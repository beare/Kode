/**
 * Kode Web Server Entry Point
 * Provides WebSocket-based interface for web clients
 */

import type { ServerWebSocket } from 'bun'
import { WebSocketBridge } from '../web/server/WebBridge'
import type { ClientMessage } from '../web/protocol/messages'
import { existsSync } from 'fs'
import { join } from 'path'
import { enableConfigs } from '../utils/config'

// Initialize configs
try {
	enableConfigs()
} catch (error) {
	console.error('Failed to initialize configs:', error)
}

// Session storage for WebSocket connections
const wsToBridge = new Map<ServerWebSocket, WebSocketBridge>()

// Serve static files helper
function serveStaticFile(path: string): Response | null {
	const webClientDist = './web-client/dist'
	const filePath = join(webClientDist, path === '/' ? 'index.html' : path)

	if (existsSync(filePath)) {
		const file = Bun.file(filePath)
		return new Response(file)
	}

	// Fallback to index.html for client-side routing
	if (path !== '/' && !path.startsWith('/api')) {
		const indexPath = join(webClientDist, 'index.html')
		if (existsSync(indexPath)) {
			return new Response(Bun.file(indexPath))
		}
	}

	return null
}

const server = Bun.serve({
	port: process.env.PORT || 3000,

	async fetch(req, server) {
		const url = new URL(req.url)

		// Handle WebSocket upgrade
		if (url.pathname === '/ws') {
			const upgraded = server.upgrade(req)
			if (upgraded) {
				return undefined // Return undefined when upgrade is successful
			}
			return new Response('WebSocket upgrade failed', { status: 500 })
		}

		// API Routes
		if (url.pathname === '/api/health') {
			return Response.json({
				status: 'ok',
				sessions: sessionManager.getStats(),
			})
		}

		if (url.pathname === '/api/stats') {
			return Response.json(sessionManager.getStats())
		}

		// Serve static files
		const staticResponse = serveStaticFile(url.pathname)
		if (staticResponse) {
			return staticResponse
		}

		return new Response('Not Found', { status: 404 })
	},

	websocket: {
		maxPayloadLength: 16 * 1024 * 1024, // 16 MB
		idleTimeout: 120, // 120 seconds

		open(ws) {
			console.log('[WebSocket] Client connected')

			// Create bridge for this connection
			// Use current working directory instead of a non-existent workspace
			const workspaceDir = process.env.WORKSPACE_DIR || process.cwd()
			const safeMode = process.env.SAFE_MODE === 'true'

			const bridge = new WebSocketBridge(ws, workspaceDir, safeMode)
			wsToBridge.set(ws, bridge)
		},

		async message(ws, message) {
			try {
				const msg: ClientMessage = JSON.parse(message.toString())
				const bridge = wsToBridge.get(ws)

				if (!bridge) {
					console.error('[WebSocket] No bridge found for connection')
					return
				}

				// Handle the message through the bridge
				await bridge.handleMessage(msg)
			} catch (error: any) {
				console.error('[WebSocket] Error processing message:', error)
				ws.send(
					JSON.stringify({
						type: 'error',
						error: error.message,
					}),
				)
			}
		},

		close(ws) {
			const bridge = wsToBridge.get(ws)
			if (bridge) {
				bridge.cleanup()
				wsToBridge.delete(ws)
				console.log('[WebSocket] Client disconnected')
			}
		},

		error(ws, error) {
			console.error('[WebSocket] Error:', error)
			const bridge = wsToBridge.get(ws)
			if (bridge) {
				bridge.cleanup()
				wsToBridge.delete(ws)
			}
		},
	},
})

console.log(`
🚀 Kode Web Server running!

  Local:    http://localhost:${server.port}
  WebSocket: ws://localhost:${server.port}/ws
  Workspace: ${process.env.WORKSPACE_DIR || process.cwd()}

Press Ctrl+C to stop
`)

// Graceful shutdown
process.on('SIGINT', () => {
	console.log('\n\n👋 Shutting down gracefully...')
	server.stop()
	process.exit(0)
})

process.on('SIGTERM', () => {
	console.log('\n\n👋 Shutting down gracefully...')
	server.stop()
	process.exit(0)
})
