import { getTheme } from '@utils/theme'
import { Box, Text } from 'ink'
import * as React from 'react'

interface KnowledgeItem {
  id: number
  title: string
  url: string
}

interface KnowledgeListRendererProps {
  data: unknown
}

export const KnowledgeListRenderer: React.FC<KnowledgeListRendererProps> = ({
  data,
}) => {
  const theme = getTheme()

  let items: KnowledgeItem[]

  // Handle different input types
  if (Array.isArray(data)) {
    // Data is already an array (from content array with {type: 'text', text: '...'})
    items = data
      .filter(
        (item): item is { type: string; text: string } =>
          typeof item === 'object' &&
          item !== null &&
          'text' in item &&
          typeof item.text === 'string',
      )
      .flatMap(item => {
        try {
          // First parse: removes outer quotes if it's a JSON string
          let parsed = JSON.parse(item.text)

          // If result is still a string, parse again (double-encoded JSON)
          if (typeof parsed === 'string') {
            parsed = JSON.parse(parsed)
          }

          return Array.isArray(parsed) ? parsed : [parsed]
        } catch {
          return []
        }
      })
  } else if (typeof data === 'string') {
    // Data is a JSON string
    try {
      items = JSON.parse(data)
      if (!Array.isArray(items)) {
        throw new Error('Expected array')
      }
    } catch {
      // Fallback to plain text if parsing fails
      return (
        <Box flexDirection="column">
          <Box>
            <Text>&nbsp;&nbsp;⎿ &nbsp;</Text>
            <Text>{data}</Text>
          </Box>
        </Box>
      )
    }
  } else {
    // Unknown format
    return (
      <Box flexDirection="column">
        <Box>
          <Text>&nbsp;&nbsp;⎿ &nbsp;</Text>
          <Text color={theme.secondaryText}>(Invalid data format)</Text>
        </Box>
      </Box>
    )
  }

  // Validate and filter items
  const validItems = items.filter(
    (item): item is KnowledgeItem =>
      item &&
      typeof item === 'object' &&
      typeof item.id === 'number' &&
      typeof item.title === 'string' &&
      typeof item.url === 'string',
  )

  if (validItems.length === 0) {
    return (
      <Box flexDirection="column">
        <Box>
          <Text>&nbsp;&nbsp;⎿ &nbsp;</Text>
          <Text color={theme.secondaryText}>(No knowledge items found)</Text>
        </Box>
      </Box>
    )
  }

  // Calculate column widths
  const idWidth = Math.max(2, ...validItems.map(i => i.id.toString().length))

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box>
        <Text>&nbsp;&nbsp;⎿ &nbsp;</Text>
        <Text bold color={theme.primary}>
          {'ID'.padEnd(idWidth + 2)}
        </Text>
        <Text bold color={theme.primary}>
          Title
        </Text>
      </Box>

      {/* Separator */}
      <Box>
        <Text>&nbsp;&nbsp;&nbsp;&nbsp;</Text>
        <Text color={theme.secondaryText}>
          {'-'.repeat(idWidth + 50)}
        </Text>
      </Box>

      {/* Items */}
      {validItems.map(item => (
        <Box key={item.id}>
          <Text>&nbsp;&nbsp;&nbsp;&nbsp;</Text>
          <Text color={theme.success}>
            {item.id.toString().padEnd(idWidth + 2)}
          </Text>
          <Text>{item.title}</Text>
        </Box>
      ))}

      {/* Footer */}
      <Box marginTop={1}>
        <Text>&nbsp;&nbsp;&nbsp;&nbsp;</Text>
        <Text color={theme.secondaryText}>
          {`Total: ${validItems.length} item${validItems.length !== 1 ? 's' : ''}`}
        </Text>
      </Box>
    </Box>
  )
}
