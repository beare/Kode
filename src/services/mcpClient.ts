import { zipObject } from 'lodash-es'
import {
  getCurrentProjectConfig,
  McpServerConfig,
  saveCurrentProjectConfig,
  getGlobalConfig,
  saveGlobalConfig,
  getMcprcConfig,
  addMcprcServerForTesting,
  removeMcprcServerForTesting,
} from '@utils/config'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getCwd } from '@utils/state'
import { safeParseJSON } from '@utils/json'
import {
  ImageBlockParam,
  MessageParam,
  ToolResultBlockParam,
} from '@anthropic-ai/sdk/resources/index.mjs'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import {
  CallToolResultSchema,
  ClientRequest,
  ListPromptsResult,
  ListPromptsResultSchema,
  ListToolsResult,
  ListToolsResultSchema,
  Result,
  ResultSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { memoize, pickBy } from 'lodash-es'
import type { Tool } from '@tool'
import { MCPTool, formatMCPToolUseMessage } from '@tools/MCPTool/MCPTool'
import { logMCPError } from '@utils/log'
import { Command } from '@commands'
import { PRODUCT_COMMAND } from '@constants/product'

type McpName = string

/**
 * Format timestamp for MCP logs
 */
function getTimestamp(): string {
  const now = new Date()
  return now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

/**
 * Log MCP info message with timestamp
 */
function logMCPInfo(serverName: string, message: string): void {
  console.log(`[${getTimestamp()}] [MCP:${serverName}] ${message}`)
}

export function parseEnvVars(
  rawEnvArgs: string[] | undefined,
): Record<string, string> {
  const parsedEnv: Record<string, string> = {}

  // Parse individual env vars
  if (rawEnvArgs) {
    for (const envStr of rawEnvArgs) {
      const [key, ...valueParts] = envStr.split('=')
      if (!key || valueParts.length === 0) {
        throw new Error(
          `Invalid environment variable format: ${envStr}, environment variables should be added as: -e KEY1=value1 -e KEY2=value2`,
        )
      }
      parsedEnv[key] = valueParts.join('=')
    }
  }
  return parsedEnv
}

const VALID_SCOPES = ['project', 'global', 'mcprc'] as const
type ConfigScope = (typeof VALID_SCOPES)[number]
const EXTERNAL_SCOPES = ['project', 'global'] as ConfigScope[]

export function ensureConfigScope(scope?: string): ConfigScope {
  if (!scope) return 'project'

  const scopesToCheck =
    process.env.USER_TYPE === 'external' ? EXTERNAL_SCOPES : VALID_SCOPES

  if (!scopesToCheck.includes(scope as ConfigScope)) {
    throw new Error(
      `Invalid scope: ${scope}. Must be one of: ${scopesToCheck.join(', ')}`,
    )
  }

  return scope as ConfigScope
}

export function addMcpServer(
  name: McpName,
  server: McpServerConfig,
  scope: ConfigScope = 'project',
): void {
  if (scope === 'mcprc') {
    if (process.env.NODE_ENV === 'test') {
      addMcprcServerForTesting(name, server)
    } else {
      const mcprcPath = join(getCwd(), '.mcprc')
      let mcprcConfig: Record<string, McpServerConfig> = {}

      // Read existing config if present
      if (existsSync(mcprcPath)) {
        try {
          const mcprcContent = readFileSync(mcprcPath, 'utf-8')
          const existingConfig = safeParseJSON(mcprcContent)
          if (existingConfig && typeof existingConfig === 'object') {
            mcprcConfig = existingConfig as Record<string, McpServerConfig>
          }
        } catch {
          // If we can't read/parse, start with empty config
        }
      }

      // Add the server
      mcprcConfig[name] = server

      // Write back to .mcprc
      try {
        writeFileSync(mcprcPath, JSON.stringify(mcprcConfig, null, 2), 'utf-8')
      } catch (error) {
        throw new Error(`Failed to write to .mcprc: ${error}`)
      }
    }
  } else if (scope === 'global') {
    const config = getGlobalConfig()
    if (!config.mcpServers) {
      config.mcpServers = {}
    }
    config.mcpServers[name] = server
    saveGlobalConfig(config)
  } else {
    const config = getCurrentProjectConfig()
    if (!config.mcpServers) {
      config.mcpServers = {}
    }
    config.mcpServers[name] = server
    saveCurrentProjectConfig(config)
  }
}

export function removeMcpServer(
  name: McpName,
  scope: ConfigScope = 'project',
): void {
  if (scope === 'mcprc') {
    if (process.env.NODE_ENV === 'test') {
      removeMcprcServerForTesting(name)
    } else {
      const mcprcPath = join(getCwd(), '.mcprc')
      if (!existsSync(mcprcPath)) {
        throw new Error('No .mcprc file found in this directory')
      }

      try {
        const mcprcContent = readFileSync(mcprcPath, 'utf-8')
        const mcprcConfig = safeParseJSON(mcprcContent) as Record<
          string,
          McpServerConfig
        > | null

        if (
          !mcprcConfig ||
          typeof mcprcConfig !== 'object' ||
          !mcprcConfig[name]
        ) {
          throw new Error(`No MCP server found with name: ${name} in .mcprc`)
        }

        delete mcprcConfig[name]
        writeFileSync(mcprcPath, JSON.stringify(mcprcConfig, null, 2), 'utf-8')
      } catch (error) {
        if (error instanceof Error) {
          throw error
        }
        throw new Error(`Failed to remove from .mcprc: ${error}`)
      }
    }
  } else if (scope === 'global') {
    const config = getGlobalConfig()
    if (!config.mcpServers?.[name]) {
      throw new Error(`No global MCP server found with name: ${name}`)
    }
    delete config.mcpServers[name]
    saveGlobalConfig(config)
  } else {
    const config = getCurrentProjectConfig()
    if (!config.mcpServers?.[name]) {
      throw new Error(`No local MCP server found with name: ${name}`)
    }
    delete config.mcpServers[name]
    saveCurrentProjectConfig(config)
  }
}

export function listMCPServers(): Record<string, McpServerConfig> {
  const globalConfig = getGlobalConfig()
  const mcprcConfig = getMcprcConfig()
  const projectConfig = getCurrentProjectConfig()
  return {
    ...(globalConfig.mcpServers ?? {}),
    ...(mcprcConfig ?? {}), // mcprc configs override global ones
    ...(projectConfig.mcpServers ?? {}), // Project configs override mcprc ones
  }
}

export type ScopedMcpServerConfig = McpServerConfig & {
  scope: ConfigScope
}

export function getMcpServer(name: McpName): ScopedMcpServerConfig | undefined {
  const projectConfig = getCurrentProjectConfig()
  const mcprcConfig = getMcprcConfig()
  const globalConfig = getGlobalConfig()

  // Check each scope in order of precedence
  if (projectConfig.mcpServers?.[name]) {
    return { ...projectConfig.mcpServers[name], scope: 'project' }
  }

  if (mcprcConfig?.[name]) {
    return { ...mcprcConfig[name], scope: 'mcprc' }
  }

  if (globalConfig.mcpServers?.[name]) {
    return { ...globalConfig.mcpServers[name], scope: 'global' }
  }

  return undefined
}

/**
 * Check if an SSE error is a normal timeout/disconnect that we should handle gracefully
 */
function isExpectedSSEError(error: any): boolean {
  const errorMessage = error?.message || error?.event?.message || String(error)
  const lowerMessage = errorMessage.toLowerCase()

  return (
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('connection closed') ||
    lowerMessage.includes('connection lost') ||
    lowerMessage.includes('sse error') ||
    error?.code === 'ECONNRESET' ||
    error?.code === 'ETIMEDOUT'
  )
}

async function connectToServer(
  name: string,
  serverRef: McpServerConfig,
): Promise<Client> {
  const transport =
    serverRef.type === 'sse'
      ? new SSEClientTransport(new URL(serverRef.url), {
          // Configure EventSource to not automatically retry on errors
          // We handle reconnection ourselves with exponential backoff
          eventSourceInit: {
            // @ts-ignore - withCredentials is not in type def but supported
            withCredentials: false,
          },
        })
      : new StdioClientTransport({
          command: serverRef.command,
          args: serverRef.args,
          env: {
            ...process.env,
            ...serverRef.env,
          } as Record<string, string>,
          stderr: 'pipe', // prevents error output from the MCP server from printing to the UI
        })

  const client = new Client(
    {
      name: PRODUCT_COMMAND,
      version: '0.1.0',
    },
    {
      capabilities: {},
    },
  )

  // Add a timeout to connection attempts to prevent tests from hanging indefinitely
  const CONNECTION_TIMEOUT_MS = 5000
  const connectPromise = client.connect(transport)
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timeoutId = setTimeout(() => {
      reject(
        new Error(
          `Connection to MCP server "${name}" timed out after ${CONNECTION_TIMEOUT_MS}ms`,
        ),
      )
    }, CONNECTION_TIMEOUT_MS)

    // Clean up timeout if connect resolves or rejects
    connectPromise.then(
      () => clearTimeout(timeoutId),
      () => clearTimeout(timeoutId),
    )
  })

  await Promise.race([connectPromise, timeoutPromise])

  if (serverRef.type === 'stdio') {
    ;(transport as StdioClientTransport).stderr?.on('data', (data: Buffer) => {
      const errorText = data.toString().trim()
      if (errorText) {
        logMCPError(name, `Server stderr: ${errorText}`)
      }
    })
  }

  // Add global error handler for SSE connections to catch unhandled EventSource errors
  if (serverRef.type === 'sse') {
    const originalOnError = (client as any).onError
    ;(client as any).onError = (error: any) => {
      // Check if this is an expected SSE error
      if (isExpectedSSEError(error)) {
        logMCPInfo(
          name,
          `SSE transport error (expected): ${error?.message || String(error)}`,
        )
        // Don't propagate expected errors as they'll be handled by our reconnection logic
        return
      }

      // For unexpected errors, call the original handler if it exists
      if (originalOnError) {
        originalOnError.call(client, error)
      } else {
        logMCPError(
          name,
          `Unhandled client error: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
  }

  return client
}

type ConnectedClient = {
  client: Client
  name: string
  type: 'connected'
  serverConfig: McpServerConfig
  keepaliveTimer?: NodeJS.Timeout
  reconnectAttempts?: number
  isReconnecting?: boolean
}
type FailedClient = {
  name: string
  type: 'failed'
}
export type WrappedClient = ConnectedClient | FailedClient

export function getMcprcServerStatus(
  serverName: string,
): 'approved' | 'rejected' | 'pending' {
  const config = getCurrentProjectConfig()
  if (config.approvedMcprcServers?.includes(serverName)) {
    return 'approved'
  }
  if (config.rejectedMcprcServers?.includes(serverName)) {
    return 'rejected'
  }
  return 'pending'
}

// SSE Keepalive configuration
const KEEPALIVE_INTERVAL_MS = 2 * 60 * 1000 // 2 minutes (less than server's 5 min timeout)
const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_BASE_DELAY_MS = 1000 // 1 second
const RECONNECT_MAX_DELAY_MS = 30000 // 30 seconds

/**
 * Setup keepalive mechanism for SSE connections
 * Periodically checks connection health and performs lightweight operations
 */
function setupSSEKeepalive(wrappedClient: ConnectedClient): void {
  // Clear existing timer if any
  if (wrappedClient.keepaliveTimer) {
    clearInterval(wrappedClient.keepaliveTimer)
  }

  wrappedClient.keepaliveTimer = setInterval(() => {
    // Use non-async wrapper to avoid unhandled promise rejections
    ;(async () => {
      try {
        // Perform a lightweight operation to keep connection alive
        await wrappedClient.client.getServerCapabilities()
        // Only log keepalive success in debug mode to reduce noise
        // logMCPInfo(wrappedClient.name, 'Keepalive check passed')
      } catch (error) {
        // Check if this is an expected error
        const isExpected = isExpectedSSEError(error)

        if (isExpected) {
          logMCPInfo(
            wrappedClient.name,
            'Keepalive detected connection issue (timeout/disconnect), will reconnect...',
          )
        } else {
          logMCPError(
            wrappedClient.name,
            `Keepalive check failed: ${error instanceof Error ? error.message : String(error)}`,
          )
        }

        // Connection lost, trigger reconnection
        clearInterval(wrappedClient.keepaliveTimer!)
        wrappedClient.keepaliveTimer = undefined
        attemptReconnect(wrappedClient).catch(err => {
          logMCPError(
            wrappedClient.name,
            `Reconnect failed in keepalive: ${err instanceof Error ? err.message : String(err)}`,
          )
        })
      }
    })()
  }, KEEPALIVE_INTERVAL_MS)
}

/**
 * Attempt to reconnect to an SSE server with exponential backoff
 */
async function attemptReconnect(
  wrappedClient: ConnectedClient,
): Promise<void> {
  // Prevent concurrent reconnection attempts
  if (wrappedClient.isReconnecting) {
    logMCPInfo(wrappedClient.name, 'Already reconnecting, skipping...')
    return
  }

  wrappedClient.isReconnecting = true
  const attempts = wrappedClient.reconnectAttempts ?? 0

  if (attempts >= MAX_RECONNECT_ATTEMPTS) {
    logMCPError(
      wrappedClient.name,
      `Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached, giving up`,
    )
    wrappedClient.isReconnecting = false
    // Don't reset all clients, just mark this one as failed
    return
  }

  // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
  const delay = Math.min(
    RECONNECT_BASE_DELAY_MS * Math.pow(2, attempts),
    RECONNECT_MAX_DELAY_MS,
  )

  logMCPInfo(
    wrappedClient.name,
    `Attempting reconnection (${attempts + 1}/${MAX_RECONNECT_ATTEMPTS}) in ${delay}ms...`,
  )

  await new Promise(resolve => setTimeout(resolve, delay))

  try {
    // Get fresh config in case it was updated
    const freshServerRef = getMcpServer(wrappedClient.name)
    const serverConfig = freshServerRef
      ? (freshServerRef as McpServerConfig)
      : wrappedClient.serverConfig

    logMCPInfo(
      wrappedClient.name,
      `Connecting to ${serverConfig.type === 'sse' ? serverConfig.url : serverConfig.command}...`,
    )

    const newClient = await connectToServer(wrappedClient.name, serverConfig)

    // Update the client reference and config
    wrappedClient.client = newClient
    wrappedClient.serverConfig = serverConfig
    wrappedClient.reconnectAttempts = 0
    wrappedClient.isReconnecting = false

    logMCPInfo(wrappedClient.name, 'Successfully reconnected!')

    // Re-setup keepalive and connection monitoring
    setupSSEKeepalive(wrappedClient)
    setupSSEConnectionMonitoring(wrappedClient)
  } catch (error) {
    logMCPError(
      wrappedClient.name,
      `Reconnection attempt ${attempts + 1} failed: ${error instanceof Error ? error.message : String(error)}`,
    )
    wrappedClient.reconnectAttempts = attempts + 1
    wrappedClient.isReconnecting = false
    await attemptReconnect(wrappedClient)
  }
}

/**
 * Setup connection monitoring for SSE connections
 * Handles connection errors and closures
 */
function setupSSEConnectionMonitoring(
  wrappedClient: ConnectedClient,
): void {
  const transport = (wrappedClient.client as any)._transport
  if (!transport) {
    logMCPError(
      wrappedClient.name,
      'Transport not found, cannot setup monitoring',
    )
    return
  }

  logMCPInfo(wrappedClient.name, 'Setting up SSE connection monitoring')

  transport.onerror = (event: any) => {
    // Check if this is an expected error (timeout, disconnect, etc.)
    const isExpected = isExpectedSSEError(event)

    if (isExpected) {
      logMCPInfo(
        wrappedClient.name,
        'SSE connection interrupted (expected: timeout/disconnect), will reconnect...',
      )
    } else {
      logMCPError(
        wrappedClient.name,
        `Unexpected SSE error: ${event?.message || String(event)}`,
      )
    }

    // Clear keepalive timer
    if (wrappedClient.keepaliveTimer) {
      clearInterval(wrappedClient.keepaliveTimer)
      wrappedClient.keepaliveTimer = undefined
    }

    // Trigger reconnection
    attemptReconnect(wrappedClient).catch(err => {
      logMCPError(
        wrappedClient.name,
        `Reconnect failed after error: ${err instanceof Error ? err.message : String(err)}`,
      )
    })
  }

  transport.onclose = (event: any) => {
    logMCPInfo(
      wrappedClient.name,
      'SSE connection closed gracefully, will reconnect...',
    )

    // Clear keepalive timer
    if (wrappedClient.keepaliveTimer) {
      clearInterval(wrappedClient.keepaliveTimer)
      wrappedClient.keepaliveTimer = undefined
    }

    // Trigger reconnection
    attemptReconnect(wrappedClient).catch(err => {
      logMCPError(
        wrappedClient.name,
        `Reconnect failed after close: ${err instanceof Error ? err.message : String(err)}`,
      )
    })
  }
}

/**
 * Cleanup keepalive timers for a client
 */
function cleanupKeepalive(wrappedClient: ConnectedClient): void {
  if (wrappedClient.keepaliveTimer) {
    clearInterval(wrappedClient.keepaliveTimer)
    wrappedClient.keepaliveTimer = undefined
  }
}

export const getClients = memoize(async (): Promise<WrappedClient[]> => {
  // TODO: This is a temporary fix for a hang during npm run verify in CI.
  // We need to investigate why MCP client connections hang in CI verify but not in CI tests.
  if (process.env.CI && process.env.NODE_ENV !== 'test') {
    return []
  }

  const globalServers = getGlobalConfig().mcpServers ?? {}
  const mcprcServers = getMcprcConfig()
  const projectServers = getCurrentProjectConfig().mcpServers ?? {}

  // Filter mcprc servers to only include approved ones
  const approvedMcprcServers = pickBy(
    mcprcServers,
    (_, name) => getMcprcServerStatus(name) === 'approved',
  )

  const allServers = {
    ...globalServers,
    ...approvedMcprcServers, // Approved .mcprc servers override global ones
    ...projectServers, // Project servers take highest precedence
  }

  const clients = await Promise.all(
    Object.entries(allServers).map(async ([name, serverRef]) => {
      try {
        const serverConfig = serverRef as McpServerConfig
        logMCPInfo(
          name,
          `Connecting to ${serverConfig.type === 'sse' ? serverConfig.url : serverConfig.command}...`,
        )

        const client = await connectToServer(name, serverConfig)

        const wrappedClient: ConnectedClient = {
          name,
          client,
          type: 'connected' as const,
          serverConfig, // Store config for reconnection
          reconnectAttempts: 0,
          isReconnecting: false,
        }

        logMCPInfo(name, 'Successfully connected')

        // For SSE connections, setup keepalive and connection monitoring
        if (serverConfig.type === 'sse') {
          logMCPInfo(
            name,
            `Setting up keepalive (interval: ${KEEPALIVE_INTERVAL_MS}ms)`,
          )
          setupSSEKeepalive(wrappedClient)
          setupSSEConnectionMonitoring(wrappedClient)
        }

        return wrappedClient
      } catch (error) {
        logMCPError(
          name,
          `Connection failed: ${error instanceof Error ? error.message : String(error)}`,
        )
        return { name, type: 'failed' as const }
      }
    }),
  )

  return clients
})

/**
 * Reset MCP client connections cache
 * This allows reconnection to previously failed or disconnected servers
 */
export async function resetMCPClients(): Promise<void> {
  // Cleanup keepalive timers before clearing cache
  try {
    const clients = await getClients()
    clients.forEach(client => {
      if (client.type === 'connected') {
        cleanupKeepalive(client)
      }
    })
  } catch {
    // Ignore errors during cleanup
  }

  getClients.cache.clear?.()
  getMCPTools.cache.clear?.()
  getMCPCommands.cache.clear?.()
}

async function requestAll<
  ResultT extends Result,
  ResultSchemaT extends typeof ResultSchema,
>(
  req: ClientRequest,
  resultSchema: ResultSchemaT,
  requiredCapability: string,
): Promise<{ client: ConnectedClient; result: ResultT }[]> {
  const clients = await getClients()
  const results = await Promise.allSettled(
    clients.map(async client => {
      if (client.type === 'failed') return null

      try {
        const capabilities = await client.client.getServerCapabilities()
        if (!capabilities?.[requiredCapability]) {
          return null
        }
        return {
          client,
          result: (await client.client.request(req, resultSchema)) as ResultT,
        }
      } catch (error) {
        if (client.type === 'connected') {
          logMCPError(
            client.name,
            `Failed to request '${req.method}': ${error instanceof Error ? error.message : String(error)}`,
          )
        }
        return null
      }
    }),
  )
  return results
    .filter(
      (
        result,
      ): result is PromiseFulfilledResult<{
        client: ConnectedClient
        result: ResultT
      } | null> => result.status === 'fulfilled',
    )
    .map(result => result.value)
    .filter(
      (result): result is { client: ConnectedClient; result: ResultT } =>
        result !== null,
    )
}

export const getMCPTools = memoize(async (): Promise<Tool[]> => {
  const toolsList = await requestAll<
    ListToolsResult,
    typeof ListToolsResultSchema
  >(
    {
      method: 'tools/list',
    },
    ListToolsResultSchema,
    'tools',
  )

  // TODO: Add zod schema validation
  return toolsList.flatMap(({ client, result: { tools } }) =>
    tools.map(
      (tool): Tool => ({
        ...MCPTool,
        name: 'mcp__' + client.name + '__' + tool.name,
        async description() {
          return tool.description ?? ''
        },
        async prompt() {
          return tool.description ?? ''
        },
        inputJSONSchema: tool.inputSchema as Tool['inputJSONSchema'],
        async validateInput(input, context) {
          // MCP tools handle their own validation through their schemas
          return { result: true }
        },
        async *call(args: Record<string, unknown>, context) {
          const data = await callMCPTool({ client, tool: tool.name, args })
          yield {
            type: 'result' as const,
            data,
            resultForAssistant: data,
          }
        },
        userFacingName() {
          return `${client.name}:${tool.name} (MCP)`
        },
        renderToolUseMessage(input, options) {
          return formatMCPToolUseMessage(input, options, {
            serverName: client.name,
            toolName: tool.name,
          })
        },
        renderToolResultMessage(output) {
          return MCPTool.renderToolResultMessage(output, {
            serverName: client.name,
            toolName: tool.name,
          })
        },
      }),
    ),
  )
})

async function callMCPTool({
  client: { client, name },
  tool,
  args,
}: {
  client: ConnectedClient
  tool: string
  args: Record<string, unknown>
}): Promise<ToolResultBlockParam['content']> {
  const result = await client.callTool(
    {
      name: tool,
      arguments: args,
    },
    CallToolResultSchema,
  )

  if ('isError' in result && result.isError) {
    const errorMessage = `Error calling tool ${tool}: ${result.error}`
    logMCPError(name, errorMessage)
    throw Error(errorMessage)
  }

  // Handle toolResult-type response
  if ('toolResult' in result) {
    return String(result.toolResult)
  }

  // Handle content array response
  if ('content' in result && Array.isArray(result.content)) {
    return result.content.map(item => {
      if (item.type === 'image') {
        return {
          type: 'image',
          source: {
            type: 'base64',
            data: String(item.data),
            media_type: item.mimeType as ImageBlockParam.Source['media_type'],
          },
        }
      }
      return item
    })
  }

  throw Error(`Unexpected response format from tool ${tool}`)
}

export const getMCPCommands = memoize(async (): Promise<Command[]> => {
  const results = await requestAll<
    ListPromptsResult,
    typeof ListPromptsResultSchema
  >(
    {
      method: 'prompts/list',
    },
    ListPromptsResultSchema,
    'prompts',
  )

  return results.flatMap(({ client, result }) =>
    result.prompts?.map(_ => {
      const argNames = Object.values(_.arguments ?? {}).map(k => k.name)
      return {
        type: 'prompt',
        name: 'mcp__' + client.name + '__' + _.name,
        description: _.description ?? '',
        isEnabled: true,
        isHidden: false,
        progressMessage: 'running',
        userFacingName() {
          return `${client.name}:${_.name} (MCP)`
        },
        argNames,
        async getPromptForCommand(args: string) {
          const argsArray = args.split(' ')
          return await runCommand(
            { name: _.name, client },
            zipObject(argNames, argsArray),
          )
        },
      }
    }),
  )
})

export async function runCommand(
  { name, client }: { name: string; client: ConnectedClient },
  args: Record<string, string>,
): Promise<MessageParam[]> {
  try {
    const result = await client.client.getPrompt({ name, arguments: args })
    // TODO: Support type == resource
    return result.messages.map(
      (message): MessageParam => ({
        role: message.role,
        content: [
          message.content.type === 'text'
            ? {
                type: 'text',
                text: message.content.text,
              }
            : {
                type: 'image',
                source: {
                  data: String(message.content.data),
                  media_type: message.content
                    .mimeType as ImageBlockParam.Source['media_type'],
                  type: 'base64',
                },
              },
        ],
      }),
    )
  } catch (error) {
    logMCPError(
      client.name,
      `Error running command '${name}': ${error instanceof Error ? error.message : String(error)}`,
    )
    throw error
  }
}
