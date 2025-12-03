/**
 * Format tool use message for opseye-boss:updateCollectConfig
 */
export function formatUpdateCollectConfigToolUse(input: any): string {
  const { key, content, capability_manifest } = input

  // Parse capability_manifest
  let manifest: {
    supported_metrics?: Array<{ field_prefix: string; field_name: string }>
    unsupported_metrics?: Array<{ field_prefix: string; field_name: string }>
  } = {}
  try {
    manifest =
      typeof capability_manifest === 'string'
        ? JSON.parse(capability_manifest)
        : capability_manifest || {}
  } catch {
    // Ignore parse errors
  }

  // Truncate content to 20 characters
  const truncatedContent =
    content && content.length > 20
      ? `${content.substring(0, 20)}...`
      : content || ''

  // Count metrics
  const supportedCount = (manifest.supported_metrics || []).length
  const unsupportedCount = (manifest.unsupported_metrics || []).length

  return [
    `调测 KEY: "${key}"`,
    `内容: "${truncatedContent}"`,
    `支持的指标: ${supportedCount}`,
    `不支持的指标: ${unsupportedCount}`,
  ].join(', ')
}
