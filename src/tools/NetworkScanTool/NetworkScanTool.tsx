import { exec } from 'node:child_process'
import { platform } from 'node:os'
import { promisify } from 'node:util'
import { Box, Text } from 'ink'
import * as React from 'react'
import { z } from 'zod'
import { FallbackToolUseRejectedMessage } from '@components/FallbackToolUseRejectedMessage'
import { Tool } from '@tool'
import { getTheme } from '@utils/theme'
import { DESCRIPTION, PROMPT } from './prompt'

const execAsync = promisify(exec)

export const inputSchema = z.strictObject({
  target: z
    .string()
    .optional()
    .describe(
      'Target network range in CIDR notation (e.g., "192.168.1.0/24"). Leave empty to auto-detect local network.',
    ),
  method: z
    .enum(['quick', 'standard', 'comprehensive'])
    .optional()
    .default('standard')
    .describe(
      'Scan method: "quick" (ping only), "standard" (ARP + ping), "comprehensive" (all methods)',
    ),
  timeout: z
    .number()
    .optional()
    .default(30)
    .describe('Timeout in seconds for the scan (default: 30)'),
})

type In = typeof inputSchema
export type Out = {
  devices: Array<{
    ip: string
    mac?: string
    hostname?: string
    vendor?: string
    responseTime?: number
    services?: string[]
  }>
  networkRange: string
  scanMethod: string
  duration: number
  errors?: string[]
}

// MAC vendor OUI database (top vendors for offline lookup)
const MAC_VENDORS: Record<string, string> = {
  '00:00:0C': 'Cisco Systems',
  '00:01:42': 'Cisco Systems',
  '00:03:47': 'Intel Corporation',
  '00:04:76': 'Samsung Electronics',
  '00:05:02': 'Apple, Inc.',
  '00:0C:29': 'VMware, Inc.',
  '00:0D:93': 'Apple, Inc.',
  '00:15:5D': 'Microsoft Corporation',
  '00:16:CB': 'Apple, Inc.',
  '00:17:F2': 'Apple, Inc.',
  '00:1B:63': 'Apple, Inc.',
  '00:1C:B3': 'Apple, Inc.',
  '00:1E:52': 'Apple, Inc.',
  '00:21:E9': 'Dell Inc.',
  '00:23:32': 'Apple, Inc.',
  '00:24:D7': 'Espressif Inc.',
  '00:25:00': 'Apple, Inc.',
  '00:26:BB': 'Apple, Inc.',
  '00:50:56': 'VMware, Inc.',
  '08:00:27': 'PCS Systemtechnik GmbH',
  '10:DD:B1': 'Apple, Inc.',
  '18:65:90': 'Apple, Inc.',
  '20:C9:D0': 'Apple, Inc.',
  '28:CF:E9': 'Apple, Inc.',
  '3C:07:54': 'Apple, Inc.',
  '40:6C:8F': 'Apple, Inc.',
  '48:D7:05': 'Apple, Inc.',
  '50:ED:3C': 'Apple, Inc.',
  '5C:95:AE': 'Apple, Inc.',
  '60:03:08': 'Apple, Inc.',
  '68:5B:35': 'Apple, Inc.',
  '70:56:81': 'Apple, Inc.',
  '78:31:C1': 'Apple, Inc.',
  '80:E6:50': 'Apple, Inc.',
  '88:66:5A': 'Apple, Inc.',
  '90:72:40': 'Apple, Inc.',
  '98:01:A7': 'Apple, Inc.',
  'A0:99:9B': 'Apple, Inc.',
  'A8:20:66': 'Apple, Inc.',
  'AC:BC:32': 'Apple, Inc.',
  'B0:34:95': 'Apple, Inc.',
  'B4:F0:AB': 'Apple, Inc.',
  'BC:3B:AF': 'Apple, Inc.',
  'C4:2C:03': 'Apple, Inc.',
  'CC:29:F5': 'Apple, Inc.',
  'D4:9A:20': 'Apple, Inc.',
  'DC:2B:61': 'Apple, Inc.',
  'E4:CE:8F': 'Apple, Inc.',
  'EC:35:86': 'Apple, Inc.',
  'F0:18:98': 'Apple, Inc.',
  'F4:0F:24': 'Apple, Inc.',
  'F8:1E:DF': 'Apple, Inc.',
}

function getVendorFromMAC(mac: string): string | undefined {
  const prefix = mac.substring(0, 8).toUpperCase()
  return MAC_VENDORS[prefix]
}

