/**
 * Chat Input Component
 */

import { useState, useRef, useEffect } from 'react'
import { Send, StopCircle } from 'lucide-react'

interface ChatInputProps {
	onSend: (message: string) => void
	onInterrupt: () => void
	disabled: boolean
	isProcessing: boolean
}

export function ChatInput({
	onSend,
	onInterrupt,
	disabled,
	isProcessing,
}: ChatInputProps) {
	const [input, setInput] = useState('')
	const textareaRef = useRef<HTMLTextAreaElement>(null)

	const handleSend = () => {
		if (!input.trim() || disabled) return

		onSend(input)
		setInput('')

		// Reset textarea height
		if (textareaRef.current) {
			textareaRef.current.style.height = 'auto'
		}
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault()
			handleSend()
		}
	}

	// Auto-resize textarea
	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = 'auto'
			textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
		}
	}, [input])

	// Focus on mount
	useEffect(() => {
		textareaRef.current?.focus()
	}, [])

	return (
		<div className="chat-input">
			<textarea
				ref={textareaRef}
				value={input}
				onChange={(e) => setInput(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={
					disabled
						? 'Connecting...'
						: 'Type your message... (Cmd/Ctrl+Enter to send)'
				}
				disabled={disabled}
				rows={1}
			/>

			<div className="input-actions">
				{isProcessing ? (
					<button
						className="btn btn-interrupt"
						onClick={onInterrupt}
						title="Interrupt"
					>
						<StopCircle size={20} />
					</button>
				) : (
					<button
						className="btn btn-send"
						onClick={handleSend}
						disabled={disabled || !input.trim()}
						title="Send (Cmd/Ctrl+Enter)"
					>
						<Send size={20} />
					</button>
				)}
			</div>
		</div>
	)
}
