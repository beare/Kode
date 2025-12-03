import { getTheme } from '@utils/theme'
import { Box, Text } from 'ink'
import * as React from 'react'

interface ConfigObject {
  id: number
  name: string
  description: string
  deviceTypeId?: number
  deviceTypeName?: string
}

interface VersionObject {
  id: number
  configId: number
  version: string
  versionDescription: string
  configContent?: string
}

interface CreateCollectConfigData {
  config: ConfigObject
  version: VersionObject
}

interface CreateCollectConfigRendererProps {
  data: unknown
}

export const CreateCollectConfigRenderer: React.FC<
  CreateCollectConfigRendererProps
> = ({ data }) => {
  const theme = getTheme()

  let configData: CreateCollectConfigData

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
    configData = data as CreateCollectConfigData
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

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box>
        <Text>&nbsp;&nbsp;⎿ &nbsp;</Text>
        <Text bold color={theme.primary}>
          采集配置已创建
        </Text>
      </Box>

      {/* Config ID */}
      <Box marginTop={1}>
        <Text>&nbsp;&nbsp;&nbsp;&nbsp;</Text>
        <Text bold color={theme.success}>
          配置ID:{' '}
        </Text>
        <Text color={theme.secondary}>{configData.config.id}</Text>
      </Box>

      {/* Name */}
      <Box>
        <Text>&nbsp;&nbsp;&nbsp;&nbsp;</Text>
        <Text bold color={theme.success}>
          名称:{' '}
        </Text>
        <Text color={theme.secondary}>{configData.config.name}</Text>
      </Box>

      {/* Description */}
      <Box>
        <Text>&nbsp;&nbsp;&nbsp;&nbsp;</Text>
        <Text bold color={theme.success}>
          描述:{' '}
        </Text>
        <Text color={theme.secondaryText}>{configData.config.description}</Text>
      </Box>

      {/* Version */}
      <Box>
        <Text>&nbsp;&nbsp;&nbsp;&nbsp;</Text>
        <Text bold color={theme.success}>
          版本号:{' '}
        </Text>
        <Text color={theme.secondary}>{configData.version.version}</Text>
      </Box>

      {/* Version Description */}
      <Box>
        <Text>&nbsp;&nbsp;&nbsp;&nbsp;</Text>
        <Text bold color={theme.success}>
          版本说明:{' '}
        </Text>
        <Text color={theme.secondaryText}>
          {configData.version.versionDescription}
        </Text>
      </Box>
    </Box>
  )
}
