/**
 * Session Manager - Handles user sessions and workspace isolation
 */

import { randomUUID } from 'crypto'
import type { Anthropic } from '@anthropic-ai/sdk'
import { ModelManager } from '../../utils/model'
import { getGlobalConfig } from '../../utils/config'

export interface Session {
	id: string
	userId: string
	workspaceDir: string
	conversationHistory: Anthropic.MessageParam[]
	modelManager: ModelManager
	createdAt: Date
	lastActivity: Date
	metadata?: Record<string, any>
}

export class SessionManager {
	private sessions = new Map<string, Session>()
	private userSessions = new Map<string, Set<string>>() // userId -> sessionIds
	private cleanupInterval: Timer | null = null

	constructor() {
		// Start cleanup task every 15 minutes
		this.startCleanupTask()
	}

	/**
	 * Create a new session for a user
	 */
	async createSession(userId: string, workspaceDir: string): Promise<string> {
		const sessionId = randomUUID()
		const config = await getGlobalConfig()

		const session: Session = {
			id: sessionId,
			userId,
			workspaceDir,
			conversationHistory: [],
			modelManager: new ModelManager(config),
			createdAt: new Date(),
			lastActivity: new Date(),
		}

		this.sessions.set(sessionId, session)

		if (!this.userSessions.has(userId)) {
			this.userSessions.set(userId, new Set())
		}
		this.userSessions.get(userId)!.add(sessionId)

		return sessionId
	}

	/**
	 * Get a session by ID and update last activity
	 */
	getSession(sessionId: string): Session | undefined {
		const session = this.sessions.get(sessionId)
		if (session) {
			session.lastActivity = new Date()
		}
		return session
	}

	/**
	 * Update session metadata
	 */
	updateSession(sessionId: string, updates: Partial<Session>): boolean {
		const session = this.sessions.get(sessionId)
		if (!session) return false

		Object.assign(session, updates)
		session.lastActivity = new Date()
		return true
	}

	/**
	 * Delete a session
	 */
	deleteSession(sessionId: string): boolean {
		const session = this.sessions.get(sessionId)
		if (!session) return false

		this.sessions.delete(sessionId)
		this.userSessions.get(session.userId)?.delete(sessionId)
		return true
	}

	/**
	 * Get all sessions for a user
	 */
	getUserSessions(userId: string): Session[] {
		const sessionIds = this.userSessions.get(userId) || new Set()
		return Array.from(sessionIds)
			.map((id) => this.sessions.get(id))
			.filter((s): s is Session => s !== undefined)
	}

	/**
	 * Clean up inactive sessions (no activity for 1 hour)
	 */
	cleanupInactiveSessions(): number {
		const timeout = 60 * 60 * 1000 // 1 hour
		const now = Date.now()
		let cleanedCount = 0

		for (const [id, session] of this.sessions) {
			if (now - session.lastActivity.getTime() > timeout) {
				this.deleteSession(id)
				cleanedCount++
			}
		}

		return cleanedCount
	}

	/**
	 * Start periodic cleanup task
	 */
	private startCleanupTask(): void {
		this.cleanupInterval = setInterval(() => {
			const cleaned = this.cleanupInactiveSessions()
			if (cleaned > 0) {
				console.log(`[SessionManager] Cleaned up ${cleaned} inactive sessions`)
			}
		}, 15 * 60 * 1000) // Every 15 minutes
	}

	/**
	 * Stop cleanup task
	 */
	stopCleanupTask(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval)
			this.cleanupInterval = null
		}
	}

	/**
	 * Get statistics about sessions
	 */
	getStats() {
		return {
			totalSessions: this.sessions.size,
			totalUsers: this.userSessions.size,
			sessionsByUser: Array.from(this.userSessions.entries()).map(
				([userId, sessions]) => ({
					userId,
					sessionCount: sessions.size,
				}),
			),
		}
	}
}
