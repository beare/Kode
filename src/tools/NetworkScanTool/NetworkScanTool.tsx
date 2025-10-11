import { exec } from 'node:child_process'
import { platform } from 'node:os'
import { promisify } from 'node:util'
import { Box, Text } from 'ink'
import * as React from 'react'
import { z } from 'zod'
import * as mdns from 'mdns-js'
import { FallbackToolUseRejectedMessage } from '@components/FallbackToolUseRejectedMessage'
import type { Tool } from '@tool'
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
    .enum(['scan', 'discovery'])
    .optional()
    .default('discovery')
    .describe(
      'Method: "scan" (ARP + Ping sweep for active hosts), "discovery" (mDNS/DNS-SD protocols for service discovery including ZNB devices, Hikvision cameras, Apple TV, etc.)',
    ),
  timeout: z
    .number()
    .optional()
    .default(30)
    .describe('Timeout in seconds (default: 30)'),
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
    deviceType?: string
    model?: string
    firmwareVersion?: string
    port?: number
    txtRecords?: Record<string, string>
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
  '00:12:12': 'Hangzhou Hikvision Digital Technology',
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
  '2C:AB:EB': 'Hangzhou Hikvision Digital Technology',
  '34:28:F7': 'Hangzhou Hikvision Digital Technology',
  '3C:07:54': 'Apple, Inc.',
  '40:6C:8F': 'Apple, Inc.',
  '44:19:B6': 'Hangzhou Hikvision Digital Technology',
  '48:D7:05': 'Apple, Inc.',
  '4C:BD:8F': 'Hangzhou Hikvision Digital Technology',
  '50:ED:3C': 'Apple, Inc.',
  '54:C4:15': 'Hangzhou Hikvision Digital Technology',
  '5C:95:AE': 'Apple, Inc.',
  '60:03:08': 'Apple, Inc.',
  '68:5B:35': 'Apple, Inc.',
  '6C:E8:73': 'Hangzhou Hikvision Digital Technology',
  '70:56:81': 'Apple, Inc.',
  '78:31:C1': 'Apple, Inc.',
  '7C:B2:1B': 'Hangzhou Hikvision Digital Technology',
  '80:E6:50': 'Apple, Inc.',
  '88:66:5A': 'Apple, Inc.',
  '90:72:40': 'Apple, Inc.',
  '98:01:A7': 'Apple, Inc.',
  'A0:99:9B': 'Apple, Inc.',
  'A4:14:37': 'Hangzhou Hikvision Digital Technology',
  'A8:20:66': 'Apple, Inc.',
  'AC:BC:32': 'Apple, Inc.',
  'B0:34:95': 'Apple, Inc.',
  'BC:AD:28': 'Hangzhou Hikvision Digital Technology',
  'B4:F0:AB': 'Apple, Inc.',
  'BC:3B:AF': 'Apple, Inc.',
  'C0:56:E3': 'Hangzhou Hikvision Digital Technology',
  'C4:2C:03': 'Apple, Inc.',
  'CC:29:F5': 'Apple, Inc.',
  'D0:66:7B': 'Hangzhou Hikvision Digital Technology',
  'D4:9A:20': 'Apple, Inc.',
  'DC:2B:61': 'Apple, Inc.',
  'E4:CE:8F': 'Apple, Inc.',
  'EC:35:86': 'Apple, Inc.',
  'EC:71:DB': 'Hangzhou Hikvision Digital Technology',
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

