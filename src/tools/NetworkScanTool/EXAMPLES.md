# NetworkScanTool Usage Examples

## Finding Hikvision IP Cameras

### Scenario 1: Find all Hikvision cameras on the network

```bash
# Discovery mode automatically discovers Hikvision cameras
kode> discover network devices
kode> find hikvision cameras
```

**Expected Output:**
```
Network scan of 192.168.1.0/24 completed in 8.5s using discovery method.

Found 3 device(s):

IP: 192.168.1.64
  Device Type: Hikvision Camera
  Model: DS-2CD2142FWD-I
  MAC: 44:19:B6:A1:23:45
  Vendor: Hangzhou Hikvision Digital Technology
  Port: 80
  Firmware: V5.5.82 build 190220
  Response Time: 15ms

IP: 192.168.1.65
  Device Type: Hikvision Camera
  Model: DS-7608NI-E2/8P
  MAC: 54:C4:15:B2:34:56
  Vendor: Hangzhou Hikvision Digital Technology
  Port: 8000
  Firmware: V3.4.106 build 190909

IP: 192.168.1.66
  Device Type: Hikvision Camera
  Model: DS-2CD2385G1-I
  MAC: A4:14:37:C3:45:67
  Vendor: Hangzhou Hikvision Digital Technology
  Port: 80
  Firmware: V5.6.5 build 200316
  Response Time: 12ms
```

### Key Information Retrieved:
- **Device Model**: Exact camera or NVR model number
- **Firmware Version**: Current firmware for security audits
- **HTTP Port**: Usually 80 for web interface, 8000 for NVR
- **MAC Address**: Hardware identification

### Use Cases:
1. **Security Audit**: Check firmware versions for vulnerabilities
2. **Network Planning**: Identify camera locations by IP
3. **Troubleshooting**: Find cameras that went offline
4. **Documentation**: Generate inventory of security equipment

---

## Finding Apple TV Devices

### Scenario 2: Discover all Apple TV devices

```bash
# Discovery mode automatically finds Apple TVs via AirPlay
kode> discover Apple TV devices
```

**Expected Output:**
```
Network scan of 192.168.1.0/24 completed in 6.2s using discovery method.

Found 2 device(s):

IP: 192.168.1.45
  Device Type: Apple TV
  Model: Apple TV (AirPlay)
  MAC: 3C:07:54:A1:B2:C3
  Vendor: Apple, Inc.
  Port: 7000
  Hostname: Living-Room-Apple-TV.local
  Response Time: 8ms

IP: 192.168.1.46
  Device Type: Apple TV
  Model: Apple TV (AirPlay)
  MAC: 40:6C:8F:D1:E2:F3
  Vendor: Apple, Inc.
  Port: 7000
  Hostname: Bedroom-Apple-TV.local
  Response Time: 10ms
```

### Key Information Retrieved:
- **AirPlay Port**: Port 7000 for AirPlay streaming
- **Hostname**: User-friendly device name
- **MAC Address**: Hardware identification
- **Response Time**: Network latency

### Use Cases:
1. **Home Network Setup**: Locate all Apple TVs in house
2. **AirPlay Troubleshooting**: Verify AirPlay is enabled
3. **Network Documentation**: Map entertainment devices
4. **Parental Controls**: Identify kids' devices

---

## Finding ZNB Devices

### Scenario 3: Discover all ZNB devices on the network

```bash
# Discovery mode automatically finds ZNB devices via mDNS
kode> discover ZNB devices
kode> find all ZNB devices
```

