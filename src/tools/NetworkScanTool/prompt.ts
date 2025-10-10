export const DESCRIPTION = `Scans the local network to discover devices using various network discovery protocols and techniques.

This tool performs network scanning using multiple approaches:
- ARP scanning for Layer 2 device discovery
- Ping sweep for active host detection
- mDNS/Bonjour discovery for service advertisement
- NetBIOS name resolution (Windows networks)
- UPnP/SSDP discovery for network devices

The tool requires appropriate network permissions and works best when run with sufficient privileges.`

export const PROMPT = `You have access to a NetworkScan tool that can discover devices on the local network.

**Usage Guidelines:**
- Specify the target network range (e.g., "192.168.1.0/24") or leave empty to auto-detect
- Choose scan method: "quick" (ping only), "standard" (ARP + ping), or "comprehensive" (all methods)
- Set timeout for scan completion (default: 30 seconds)
- Be aware that comprehensive scans may take longer and require elevated privileges

**Scan Methods:**
1. **quick**: Fast ping sweep only, minimal information
2. **standard**: ARP + ping, good balance of speed and detail
3. **comprehensive**: All discovery methods, most detailed but slower

**Output Information:**
- IP addresses of discovered devices
- MAC addresses (when available via ARP)
- Hostnames (when resolvable)
- Device vendors (MAC OUI lookup)
- Open ports and services (in comprehensive mode)
- Response times

**Security Considerations:**
- Network scanning may trigger security alerts on monitored networks
- Some methods require root/administrator privileges
- Respect network policies and only scan networks you own or have permission to scan
- Firewall rules may block some discovery methods

**Platform Support:**
- macOS: Full support with native tools (arp, ping, dns-sd)
- Linux: Full support (requires net-tools, nmap for comprehensive scans)
- Windows: Partial support (arp, ping, netstat)

**Example Usage:**
- Scan default network: No parameters needed
- Scan specific range: target="192.168.1.0/24"
- Quick scan: method="quick"
- Detailed scan: method="comprehensive", timeout=60

**Limitations:**
- Devices with strict firewall rules may not respond
- Some IoT devices only respond to specific protocols
- Scan accuracy depends on network configuration
- Wireless networks may have client isolation enabled
`
