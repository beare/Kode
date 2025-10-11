# NetworkScanTool

A comprehensive network scanning tool for discovering devices on local networks using multiple discovery protocols and techniques.

## Features

- **Two Methods**:
  - **Scan** (ARP + Ping for active hosts)
  - **Discovery** (mDNS/DNS-SD and other discovery protocols)
- **Protocol Support**:
  - ARP (Address Resolution Protocol) scanning
  - ICMP ping sweep
  - mDNS/Bonjour service discovery using `dns-sd -Z`
  - **ZNB device discovery** via mDNS (_znb._tcp service) with JSON TXT records
  - **Hikvision SADP protocol** for IP camera discovery
  - **Apple AirPlay protocol** for Apple TV discovery
  - SSDP/UPnP for smart home and media devices
  - DNS hostname resolution
- **Device Information**:
  - IP addresses
  - MAC addresses
  - Hardware vendors (via MAC OUI lookup)
  - Hostnames
  - Response times
  - **Device types** (Hikvision Camera, Apple TV, ZNB Device, etc.)
  - **Device models and firmware versions** (for specialized devices)
  - **Port numbers** (from mDNS and specialized protocols)
  - **TXT records** (mDNS metadata including version, model, features, etc.)
  - Network services (from mDNS/DNS-SD)
  - Discovered mDNS services
- **Cross-Platform**: Supports macOS, Linux, and Windows

## Usage

The tool accepts the following parameters:

```typescript
{
  target?: string,      // Network range in CIDR notation (e.g., "192.168.1.0/24")
  method?: "scan" | "discovery",
  timeout?: number      // Timeout in seconds (default: 30)
}
```

### Methods

1. **scan**: Network scanning (ARP + Ping)
   - ARP scanning for MAC addresses and vendor identification
   - Ping sweep for active host detection
   - Provides: IP, MAC, vendor, response time
   - Fast and efficient for basic network inventory
   - Use when you need to find active hosts on the network

2. **discovery** (default, recommended): Service discovery protocols
   - Enhanced mDNS/DNS-SD service discovery using `dns-sd -Z`
   - **Discovers ZNB devices via _znb._tcp with JSON TXT records**
   - **Discovers Hikvision IP cameras via SADP protocol**
   - **Discovers Apple TV devices via AirPlay protocol**
   - SSDP/UPnP discovery for smart TVs and media devices
   - Provides: IP, hostname, port, device type, TXT records, services
   - May require elevated privileges for full functionality
   - **Recommended for IoT devices and smart home discovery**

### Examples

```typescript
// Auto-detect network and use discovery mode (recommended)
{ }

// Scan mode (ARP + Ping)
{ method: "scan" }

// Discovery mode with specific network range
{ method: "discovery", target: "192.168.1.0/24" }

// Extended timeout for larger networks
{ timeout: 60 }
```

## Output Format

```typescript
{
  devices: Array<{
    ip: string,
    mac?: string,
    hostname?: string,
    vendor?: string,
    responseTime?: number,
    services?: string[],
    deviceType?: string,        // e.g., "Hikvision Camera", "Apple TV", "ZNB Device"
    model?: string,              // Device model number
    firmwareVersion?: string,    // Firmware version (for cameras)
    port?: number,               // Primary service port
    txtRecords?: Record<string, string>  // mDNS TXT records (device metadata)
  }>,
  networkRange: string,
  scanMethod: string,
  duration: number,
  errors?: string[]
}
```

## Platform-Specific Notes

### macOS
- Full support for all scan methods
- Uses native tools: `arp`, `ping`, `dns-sd`, `ifconfig`
- mDNS discovery works out of the box
- No additional dependencies required

### Linux
- Full support for all scan methods
- Uses: `arp`, `ping`, `ip`, `host`/`dig`
- mDNS requires `avahi-browse` (install via `avahi-utils` package)
- Some operations may require `sudo` for best results

### Windows
- Partial support (quick and standard methods work well)
- Uses: `arp`, `ping`, `ipconfig`, `nslookup`
- mDNS/Bonjour requires Apple's Bonjour service
- Comprehensive mode has limited functionality

## Security Considerations

⚠️ **Important Security Notes**:

1. **Authorization**: Only scan networks you own or have explicit permission to scan
2. **Network Policies**: Network scanning may trigger security alerts on monitored networks
3. **Privileges**: Some scan methods require elevated privileges (root/administrator)
4. **Firewall**: Results may be affected by firewall rules and network configuration
5. **Privacy**: Be mindful of privacy concerns when scanning shared networks

## Technical Details

### Network Discovery Techniques

1. **ARP Scanning**
   - Layer 2 discovery via Address Resolution Protocol
   - Most reliable for local network device detection
   - Provides MAC addresses for vendor identification
   - Limited to local subnet

2. **Ping Sweep**
   - ICMP echo requests to detect active hosts
   - Measures response times
   - Works across subnets (if routing allows)
   - May be blocked by firewalls

3. **mDNS Discovery**
   - Discovers services advertised via multicast DNS
   - Common for IoT devices, printers, and smart home devices
   - Uses Bonjour/Avahi protocols
   - Limited to local network segment

4. **DNS Resolution**
   - Reverse DNS lookups for hostname discovery
   - Requires properly configured DNS infrastructure
   - May fail for devices without PTR records

5. **Hikvision SADP Discovery**
   - Search Active Devices Protocol (SADP)
   - UDP broadcast on port 37020
   - Discovers Hikvision IP cameras and DVRs/NVRs
   - Returns device model, firmware version, and HTTP port
   - Works on all Hikvision security products

6. **Apple TV AirPlay Discovery**
   - Uses Bonjour/mDNS `_airplay._tcp` service
   - Also scans for `_touch-able._tcp` (Apple TV Remote)
   - Port scanning on AirPlay port 7000
   - Discovers all Apple TV generations (HD, 4K, etc.)
   - Also discovers HomePods and AirPort Express with AirPlay

### MAC Vendor Database

The tool includes an offline MAC OUI (Organizationally Unique Identifier) database for common vendors including:
- **Hikvision IP cameras** (10+ MAC prefixes)
- Apple devices (iPhones, iPads, Macs, Apple TVs)
- Cisco networking equipment
- VMware virtual machines
- Samsung, Dell, Intel, Microsoft devices
- And many more

This allows immediate vendor identification even when network access is restricted.

## Limitations

- **Client Isolation**: Wireless networks with client isolation enabled will limit device discovery
- **Firewalls**: Strict firewall rules may prevent detection of some devices
- **VLANs**: Scanning is typically limited to the current VLAN/subnet
- **IoT Devices**: Some IoT devices only respond to specific protocols
- **Performance**: Large networks (/16 or larger) may take significant time to scan

## Troubleshooting

### No devices found
- Check network connectivity
- Verify the target network range is correct
- Try running with elevated privileges (sudo)
- Firewall may be blocking responses

### Incomplete information
- Use "comprehensive" scan method for more details
- Some devices don't respond to all protocols
- MAC addresses only available on local subnet

### Slow scans
- Reduce network range
- Use "quick" scan method
- Decrease timeout value (may miss some devices)

## Dependencies

### Runtime Dependencies
None - uses native system tools

### System Requirements
- macOS: 10.14+ (native tools included)
- Linux: Modern distribution with `net-tools` or `iproute2`
- Windows: Windows 10+ (native tools included)

### Optional Tools (for enhanced functionality)
- Linux: `avahi-utils` for mDNS discovery
- Linux: `nmap` for advanced port scanning (future enhancement)
