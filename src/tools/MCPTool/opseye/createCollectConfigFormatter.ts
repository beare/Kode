/**
 * Format tool use message for opseye-boss:createCollectConfigWithVersion
 */
export function formatCreateCollectConfigToolUse(input: any): string {
  const { name, deviceTypeId, version, configContent, versionDescription } =
    input

  // Truncate configContent to 20 characters
  const truncatedContent =
    configContent && configContent.length > 20
      ? `${configContent.substring(0, 20)}...`
      : configContent || ''

  return [
    `名称: "${name}"`,
    `设备类型ID: ${deviceTypeId}`,
    `版本: "${version}"`,
    `配置内容: "${truncatedContent}"`,
    `版本说明: "${versionDescription}"`,
  ].join(', ')
}
