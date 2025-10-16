/**
 * WebSocket Protocol Message Definitions
 * Defines all message types for client-server communication
 */

// ============ Client -> Server Messages ============

export type ClientMessage =
	| UserInputMessage
	| ToolApprovalMessage
	| InterruptMessage
	| SwitchModelMessage

export interface UserInputMessage {
	type: 'user_input'
	content: string
	conversationId: string
}

export interface ToolApprovalMessage {
	type: 'tool_approval'
	approved: boolean
	toolCallId: string
}

export interface InterruptMessage {
	type: 'interrupt'
	conversationId: string
}

export interface SwitchModelMessage {
	type: 'switch_model'
	modelId: string
}

// ============ Server -> Client Messages ============

export type ServerMessage =
	| ThinkingMessage
	| TextDeltaMessage
	| ToolCallStartMessage
	| ToolCallProgressMessage
	| ToolCallCompleteMessage
	| PermissionRequestMessage
	| AssistantCompleteMessage
	| ErrorMessage
	| SessionInitMessage

export interface ThinkingMessage {
	type: 'thinking'
	content: string
}

export interface TextDeltaMessage {
	type: 'text_delta'
	content: string
}

export interface ToolCallStartMessage {
	type: 'tool_call_start'
	tool: string
	params: any
	toolCallId: string
}

export interface ToolCallProgressMessage {
	type: 'tool_call_progress'
	toolCallId: string
	output: string
}

export interface ToolCallCompleteMessage {
	type: 'tool_call_complete'
	toolCallId: string
	result: any
}

export interface PermissionRequestMessage {
	type: 'permission_request'
	tool: string
	params: any
	toolCallId: string
}

export interface AssistantCompleteMessage {
	type: 'assistant_complete'
	conversationId: string
}

export interface ErrorMessage {
	type: 'error'
	error: string
	details?: any
}

export interface SessionInitMessage {
	type: 'session_init'
	sessionId: string
	availableModels: string[]
	workspaceDir: string
}
