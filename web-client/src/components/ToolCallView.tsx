/**
 * Tool Call Display Component
 */

import type { ToolCall } from '../types/messages'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface ToolCallViewProps {
	toolCall: ToolCall
	onApprove: (toolCallId: string, approved: boolean) => void
}

export function ToolCallView({ toolCall, onApprove }: ToolCallViewProps) {
	const getStatusIcon = () => {
		switch (toolCall.status) {
			case 'running':
				return <Loader2 className="animate-spin" size={16} />
			case 'completed':
				return <CheckCircle size={16} className="text-green-500" />
			case 'error':
				return <XCircle size={16} className="text-red-500" />
			default:
				return null
		}
	}

	return (
		<div className={`tool-call tool-call-${toolCall.status}`}>
			<div className="tool-call-header">
				{getStatusIcon()}
				<span className="tool-name">{toolCall.tool}</span>
			</div>

			<div className="tool-params">
				<details>
					<summary>Parameters</summary>
					<pre>{JSON.stringify(toolCall.params, null, 2)}</pre>
				</details>
			</div>

			{toolCall.needsApproval && toolCall.status === 'pending' && (
				<div className="tool-approval">
					<p>This tool requires your approval to execute.</p>
					<div className="approval-buttons">
						<button
							className="btn btn-approve"
							onClick={() => onApprove(toolCall.id, true)}
						>
							Approve
						</button>
						<button
							className="btn btn-deny"
							onClick={() => onApprove(toolCall.id, false)}
						>
							Deny
						</button>
					</div>
				</div>
			)}

			{toolCall.output && (
				<div className="tool-output">
					<details open={toolCall.status === 'running'}>
						<summary>Output</summary>
						<pre>{toolCall.output}</pre>
					</details>
				</div>
			)}

			{toolCall.result && toolCall.status === 'completed' && (
				<div className="tool-result">
					<details>
						<summary>Result</summary>
						<pre>{JSON.stringify(toolCall.result, null, 2)}</pre>
					</details>
				</div>
			)}
		</div>
	)
}
