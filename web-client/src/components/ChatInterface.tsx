/**
 * Main Chat Interface Component
 */

import { useState, useRef, useEffect } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { ConnectionStatus } from './ConnectionStatus'

export function ChatInterface() {
	const wsUrl = import.meta.env.DEV
		? 'ws://localhost:3000/ws'
		: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`

	const {
		messages,
		status,
		sessionId,
		availableModels,
		sendUserMessage,
		approveToolCall,
		switchModel,
		interrupt,
		reconnect,
	} = useWebSocket(wsUrl)

	const [currentModel, setCurrentModel] = useState<string>('')
	const messagesEndRef = useRef<HTMLDivElement>(null)

	// Auto-scroll to bottom when new messages arrive
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [messages])

	// Set initial model
	useEffect(() => {
		if (availableModels.length > 0 && !currentModel) {
			setCurrentModel(availableModels[0])
		}
	}, [availableModels, currentModel])

	const handleModelChange = (modelId: string) => {
		setCurrentModel(modelId)
		switchModel(modelId)
	}

	return (
		<div className="chat-interface">
			<header className="header">
				<h1>Kode - AI Coding Assistant</h1>
				<ConnectionStatus
					status={status}
					sessionId={sessionId}
					currentModel={currentModel}
					availableModels={availableModels}
					onModelChange={handleModelChange}
					onReconnect={reconnect}
				/>
			</header>

			<div className="messages-container">
				<MessageList
					messages={messages}
					onApproveToolCall={approveToolCall}
				/>
				<div ref={messagesEndRef} />
			</div>

			<ChatInput
				onSend={sendUserMessage}
				onInterrupt={interrupt}
				disabled={status !== 'connected'}
				isProcessing={
					messages[messages.length - 1]?.role === 'user' &&
					messages[messages.length - 1]?.content !== ''
				}
			/>
		</div>
	)
}
