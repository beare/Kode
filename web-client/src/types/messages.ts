/**
 * Message types - matches server protocol
 */

export type ClientMessage =
	| { type: 'user_input'; content: string; conversationId: string }
	| { type: 'tool_approval'; approved: boolean; toolCallId: string }
	| { type: 'interrupt'; conversationId: string }
	| { type: 'switch_model'; modelId: string }

export type ServerMessage =
	| { type: 'thinking'; content: string }
	| { type: 'text_delta'; content: string }
	| {
			type: 'tool_call_start'
			tool: string
			params: any
			toolCallId: string
	  }
	| { type: 'tool_call_progress'; toolCallId: string; output: string }
	| { type: 'tool_call_complete'; toolCallId: string; result: any }
	| {
			type: 'permission_request'
			tool: string
			params: any
			toolCallId: string
	  }
	| { type: 'assistant_complete'; conversationId: string }
	| { type: 'error'; error: string; details?: any }
	| {
			type: 'session_init'
			sessionId: string
			availableModels: string[]
			workspaceDir: string
	  }

export interface Message {
	id: string
	role: 'user' | 'assistant' | 'system'
	content: string
	timestamp: Date
	toolCalls?: ToolCall[]
}

export interface ToolCall {
	id: string
	tool: string
	params: any
	status: 'pending' | 'running' | 'completed' | 'error'
	output?: string
	result?: any
	needsApproval?: boolean
}
