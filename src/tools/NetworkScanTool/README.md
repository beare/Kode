# NetworkScanTool

A comprehensive network scanning tool for discovering devices on local networks using multiple discovery protocols and techniques.

## Features

- **Multiple Scan Methods**: Quick, standard, and comprehensive scanning modes
- **Protocol Support**:
  - ARP (Address Resolution Protocol) scanning
  - ICMP ping sweep
  - mDNS/Bonjour service discovery
  - DNS hostname resolution
- **Device Information**:
  - IP addresses
  - MAC addresses
  - Hardware vendors (via MAC OUI lookup)
  - Hostnames
  - Response times
  - Network services (in comprehensive mode)
- **Cross-Platform**: Supports macOS, Linux, and Windows

## Usage

The tool accepts the following parameters:

```typescript
{
  target?: string,      // Network range in CIDR notation (e.g., "192.168.1.0/24")
  method?: "quick" | "standard" | "comprehensive",
  timeout?: number      // Scan timeout in seconds (default: 30)
}
```

### Scan Methods

1. **quick**: Fast ping sweep only
   - Fastest option
   - Only detects active hosts and response times
   - No MAC address or vendor information

2. **standard** (default): ARP + ping sweep
   - Good balance of speed and detail
   - Provides IP, MAC, vendor, and response time
   - Recommended for most use cases

3. **comprehensive**: All discovery methods
   - Slowest but most detailed
   - Includes mDNS service discovery
   - May require elevated privileges

### Examples

```typescript
// Auto-detect network and use standard scan
{ }

// Scan specific network range
{ target: "192.168.1.0/24" }

// Quick scan with custom timeout
{ method: "quick", timeout: 15 }

// Comprehensive scan
{ method: "comprehensive", timeout: 60 }
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
    services?: string[]
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

### MAC Vendor Database

The tool includes an offline MAC OUI (Organizationally Unique Identifier) database for common vendors including:
- Apple devices
- Cisco networking equipment
- VMware virtual machines
- Samsung, Dell, Intel, Microsoft devices
- And many more

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
