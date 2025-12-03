import { getTheme } from '@utils/theme'
import { Box, Text } from 'ink'
import * as React from 'react'

interface DeviceType {
  id: number
  code: string
  name: string
  description: string
}

interface DeviceTypesRendererProps {
  data: unknown
}

export const DeviceTypesRenderer: React.FC<DeviceTypesRendererProps> = ({
  data,
}) => {
  const theme = getTheme()

  let deviceTypes: DeviceType[]

  // Handle different input types
  if (Array.isArray(data)) {
    // Data is already an array (from content array with {type: 'text', text: '...'})
    deviceTypes = data
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
      deviceTypes = JSON.parse(data)
      if (!Array.isArray(deviceTypes)) {
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

  // Validate and filter device types
  const validDeviceTypes = deviceTypes.filter(
    (item): item is DeviceType =>
      item &&
      typeof item === 'object' &&
      typeof item.id === 'number' &&
      typeof item.code === 'string' &&
      typeof item.name === 'string',
  )

  if (validDeviceTypes.length === 0) {
    return (
      <Box flexDirection="column">
        <Box>
          <Text>&nbsp;&nbsp;⎿ &nbsp;</Text>
          <Text color={theme.secondaryText}>(No device types found)</Text>
        </Box>
      </Box>
    )
  }

  // Calculate column widths
  const idWidth = Math.max(
    2,
    ...validDeviceTypes.map(i => i.id.toString().length),
  )
  const codeWidth = Math.max(4, ...validDeviceTypes.map(i => i.code.length))

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box>
        <Text>&nbsp;&nbsp;⎿ &nbsp;</Text>
        <Text bold color={theme.primary}>
          {'ID'.padEnd(idWidth + 2)}
        </Text>
        <Text bold color={theme.primary}>
          {'代码'.padEnd(codeWidth + 2)}
        </Text>
        <Text bold color={theme.primary}>
          名称
        </Text>
      </Box>

      {/* Separator */}
      <Box>
        <Text>&nbsp;&nbsp;&nbsp;&nbsp;</Text>
        <Text color={theme.secondaryText}>
          {'-'.repeat(idWidth + codeWidth + 30)}
        </Text>
      </Box>

      {/* Items */}
      {validDeviceTypes.map(item => (
        <Box key={item.id}>
          <Text>&nbsp;&nbsp;&nbsp;&nbsp;</Text>
          <Text color={theme.success}>
            {item.id.toString().padEnd(idWidth + 2)}
          </Text>
          <Text color={theme.secondary}>{item.code.padEnd(codeWidth + 2)}</Text>
          <Text>{item.name}</Text>
        </Box>
      ))}

      {/* Footer */}
      <Box marginTop={1}>
        <Text>&nbsp;&nbsp;&nbsp;&nbsp;</Text>
        <Text color={theme.secondaryText}>
          {`总计: ${validDeviceTypes.length} 种设备类型`}
        </Text>
      </Box>
    </Box>
  )
}
