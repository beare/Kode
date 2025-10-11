# Service Discovery Enhancements

This document describes the enhanced service discovery capabilities added to the NetworkScanTool based on industry-standard protocols from Context7 documentation.

## Overview

The NetworkScanTool now implements comprehensive service discovery using multiple standardized protocols:

1. **Enhanced mDNS/DNS-SD** (RFC 6762/6763)
2. **SSDP/UPnP** Discovery
3. **Hikvision SADP** Protocol
4. **Apple AirPlay/Bonjour** Discovery

## 1. Enhanced mDNS/DNS-SD Discovery

### Standards Compliance
- **RFC 6762**: Multicast DNS specification
- **RFC 6763**: DNS-Based Service Discovery specification

### Supported Service Types (30+)

The tool now discovers a comprehensive set of standard service types:

#### Network Services
- `_http._tcp` - Web servers
- `_https._tcp` - Secure web servers
- `_ssh._tcp` - SSH servers
- `_sftp-ssh._tcp` - SFTP servers
- `_ftp._tcp` - FTP servers

#### Printing Services
- `_printer._tcp` - Network printers
- `_ipp._tcp` - Internet Printing Protocol
- `_scanners._tcp` - Network scanners

#### Apple Services
- `_airplay._tcp` - Apple AirPlay
- `_raop._tcp` - Remote Audio Output Protocol
- `_touch-able._tcp` - Apple TV Remote
- `_companion-link._tcp` - Apple TV Companion
- `_homekit._tcp` - HomeKit devices
- `_hap._tcp` - HomeKit Accessory Protocol
- `_afpovertcp._tcp` - Apple File Protocol
- `_net-assistant._udp` - Apple Remote Desktop

#### Media & Entertainment
- `_googlecast._tcp` - Google Chromecast
- `_spotify-connect._tcp` - Spotify Connect
- `_sonos._tcp` - Sonos speakers
- `_daap._tcp` - Digital Audio Access Protocol
- `_dpap._tcp` - Digital Photo Access Protocol

#### File Sharing
- `_smb._tcp` - SMB/CIFS file sharing
- `_nfs._tcp` - Network File System
- `_workstation._tcp` - Workstation services

#### Other Services
- `_device-info._tcp` - Device information
- `_rdlink._tcp` - Remote Desktop
- `_rfb._tcp` - VNC (Remote Frame Buffer)
- `_iscsi._tcp` - iSCSI storage
- `_nvstream._tcp` - NVIDIA GameStream
- `_sleep-proxy._udp` - Sleep Proxy servers

### Platform-Specific Implementation

#### macOS
- Uses native `dns-sd` command for optimal Bonjour support
- Browses each service type with parallel execution
- Resolves services to IP addresses using `dns-sd -L`
- Extracts instance names, hostnames, and service types

#### Linux
- Uses Avahi (if available) for mDNS/DNS-SD
- Leverages `avahi-browse` with parseable output format
- Extracts IP addresses, hostnames, ports, and TXT records

### Device Type Identification

The enhanced mDNS implementation automatically identifies device types based on discovered services:

- **Apple TV / AirPlay Device**: Devices advertising `_airplay._tcp` or `_raop._tcp`
- **Printer**: Devices advertising `_printer._tcp` or `_ipp._tcp`
- **HomeKit Device**: Devices advertising `_homekit._tcp` or `_hap._tcp`
- **Chromecast**: Devices advertising `_googlecast._tcp`
- **Sonos Speaker**: Devices advertising `_sonos._tcp`

## 2. SSDP/UPnP Discovery

### Protocol Implementation
Based on the UPnP Device Architecture specification and IETF standards.

### Discovery Method
- Sends M-SEARCH multicast messages to `239.255.255.250:1900`
- Listens for SSDP responses from UPnP devices
- Parses response headers (LOCATION, SERVER, ST, USN)
- Maximum response time (MX) of 3 seconds

### Supported Service Types
- `ssdp:all` - All devices and services
- `upnp:rootdevice` - Root devices
- `urn:schemas-upnp-org:device:MediaServer:1` - Media servers
- `urn:schemas-upnp-org:device:MediaRenderer:1` - Media renderers
- `urn:schemas-upnp-org:device:InternetGatewayDevice:1` - Routers/gateways
- `urn:dial-multiscreen-org:service:dial:1` - DIAL protocol (Netflix, YouTube)

