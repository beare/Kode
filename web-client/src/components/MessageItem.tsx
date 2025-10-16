/**
 * Individual Message Component
 */

import type { Message } from '../types/messages'
import { ToolCallView } from './ToolCallView'

interface MessageItemProps {
	message: Message
	onApproveToolCall: (toolCallId: string, approved: boolean) => void
}

export function MessageItem({ message, onApproveToolCall }: MessageItemProps) {
	const roleClass = `message-${message.role}`

	return (
		<div className={`message ${roleClass}`}>
			<div className="message-header">
				<span className="message-role">{message.role}</span>
				<span className="message-time">
					{message.timestamp.toLocaleTimeString()}
				</span>
			</div>

			{message.content && (
				<div className="message-content">
					<pre>{message.content}</pre>
				</div>
			)}

			{message.toolCalls && message.toolCalls.length > 0 && (
				<div className="tool-calls">
					{message.toolCalls.map((toolCall) => (
						<ToolCallView
							key={toolCall.id}
							toolCall={toolCall}
							onApprove={onApproveToolCall}
						/>
					))}
				</div>
			)}
		</div>
	)
}
