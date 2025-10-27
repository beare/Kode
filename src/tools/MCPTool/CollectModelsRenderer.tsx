import { getTheme } from '@utils/theme'
import { Box, Text } from 'ink'
import * as React from 'react'

interface CollectModelItem {
  id: number
  name: string
  label: string
  isTag: boolean
  dataType: string
  unit: string
  description: string
  sortOrder: number
}

interface CollectModel {
  id: number
  name: string
  description: string
  enabled: boolean
  category: string
  isBaseModel: boolean
  fieldPrefix: string
  items: CollectModelItem[]
  createTime: string
  updateTime: string
}

interface CollectModelsRendererProps {
  data: unknown
}

export const CollectModelsRenderer: React.FC<CollectModelsRendererProps> = ({
  data,
}) => {
  const theme = getTheme()

  let models: CollectModel[]

  // Handle different input types
  if (Array.isArray(data)) {
    models = data
      .filter(
        (item): item is { type: string; text: string } =>
          typeof item === 'object' &&
          item !== null &&
          'text' in item &&
          typeof item.text === 'string',
      )
      .flatMap(item => {
        try {
          let parsed = JSON.parse(item.text)
          if (typeof parsed === 'string') {
            parsed = JSON.parse(parsed)
          }
          return Array.isArray(parsed) ? parsed : [parsed]
        } catch {
          return []
        }
      })
  } else if (typeof data === 'string') {
    try {
      models = JSON.parse(data)
      if (!Array.isArray(models)) {
        throw new Error('Expected array')
      }
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

  // Validate and filter models
  const validModels = models.filter(
    (model): model is CollectModel =>
      model &&
      typeof model === 'object' &&
      typeof model.id === 'number' &&
      typeof model.name === 'string' &&
      typeof model.category === 'string' &&
      Array.isArray(model.items),
  )

  if (validModels.length === 0) {
    return (
      <Box flexDirection="column">
        <Box>
          <Text>&nbsp;&nbsp;⎿ &nbsp;</Text>
          <Text color={theme.secondaryText}>(No collect models found)</Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Text>&nbsp;&nbsp;⎿ &nbsp;</Text>
        <Text bold color={theme.primary}>
          采集模型列表 ({validModels.length} 个模型)
        </Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        {validModels.map((model, index) => (
          <Box key={model.id} flexDirection="column" marginTop={index > 0 ? 1 : 0}>
            {/* Model header */}
            <Box>
              <Text>&nbsp;&nbsp;&nbsp;&nbsp;</Text>
              <Text bold color={theme.success}>
                [{model.id}]
              </Text>
              <Text bold> {model.name}</Text>
              <Text color={theme.secondaryText}> ({model.category})</Text>
              {model.enabled ? (
                <Text color={theme.success}> ✓</Text>
              ) : (
                <Text color={theme.error}> ✗</Text>
              )}
            </Box>

            {/* Model description */}
            <Box>
              <Text>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</Text>
              <Text color={theme.secondaryText}>{model.description}</Text>
            </Box>

            {/* Field prefix */}
            <Box>
              <Text>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</Text>
              <Text dimColor>前缀: </Text>
              <Text color={theme.secondary}>{model.fieldPrefix}</Text>
              <Text dimColor> | 字段数: </Text>
              <Text color={theme.secondary}>{model.items.length}</Text>
            </Box>

            {/* Items list */}
            {model.items.length > 0 && (
              <Box marginTop={0} flexDirection="column">
                <Box>
                  <Text>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</Text>
                  <Text dimColor>字段:</Text>
                </Box>
                {model.items.map(item => (
                  <Box key={item.id}>
                    <Text>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</Text>
                    <Text color={theme.secondary}>• {item.label}</Text>
                    <Text dimColor> ({item.name})</Text>
                    {item.isTag && (
                      <Text color={theme.warning}> [Tag]</Text>
                    )}
                    <Text color={theme.secondaryText}>
                      {' '}
                      - {item.dataType}
                      {item.unit && ` [${item.unit}]`}
                    </Text>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        ))}
      </Box>

      {/* Footer */}
      <Box marginTop={1}>
        <Text>&nbsp;&nbsp;&nbsp;&nbsp;</Text>
        <Text color={theme.secondaryText}>
          总计: {validModels.length} 个采集模型, 共{' '}
          {validModels.reduce((sum, m) => sum + m.items.length, 0)} 个字段
        </Text>
      </Box>
    </Box>
  )
}