// Enhanced mDNS/DNS-SD (Service Discovery) implementation using mdns-js library
// Based on RFC 6762 (Multicast DNS) and RFC 6763 (DNS-Based Service Discovery)
async function performMdnsScan(
  signal: AbortSignal,
): Promise<Map<string, { hostname?: string; services: string[]; ip?: string; txtRecords?: Record<string, string>; port?: number; deviceType?: string }>> {
  return new Promise((resolve) => {
    const devices = new Map<string, { hostname?: string; services: string[]; ip?: string; txtRecords?: Record<string, string>; port?: number; deviceType?: string }>()

    // Create browser instance for service discovery
    const browser = mdns.createBrowser(mdns.tcp('znb'))

    // Track discovered instances to avoid duplicates
    const discoveredInstances = new Set<string>()

    // Timeout for mDNS discovery
    const timeout = setTimeout(() => {
      cleanup()
    }, 8000) // 8 seconds for discovery

    const cleanup = () => {
      clearTimeout(timeout)
      try {
        browser.stop()
      } catch {
        // Ignore stop errors
      }
      resolve(devices)
    }

    // Handle abort signal
    if (signal.aborted) {
      cleanup()
      return
    }

    signal.addEventListener('abort', cleanup, { once: true })

    // Handle browser ready event
    browser.on('ready', () => {
      try {
        browser.discover()
      } catch {
        // Ignore discovery errors
      }
    })

    // Handle service updates
    browser.on('update', (data: any) => {
      try {
        if (!data) return

        // Extract service information from mdns-js data
        const fullname = data.fullname || data.name
        const type = data.type?.[0]?.name || ''
        const hostname = data.host
        const port = data.port
        const ip = data.addresses?.[0]
        const txt = data.txt

        if (!fullname || discoveredInstances.has(fullname)) {
          return
        }

        discoveredInstances.add(fullname)

        // Clean up instance name
        const cleanInstanceName = fullname
          .replace(/\._znb\._tcp\.local/g, '')
          .replace(/\._tcp\.local/g, '')
          .replace(/\._udp\.local/g, '')
          .replace(/\.local$/g, '')

        // Extract service name
        const serviceName = type
          .replace(/^_/, '')
          .replace(/\._tcp\.local/g, '')
          .replace(/\._udp\.local/g, '')
          .replace(/\.local$/g, '')

        // Parse TXT records
        let parsedTxtRecords: Record<string, string> | undefined
        if (txt && Array.isArray(txt)) {
          parsedTxtRecords = {}
          for (const entry of txt) {
            if (typeof entry === 'string') {
              const eqIndex = entry.indexOf('=')
              if (eqIndex > 0) {
                const key = entry.substring(0, eqIndex).trim()
                const value = entry.substring(eqIndex + 1).trim()
                parsedTxtRecords[key] = value
              }
            }
          }
          if (Object.keys(parsedTxtRecords).length === 0) {
            parsedTxtRecords = undefined
          }
        }

        // Use IP if available, otherwise hostname, otherwise instance name
        const key = ip || hostname || fullname

        // Determine device type from service
        let deviceType: string | undefined
        if (serviceName.includes('znb')) {
          deviceType = 'ZNB Device'
        } else if (serviceName.includes('airplay') || serviceName.includes('raop')) {
          deviceType = 'Apple TV / AirPlay Device'
        } else if (serviceName.includes('printer') || serviceName.includes('ipp')) {
          deviceType = 'Printer'
        } else if (serviceName.includes('homekit') || serviceName.includes('hap')) {
          deviceType = 'HomeKit Device'
        } else if (serviceName.includes('googlecast')) {
          deviceType = 'Chromecast'
        } else if (serviceName.includes('sonos')) {
          deviceType = 'Sonos Speaker'
        }

        const existing = devices.get(key)
        if (existing) {
          // Merge with existing device
          if (!existing.services.includes(serviceName)) {
            existing.services.push(serviceName)
          }
          if (ip && !existing.ip) existing.ip = ip
          if (hostname && !existing.hostname) existing.hostname = hostname
          if (port && !existing.port) existing.port = port
          if (parsedTxtRecords && !existing.txtRecords) {
            existing.txtRecords = parsedTxtRecords
          }
          if (deviceType && !existing.deviceType) {
            existing.deviceType = deviceType
          }
        } else {
          // Add new device
          devices.set(key, {
            hostname: cleanInstanceName,
            services: [serviceName],
            ip,
            port: port && port > 0 ? port : undefined,
            txtRecords: parsedTxtRecords,
            deviceType,
          })
        }
      } catch {
        // Ignore parsing errors for individual responses
      }
    })
  })
}

