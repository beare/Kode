import { Box, Text } from 'ink'
import * as React from 'react'
import { z } from 'zod'
import { FallbackToolUseRejectedMessage } from '@components/FallbackToolUseRejectedMessage'
import { type Tool } from '@tool'
import { getTheme } from '@utils/theme'
import { DESCRIPTION, PROMPT } from './prompt'
import { OutputLine } from '@tools/BashTool/OutputLine'
import { KnowledgeListRenderer } from './opseye/KnowledgeListRenderer'
import { CollectModelsRenderer } from './opseye/CollectModelsRenderer'
import { UpdateCollectConfigRenderer } from './opseye/UpdateCollectConfigRenderer'
import { CreateCollectConfigRenderer } from './opseye/CreateCollectConfigRenderer'
import { DeviceTypesRenderer } from './opseye/DeviceTypesRenderer'
import { formatUpdateCollectConfigToolUse } from './opseye/updateCollectConfigFormatter'
import { formatCreateCollectConfigToolUse } from './opseye/createCollectConfigFormatter'

// Allow any input object since MCP tools define their own schemas
const inputSchema = z.object({}).passthrough()

// Internal function to format tool use messages with optional metadata
export function formatMCPToolUseMessage(
  input: any,
  _options: { verbose: boolean },
  metadata?: { serverName: string; toolName: string },
): string {
  // Custom formatting for specific MCP servers
  if (metadata?.serverName === 'opseye-boss') {
    if (metadata?.toolName === 'updateCollectConfig') {
      return formatUpdateCollectConfigToolUse(input)
    }
    if (metadata?.toolName === 'createCollectConfigWithVersion') {
      return formatCreateCollectConfigToolUse(input)
    }
  }

  // Default formatting
  return Object.entries(input)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(', ')
}

export const MCPTool = {
  async isEnabled() {
    return true
  },
  isReadOnly() {
    return false
  },
  isConcurrencySafe() {
    return false // MCPTool can modify state through MCP calls, not safe for concurrent execution
  },
  // Overridden in mcpClient.ts
  name: 'mcp',
  // Overridden in mcpClient.ts
  async description() {
    return DESCRIPTION
  },
  // Overridden in mcpClient.ts
  async prompt() {
    return PROMPT
  },
  inputSchema,
  // Overridden in mcpClient.ts
  async *call() {
    yield {
      type: 'result',
      data: '',
      resultForAssistant: '',
    }
  },
  needsPermissions() {
    return true
  },
  renderToolUseMessage(input, options) {
    return formatMCPToolUseMessage(input, options, undefined)
  },
  // Overridden in mcpClient.ts
  userFacingName: () => 'mcp',
  renderToolUseRejectedMessage() {
    return <FallbackToolUseRejectedMessage />
  },
  renderToolResultMessage(
    output,
    metadata?: { serverName: string; toolName: string },
  ) {
    // Custom rendering for specific MCP tools
    if (metadata?.serverName === 'opseye-boss') {
      if (metadata?.toolName === 'getKnowledgeListByType') {
        return <KnowledgeListRenderer data={output} />
      }
      if (metadata?.toolName === 'getCollectModels') {
        return <CollectModelsRenderer data={output} />
      }
      if (metadata?.toolName === 'updateCollectConfig') {
        return <UpdateCollectConfigRenderer data={output} />
      }
      if (metadata?.toolName === 'createCollectConfigWithVersion') {
        return <CreateCollectConfigRenderer data={output} />
      }
      if (metadata?.toolName === 'getDeviceTypes') {
        return <DeviceTypesRenderer data={output} />
      }
    }

    // Default rendering logic
    const verbose = false // Set default value for verbose
    if (Array.isArray(output)) {
      return (
        <Box flexDirection="column">
          {output.map((item, i) => {
            if (item.type === 'image') {
              return (
                <Box
                  key={i}
                  justifyContent="space-between"
                  overflowX="hidden"
                  width="100%"
                >
                  <Box flexDirection="row">
                    <Text>&nbsp;&nbsp;⎿ &nbsp;</Text>
                    <Text>[Image]</Text>
                  </Box>
                </Box>
              )
            }
            const lines = item.text.split('\n').length
            return (
              <OutputLine
                key={i}
                content={item.text}
                lines={lines}
                verbose={verbose}
              />
            )
          })}
        </Box>
      )
    }

    if (!output) {
      return (
        <Box justifyContent="space-between" overflowX="hidden" width="100%">
          <Box flexDirection="row">
            <Text>&nbsp;&nbsp;⎿ &nbsp;</Text>
            <Text color={getTheme().secondaryText}>(No content)</Text>
          </Box>
        </Box>
      )
    }

    const lines = output.split('\n').length
    return <OutputLine content={output} lines={lines} verbose={verbose} />
  },
  renderResultForAssistant(content) {
    return content
  },
} satisfies Tool<typeof inputSchema, string>
