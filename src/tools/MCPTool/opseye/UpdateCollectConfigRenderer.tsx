import { getTheme } from '@utils/theme'
import { Box, Text } from 'ink'
import * as React from 'react'

interface UpdateCollectConfigData {
  id: number
  configId: number
  version: string
  versionDescription: string
  configContent: string
}

interface UpdateCollectConfigRendererProps {
  data: unknown
}

export const UpdateCollectConfigRenderer: React.FC<
  UpdateCollectConfigRendererProps
> = ({ data }) => {
  const theme = getTheme()

  let configData: UpdateCollectConfigData

  // Handle different input types
  if (Array.isArray(data)) {
    // Extract from content array format
    const textItems = data.filter(
      (item): item is { type: string; text: string } =>
        typeof item === 'object' &&
        item !== null &&
        'text' in item &&
        typeof item.text === 'string',
    )

    if (textItems.length === 0) {
      return (
        <Box flexDirection="column">
          <Box>
            <Text>&nbsp;&nbsp;⎿ &nbsp;</Text>
            <Text color={theme.secondaryText}>(No data found)</Text>
          </Box>
        </Box>
      )
    }

    try {
      let parsed = JSON.parse(textItems[0].text)
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed)
      }
      configData = parsed
    } catch {
      return (
        <Box flexDirection="column">
          <Box>
            <Text>&nbsp;&nbsp;⎿ &nbsp;</Text>
            <Text>{textItems[0].text}</Text>
          </Box>
        </Box>
      )
    }
  } else if (typeof data === 'string') {
    try {
      configData = JSON.parse(data)
    } catch {
      return (
        <Box flexDirection="column">
          <Box>
            <Text>&nbsp;&nbsp;⎿ &nbsp;</Text>
            <Text>{data}</Text>
          </Box>
        </Box>
      )
    }
  } else if (typeof data === 'object' && data !== null) {
    configData = data as UpdateCollectConfigData
  } else {
    return (
      <Box flexDirection="column">
        <Box>
          <Text>&nbsp;&nbsp;⎿ &nbsp;</Text>
          <Text color={theme.secondaryText}>(Invalid data format)</Text>
        </Box>
      </Box>
    )
  }

  // Extract clean description without capability manifest
  const cleanDescription =
    configData.versionDescription.split('\n\n能力清单:')[0]

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box>
        <Text>&nbsp;&nbsp;⎿ &nbsp;</Text>
        <Text bold color={theme.primary}>
          采集配置已更新
        </Text>
      </Box>

      {/* Config ID */}
      <Box marginTop={1}>
        <Text>&nbsp;&nbsp;&nbsp;&nbsp;</Text>
        <Text bold color={theme.success}>
          配置ID:{' '}
        </Text>
        <Text color={theme.secondary}>{configData.configId}</Text>
      </Box>

      {/* Version */}
      <Box>
        <Text>&nbsp;&nbsp;&nbsp;&nbsp;</Text>
        <Text bold color={theme.success}>
          版本号:{' '}
        </Text>
        <Text color={theme.secondary}>{configData.version}</Text>
      </Box>

      {/* Description */}
      <Box>
        <Text>&nbsp;&nbsp;&nbsp;&nbsp;</Text>
        <Text bold color={theme.success}>
          版本说明:{' '}
        </Text>
        <Text color={theme.secondaryText}>{cleanDescription}</Text>
      </Box>
    </Box>
  )
}