// SSDP/UPnP Discovery (Simple Service Discovery Protocol)
// Based on UPnP Device Architecture specification
async function performSsdpScan(
  signal: AbortSignal,
): Promise<Map<string, { deviceType?: string; manufacturer?: string; model?: string; services: string[] }>> {
  const devices = new Map<string, { deviceType?: string; manufacturer?: string; model?: string; services: string[] }>()

  try {
    // Create a simple Node.js script for SSDP M-SEARCH
    const ssdpScript = `
const dgram = require('dgram');
const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

const discoveredDevices = new Map();

socket.on('message', (msg, rinfo) => {
  try {
    const response = msg.toString('utf8');
    const ip = rinfo.address;

    // Parse SSDP response headers
    const lines = response.split('\\r\\n');
    let location = '';
    let server = '';
    let st = ''; // Service Type
    let usn = ''; // Unique Service Name

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.startsWith('location:')) {
        location = line.substring(9).trim();
      } else if (lower.startsWith('server:')) {
        server = line.substring(7).trim();
      } else if (lower.startsWith('st:')) {
        st = line.substring(3).trim();
      } else if (lower.startsWith('usn:')) {
        usn = line.substring(4).trim();
      }
    }

    if (!discoveredDevices.has(ip)) {
      discoveredDevices.set(ip, {
        ip: ip,
        location: location,
        server: server,
        services: []
      });
    }

    const device = discoveredDevices.get(ip);
    if (st && !device.services.includes(st)) {
      device.services.push(st);
    }

  } catch (e) {
    // Ignore parse errors
  }
});

socket.on('listening', () => {
  socket.setBroadcast(true);
  socket.setMulticastTTL(4);

  // SSDP M-SEARCH message
  const searchTargets = [
    'ssdp:all',                           // All devices and services
    'upnp:rootdevice',                    // Root devices
    'urn:schemas-upnp-org:device:MediaServer:1',
    'urn:schemas-upnp-org:device:MediaRenderer:1',
    'urn:schemas-upnp-org:device:InternetGatewayDevice:1',
    'urn:dial-multiscreen-org:service:dial:1', // DIAL (Netflix, YouTube)
  ];

  searchTargets.forEach((st, index) => {
    setTimeout(() => {
      const message = Buffer.from(
        'M-SEARCH * HTTP/1.1\\r\\n' +
        'HOST: 239.255.255.250:1900\\r\\n' +
        'MAN: "ssdp:discover"\\r\\n' +
        'MX: 3\\r\\n' +
        'ST: ' + st + '\\r\\n' +
        '\\r\\n'
      );
      socket.send(message, 1900, '239.255.255.250');
    }, index * 200);
  });

  // Wait for responses
  setTimeout(() => {
    // Output results as JSON
    discoveredDevices.forEach((device, ip) => {
      console.log(JSON.stringify(device));
    });
    socket.close();
  }, 5000);
});

socket.bind(0);
`

    const { stdout } = await execAsync(
      `node -e ${JSON.stringify(ssdpScript)}`,
      { signal, timeout: 6000 }
    )

    const lines = stdout.split('\n')
    for (const line of lines) {
      if (!line.trim()) continue

      try {
        const parsed = JSON.parse(line)
        if (parsed.ip) {
          // Parse device type from services
          let deviceType = 'UPnP Device'
          if (parsed.services.some((s: string) => s.includes('MediaServer'))) {
            deviceType = 'Media Server'
          } else if (parsed.services.some((s: string) => s.includes('MediaRenderer'))) {
            deviceType = 'Media Renderer'
          } else if (parsed.services.some((s: string) => s.includes('InternetGatewayDevice'))) {
            deviceType = 'Router/Gateway'
          } else if (parsed.services.some((s: string) => s.includes('dial'))) {
            deviceType = 'Smart TV/Streaming Device'
          }

          // Parse manufacturer from server string
          let manufacturer: string | undefined
          if (parsed.server) {
            const serverParts = parsed.server.split(/[\s/]/)
            if (serverParts.length > 0) {
              manufacturer = serverParts[0]
            }
          }

          devices.set(parsed.ip, {
            deviceType,
            manufacturer,
            services: parsed.services || [],
          })
        }
      } catch {
        // Not valid JSON, skip
      }
    }
  } catch {
    // SSDP discovery failed
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

// Hikvision SADP (Search Active Devices Protocol) Discovery
// Hikvision devices respond to UDP broadcast on port 37020
async function discoverHikvisionDevices(
  signal: AbortSignal,
): Promise<Map<string, { model?: string; port?: number; firmwareVersion?: string }>> {
  const devices = new Map<string, { model?: string; port?: number; firmwareVersion?: string }>()

  try {
    // Create a simple Node.js script to send SADP discovery packet
    const discoveryScript = `
const dgram = require('dgram');
const socket = dgram.createSocket('udp4');

socket.on('message', (msg, rinfo) => {
  try {
    const xml = msg.toString('utf8');
    // Parse basic info from Hikvision SADP XML response
    const ipMatch = xml.match(/<IPv4Address>(.*?)<\\/IPv4Address>/);
    const portMatch = xml.match(/<CommandPort>(.*?)<\\/CommandPort>/);
    const modelMatch = xml.match(/<DeviceType>(.*?)<\\/DeviceType>/);
    const versionMatch = xml.match(/<DeviceVersion>(.*?)<\\/DeviceVersion>/);

    if (ipMatch && ipMatch[1]) {
      const result = {
        ip: ipMatch[1],
        port: portMatch ? portMatch[1] : undefined,
        model: modelMatch ? modelMatch[1] : undefined,
        version: versionMatch ? versionMatch[1] : undefined
      };
      console.log(JSON.stringify(result));
    }
  } catch (e) {
    // Ignore parse errors
  }
});

socket.on('listening', () => {
  socket.setBroadcast(true);

  // SADP discovery packet (simplified)
  const sadpPacket = Buffer.from([
    0x21, 0x00, 0x00, 0x14, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00
  ]);

  socket.send(sadpPacket, 37020, '255.255.255.255');

  // Listen for 3 seconds
  setTimeout(() => {
    socket.close();
  }, 3000);
});

socket.bind(37020);
`

    const { stdout } = await execAsync(
      `node -e ${JSON.stringify(discoveryScript)}`,
      { signal, timeout: 5000 }
    )

    const lines = stdout.split('\n')
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line)
        if (parsed.ip) {
          devices.set(parsed.ip, {
            model: parsed.model,
            port: parsed.port ? Number.parseInt(parsed.port, 10) : 80,
            firmwareVersion: parsed.version,
          })
        }
      } catch {
        // Not valid JSON, skip
      }
    }
  } catch {
    // SADP discovery failed
  }

  return devices
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
            {data.scanMethod} spent ({data.duration.toFixed(1)}s)
          </Text>
        </Box>
        {data.devices.slice(0, 10).map((device) => (
          <Box key={device.ip} flexDirection="column" marginLeft={2}>
            <Text>
              {device.ip}
              {device.hostname && ` (${device.hostname})`}
              {device.deviceType && ` - ${device.deviceType}`}
            </Text>
            {device.model && (
              <Text color={theme.secondaryText}>
                  Model: {device.model}
              </Text>
            )}
            {device.mac && (
              <Text color={theme.secondaryText}>
                  MAC: {device.mac}
                {device.vendor && ` - ${device.vendor}`}
              </Text>
            )}
            {device.port && (
              <Text color={theme.secondaryText}>
                  Port: {device.port}
              </Text>
            )}
            {device.firmwareVersion && (
              <Text color={theme.secondaryText}>
                  Firmware: {device.firmwareVersion}
              </Text>
            )}
            {device.responseTime && (
              <Text color={theme.secondaryText}>
                  Response: {device.responseTime}ms
              </Text>
            )}
            {device.txtRecords && Object.keys(device.txtRecords).length > 0 && (
              <Text color={theme.secondaryText}>
                  TXT: {Object.entries(device.txtRecords).map(([k, v]) => `${k}=${v}`).join(', ')}
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
      if (device.deviceType) result += `  Device Type: ${device.deviceType}\n`
      if (device.model) result += `  Model: ${device.model}\n`
      if (device.hostname) result += `  Hostname: ${device.hostname}\n`
      if (device.mac) result += `  MAC: ${device.mac}\n`
      if (device.vendor) result += `  Vendor: ${device.vendor}\n`
      if (device.port) result += `  Port: ${device.port}\n`
      if (device.firmwareVersion)
        result += `  Firmware: ${device.firmwareVersion}\n`
      if (device.responseTime)
        result += `  Response Time: ${device.responseTime}ms\n`
      if (device.services && device.services.length > 0)
        result += `  Services: ${device.services.join(', ')}\n`
      if (device.txtRecords && Object.keys(device.txtRecords).length > 0) {
        result += `  TXT Records:\n`
        for (const [key, value] of Object.entries(device.txtRecords)) {
          result += `    ${key}=${value}\n`
        }
      }
      result += '\n'
    }

    if (out.errors && out.errors.length > 0) {
      result += `\nErrors encountered:\n${out.errors.join('\n')}`
    }

    return result
  },
  async *call({ target, method = 'discovery' }, { abortController }) {
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
          deviceType?: string
          model?: string
          firmwareVersion?: string
          port?: number
          txtRecords?: Record<string, string>
        }
      >()

      // Perform operations based on method
      if (method === 'scan') {
        // Scan mode: ARP + Ping sweep for active hosts
        const arpResults = await performArpScan(
          networkRange,
          abortController.signal,
        )

        const pingResults = await performPingSweep(
          networkRange,
          abortController.signal,
        )

        // Merge ARP and Ping results
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
      } else {
        // Discovery mode: mDNS/DNS-SD and other discovery protocols
        // Enhanced mDNS/DNS-SD scan
        try {
          const mdnsResults = await performMdnsScan(abortController.signal)
          for (const [key, mdnsInfo] of mdnsResults) {
            const ip = mdnsInfo.ip || key
            const existing = devicesMap.get(ip)

            if (existing) {
              // Merge mDNS data with existing device
              if (mdnsInfo.hostname && !existing.hostname) {
                existing.hostname = mdnsInfo.hostname
              }
              if (mdnsInfo.port && !existing.port) {
                existing.port = mdnsInfo.port
              }
              if (mdnsInfo.txtRecords && !existing.txtRecords) {
                existing.txtRecords = mdnsInfo.txtRecords
              }
              existing.services = existing.services || []
              for (const service of mdnsInfo.services) {
                if (!existing.services.includes(service)) {
                  existing.services.push(service)
                }
              }
              // Identify device type from services
              if (!existing.deviceType && mdnsInfo.services.length > 0) {
                if (mdnsInfo.services.some(s => s.includes('znb'))) {
                  existing.deviceType = 'ZNB Device'
                } else if (mdnsInfo.services.some(s => s.includes('airplay') || s.includes('raop'))) {
                  existing.deviceType = 'Apple TV / AirPlay Device'
                } else if (mdnsInfo.services.some(s => s.includes('printer') || s.includes('ipp'))) {
                  existing.deviceType = 'Printer'
                } else if (mdnsInfo.services.some(s => s.includes('homekit') || s.includes('hap'))) {
                  existing.deviceType = 'HomeKit Device'
                } else if (mdnsInfo.services.some(s => s.includes('googlecast'))) {
                  existing.deviceType = 'Chromecast'
                } else if (mdnsInfo.services.some(s => s.includes('sonos'))) {
                  existing.deviceType = 'Sonos Speaker'
                }
              }
            } else if (mdnsInfo.ip) {
              // Add new device from mDNS
              let deviceType: string | undefined
              if (mdnsInfo.services.some(s => s.includes('znb'))) {
                deviceType = 'ZNB Device'
              } else if (mdnsInfo.services.some(s => s.includes('airplay'))) {
                deviceType = 'Apple TV / AirPlay Device'
              }

              devicesMap.set(ip, {
                ip: mdnsInfo.ip,
                hostname: mdnsInfo.hostname,
                services: mdnsInfo.services,
                deviceType,
                port: mdnsInfo.port,
                txtRecords: mdnsInfo.txtRecords,
              })
            }
          }
        } catch {
          errors.push('mDNS scan failed')
        }

        // SSDP/UPnP Discovery
        try {
          const ssdpResults = await performSsdpScan(abortController.signal)
          for (const [ip, ssdpInfo] of ssdpResults) {
            const existing = devicesMap.get(ip)

            if (existing) {
              // Merge SSDP data
              if (ssdpInfo.deviceType && !existing.deviceType) {
                existing.deviceType = ssdpInfo.deviceType
              }
              if (ssdpInfo.manufacturer && !existing.vendor) {
                existing.vendor = ssdpInfo.manufacturer
              }
              if (ssdpInfo.model && !existing.model) {
                existing.model = ssdpInfo.model
              }
              existing.services = existing.services || []
              for (const service of ssdpInfo.services) {
                if (!existing.services.includes(service)) {
                  existing.services.push(service)
                }
              }
            } else {
              // Add new device from SSDP
              devicesMap.set(ip, {
                ip,
                deviceType: ssdpInfo.deviceType,
                vendor: ssdpInfo.manufacturer,
                model: ssdpInfo.model,
                services: ssdpInfo.services,
              })
            }
          }
        } catch {
          errors.push('SSDP/UPnP discovery failed')
        }

        // Hikvision SADP discovery
        try {
          const hikvisionResults = await discoverHikvisionDevices(
            abortController.signal,
          )
          for (const [ip, info] of hikvisionResults) {
            const existing = devicesMap.get(ip)
            if (existing) {
              existing.deviceType = 'Hikvision Camera'
              existing.model = info.model
              existing.port = info.port
              existing.firmwareVersion = info.firmwareVersion
            } else {
              devicesMap.set(ip, {
                ip,
                deviceType: 'Hikvision Camera',
                model: info.model,
                port: info.port,
                firmwareVersion: info.firmwareVersion,
                vendor: 'Hangzhou Hikvision Digital Technology',
              })
            }
          }
        } catch {
          errors.push('Hikvision SADP discovery failed')
        }

        // DNS hostname resolution for discovery mode
        const hostnamePromises = Array.from(devicesMap.keys()).map(async ip => {
          const hostname = await resolveHostname(ip)
          if (hostname) {
            const device = devicesMap.get(ip)
            if (device && !device.hostname) {
              device.hostname = hostname
            }
          }
        })

        await Promise.all(hostnamePromises)
      }

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
