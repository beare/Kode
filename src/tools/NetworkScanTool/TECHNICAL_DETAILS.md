# NetworkScanTool - Technical Implementation Details

## Specialized Device Discovery Protocols

### 1. Hikvision SADP (Search Active Devices Protocol)

#### Protocol Overview
SADP is Hikvision's proprietary discovery protocol used by all their IP cameras, DVRs, and NVRs.

#### Implementation Details

**Port**: UDP 37020 (broadcast)

**Discovery Packet Structure**:
```javascript
const sadpPacket = Buffer.from([
  0x21, 0x00, 0x00, 0x14, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00
]);
```

**Response Format**: XML over UDP
```xml
<?xml version="1.0" encoding="UTF-8"?>
<ProbeMatch>
  <IPv4Address>192.168.1.64</IPv4Address>
  <IPv4SubnetMask>255.255.255.0</IPv4SubnetMask>
  <IPv4Gateway>192.168.1.1</IPv4Gateway>
  <CommandPort>80</CommandPort>
  <HttpPort>80</HttpPort>
  <MAC>44:19:B6:A1:23:45</MAC>
  <DeviceType>DS-2CD2142FWD-I</DeviceType>
  <DeviceDescription>Hikvision IP Camera</DeviceDescription>
  <DeviceVersion>V5.5.82 build 190220</DeviceVersion>
  <DeviceSN>DS-2CD2142FWD-I20190101AAWRD00001</DeviceSN>
  <SupportBeep>true</SupportBeep>
  <Activated>true</Activated>
</ProbeMatch>
```

#### Parsed Information
- **IPv4Address**: Camera IP address
- **CommandPort**: Primary HTTP service port (usually 80)
- **DeviceType**: Exact model number
- **DeviceVersion**: Firmware version string
- **MAC**: Hardware MAC address

#### Known Hikvision MAC Prefixes
The tool includes 10+ Hikvision OUI prefixes:
```
00:12:12, 2C:AB:EB, 34:28:F7, 44:19:B6, 4C:BD:8F,
54:C4:15, 6C:E8:73, 7C:B2:1B, A4:14:37, BC:AD:28,
C0:56:E3, D0:66:7B, EC:71:DB
```

#### Timeout Strategy
- Broadcast sent once
- Listen for 3 seconds
- Multiple devices may respond
- Async collection of all responses

#### Limitations
- Requires UDP broadcast support (no VLAN boundaries)
- Devices must have SADP enabled (default on)
- Some older models may not support SADP
- Firewall may block UDP broadcast

---

### 2. Apple TV / AirPlay Discovery

#### Protocol Overview
Apple TV uses standard Bonjour/mDNS for service advertisement, specifically the `_airplay._tcp` service type.

#### Implementation Details

**Services Scanned**:
1. `_airplay._tcp.local` - AirPlay streaming service (port 7000)
2. `_touch-able._tcp.local` - Apple TV Remote protocol (port 49152)

**macOS Discovery Command**:
```bash
dns-sd -B _airplay._tcp local.
```

**Linux Discovery Command**:
```bash
avahi-browse -t _airplay._tcp
```

#### Discovery Methods

**Method 1: mDNS Service Discovery**
- Query for Bonjour services
- Look for "Apple TV" in service name
- Extract hostname and service info

**Method 2: Port Scanning**
- Scan entire subnet for port 7000 (AirPlay)
- Test connection to each IP
- If port 7000 responds, likely an Apple TV or AirPlay device

**Port Test Command** (Unix):
```bash
bash -c "echo > /dev/tcp/192.168.1.45/7000"
# Timeout is handled by execAsync options, not shell command
```

**Port Test Command** (Windows):
```powershell
Test-NetConnection -ComputerName 192.168.1.45 -Port 7000
```

#### Identified Devices
Not just Apple TV, but also:
- HomePod and HomePod mini
- AirPort Express
- Some third-party AirPlay 2 speakers
- Macs with AirPlay receiver enabled

#### Apple Device MAC Prefixes
50+ Apple OUI prefixes are recognized:
```
00:05:02, 00:0D:93, 00:16:CB, 00:17:F2, 00:1B:63,
00:1C:B3, 00:1E:52, 00:23:32, 00:25:00, 00:26:BB,
10:DD:B1, 18:65:90, 20:C9:D0, 28:CF:E9, 3C:07:54,
40:6C:8F, 48:D7:05, 50:ED:3C, 5C:95:AE, 60:03:08,
... (and many more)
```

#### Batch Processing
To avoid overwhelming the network:
```javascript
const scanPromises = []
for (let i = 1; i <= 254; i++) {
  scanPromises.push(checkPort(ip, 7000))

  // Process in batches of 20
  if (scanPromises.length >= 20) {
    await Promise.all(scanPromises)
    scanPromises.length = 0
  }
}
```

#### Timeout Strategy
- mDNS query: 5 seconds
- Port scan per IP: 1.5 seconds
- Total batch time: ~15 seconds for /24 network

---

### 3. ZNB Device Discovery

