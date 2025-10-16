/**
 * Connection Status Component
 */

import { Wifi, WifiOff, RefreshCw } from 'lucide-react'

interface ConnectionStatusProps {
	status: 'connecting' | 'connected' | 'disconnected' | 'error'
	sessionId: string | null
	currentModel: string
	availableModels: string[]
	onModelChange: (modelId: string) => void
	onReconnect: () => void
}

export function ConnectionStatus({
	status,
	sessionId,
	currentModel,
	availableModels,
	onModelChange,
	onReconnect,
}: ConnectionStatusProps) {
	const getStatusColor = () => {
		switch (status) {
			case 'connected':
				return 'status-connected'
			case 'connecting':
				return 'status-connecting'
			case 'disconnected':
			case 'error':
				return 'status-error'
		}
	}

	const getStatusIcon = () => {
		switch (status) {
			case 'connected':
				return <Wifi size={16} />
			case 'connecting':
				return <RefreshCw size={16} className="animate-spin" />
			default:
				return <WifiOff size={16} />
		}
	}

	return (
		<div className="connection-status">
			<div className={`status-indicator ${getStatusColor()}`}>
				{getStatusIcon()}
				<span>{status}</span>
			</div>

			{sessionId && (
				<div className="session-info">
					<span className="session-id" title={sessionId}>
						Session: {sessionId.slice(0, 8)}...
					</span>
				</div>
			)}

			{availableModels.length > 0 && (
				<div className="model-selector">
					<label>Model:</label>
					<select
						value={currentModel}
						onChange={(e) => onModelChange(e.target.value)}
						disabled={status !== 'connected'}
					>
						{availableModels.map((model) => (
							<option key={model} value={model}>
								{model}
							</option>
						))}
					</select>
				</div>
			)}

			{(status === 'disconnected' || status === 'error') && (
				<button className="btn btn-reconnect" onClick={onReconnect}>
					<RefreshCw size={16} />
					Reconnect
				</button>
			)}
		</div>
	)
}
