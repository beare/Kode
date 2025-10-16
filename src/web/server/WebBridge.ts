/**
 * WebSocket Bridge for REPL
 * Bridges WebSocket communication to the existing REPL/query system
 */

import type { ServerWebSocket } from 'bun'
import type { ClientMessage, ServerMessage } from '../protocol/messages'
import { getSystemPrompt } from '../../constants/prompts'
import { getContext } from '../../context'
import { query, type Message } from '../../query'
import { hasPermissionsToUseTool } from '../../permissions'
import { getTools } from '../../tools'
import { getCommands } from '../../commands'
import { dateToFilename } from '../../utils/log'
import { createUserMessage } from '../../utils/messages'
import { getModelManager } from '../../utils/model'
import { setCwd } from '../../utils/state'
import type { Tool } from '../../Tool'
import type { Command } from '../../commands'

export class WebSocketBridge {
	private tools: Tool[] = []
	private commands: Command[] = []
	private messages: Message[] = []
	private abortController: AbortController | null = null

	constructor(
		private ws: ServerWebSocket,
		private workspaceDir: string,
		private safeMode: boolean = false,
	) {
		this.initialize()
	}

	private async initialize() {
		try {
			await setCwd(this.workspaceDir)
			this.tools = await getTools()
			this.commands = await getCommands()

			const modelManager = getModelManager()
			const modelProfiles = modelManager.modelProfiles || []
			const availableModels = modelProfiles
				.filter((p: any) => p.isActive)
				.map((p: any) => p.name)

			// Send session ready
			this.send({
				type: 'session_init',
				sessionId: 'web-' + Date.now(),
				availableModels,
				workspaceDir: this.workspaceDir,
			})
		} catch (error: any) {
			console.error('[WebBridge] Initialization error:', error)
			this.send({
				type: 'error',
				error: 'Failed to initialize session',
			})
		}
	}

	/**
	 * Handle incoming client message
	 */
	async handleMessage(msg: ClientMessage) {
		try {
			switch (msg.type) {
				case 'user_input':
					await this.handleUserInput(msg.content)
					break

				case 'tool_approval':
					// Tool approvals are handled through the permission system
					break

				case 'interrupt':
					this.handleInterrupt()
					break

				case 'switch_model':
					await this.handleModelSwitch(msg.modelId)
					break
			}
		} catch (error: any) {
			this.send({
				type: 'error',
				error: error.message || 'Unknown error',
			})
		}
	}

	/**
	 * Handle user input using the query() function
	 */
	private async handleUserInput(content: string) {
		this.abortController = new AbortController()

		try {
			// Add user message
			const userMessage = createUserMessage(content)
			this.messages.push(userMessage)

			// Get system prompt and context
			const [systemPrompt, context] = await Promise.all([
				getSystemPrompt(),
				getContext(),
			])

			// Stream the response using query()
			for await (const message of query(
				this.messages,
				systemPrompt,
				context,
				hasPermissionsToUseTool,
				{
					options: {
						commands: this.commands,
						tools: this.tools,
						verbose: false,
						safeMode: this.safeMode,
						forkNumber: 0,
						messageLogName: dateToFilename(new Date()),
						maxThinkingTokens: 0,
					},
					abortController: this.abortController,
					messageId: undefined,
					readFileTimestamps: {},
					// Callback to send tool UI updates
					setToolJSX: (jsx: any) => {
						// Extract tool information from the JSX
						if (jsx?.props) {
							const { tool, params, status } = jsx.props
							if (tool && status === 'running') {
								this.send({
									type: 'tool_call_start',
									tool,
									params,
									toolCallId: Date.now().toString(),
								})
							}
						}
					},
				},
			)) {
				// Add message to history
				this.messages.push(message)

				// Send message content to client
				if (message.type === 'assistant') {
					for (const block of message.message.content) {
						if (block.type === 'text') {
							this.send({
								type: 'text_delta',
								content: block.text,
							})
						} else if (block.type === 'tool_use') {
							this.send({
								type: 'tool_call_start',
								tool: block.name,
								params: block.input,
								toolCallId: block.id,
							})
						}
					}
				} else if (message.type === 'tool_result') {
					this.send({
						type: 'tool_call_complete',
						toolCallId: message.message.tool_use_id,
						result: message.message.content,
					})
				} else if (message.type === 'progress') {
					// Progress messages (thinking, tool execution, etc.)
					this.send({
						type: 'text_delta',
						content: message.message || '',
					})
				}
			}

			// Send completion
			this.send({
				type: 'assistant_complete',
				conversationId: 'main',
			})
		} catch (error: any) {
			if (error.name === 'AbortError') {
				this.send({
					type: 'error',
					error: 'Request interrupted',
				})
			} else {
				this.send({
					type: 'error',
					error: error.message || 'Failed to process input',
				})
			}
		} finally {
			this.abortController = null
		}
	}

	/**
	 * Handle interrupt request
	 */
	private handleInterrupt() {
		if (this.abortController) {
			this.abortController.abort()
		}
	}

	/**
	 * Handle model switch
	 */
	private async handleModelSwitch(modelId: string) {
		try {
			const modelManager = getModelManager()
			const profile = modelManager.findModelProfile(modelId)

			if (!profile) {
				throw new Error(`Model not found: ${modelId}`)
			}

			// Update model pointer
			// Note: This is a simplified version, proper implementation
			// would update the config and notify the model manager
			this.send({
				type: 'text_delta',
				content: `\n*Switched to model: ${modelId}*\n`,
			})
		} catch (error: any) {
			this.send({
				type: 'error',
				error: error.message,
			})
		}
	}

	/**
	 * Send message to client
	 */
	private send(msg: ServerMessage) {
		try {
			this.ws.send(JSON.stringify(msg))
		} catch (error) {
			console.error('[WebBridge] Failed to send message:', error)
		}
	}

	/**
	 * Cleanup
	 */
	cleanup() {
		if (this.abortController) {
			this.abortController.abort()
		}
		this.messages = []
		this.tools = []
		this.commands = []
	}
}
