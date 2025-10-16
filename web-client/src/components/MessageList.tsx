/**
 * Message List Component - Displays conversation messages
 */

import type { Message } from '../types/messages'
import { MessageItem } from './MessageItem'

interface MessageListProps {
	messages: Message[]
	onApproveToolCall: (toolCallId: string, approved: boolean) => void
}

export function MessageList({ messages, onApproveToolCall }: MessageListProps) {
	return (
		<div className="message-list">
			{messages.map((message) => (
				<MessageItem
					key={message.id}
					message={message}
					onApproveToolCall={onApproveToolCall}
				/>
			))}
		</div>
	)
}