**Expected Output:**
```
Network scan of 192.168.1.0/24 completed in 9.8s using discovery method.

Found 3 device(s):

IP: 192.168.1.100
  Device Type: ZNB Device
  Hostname: znb-device-001.local
  MAC: 12:34:56:78:9A:BC
  Port: 8080
  Services: _znb._tcp
  Response Time: 6ms
  TXT Records:
    version=1.2.3
    model=ZNB-Gateway-Pro
    serial=ZNB001234

IP: 192.168.1.101
  Device Type: ZNB Device
  Hostname: znb-device-002.local
  MAC: 12:34:56:78:9A:BD
  Port: 8080
  Services: _znb._tcp
  Response Time: 8ms
  TXT Records:
    version=1.2.1
    model=ZNB-Sensor
    status=active

IP: 192.168.1.102
  Device Type: ZNB Device
  Hostname: znb-gateway.local
  MAC: 12:34:56:78:9A:BE
  Port: 80
  Services: _znb._tcp, _http._tcp
  Response Time: 5ms
  TXT Records:
    version=2.0.0
    model=ZNB-Gateway
    features=mqtt,websocket,rest
```

### Key Information Retrieved:
- **Device Type**: Automatically identified as "ZNB Device"
- **mDNS Hostname**: User-friendly local domain names
- **Service Type**: _znb._tcp service identifier
- **Port Number**: Service port (e.g., 8080, 80)
- **TXT Records**: Device metadata including version, model, serial number, features, etc.
- **MAC Address**: Hardware identification
- **Additional Services**: May also advertise HTTP or other services

### Use Cases:
1. **Network Discovery**: Find all ZNB devices on the network
2. **Device Inventory**: Maintain a list of ZNB equipment
3. **Troubleshooting**: Identify offline or misconfigured ZNB devices
4. **Integration**: Collect IP addresses for automated configuration

### Technical Details:
- **Protocol**: mDNS/DNS-SD (RFC 6762/6763)
- **Service Type**: `_znb._tcp.local`
- **Discovery Method**: Bonjour/Avahi service browsing
- **Platform Support**: macOS (dns-sd), Linux (avahi-browse)

---

## Combined Discovery

### Scenario 4: Find all smart home and security devices

```bash
# Discovery mode discovers all device types
kode> discover network devices
```

**Expected Output:**
```
Network scan of 192.168.1.0/24 completed in 12.3s using discovery method.

Found 15 device(s):

IP: 192.168.1.1
  Hostname: router.local
  MAC: A0:99:9B:12:34:56
  Vendor: Apple, Inc.
  Response Time: 2ms

IP: 192.168.1.10
  Hostname: iPhone-John.local
  MAC: BC:3B:AF:A1:B2:C3
  Vendor: Apple, Inc.
  Response Time: 5ms

IP: 192.168.1.45
  Device Type: Apple TV
  Model: Apple TV (AirPlay)
  MAC: 3C:07:54:A1:B2:C3
  Vendor: Apple, Inc.
  Port: 7000
  Hostname: Living-Room-Apple-TV.local

IP: 192.168.1.64
  Device Type: Hikvision Camera
  Model: DS-2CD2142FWD-I
  MAC: 44:19:B6:A1:23:45
  Vendor: Hangzhou Hikvision Digital Technology
  Port: 80
  Firmware: V5.5.82 build 190220

IP: 192.168.1.100
  Device Type: ZNB Device
  Hostname: znb-device-001.local
  MAC: 12:34:56:78:9A:BC
  Port: 8080
  Services: _znb._tcp
  TXT Records:
    version=1.2.3
    model=ZNB-Gateway-Pro

... and 11 more device(s)
```

---

## Network Scans

### Scenario 5: Fast scan for active hosts

```bash
# Scan mode - ARP + Ping sweep
kode> scan network for active hosts
```

**Expected Output:**
```
Network scan of 192.168.1.0/24 completed in 3.5s using scan method.

Found 15 device(s):

IP: 192.168.1.1
  MAC: A0:99:9B:12:34:56
  Vendor: Apple, Inc.
  Response Time: 2ms

IP: 192.168.1.10
  MAC: BC:3B:AF:A1:B2:C3
  Vendor: Apple, Inc.
  Response Time: 5ms

IP: 192.168.1.45
  MAC: 3C:07:54:A1:B2:C3
  Vendor: Apple, Inc.
  Response Time: 8ms

... (continues)
```