### Device Type Identification

SSDP discovery automatically identifies:

- **Media Server**: Devices providing media content
- **Media Renderer**: Devices that can play media (Smart TVs, speakers)
- **Router/Gateway**: Internet gateway devices
- **Smart TV/Streaming Device**: DIAL-enabled devices

### Extracted Information
- IP address from response
- Device location URL
- Server/manufacturer information
- All advertised service types

## 3. Integration and Merging

The tool intelligently merges data from multiple discovery protocols:

### Data Prioritization
1. **IP Address**: Primary key for device identification
2. **Hostname**: From mDNS or reverse DNS lookup
3. **Device Type**: Inferred from services or protocol-specific info
4. **Services**: Combined list from all discovery methods
5. **Vendor**: From MAC OUI, SSDP server header, or protocol-specific

### Comprehensive Scan Flow
```
1. ARP Scan → Get MAC addresses and vendors
2. Ping Sweep → Identify active hosts
3. mDNS/DNS-SD → Discover 30+ service types
4. SSDP/UPnP → Find media devices and IoT
5. Hikvision SADP → Locate IP cameras
6. Apple AirPlay → Find Apple TV devices
7. Merge all results by IP address
8. Resolve hostnames for all devices
```

## 4. Performance Optimizations

### Parallel Execution
- Multiple service type queries execute concurrently
- Batch processing for ping sweeps and port scans
- Timeout controls for each protocol (2-5 seconds)

### Resource Management
- AbortController support for early termination
- Configurable timeouts to prevent hanging
- Error handling that doesn't block other discoveries

### Network Efficiency
- Multicast TTL of 4 for SSDP
- Staggered M-SEARCH messages (200ms intervals)
- Short listening periods (3-5 seconds)

## 5. Use Cases

### Home Network Discovery
Comprehensive mode discovers:
- Smart TVs (via SSDP/DIAL)
- Chromecast devices (via mDNS)
- Apple TVs (via AirPlay/mDNS)
- Sonos speakers (via mDNS)
- HomeKit devices (via mDNS HAP)
- Printers (via mDNS IPP)
- NAS devices (via SSDP/SMB)

### IoT Device Discovery
Identifies:
- IP cameras (Hikvision SADP)
- Smart home hubs
- Media servers
- Network storage
- Gaming consoles (UPnP)

### Network Administration
Provides:
- Service inventory
- Device classification
- Vendor identification
- Port/protocol information
- Hostname resolution

## 6. Security Considerations

### Privacy
- Local network only (multicast)
- No external communication
- User permission required

### Best Practices
- Only scan networks you own or have permission to scan
- Some methods require elevated privileges
- May trigger security alerts on monitored networks
- Firewall rules may block some protocols

## 7. Platform Support

| Feature | macOS | Linux | Windows |
|---------|-------|-------|---------|
| mDNS (native) | ✅ dns-sd | ✅ Avahi | ⚠️ Limited |
| SSDP/UPnP | ✅ | ✅ | ✅ |
| ARP Scan | ✅ | ✅ | ✅ |
| Ping Sweep | ✅ | ✅ | ✅ |
| Hikvision SADP | ✅ | ✅ | ✅ |
| Apple AirPlay | ✅ | ⚠️ Limited | ❌ |

## 8. Example Output

```json
{
  "ip": "192.168.1.10",
  "mac": "A8:20:66:XX:XX:XX",
  "hostname": "Apple-TV.local",
  "vendor": "Apple, Inc.",
  "deviceType": "Apple TV / AirPlay Device",
  "model": "Apple TV",
  "port": 7000,
  "services": [
    "_airplay",
    "_raop",
    "_touch-able",
    "_companion-link",
    "_homekit"
  ],
  "responseTime": 5
}
```

## References

### Standards
- RFC 6762: Multicast DNS
- RFC 6763: DNS-Based Service Discovery
- RFC 2782: DNS SRV Records
- UPnP Device Architecture Specification
- IETF SSDP/DIAL Protocol

### Libraries Referenced
- HashiCorp mDNS (Go implementation)
- JmDNS (Java implementation)
- node-ssdp (Node.js implementation)

### Documentation Sources
- Context7 library documentation
- Apple Bonjour Programming Guide
- UPnP Forum specifications