#### Protocol Overview
ZNB devices use standard mDNS/DNS-SD (Bonjour) for service advertisement with the service type `_znb._tcp`.

#### Implementation Details

**Service Type**: `_znb._tcp.local`

**Discovery Method**:
- Standard mDNS/DNS-SD service browsing
- Same mechanism as AirPlay, HomeKit, and other Bonjour services
- No proprietary protocol required

**macOS Discovery Command**:
```bash
# Comprehensive zone-style output (recommended)
dns-sd -Z _znb._tcp local.

# Browse only (lighter, less info)
dns-sd -B _znb._tcp local.
```

**Linux Discovery Command**:
```bash
avahi-browse -t _znb._tcp
```

#### Discovery Process

The tool uses `dns-sd -Z` on macOS to get comprehensive zone-file style output:

**Example Output**:
```
_znb._tcp                                       PTR     dev-pc_00e26994d903._znb._tcp
dev-pc_00e26994d903._znb._tcp                   SRV     0 0 5353 dev-pc_00e26994d903.
dev-pc_00e26994d903._znb._tcp                   TXT     "{"basicVersion":"2.3.4","mac":"00:e2:69:94:d9:03",...}"
```

**Parsing Logic**:
1. PTR record → Extract instance name
2. SRV record → Extract port (5353) and hostname
3. TXT record → Parse JSON or key=value pairs
4. Resolve hostname to IP using `dns-sd -G v4`

**Service Types**:
```javascript
const serviceTypes = [
  '_znb._tcp',  // ZNB devices
]
```

#### Identification Logic

When a device advertising `_znb._tcp` is found, it's automatically classified:

```typescript
if (mdnsInfo.services.some(s => s.includes('znb'))) {
  existing.deviceType = 'ZNB Device'
}
```

#### Retrieved Information
- **IP Address**: Resolved from mDNS announcement
- **Hostname**: mDNS instance name (e.g., "znb-device-001.local")
- **Service Type**: _znb._tcp identifier
- **Port Number**: Service port from mDNS record
- **TXT Records**: Key-value pairs from mDNS TXT records (device metadata)
- **MAC Address**: From ARP table (if available)
- **Additional Services**: May also advertise HTTP, SSH, etc.

#### Platform Support
- **macOS**: Native support via Bonjour/dns-sd
- **Linux**: Via Avahi (avahi-browse)
- **Windows**: Via Bonjour for Windows (if installed)

#### Integration with Other Discovery Methods

ZNB devices are discovered through the enhanced mDNS scan and merged with:
1. **ARP data**: Adds MAC address and vendor info
2. **Ping data**: Adds response time
3. **DNS data**: May add additional hostname info

#### Advantages
- ✅ Standard protocol (RFC 6762/6763)
- ✅ No proprietary implementation needed
- ✅ Works with existing mDNS infrastructure
- ✅ Cross-platform compatible
- ✅ Automatic hostname resolution

#### Limitations
- ❌ mDNS is local network only (no routing across subnets)
- ❌ Requires mDNS responder on device
- ❌ May be blocked by some firewalls (UDP 5353)
- ❌ Device must actively advertise service

---

## Architecture

### Scan Flow

```
┌─────────────────────────────────────────────┐
│        NetworkScanTool.call()               │
└────────────────┬────────────────────────────┘
                 │
                 ├─► Quick Mode
                 │   └─► Ping Sweep
                 │
                 ├─► Standard Mode
                 │   ├─► ARP Scan
                 │   ├─► Ping Sweep
                 │   └─► DNS Resolution
                 │
                 └─► Comprehensive Mode
                     ├─► ARP Scan
                     ├─► Ping Sweep
                     ├─► Enhanced mDNS Discovery (30+ services) ◄── ENHANCED
                     │   ├─► ZNB Devices (_znb._tcp) ◄── NEW
                     │   ├─► AirPlay Devices
                     │   ├─► HomeKit Devices
                     │   └─► Other Services
                     ├─► SSDP/UPnP Discovery ◄── NEW
                     ├─► Hikvision SADP ◄── NEW
                     ├─► Apple TV AirPlay ◄── NEW
                     └─► DNS Resolution
```

### Data Flow

```typescript
devicesMap: Map<string, {
  ip: string
  mac?: string              // from ARP
  hostname?: string         // from DNS / mDNS
  vendor?: string           // from MAC OUI
  responseTime?: number     // from ping
  services?: string[]       // from mDNS
  deviceType?: string       // from SADP/AirPlay/mDNS
  model?: string            // from SADP/AirPlay
  firmwareVersion?: string  // from SADP
  port?: number             // from SADP/AirPlay/mDNS
  txtRecords?: Record<string, string>  // from mDNS TXT records ◄── NEW
}>
```

### Merging Strategy

Discovery results are merged into a unified device map:

1. **Base Discovery** (ARP + Ping)
   - Creates initial device entries with IP, MAC, vendor

2. **Specialized Discovery** (Hikvision/Apple TV)
   - Enhances existing entries with device-specific info
   - Creates new entries if device wasn't found by ARP

3. **DNS Resolution**
   - Adds hostname to all discovered devices
   - Runs in parallel for performance

