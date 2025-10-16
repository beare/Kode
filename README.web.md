# Kode Web - Web-based AI Coding Assistant

A fully server-side web version of Kode that provides a browser-based interface while maintaining all the power of the CLI version.

## Architecture

**Complete Server-Side Architecture:**
- All AI processing, tool execution, and file operations happen on the server
- WebSocket-based real-time communication
- Browser only handles UI rendering and user interaction
- Full security through server-side sandboxing

## Quick Start

### Development

1. **Install dependencies:**
   ```bash
   bun install
   cd web-client && bun install && cd ..
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

3. **Run in development mode:**
   ```bash
   # Run both server and client with hot reload
   bun run dev:all

   # Or run separately:
   bun run dev:web      # Server on :3000
   bun run dev:client   # Client on :5173
   ```

4. **Access the application:**
   - Development: http://localhost:5173 (proxies to :3000)
   - Production: http://localhost:3000

### Production Deployment

#### Option 1: Docker (Recommended)

```bash
# Build and run with Docker Compose
docker-compose -f docker-compose.web.yml up -d

# Or use npm scripts
bun run docker:build
bun run docker:run
```

#### Option 2: Manual Build

```bash
# Build both server and client
bun run build:web

# Run the server
bun run dist/entrypoints/server.js
```

## Project Structure

```
Kode/
├── src/
│   ├── entrypoints/
│   │   ├── cli.tsx              # CLI entry point
│   │   └── server.ts            # Web server entry point
│   ├── web/
│   │   ├── server/
│   │   │   ├── SessionManager.ts   # Session management
│   │   │   └── WebREPL.ts          # Core REPL logic
│   │   └── protocol/
│   │       └── messages.ts         # WebSocket protocol
│   └── tools/                   # Shared tools (reused from CLI)
│
└── web-client/                  # React frontend
    ├── src/
    │   ├── components/          # UI components
    │   ├── hooks/
    │   │   └── useWebSocket.ts  # WebSocket client
    │   └── types/
    └── package.json
```

## Key Features

### Server-Side Processing
- ✅ All tool execution on server
- ✅ Direct file system access
- ✅ Bash command execution
- ✅ Full AI model support
- ✅ MCP tool integration

### Real-Time Communication
- ✅ WebSocket-based streaming
- ✅ Live tool execution progress
- ✅ Permission request/approval flow
- ✅ Model switching
- ✅ Auto-reconnection

### Security
- 🔒 All operations sandboxed on server
- 🔒 Permission-based tool access
- 🔒 Workspace isolation per session
- 🔒 Configurable API key management

## Configuration

### Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx

# Optional
PORT=3000
WORKSPACE_DIR=/workspace
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

### Workspace Configuration

The server operates on a workspace directory that can be:
- Mounted volume in Docker: `./workspace:/workspace`
- Local directory: Set via `WORKSPACE_DIR` environment variable
- Default: Current working directory

### Model Configuration

Models are configured in `~/.kode.json` (same as CLI version):

```json
{
  "modelProfiles": [
    {
      "name": "claude-sonnet",
      "modelName": "claude-sonnet-4-20250514",
      "apiKey": "sk-ant-xxx",
      "isActive": true
    }
  ],
  "modelPointers": {
    "main": "claude-sonnet"
  }
}
```

## Development Scripts

```bash
# Development
bun run dev:web          # Start web server only
bun run dev:client       # Start frontend only
bun run dev:all          # Start both (recommended)

# Building
bun run build            # Build CLI version
bun run build:web        # Build web version (server + client)

# Docker
bun run docker:build     # Build Docker image
bun run docker:run       # Run with docker-compose
bun run docker:stop      # Stop containers

# Testing
bun test                 # Run tests
bun run typecheck        # Type checking
```

## API Endpoints

### HTTP Endpoints
- `GET /` - Serve web client
- `GET /api/health` - Health check
- `GET /api/stats` - Session statistics

### WebSocket Protocol
- `ws://localhost:3000/ws` - Main WebSocket connection

**Client → Server Messages:**
```typescript
{ type: 'user_input', content: string, conversationId: string }
{ type: 'tool_approval', approved: boolean, toolCallId: string }
{ type: 'switch_model', modelId: string }
{ type: 'interrupt', conversationId: string }
```

**Server → Client Messages:**
```typescript
{ type: 'session_init', sessionId: string, availableModels: string[] }
{ type: 'text_delta', content: string }
{ type: 'tool_call_start', tool: string, params: any }
{ type: 'tool_call_complete', toolCallId: string, result: any }
{ type: 'permission_request', tool: string, params: any }
{ type: 'assistant_complete', conversationId: string }
{ type: 'error', error: string }
```

## Deployment Considerations

### Resource Requirements
- **Memory**: 512MB minimum, 2GB recommended
- **CPU**: 1 core minimum, 2+ cores recommended
- **Storage**: Depends on workspace size

### Scaling
- Each WebSocket connection = 1 session
- Sessions auto-cleanup after 1 hour of inactivity
- Consider connection limits for production

### Security Best Practices
1. Use environment variables for API keys
2. Run in isolated Docker container
3. Mount workspace as read-only if possible
4. Implement authentication (not included by default)
5. Use HTTPS/WSS in production
6. Set up firewall rules

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Configure proper CORS origins
- [ ] Set up HTTPS/WSS certificates
- [ ] Implement user authentication
- [ ] Set up monitoring and logging
- [ ] Configure resource limits
- [ ] Set up automated backups
- [ ] Test disaster recovery

## Troubleshooting

### WebSocket Connection Issues
```bash
# Check if server is running
curl http://localhost:3000/api/health

# Check WebSocket connection
wscat -c ws://localhost:3000/ws
```

### Build Issues
```bash
# Clean and rebuild
rm -rf dist web-client/dist
bun install
bun run build:web
```

### Docker Issues
```bash
# Check logs
docker-compose -f docker-compose.web.yml logs -f

# Rebuild from scratch
docker-compose -f docker-compose.web.yml down -v
bun run docker:build
```

## Differences from CLI Version

| Feature | CLI | Web |
|---------|-----|-----|
| Interface | Terminal | Browser |
| Tool Execution | Local process | Server-side |
| File Access | Direct | Server filesystem |
| Authentication | None | Configurable |
| Multi-user | No | Yes (via sessions) |
| Persistence | Local history | Server sessions |

## Contributing

Same contribution guidelines as the main Kode project. When adding features:
1. Implement in `src/` for shared logic
2. Add server handling in `src/web/server/`
3. Add UI components in `web-client/src/`
4. Update protocol if needed

## License

Same as Kode: Apache-2.0

## Support

- Issues: https://github.com/beare/znbai/issues
- Main README: [../README.md](../README.md)
- Claude Instructions: [../CLAUDE.md](../CLAUDE.md)