**Use Case**: Quick inventory of active hosts with MAC addresses and vendors

---

## Specific Network Range

### Scenario 6: Scan a specific subnet

```bash
# Target a specific network range
kode> scan network 10.0.10.0/24
```

Useful for:
- Multi-subnet networks
- VLAN scanning
- Remote network discovery (if accessible)
- Discovery mode is always used for complete service discovery

---

## Troubleshooting Examples

### Can't Find Hikvision Camera?

**Problem**: Camera not appearing in scan results

**Solutions**:
1. **Use discovery mode**: Scan mode won't run SADP discovery
2. **Check network**: Camera must be on same subnet
3. **Verify power**: Camera may be offline
4. **Firewall**: UDP port 37020 must not be blocked
5. **Check MAC address**: Look for Hikvision MAC prefixes using scan mode

### Apple TV Not Discovered?

**Problem**: Apple TV not showing up

**Solutions**:
1. **AirPlay enabled**: Check Apple TV settings
2. **Same network**: Ensure device is on same subnet
3. **mDNS working**: Bonjour must not be blocked
4. **Port scan**: Check if port 7000 is accessible
5. **Network isolation**: Disable AP isolation on router

### ZNB Devices Not Found?

**Problem**: ZNB devices not appearing in scan results

**Solutions**:
1. **Use discovery mode**: Scan mode won't discover mDNS services
2. **mDNS enabled**: Verify ZNB devices have mDNS/Bonjour enabled
3. **Service name**: Ensure devices advertise `_znb._tcp` service
4. **Network segment**: Devices must be on same subnet (mDNS is local)
5. **Firewall**: mDNS uses UDP port 5353, check firewall rules
6. **Platform tools**: Verify dns-sd (macOS) or avahi (Linux) is available

---

## Advanced Usage

### Security Audit Workflow

1. **Initial Discovery**:
   ```bash
   kode> discover network devices
   ```

2. **Identify Security Devices**:
   - Look for Hikvision cameras
   - Note firmware versions

3. **Document Findings**:
   - Export device list
   - Check firmware against CVE database
   - Plan updates if needed

### Home Network Inventory

1. **Discover Devices**:
   ```bash
   kode> discover my home network
   ```

2. **Categorize Devices**:
   - Identify Apple devices by vendor
   - Find cameras by device type
   - List all unknown devices

3. **Security Check**:
   ```bash
   kode> scan network for active hosts
   ```
   - Verify all devices are expected
   - Check for unknown MAC addresses
   - Document device purposes

---

## Tips and Best Practices

### For Hikvision Discovery:
- ✅ Use discovery mode (default)
- ✅ Run during low network activity
- ✅ Document firmware versions for updates
- ✅ Note device models for manual lookups
- ⚠️ SADP requires UDP broadcast support

### For Apple TV Discovery:
- ✅ Use discovery mode (default)
- ✅ Ensure AirPlay is enabled on devices
- ✅ Check device names match expectations
- ✅ Verify port 7000 accessibility
- ✅ Use mDNS hostnames for friendly names
- ⚠️ May also discover HomePods and AirPort Express

### For ZNB Device Discovery:
- ✅ Use discovery mode (default)
- ✅ Verify mDNS/Bonjour is enabled on devices
- ✅ Ensure devices advertise `_znb._tcp` service
- ✅ Check UDP port 5353 is not blocked
- ✅ Document device hostnames for easy identification
- ✅ TXT records provide rich metadata (version, model, serial, etc.)
- ⚠️ mDNS only works on local network segment

### General Tips:
- 🚀 Scan mode for speed (ARP + Ping), discovery for detailed info (recommended)
- 🔒 Run from trusted networks only
- 📊 Document results for network inventory
- 🔄 Regular scans detect new/rogue devices
- ⏱️ Discovery scans typically take 5-15 seconds