async function getLocalNetworkRange(): Promise<string> {
  const os = platform()

  try {
    if (os === 'darwin' || os === 'linux') {
      // Try to get default gateway and interface
      const { stdout } = await execAsync(
        os === 'darwin'
          ? "route -n get default | grep 'interface' | awk '{print $2}'"
          : "ip route | grep default | awk '{print $5}'",
      )
      const iface = stdout.trim()

      if (iface) {
        const { stdout: ipInfo } = await execAsync(
          os === 'darwin'
            ? `ifconfig ${iface} | grep 'inet ' | awk '{print $2}'`
            : `ip addr show ${iface} | grep 'inet ' | awk '{print $2}'`,
        )
        const ip = ipInfo.trim().split('/')[0]

        if (ip) {
          // Assume /24 network
          const parts = ip.split('.')
          return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`
        }
      }
    } else if (os === 'win32') {
      const { stdout } = await execAsync('ipconfig')
      const ipMatch = stdout.match(/IPv4 Address[.\s]+: ([\d.]+)/)
      if (ipMatch?.[1]) {
        const parts = ipMatch[1].split('.')
        return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`
      }
    }
  } catch {
    // Fall back to common private network
  }

  return '192.168.1.0/24'
}

async function performArpScan(
  networkRange: string,
  signal: AbortSignal,
): Promise<Map<string, { mac: string; vendor?: string }>> {
  const devices = new Map<string, { mac: string; vendor?: string }>()
  const os = platform()

  try {
    if (os === 'darwin' || os === 'linux') {
      // Use arp-scan if available, otherwise use arp -a
      let command = 'arp -a'

      // First try to populate ARP cache with ping sweep
      const [network, cidr] = networkRange.split('/')
      const cidrNum = Number.parseInt(cidr || '24', 10)
      if (cidrNum === 24 && network) {
        const baseIp = network.split('.').slice(0, 3).join('.')
        // Ping multiple IPs in parallel (but not too many to avoid overwhelming)
        command = `for i in {1..254}; do ping -c 1 -W 1 ${baseIp}.$i >/dev/null 2>&1 & done; wait; arp -a`
      }

      const { stdout } = await execAsync(command, {
        signal,
        timeout: 15000,
      })

      // Parse ARP output
      const lines = stdout.split('\n')
      for (const line of lines) {
        // macOS format: ? (192.168.1.1) at aa:bb:cc:dd:ee:ff on en0 ifscope [ethernet]
        // Linux format: ? (192.168.1.1) at aa:bb:cc:dd:ee:ff [ether] on eth0
        const match = line.match(
          /\(([0-9.]+)\)\s+at\s+([0-9a-f:]+)/i,
        )
        if (match?.[1] && match[2]) {
          const ip = match[1]
          const mac = match[2].toUpperCase()
          const vendor = getVendorFromMAC(mac)
          devices.set(ip, { mac, vendor })
        }
      }
    } else if (os === 'win32') {
      const { stdout } = await execAsync('arp -a', { signal })
      const lines = stdout.split('\n')
      for (const line of lines) {
        // Windows format: 192.168.1.1          aa-bb-cc-dd-ee-ff     dynamic
        const match = line.match(/([0-9.]+)\s+([0-9a-f-]+)\s+/i)
        if (match?.[1] && match[2]) {
          const ip = match[1]
          const mac = match[2].replace(/-/g, ':').toUpperCase()
          const vendor = getVendorFromMAC(mac)
          devices.set(ip, { mac, vendor })
        }
      }
    }
  } catch {
    // ARP scan failed, return empty map
  }

  return devices
}

async function performPingSweep(
  networkRange: string,
  signal: AbortSignal,
): Promise<Map<string, number>> {
  const devices = new Map<string, number>()
  const [network] = networkRange.split('/')
  if (!network) return devices

  const baseIp = network.split('.').slice(0, 3).join('.')
  const os = platform()

  const pingCmd = os === 'win32' ? 'ping -n 1 -w 500' : 'ping -c 1 -W 1'

  // Ping sweep in batches to avoid overwhelming the system
  const batchSize = 50
  for (let i = 1; i <= 254; i += batchSize) {
    if (signal.aborted) break

    const promises = []
    for (let j = i; j < Math.min(i + batchSize, 255); j++) {
      const ip = `${baseIp}.${j}`
      promises.push(
        (async () => {
          try {
            const start = Date.now()
            await execAsync(`${pingCmd} ${ip}`, {
              signal,
              timeout: 2000,
            })
            const responseTime = Date.now() - start
            devices.set(ip, responseTime)
          } catch {
            // Host didn't respond
          }
        })(),
      )
    }

    await Promise.all(promises)
  }

  return devices
}

async function performMdnsScan(
  signal: AbortSignal,
): Promise<Map<string, string>> {
  const devices = new Map<string, string>()
  const os = platform()

  try {
    if (os === 'darwin') {
      // Use dns-sd to discover services
      const { stdout } = await execAsync(
        'dns-sd -B _services._dns-sd._udp local. & sleep 3; killall dns-sd',
        { signal, timeout: 5000 },
      )

      // Parse mDNS responses
      const lines = stdout.split('\n')
      for (const line of lines) {
        // Extract service information
        if (line.includes('Add')) {
          const parts = line.split(/\s+/)
          if (parts.length > 6) {
            const hostname = parts[6]
            if (hostname) {
              devices.set(hostname, 'mDNS Service')
            }
          }
        }
      }
    } else if (os === 'linux') {
      // Try avahi-browse if available
      const { stdout } = await execAsync(
        'timeout 3 avahi-browse -a -t -r 2>/dev/null || echo "avahi not available"',
        { signal },
      )

      if (!stdout.includes('not available')) {
        const lines = stdout.split('\n')
        for (const line of lines) {
          if (line.includes('hostname')) {
            const match = line.match(/hostname = \[(.*?)\]/)
            if (match && match[1]) {
              devices.set(match[1], 'mDNS Service')
            }
          }
        }
      }
    }
  } catch {
    // mDNS scan failed
  }

  return devices
}

async function resolveHostname(ip: string): Promise<string | undefined> {
  try {
    const os = platform()
    const cmd =
      os === 'win32' ? `nslookup ${ip}` : `host ${ip} 2>/dev/null || dig -x ${ip} +short`

    const { stdout } = await execAsync(cmd, { timeout: 2000 })

    if (os === 'win32') {
      const match = stdout.match(/Name:\s+(.+)/)
      return match?.[1]?.trim()
    } else {
      const lines = stdout.split('\n')
      for (const line of lines) {
        if (line.includes('domain name pointer')) {
          return line.split('pointer')[1]?.trim().replace(/\.$/, '')
        } else if (line.trim() && !line.includes(';;')) {
          return line.trim().replace(/\.$/, '')
        }
      }
    }
  } catch {
    // Hostname resolution failed
  }
  return undefined
}

export const NetworkScanTool = {
  name: 'NetworkScan',
  async description() {
    return DESCRIPTION
  },
  async prompt() {
    return PROMPT
  },
  isReadOnly() {
    return true
  },
  isConcurrencySafe() {
    return false // Network scanning should be serialized
  },
  inputSchema,
  userFacingName() {
    return 'Network Scan'
  },
  async isEnabled() {
    return true
  },
  needsPermissions(): boolean {
    return true // Network scanning requires user approval
  },
  renderToolUseMessage({ target, method }) {
    return `target: ${target || 'auto-detect'}, method: ${method || 'standard'}`
  },
  renderToolUseRejectedMessage() {
    return <FallbackToolUseRejectedMessage />
  },
  renderToolResultMessage(content) {
    if (typeof content !== 'object' || !content) {
      return null
    }

    const data = content as Out
    const theme = getTheme()

    return (
      <Box flexDirection="column">
        <Box>
          <Text color={theme.secondaryText}>
            Found {data.devices.length} device(s) on {data.networkRange} using{' '}
            {data.scanMethod} scan ({data.duration.toFixed(1)}s)
          </Text>
        </Box>
        {data.devices.slice(0, 10).map((device) => (
          <Box key={device.ip} flexDirection="column" marginLeft={2}>
            <Text>
              {device.ip}
              {device.hostname && ` (${device.hostname})`}
            </Text>
            {device.mac && (
              <Text color={theme.secondaryText}>
                  MAC: {device.mac}
                {device.vendor && ` - ${device.vendor}`}
              </Text>
            )}
            {device.responseTime && (
              <Text color={theme.secondaryText}>
                  Response: {device.responseTime}ms
              </Text>
            )}
          </Box>
        ))}
        {data.devices.length > 10 && (
          <Text color={theme.secondaryText}>
            ... and {data.devices.length - 10} more device(s)
          </Text>
        )}
        {data.errors && data.errors.length > 0 && (
          <Box marginTop={1}>
            <Text color="red">Errors: {data.errors.join(', ')}</Text>
          </Box>
        )}
      </Box>
    )
  },
  renderResultForAssistant(data) {
    const out = data as Out
    let result = `Network scan of ${out.networkRange} completed in ${out.duration.toFixed(1)}s using ${out.scanMethod} method.\n\n`
    result += `Found ${out.devices.length} device(s):\n\n`

    for (const device of out.devices) {
      result += `IP: ${device.ip}\n`
      if (device.hostname) result += `  Hostname: ${device.hostname}\n`
      if (device.mac) result += `  MAC: ${device.mac}\n`
      if (device.vendor) result += `  Vendor: ${device.vendor}\n`
      if (device.responseTime)
        result += `  Response Time: ${device.responseTime}ms\n`
      if (device.services && device.services.length > 0)
        result += `  Services: ${device.services.join(', ')}\n`
      result += '\n'
    }

    if (out.errors && out.errors.length > 0) {
      result += `\nErrors encountered:\n${out.errors.join('\n')}`
    }

    return result
  },
  async *call({ target, method = 'standard' }, { abortController }) {
    const startTime = Date.now()
    const errors: string[] = []
    const networkRange = target || (await getLocalNetworkRange())

    try {
      const devicesMap = new Map<
        string,
        {
          ip: string
          mac?: string
          hostname?: string
          vendor?: string
          responseTime?: number
          services?: string[]
        }
      >()

      // Perform scans based on method
      if (method === 'quick') {
        const pingResults = await performPingSweep(
          networkRange,
          abortController.signal,
        )
        for (const [ip, responseTime] of pingResults) {
          devicesMap.set(ip, { ip, responseTime })
        }
      } else if (method === 'standard' || method === 'comprehensive') {
        // ARP scan
        const arpResults = await performArpScan(
          networkRange,
          abortController.signal,
        )

        // Ping sweep
        const pingResults = await performPingSweep(
          networkRange,
          abortController.signal,
        )

        // Merge results
        for (const [ip, responseTime] of pingResults) {
          const arpInfo = arpResults.get(ip)
          devicesMap.set(ip, {
            ip,
            responseTime,
            mac: arpInfo?.mac,
            vendor: arpInfo?.vendor,
          })
        }

        // Add ARP-only results (devices that didn't respond to ping)
        for (const [ip, arpInfo] of arpResults) {
          if (!devicesMap.has(ip)) {
            devicesMap.set(ip, {
              ip,
              mac: arpInfo.mac,
              vendor: arpInfo.vendor,
            })
          }
        }

        if (method === 'comprehensive') {
          // mDNS scan
          try {
            const mdnsResults = await performMdnsScan(abortController.signal)
            for (const [, service] of mdnsResults) {
              // Try to find corresponding IP
              for (const [, device] of devicesMap) {
                if (!device.hostname) {
                  device.services = device.services || []
                  if (!device.services.includes(service)) {
                    device.services.push(service)
                  }
                }
              }
            }
          } catch {
            errors.push('mDNS scan failed')
          }
        }
      }

      // Resolve hostnames for discovered devices
      const hostnamePromises = Array.from(devicesMap.keys()).map(async ip => {
        const hostname = await resolveHostname(ip)
        if (hostname) {
          const device = devicesMap.get(ip)
          if (device) {
            device.hostname = hostname
          }
        }
      })

      await Promise.all(hostnamePromises)

      const devices = Array.from(devicesMap.values()).sort((a, b) => {
        const ipA = a.ip.split('.').map(Number)
        const ipB = b.ip.split('.').map(Number)
        for (let i = 0; i < 4; i++) {
          const partA = ipA[i] ?? 0
          const partB = ipB[i] ?? 0
          if (partA !== partB) {
            return partA - partB
          }
        }
        return 0
      })

      const duration = (Date.now() - startTime) / 1000

      const result: Out = {
        devices,
        networkRange,
        scanMethod: method,
        duration,
        errors: errors.length > 0 ? errors : undefined,
      }

      yield {
        type: 'result',
        data: result,
        resultForAssistant: this.renderResultForAssistant(result),
      }
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      const result: Out = {
        devices: [],
        networkRange,
        scanMethod: method,
        duration,
        errors: [errorMessage],
      }

      yield {
        type: 'result',
        data: result,
        resultForAssistant: this.renderResultForAssistant(result),
      }
    }
  },
} satisfies Tool<In, Out>
