/**
 * WebSocket Hook for managing connection and message handling
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type {
	ClientMessage,
	ServerMessage,
	Message,
	ToolCall,
} from '../types/messages'

interface UseWebSocketReturn {
	messages: Message[]
	status: 'connecting' | 'connected' | 'disconnected' | 'error'
	sessionId: string | null
	availableModels: string[]
	send: (message: ClientMessage) => void
	sendUserMessage: (content: string) => void
	approveToolCall: (toolCallId: string, approved: boolean) => void
	switchModel: (modelId: string) => void
	interrupt: () => void
	reconnect: () => void
}

export function useWebSocket(url: string): UseWebSocketReturn {
	const [messages, setMessages] = useState<Message[]>([])
	const [status, setStatus] = useState<UseWebSocketReturn['status']>('connecting')
	const [sessionId, setSessionId] = useState<string | null>(null)
	const [availableModels, setAvailableModels] = useState<string[]>([])

	const ws = useRef<WebSocket | null>(null)
	const reconnectTimeout = useRef<NodeJS.Timeout>()
	const currentAssistantMessage = useRef<Message | null>(null)
	const conversationId = useRef<string>('main')

	// Handle incoming server messages
	const handleServerMessage = useCallback((msg: ServerMessage) => {
		switch (msg.type) {
			case 'session_init':
				setSessionId(msg.sessionId)
				setAvailableModels(msg.availableModels)
				console.log(`Session initialized: ${msg.sessionId}`)
				break

			case 'text_delta':
				// Append to current assistant message
				setMessages((prev) => {
					const last = prev[prev.length - 1]
					if (last && last.role === 'assistant' && !last.toolCalls?.length) {
						return [
							...prev.slice(0, -1),
							{ ...last, content: last.content + msg.content },
						]
					} else {
						// Start new assistant message
						const newMsg: Message = {
							id: Date.now().toString(),
							role: 'assistant',
							content: msg.content,
							timestamp: new Date(),
						}
						currentAssistantMessage.current = newMsg
						return [...prev, newMsg]
					}
				})
				break

			case 'tool_call_start':
				setMessages((prev) => {
					const last = prev[prev.length - 1]
					const toolCall: ToolCall = {
						id: msg.toolCallId,
						tool: msg.tool,
						params: msg.params,
						status: 'running',
					}

					if (last && last.role === 'assistant') {
						return [
							...prev.slice(0, -1),
							{
								...last,
								toolCalls: [...(last.toolCalls || []), toolCall],
							},
						]
					}
					return prev
				})
				break

			case 'tool_call_progress':
				setMessages((prev) => {
					const updated = [...prev]
					const lastMsg = updated[updated.length - 1]
					if (lastMsg?.toolCalls) {
						lastMsg.toolCalls = lastMsg.toolCalls.map((tc) =>
							tc.id === msg.toolCallId
								? { ...tc, output: (tc.output || '') + msg.output }
								: tc,
						)
					}
					return updated
				})
				break

			case 'tool_call_complete':
				setMessages((prev) => {
					const updated = [...prev]
					const lastMsg = updated[updated.length - 1]
					if (lastMsg?.toolCalls) {
						lastMsg.toolCalls = lastMsg.toolCalls.map((tc) =>
							tc.id === msg.toolCallId
								? { ...tc, status: 'completed', result: msg.result }
								: tc,
						)
					}
					return updated
				})
				break

			case 'permission_request':
				setMessages((prev) => {
					const updated = [...prev]
					const lastMsg = updated[updated.length - 1]
					if (lastMsg?.toolCalls) {
						lastMsg.toolCalls = lastMsg.toolCalls.map((tc) =>
							tc.id === msg.toolCallId
								? { ...tc, status: 'pending', needsApproval: true }
								: tc,
						)
					}
					return updated
				})
				break

			case 'assistant_complete':
				currentAssistantMessage.current = null
				break

			case 'error':
				console.error('Server error:', msg.error, msg.details)
				setMessages((prev) => [
					...prev,
					{
						id: Date.now().toString(),
						role: 'system',
						content: `Error: ${msg.error}`,
						timestamp: new Date(),
					},
				])
				break

			case 'thinking':
				// Optional: Show thinking indicator
				console.log('AI thinking:', msg.content)
				break
		}
	}, [])

	// Connect to WebSocket
	const connect = useCallback(() => {
		if (ws.current?.readyState === WebSocket.OPEN) return

		setStatus('connecting')
		ws.current = new WebSocket(url)

		ws.current.onopen = () => {
			console.log('WebSocket connected')
			setStatus('connected')
		}

		ws.current.onmessage = (event) => {
			try {
				const msg: ServerMessage = JSON.parse(event.data)
				handleServerMessage(msg)
			} catch (error) {
				console.error('Failed to parse message:', error)
			}
		}

		ws.current.onerror = (error) => {
			console.error('WebSocket error:', error)
			setStatus('error')
		}

		ws.current.onclose = () => {
			console.log('WebSocket disconnected')
			setStatus('disconnected')

			// Auto-reconnect after 3 seconds
			reconnectTimeout.current = setTimeout(() => {
				console.log('Attempting to reconnect...')
				connect()
			}, 3000)
		}
	}, [url, handleServerMessage])

	// Initialize connection
	useEffect(() => {
		connect()

		return () => {
			if (reconnectTimeout.current) {
				clearTimeout(reconnectTimeout.current)
			}
			ws.current?.close()
		}
	}, [connect])

	// Send message
	const send = useCallback((message: ClientMessage) => {
		if (ws.current?.readyState === WebSocket.OPEN) {
			ws.current.send(JSON.stringify(message))
		} else {
			console.error('WebSocket is not connected')
		}
	}, [])

	// Send user message
	const sendUserMessage = useCallback(
		(content: string) => {
			// Add user message to UI
			setMessages((prev) => [
				...prev,
				{
					id: Date.now().toString(),
					role: 'user',
					content,
					timestamp: new Date(),
				},
			])

			// Send to server
			send({
				type: 'user_input',
				content,
				conversationId: conversationId.current,
			})
		},
		[send],
	)

	// Approve tool call
	const approveToolCall = useCallback(
		(toolCallId: string, approved: boolean) => {
			send({
				type: 'tool_approval',
				approved,
				toolCallId,
			})
		},
		[send],
	)

	// Switch model
	const switchModel = useCallback(
		(modelId: string) => {
			send({
				type: 'switch_model',
				modelId,
			})
		},
		[send],
	)

	// Interrupt current request
	const interrupt = useCallback(() => {
		send({
			type: 'interrupt',
			conversationId: conversationId.current,
		})
	}, [send])

	return {
		messages,
		status,
		sessionId,
		availableModels,
		send,
		sendUserMessage,
		approveToolCall,
		switchModel,
		interrupt,
		reconnect: connect,
	}
}