### Result Priority
When multiple sources provide conflicting info:
- IP address: Always from initial discovery
- MAC/Vendor: Prefer ARP over specialized protocols
- Device Type: Only from specialized protocols
- Model/Firmware: Only from specialized protocols

---

## Performance Optimization

### Parallel Execution

```typescript
// All scans run in parallel where possible
const [arpResults, pingResults, mdnsResults] = await Promise.all([
  performArpScan(networkRange, signal),
  performPingSweep(networkRange, signal),
  performMdnsScan(signal)
])

// Then specialized protocols
const [hikvisionResults, appleTVResults] = await Promise.all([
  discoverHikvisionDevices(signal),
  discoverAppleTVDevices(networkRange, signal)
])
```

### Batch Processing

**Ping Sweep**: 50 IPs per batch
```typescript
const batchSize = 50
for (let i = 1; i <= 254; i += batchSize) {
  // Batch process
}
```

**Apple TV Port Scan**: 20 IPs per batch
```typescript
const batchSize = 20
if (scanPromises.length >= 20) {
  await Promise.all(scanPromises)
  scanPromises.length = 0
}
```

### Timeout Optimization

| Operation | Timeout | Reason |
|-----------|---------|--------|
| Ping | 1s per IP | Fast host check |
| ARP | 15s total | Includes pre-population |
| DNS | 2s per lookup | DNS can be slow |
| mDNS | 3-5s | Broadcast response time |
| SADP | 5s | UDP broadcast wait |
| AirPlay | 6s total | mDNS + port scan |

### Memory Efficiency

- Streaming results via generator function
- No full network scan stored in memory
- Device map grows incrementally
- Garbage collection friendly

---

## Security Considerations

### Network Security

1. **Broadcast Packets**: SADP uses UDP broadcast which may trigger IDS
2. **Port Scanning**: AirPlay discovery scans 254 IPs on port 7000
3. **Elevated Privileges**: Some operations may require sudo/admin

### Privacy Considerations

1. **Camera Discovery**: May reveal security camera locations
2. **Device Inventory**: Exposes network topology
3. **Firmware Versions**: Security audit information

### Best Practices

- ✅ Only scan networks you own or have permission to scan
- ✅ Document scan activities for compliance
- ✅ Use results for legitimate network management
- ❌ Don't scan public or unauthorized networks
- ❌ Don't use for reconnaissance without permission

---

## Error Handling

### Graceful Degradation

```typescript
try {
  const hikvisionResults = await discoverHikvisionDevices(signal)
  // Process results
} catch {
  errors.push('Hikvision SADP discovery failed')
  // Continue with other methods
}
```

### Common Errors

| Error | Cause | Impact |
|-------|-------|--------|
| UDP broadcast blocked | Firewall | SADP fails |
| mDNS not available | No Bonjour/Avahi | AirPlay discovery partial |
| Port scan timeout | Network latency | Slower results |
| DNS timeout | No reverse DNS | Missing hostnames |
| ARP permission denied | Not root/admin | Limited MAC info |

### User Feedback

Errors are collected but don't stop the scan:
```typescript
errors: [
  'mDNS scan failed',
  'Hikvision SADP discovery failed'
]
```

Users see which discovery methods succeeded/failed.

---

## Testing Recommendations

### Test Scenarios

1. **No Devices**
   - Empty network should return quickly
   - No false positives

2. **Mixed Devices**
   - Should identify all device types
   - Proper vendor attribution

3. **Hikvision Only**
   - SADP should find all cameras
   - Firmware version extracted

4. **Apple TV Only**
   - AirPlay discovery should succeed
   - Port 7000 detected

5. **Network Isolation**
   - Handle AP isolation gracefully
   - Report limited results

### Mock Data

For testing without devices:
```typescript
// Mock Hikvision response
const mockSadpResponse = `
<?xml version="1.0" encoding="UTF-8"?>
<ProbeMatch>
  <IPv4Address>192.168.1.64</IPv4Address>
  <DeviceType>DS-2CD2142FWD-I</DeviceType>
  <DeviceVersion>V5.5.82 build 190220</DeviceVersion>
</ProbeMatch>
`
```

---

## Future Enhancements

### Potential Additions

1. **ONVIF Discovery** - Universal IP camera protocol
2. **UPnP/SSDP** - Smart home device discovery
3. **RTSP Port Scanning** - Find video stream endpoints
4. **Web Interface Detection** - HTTP service fingerprinting
5. **Dahua Discovery** - Alternative camera manufacturer
6. **Chromecast Discovery** - Google Cast protocol
7. **Sonos Discovery** - Multi-room audio

### Performance Improvements

1. **Caching** - Remember recent scans
2. **Incremental Updates** - Re-scan specific IPs
3. **Background Scanning** - Continuous monitoring
4. **WebSocket Results** - Stream results as found

### Advanced Features

1. **Port Scanning** - Identify services on each device
2. **Banner Grabbing** - Identify software versions
3. **Vulnerability Checking** - Cross-reference CVE databases
4. **Topology Mapping** - Visualize network structure
