/**
 * WebREPL - Core logic for handling web-based REPL interactions
 * Manages conversation flow, tool execution, and permission requests
 */

import type { Session } from './SessionManager'
import type { ClientMessage, ServerMessage } from '../protocol/messages'
import type { Tool } from '../../Tool'
import { getTools } from '../../tools'
import { queryLLM } from '../../services/claude'
import type { AssistantMessage, UserMessage } from '../../query'
import type { Anthropic } from '@anthropic-ai/sdk'

interface PendingApproval {
	resolve: (approved: boolean) => void
	timer: Timer
}

export class WebREPL {
	private pendingApprovals = new Map<string, PendingApproval>()
	private isProcessing = false
	private tools: Tool[] = []
	private abortController: AbortController | null = null

	constructor(
		private session: Session,
		private sendToClient: (msg: ServerMessage) => void,
	) {
		this.initializeTools()
	}

	private async initializeTools() {
		try {
			this.tools = await getTools()
		} catch (error) {
			console.error('[WebREPL] Failed to initialize tools:', error)
			this.tools = []
		}
	}

	/**
	 * Handle incoming client messages
	 */
	async handleClientMessage(msg: ClientMessage): Promise<void> {
		try {
			switch (msg.type) {
				case 'user_input':
					await this.processUserInput(msg.content)
					break

				case 'tool_approval':
					this.resolveApproval(msg.toolCallId, msg.approved)
					break

				case 'switch_model':
					this.switchModel(msg.modelId)
					break

				case 'interrupt':
					this.interrupt()
					break
			}
		} catch (error) {
			this.sendError(error)
		}
	}

	/**
	 * Process user input and generate AI response
	 */
	private async processUserInput(content: string): Promise<void> {
		if (this.isProcessing) {
			this.sendToClient({
				type: 'error',
				error: 'Already processing a request. Please wait or interrupt.',
			})
			return
		}

		this.isProcessing = true
		this.abortController = new AbortController()

		try {
			// Convert conversation history to the format expected by queryLLM
			const messages: (UserMessage | AssistantMessage)[] = []

			for (const msg of this.session.conversationHistory) {
				if (msg.role === 'user') {
					messages.push({
						role: 'user',
						content: typeof msg.content === 'string' ? msg.content : '',
					})
				} else if (msg.role === 'assistant') {
					const assistantMsg: AssistantMessage = {
						role: 'assistant',
						content: Array.isArray(msg.content) ? msg.content : [],
					}
					messages.push(assistantMsg)
				}
			}

			// Add the new user message
			messages.push({
				role: 'user',
				content,
			})

			// Get current model
			const currentModelName = this.session.modelManager.getCurrentModel()
			if (!currentModelName) {
				throw new Error('No model configured')
			}

			// Prepare system prompt (empty for now, can be customized)
			const systemPrompt: string[] = [
				'You are a helpful AI coding assistant running in a web interface.',
				'You have access to various tools to help with coding tasks.',
			]

			// Call the LLM with streaming disabled for now (we'll handle streaming later)
			const response = await queryLLM(
				messages,
				systemPrompt,
				0, // maxThinkingTokens
				this.tools,
				this.abortController.signal,
				{
					safeMode: false,
					model: currentModelName,
					prependCLISysprompt: false,
				},
			)

			// Process the response
			await this.processAssistantResponse(response)

			// Add to conversation history
			this.session.conversationHistory.push({
				role: 'assistant',
				content: response.content,
			})

			this.sendToClient({
				type: 'assistant_complete',
				conversationId: this.session.id,
			})
		} catch (error) {
			if (error.name === 'AbortError') {
				this.sendToClient({
					type: 'error',
					error: 'Request interrupted by user',
				})
			} else {
				this.sendError(error)
			}
		} finally {
			this.isProcessing = false
			this.abortController = null
		}
	}

	/**
	 * Process assistant response and send to client
	 */
	private async processAssistantResponse(
		response: AssistantMessage,
	): Promise<void> {
		for (const block of response.content) {
			if (block.type === 'text') {
				// Send text content
				this.sendToClient({
					type: 'text_delta',
					content: block.text,
				})
			} else if (block.type === 'tool_use') {
				// Handle tool execution
				const result = await this.handleToolCall(block)

				// Add tool result to conversation history
				// This will be needed for the next turn if there are tool uses
			}
		}
	}

