---
marp: true
title: 'WG Mesh: how an Atlas VM packet finds its host'
description: How Atlas VMs find and reach each other across hosts with eBPF, WireGuard, and NDP. Normal VMs first, then privileged VMs, gateway VMs, and the IPv6 router.
theme: default
paginate: true
style: |
  section {
    background: #ffffff;
    color: #1e1e1e;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 28px;
    padding: 58px 60px 40px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
  }
  header { top: 22px; left: 60px; font-size: 15px; font-weight: 650; letter-spacing: 0.08em; text-transform: uppercase; color: #e8590c; }
  h1 { font-size: 40px; font-weight: 650; color: #111111; line-height: 1.12; margin: 0 0 18px; padding: 0; border: 0; letter-spacing: -0.01em; }
  p, li { line-height: 1.45; }
  li { margin: 6px 0; }
  strong { color: #111111; font-weight: 650; }
  em { font-style: normal; color: #6c757d; font-size: 22px; }
  code { background: #f1f3f5; color: #1e1e1e; font-size: 0.85em; border-radius: 4px; }
  pre { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; font-size: 21px; line-height: 1.5; }
  pre code { background: transparent; font-size: 1em; }
  table { font-size: 22px; border-collapse: collapse; }
  th, td { border: none !important; border-bottom: 1px solid #dee2e6 !important; padding: 7px 16px; background: #ffffff !important; text-align: left; vertical-align: top; }
  th { color: #6c757d; font-weight: 600; }
  img { background: transparent; }
  section::after { color: #adb5bd; font-size: 16px; }
  section.lead { justify-content: center; text-align: center; }
  section.lead h1 { font-size: 66px; margin: 8px 0 6px; }
  section.center { justify-content: center; }
  section.center h1 { text-align: center; }
  section.center p { text-align: center; }
  section.pause { justify-content: center; }
  section.pause h1 { font-size: 52px; font-weight: 600; margin: 0; }
  section.pause p { color: #6c757d; margin: 12px 0 0; }
  section.small table { font-size: 20px; }
---

<!-- _class: lead -->
<!-- _paginate: false -->

# WG Mesh

How an Atlas VM packet finds its host

*eBPF, WireGuard, and NDP inside one region*

---

<!-- _class: center -->

# One address per VM

![w:1120 The address fdaa:1:0:2::3 written in full as fdaa:0001:0000:0002:0000:0000:0000:0003. Braces mark the fdaa prefix, the 16-bit region 1, the 32-bit tenant 2, and the 64-bit VM ID 3. The hooks compare the tenant field.](assets/address.svg)

---

# A VM address names the VM, not the host

- Atlas picks a host when it creates a VM
- A migration keeps the address and changes the host
- Every other host must still find the VM before it can send to it

*WG Mesh does not keep a central map. A host that does not know asks the network, and the owner answers.*

---

# Four steps, each built on the last

1. **Normal VMs:** find a host, tunnel, repair after a move, keep tenants apart
2. **Privileged VMs:** tenant-0 services that may reach every tenant
3. **Gateway VMs:** carry traffic for addresses outside the mesh
4. **IPv6 router:** a gateway VM that gives each VM a public IPv6 address

---

<!-- header: '1 · Normal VMs' -->

# Three layers, one packet

![w:1120 Two hosts. VM A on host 1 sends to VM B on host 2. The VM hook adds an outer IPv6 header for host 2, WireGuard encrypts it and sends it as UDP over the provider private network, and host 2 decrypts and unwraps it for VM B. The packet strip shows the headers at each step.](assets/layers.svg)

*Watch the packet strip. An orange cell is the header that the last step added.*

---

# Four hooks, one set of maps

![w:1120 One host runs four tc eBPF hooks that share pinned maps: the VM hook on each VM interface, the WireGuard hook on wg0, the uplink hook on the private uplink to other hosts, and the public hook on the public interface to the provider router.](assets/host.svg)

*`tc` eBPF programs from one object. No daemon. The `atlas-wg-mesh` CLI loads them and writes the maps.*

---

<!-- _class: small -->

# The maps a normal VM uses

| Map | Holds | Written by |
|---|---|---|
| `local_vms` | VM address → local interface | `vm sync` |
| `remote_vms` | VM address → host `fdab` address · LRU, 262,144 entries | uplink hook, from NDP |
| `peer_list` | peer IPv4, MAC, `fdab` address | `peers sync` |
| `discovery_limits` | lookup tokens per VM interface | VM hook |

*No timers. A `remote_vms` entry lives until LRU eviction or a valid `NOT_HERE`.*

---

# The VM hook, in order

1. Drop anything sent to `fdab::/16`
2. Drop a source address that the VM does not own
3. Drop another tenant
4. Same host: let Linux deliver
5. Known remote host: tunnel through WireGuard
6. Unknown host: turn the packet into an NDP lookup

*Privileged and gateway VMs add rules later. This order stays.*

---

# Same host: Linux delivers

![w:1120 VM A and VM C of tenant 2 run on host 1. The VM hook checks the packet, sees that VM C is local, and lets Linux deliver it through the host route. No tunnel and no WireGuard.](assets/same-host.svg)

*The packet does not change. In a test this path moved 14.3 Gbit/s.*

---

<!-- _transition: fade 250ms -->

# Known host: check and wrap

![w:1120 VM A sends to VM B. The VM hook on host 1 checks the packet, finds VM B at fdab::2 in remote_vms, and adds an outer IPv6 header for host 2.](assets/known-1.svg)

*Next header 41 means IPv6 inside IPv6. The outer addresses are the two hosts.*

---

<!-- _transition: fade 250ms -->

# Known host: WireGuard carries it

![w:1120 WireGuard on host 1 encrypts the tunnel packet and sends it as UDP over the private network to host 2.](assets/known-2.svg)

*Metal applies the WireGuard peers and keys. WG Mesh only picks the host.*

---

# Known host: unwrap and deliver

![w:1120 Host 2 decrypts the packet. Its WireGuard hook finds VM B in local_vms, removes the outer header, and Linux delivers the packet to VM B.](assets/known-3.svg)

*The receiving host checks the tenant again. VM B sees the packet exactly as VM A sent it.*

---

<!-- _transition: fade 250ms -->

# First contact: the packet becomes a question

![w:1120 Host 1 has no location for VM B. The VM hook replaces the packet with a neighbor solicitation that asks who has fdaa:1:0:2::7, and sends it on the private uplink. The data is lost.](assets/discovery-1.svg)

*Each VM interface may start 10 lookups a second, with a burst of 50.*

---

<!-- _transition: fade 250ms -->

# First contact: the owner answers

![w:1120 Host 2 has a proxy NDP entry for VM B, so Linux answers at once with host 2 uplink MAC.](assets/discovery-2.svg)

*`configure` sets `proxy_delay` to 0. Linux would otherwise wait up to 0.8 s.*

---

# First contact: remember the answer

![w:1120 The uplink hook on host 1 maps the answering MAC to host 2 through peer_list and stores VM B at fdab::2 in remote_vms. The retry goes through WireGuard.](assets/discovery-3.svg)

*One packet is lost. In a test, a new VM was reachable about 5 ms after `vm sync`.*

---

# No multicast? Send a copy to each peer

![w:1120 In unicast mode the uplink egress hook on host 1 wraps the neighbor solicitation in IPv4 protocol 41 and sends one copy to each peer. The ingress hook on each peer accepts it only from a peer address and unwraps it.](assets/unicast.svg)

*`peers sync --unicast` attaches the egress hook. Only discovery changes, not throughput.*

---

<!-- _transition: fade 250ms -->

# VM moved: the sender still points at host 2

![w:1120 VM B moved from host 2 to host 3. Host 1 missed the announcement and still tunnels to host 2 at fdab::2.](assets/moved-1.svg)

*The new host sent an unsolicited advertisement. Most hosts updated at once. Host 1 missed it.*

---

<!-- _transition: fade 250ms -->

# VM moved: host 2 says NOT_HERE

![w:1120 VM B is not in host 2 local_vms, so host 2 replies NOT_HERE with next header 253 and the VM address. Host 1 checks that the reply came from the stored host and deletes the entry.](assets/moved-2.svg)

*Only the host stored in `remote_vms` can clear an entry. Another host cannot erase a good one.*

---

# VM moved: ask again

![w:1120 Host 1 sends a new lookup on the uplink. Host 3 answers, and host 1 stores VM B at fdab::3.](assets/moved-3.svg)

*In a test, 15 moves took 1.5 ms to 10.5 ms, within one 10 ms ping.*

---

# Tenants stay apart

![w:1120 VM A of tenant 2 sends to VM V of tenant abcd on the same host. The VM hook compares the tenant fields, finds that neither side is privileged, and drops the packet.](assets/tenant.svg)

*The orange parts of the addresses are the tenant fields that the hook compares.*

---

<!-- header: '2 · Privileged VMs' -->
<!-- _class: pause -->

# Privileged VMs

Tenant-0 services that serve every tenant

---

# What makes a VM privileged

- It is a **tenant 0** VM, and Atlas lists it in `privileged_vms` during host sync
- The tenant rule passes when **either side** is privileged
- So a tenant VM can reply to a privileged VM
- Examples: HTTP proxy, Cargo, IPv6 router

*Only Atlas can grant privilege, and only to tenant-0 VMs.*

---

# A privileged VM crosses tenants

![w:1120 The HTTP proxy is a privileged tenant-0 VM. It reaches VM A of tenant 2 and VM V of tenant abcd, and VM V can reply to it. VM A cannot reach VM V, because neither of them is privileged.](assets/privileged.svg)

*Rule 3 becomes: drop another tenant, unless one side is privileged.*

---

<!-- header: '3 · Gateway VMs' -->
<!-- _class: pause -->

# Gateway VMs

Traffic for addresses outside the mesh

---

# A gateway VM needs two flags

| Flag | Effect in WG Mesh |
|---|---|
| **Privileged** | In `privileged_vms`: passes the tenant rule |
| **Network gateway** | In `gateways`: may send a source outside the mesh, and receives gateway tunnels |

*The gateway's own software forwards, translates, and filters. The mesh carries packets and checks two rules.*

---

# A gateway route works both ways

```text
VM V:   2000::/3  via  fdaa:1::56      the gateway VM
```

- **Out:** V's packets to that prefix go to the gateway
- **In:** an outside source reaches V only if V has a route back to it
- The key is V's address + the destination, so one trie holds a table per VM

*`vm sync --route 2000::/3=fdaa:1::56` writes it into `gateway_routes`.*

---

# The VM hook, with gateway rules

1. Drop anything sent to `fdab::/16`
2. **Outside destination: check the source, then send to the gateway route**
3. Drop a source that the VM does not own. **An outside source only from a gateway.**
4. Drop another tenant, unless one side is privileged
5. Same host: let Linux deliver. **An outside source needs a route back.**
6. Known remote host: tunnel through WireGuard
7. Unknown host: turn the packet into an NDP lookup

---

<!-- _transition: fade 250ms -->

# Out: the VM hook picks the gateway

![w:1120 VM V on host 1 sends to an outside address. Its VM hook finds the longest matching gateway route, 2000::/3 via the gateway VM, and sends a tunnel with next header 254 and the gateway address to host 2.](assets/gateway-out-1.svg)

*Next header 254 puts the gateway address first. The destination is outside the mesh, and one host can run several gateways.*

---

# Out: host 2 hands it to the named gateway

![w:1120 Host 2 reads the gateway address from the tunnel, checks that the gateway is local and a gateway interface, and delivers the packet to it. The gateway software forwards it outside.](assets/gateway-out-2.svg)

*If the gateway is not on host 2, host 2 replies `NOT_HERE` for the gateway address.*

---

<!-- _transition: fade 250ms -->

# In: only a gateway may send an outside source

![w:1120 The gateway VM sends a packet with an outside source to VM V. Its VM hook allows the outside source only because the interface is a gateway, and tunnels it to host 1 with next header 41.](assets/gateway-in-1.svg)

*A normal VM that sends a source it does not own is dropped at rule 3.*

---

# In: the route back is the guard

![w:1120 The WireGuard hook on host 1 checks that VM V has a gateway route back to the outside source, 2000::/3 via the gateway, and delivers the packet. Without that route it drops the packet.](assets/gateway-in-2.svg)

*No route back, no delivery. So a VM receives outside traffic only through a gateway that it replies through.*

---

# The gateway tunnel fits the MTU

```text
outer IPv6   fdab::1 → fdab::2, next header 254          40 bytes
gateway      fdaa:1::56                                  16 bytes
VM packet    fdaa:1:0:abcd::5 → 2001:db8:ffff::10     ≤ 1380 bytes
                                                      ≤ 1436 bytes
wg0 MTU                                                 1440 bytes
```

---

<!-- header: '4 · IPv6 router' -->
<!-- _class: pause -->

# The IPv6 router

A gateway VM for public IPv6

---

# Why a router VM

- Some providers attach a whole IPv6 block to **one host**
- A VM that moves to another host cannot take the block with it
- So the block stays on a router VM, and each VM gets a derived `/128`
- The VM keeps its mesh and public addresses when it moves. WG Mesh finds its new host.

*The router is a privileged, network gateway VM. Everything from part 3 applies.*

---

<!-- _class: center -->

# The address bits carry the mapping

![w:1120 The public address 2001:db8:1:2:3:a:bcd0:5 written in full above the mesh address fdaa:1:0:abcd::5. Braces mark the router block /80, a reserved zero, a 24-bit tenant, and a 20-bit VM in the public address, and the fdaa prefix, region, 32-bit tenant, and 64-bit VM ID in the mesh address. Arrows join the tenant fields and the VM fields.](assets/mapping.svg)

*No table and no connection state. A tenant of 2^24 or more, or a VM of 2^20 or more, gets no public address.*

---

<!-- _transition: fade 250ms -->

# In: the public packet reaches the router

![w:1120 A client sends to the public address 2001:db8:1:2:3:a:bcd0:5. The provider router sends it to host 2, whose public hook answers NDP for the owned prefix, and Linux routes it to the IPv6 router VM.](assets/router-in-1.svg)

*New in this part: the public hook and `owned_prefixes`.*

---

# In: the router changes only the destination

![w:1120 The router changes only the destination to the mesh address of VM V and keeps the client source. From here it is the gateway inbound path: the VM hook tunnels it to host 1, and the WireGuard hook checks the return route before it delivers.](assets/router-in-2.svg)

*Steps 5 and 6 are the gateway inbound path. VM V sees the real client address.*

---

# Out: the reply gets its public source back

![w:1120 VM V replies to the client. The reply takes the gateway outbound path to the router, and the router changes the source from the mesh address to the public address 2001:db8:1:2:3:a:bcd0:5.](assets/router-out.svg)

*Steps 1 to 3 are the gateway outbound path. Step 4 is the router's own translation.*

---

<!-- _transition: fade 250ms -->

# The router moved: the old host forwards

![w:1120 The router moved from host 2 to host 3. The provider still sends to host 2, whose public hook finds the prefix in moved_prefixes and tunnels the packet to host 3. Host 3 turns it into an unsolicited neighbor advertisement with the override flag, and the provider learns host 3 MAC.](assets/router-moved-1.svg)

*The provider caches host 2's MAC and does not ask again. So host 3 tells it, once a second at most.*

---

# The router moved: the provider learns

![w:1120 The provider now sends the public address straight to host 3, and Linux routes it to the router VM.](assets/router-moved-2.svg)

*The old host forwards for 5 minutes. The first packet can be lost.*

---

<!-- header: '' -->
<!-- _class: small -->

# Who owns what

| Part | Owns | Does not own |
|---|---|---|
| **Atlas app** | VM addresses, host peers and keys, privileged VMs, gateway routes | Where a VM runs |
| **Metal** | WireGuard peers on the host, VM namespace and links, calls to `atlas-wg-mesh` | Packet decisions |
| **WG Mesh** | Per-packet decisions and learned locations | Keys, peers, NAT, DNS, DHCP, guest firewalls |
| **Gateway VM** | Address translation, forwarding, firewall policy | Mesh delivery, the return-route check |

---

# Look at a host

```sh
atlas-wg-mesh status                        # interfaces, NDP mode, map counts
atlas-wg-mesh inspect fdaa:1:10:20::5       # local, learned host, or unknown
atlas-wg-mesh vm list --json

atlas-wg-mesh vm sync --interface vh-100001 \
  --address fdaa:1:10:20::5 --mtu 1380      # replaces all state of one VM
```

*Private fault? Check WireGuard peers, then the VM namespace, then `local_vms` and `remote_vms`.*

---

# Measured on two hosts

| Path | Throughput | Average ping |
|---|---:|---:|
| Raw private network | 939 Mbit/s | 0.28 ms |
| Host-to-host WireGuard | 886 Mbit/s | 0.76 ms |
| VM to VM, two hosts | 847 Mbit/s | 1.75 ms |
| VM to VM, one host | 14.3 Gbit/s | 0.92 ms |

*Scaleway bare metal, 1 GbE, Firecracker 2 vCPU. `iperf3` TCP, one stream, median of 3.*

---

# Limits

- The first packet to a new or moved VM can be lost. Clients retry.
- NDP trusts the private host network. It does not authenticate hosts by itself.
- The mesh covers one region. It does not connect regions.
- `NOT_HERE` (253) and the gateway tunnel (254) are Atlas formats, not standards.

---

<!-- _class: lead -->
<!-- _paginate: false -->

# Read more

[WG Mesh design](https://github.com/frappe/atlas/blob/develop/docs/networking/wg-mesh/index.md) · [How VMs reach each other](https://github.com/frappe/atlas/blob/develop/docs/networking/index.md) · [Gateway VMs](https://github.com/frappe/atlas/blob/develop/docs/networking/wg-mesh/gateways.md) · [IPv6 router](https://github.com/frappe/atlas/blob/develop/docs/networking/ipv6-router.md)

[vm.h](https://github.com/frappe/atlas/blob/develop/services/wg-mesh/bpf/vm.h) · [wireguard.h](https://github.com/frappe/atlas/blob/develop/services/wg-mesh/bpf/wireguard.h) · [uplink.h](https://github.com/frappe/atlas/blob/develop/services/wg-mesh/bpf/uplink.h) · [maps.h](https://github.com/frappe/atlas/blob/develop/services/wg-mesh/bpf/maps.h)

*frappe/atlas · all addresses are examples*
