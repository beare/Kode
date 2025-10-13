export const DESCRIPTION = `Discovers devices on the local network using network scanning or discovery protocols.

This tool supports two modes:

**Scan Mode (ARP + Ping)**:
- ARP scanning for Layer 2 device discovery
- Ping sweep for active host detection
- Provides IP, MAC, vendor, and response time

**Discovery Mode (Network mapping and service discovery)**:
- Nmap network mapping for comprehensive device discovery (requires nmap to be installed)
- Enhanced mDNS/DNS-SD (RFC 6762/6763) discovery including ZNB devices
- SSDP/UPnP discovery for media servers, smart TVs, and IoT devices
- Hikvision SADP protocol for IP camera discovery
- Apple AirPlay protocol for Apple TV discovery
- Provides device type, port, TXT records, and detailed metadata

The tool requires appropriate network permissions. Discovery mode is recommended for IoT and smart home devices.`

export const PROMPT = `You have access to a NetworkScan tool that can discover devices on the local network.

**Usage Guidelines:**
- Specify the target network range (e.g., "192.168.1.0/24") or leave empty to auto-detect
- Choose method: "scan" (ARP + Ping) or "discovery" (mDNS/DNS-SD protocols)
- Set timeout for completion (default: 30 seconds)
- Discovery mode may require elevated privileges for full functionality

**Methods:**

1. **scan**: Network scanning via ARP + Ping
   - ARP scanning for MAC addresses and vendor identification
   - Ping sweep for active host detection and response times
   - Provides: IP, MAC, vendor, response time
   - Use for: Basic network inventory, finding active hosts

2. **discovery** (default, recommended): Network mapping and service discovery protocols
   - Nmap network scanning for comprehensive device discovery with MAC addresses and vendor info
   - Enhanced mDNS/DNS-SD for service types (ZNB, AirPlay, HomeKit, Chromecast, Printers, etc.)
   - SSDP/UPnP for media servers, routers, smart TVs, and streaming devices
   - Hikvision SADP protocol for IP cameras
   - Apple AirPlay protocol for Apple TV devices
   - ZNB device discovery via _znb._tcp service with JSON TXT records
   - Provides: IP, hostname, MAC, vendor, port, device type, TXT records (metadata), services
   - Use for: IoT devices, smart home discovery, detailed device information
   - Note: Requires nmap to be installed. If nmap is not found, install it using:
     * macOS: 'brew install nmap'
     * Linux: 'sudo apt-get install nmap' or 'sudo yum install nmap'
     * Windows: Download from https://nmap.org/download.html

**Output Information:**
- IP addresses of discovered devices
- MAC addresses (when available via ARP)
- Hostnames (when resolvable)
- Device vendors (MAC OUI lookup)
- Device types (Hikvision Camera, Apple TV, ZNB Device, etc.)
- Device models and firmware versions (for specialized devices)
- Port numbers (from mDNS and specialized protocols)
- TXT records (mDNS metadata: version, model, serial, features, etc.)
- Network services (from mDNS/DNS-SD)
- Response times

**Security Considerations:**
- Network scanning may trigger security alerts on monitored networks
- Some methods require root/administrator privileges
- Respect network policies and only scan networks you own or have permission to scan
- Firewall rules may block some discovery methods

**Platform Support:**
- macOS: Full support with native tools (arp, ping, dns-sd) + nmap recommended
- Linux: Full support (requires net-tools, avahi for mDNS) + nmap recommended
- Windows: Partial support (arp, ping) + nmap recommended

**Dependencies:**
- Discovery mode works best with nmap installed for comprehensive device information
- If nmap is not installed, discovery mode will still work but with limited MAC/vendor info
- When nmap errors occur, you should inform the user to install nmap for better results

**Example Usage:**
- Discovery mode (default): No parameters needed
- Scan mode: method="scan"
- Specific network range: target="192.168.1.0/24"
- Extended timeout: timeout=60

**Limitations:**
- Devices with strict firewall rules may not respond
- Some IoT devices only respond to specific protocols
- Scan accuracy depends on network configuration
- Wireless networks may have client isolation enabled
`