	/**
	 * Handle tool execution
	 */
	private async handleToolCall(
		toolUse: Anthropic.ToolUseBlock,
	): Promise<Anthropic.ToolResultBlockParam> {
		const tool = this.tools.find((t) => t.name === toolUse.name)
		if (!tool) {
			this.sendToClient({
				type: 'tool_call_complete',
				toolCallId: toolUse.id,
				result: { error: `Tool not found: ${toolUse.name}` },
			})

			return {
				type: 'tool_result',
				tool_use_id: toolUse.id,
				content: `Tool not found: ${toolUse.name}`,
				is_error: true,
			}
		}

		const toolCallId = toolUse.id

		this.sendToClient({
			type: 'tool_call_start',
			tool: toolUse.name,
			params: toolUse.input,
			toolCallId,
		})

		// Request permission if needed (for now, auto-approve read-only tools)
		const isReadOnly = tool.isReadOnly()
		const approved = isReadOnly || await this.requestPermission(
			toolCallId,
			toolUse.name,
			toolUse.input,
		)

		if (!approved) {
			this.sendToClient({
				type: 'tool_call_complete',
				toolCallId,
				result: { error: 'Permission denied by user' },
			})
			return {
				type: 'tool_result',
				tool_use_id: toolUse.id,
				content: 'Permission denied by user',
				is_error: true,
			}
		}

		// Execute tool
		try {
			const result = await tool.execute(toolUse.input, {
				workingDirectory: this.session.workspaceDir,
			})

			this.sendToClient({
				type: 'tool_call_complete',
				toolCallId,
				result,
			})

			return {
				type: 'tool_result',
				tool_use_id: toolUse.id,
				content:
					typeof result === 'string' ? result : JSON.stringify(result),
			}
		} catch (error: any) {
			this.sendToClient({
				type: 'tool_call_complete',
				toolCallId,
				result: { error: error.message },
			})

			return {
				type: 'tool_result',
				tool_use_id: toolUse.id,
				content: error.message,
				is_error: true,
			}
		}
	}

	/**
	 * Request permission from user for tool execution
	 */
	private async requestPermission(
		toolCallId: string,
		toolName: string,
		params: any,
	): Promise<boolean> {
		this.sendToClient({
			type: 'permission_request',
			tool: toolName,
			params,
			toolCallId,
		})

		return new Promise((resolve) => {
			// Set 30 second timeout
			const timer = setTimeout(() => {
				this.pendingApprovals.delete(toolCallId)
				resolve(false)
			}, 30000)

			this.pendingApprovals.set(toolCallId, { resolve, timer })
		})
	}

	/**
	 * Resolve a pending approval
	 */
	private resolveApproval(toolCallId: string, approved: boolean): void {
		const pending = this.pendingApprovals.get(toolCallId)
		if (pending) {
			clearTimeout(pending.timer)
			pending.resolve(approved)
			this.pendingApprovals.delete(toolCallId)
		}
	}

	/**
	 * Switch to a different model
	 */
	private switchModel(modelId: string): void {
		try {
			// Find the model profile
			const profile = this.session.modelManager.findModelProfile(modelId)
			if (!profile) {
				throw new Error(`Model profile not found: ${modelId}`)
			}

			// Update current model via model pointer
			const config = this.session.modelManager as any
			if (config.config?.modelPointers) {
				config.config.modelPointers.main = modelId
			}

			this.sendToClient({
				type: 'text_delta',
				content: `\n*Switched to model: ${modelId}*\n`,
			})
		} catch (error) {
			this.sendError(error)
		}
	}

	/**
	 * Interrupt current processing
	 */
	private interrupt(): void {
		if (this.abortController) {
			this.abortController.abort()
		}
		this.isProcessing = false
	}

	/**
	 * Send error to client
	 */
	private sendError(error: any): void {
		this.sendToClient({
			type: 'error',
			error: error.message || 'Unknown error',
			details: error.stack,
		})
	}

	/**
	 * Cleanup resources
	 */
	cleanup(): void {
		// Clear all pending approvals
		for (const [id, pending] of this.pendingApprovals) {
			clearTimeout(pending.timer)
			pending.resolve(false)
		}
		this.pendingApprovals.clear()
		this.isProcessing = false

		if (this.abortController) {
			this.abortController.abort()
			this.abortController = null
		}
	}
}
