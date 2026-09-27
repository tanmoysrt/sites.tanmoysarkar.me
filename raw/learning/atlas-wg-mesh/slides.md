---
marp: true
title: 'WG Mesh: how an Atlas VM packet finds its host'
description: How Atlas VMs find and reach each other across hosts with eBPF, WireGuard, and NDP, and how the mesh carries gateway traffic.
theme: default
paginate: true
style: |
  section {
    background: #ffffff;
    color: #1e1e1e;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 28px;
    padding: 50px 60px 44px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
  }
  h1 { font-size: 42px; font-weight: 650; color: #111111; line-height: 1.12; margin: 0 0 22px; padding: 0; border: 0; letter-spacing: -0.01em; }
  p, li { line-height: 1.45; }
  li { margin: 6px 0; }
  strong { color: #111111; font-weight: 650; }
  em { font-style: normal; color: #6c757d; font-size: 23px; }
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
  section.pause { justify-content: center; }
  section.pause h1 { font-size: 52px; font-weight: 600; margin: 0; }
  section.pause p { color: #6c757d; margin: 12px 0 0; }
  section.small table { font-size: 20px; }
  .key { display: inline-block; width: 14px; height: 14px; border-radius: 3px; border: 2px solid; vertical-align: -1px; margin: 0 6px 0 18px; }
---

<!-- _class: lead -->
<!-- _paginate: false -->

# WG Mesh

How an Atlas VM packet finds its host

*eBPF, WireGuard, and NDP inside one region*

---

# A VM address names the VM, not the host

- Atlas picks a host when it creates a VM
- A migration keeps the address and changes the host
- Every other host must still find the VM before it can send to it

---

# Two ways to find a VM

| | Central map | Ask the network |
|---|---|---|
| **Who knows** | A controller pushes every location to every host | The host that runs the VM answers |
| **After a move** | Update every host | The new host announces itself |
| **A missed update** | Traffic goes to the wrong host | The next packet repairs it |

*WG Mesh asks the network. Atlas never sends a VM-to-host map.*

---

# Three layers, one packet

![w:1120 Two hosts. VM A on host 1 sends to VM B on host 2. The VM hook wraps the packet for wg0. WireGuard encrypts it over the provider private network. Host 2 decrypts it and the WireGuard hook unwraps it for VM B.](assets/layers.svg)

*Only the bottom line is a real wire. A VM never sees the other two layers.*

---

# The address carries the policy

```text
fdaa : region 16 : tenant 32 : VM ID 64      one per VM
fdab : host WireGuard address                one per host

fdaa:1:0:2::3   →   region 1 · tenant 2 · VM 3
```

- The hooks read the tenant bits directly. No lookup.
- A **privileged** VM is a tenant-0 VM that Atlas lists. It may reach every tenant.

---

<!-- _class: pause -->

# What runs on a host?

---

# Four hooks, one set of maps

![w:1120 One host runs four tc eBPF hooks that share pinned maps: the VM hook on each VM interface, the WireGuard hook on wg0, the uplink hook on the private uplink to other hosts, and the public hook on the public interface to the provider router.](assets/host.svg)

*`tc` eBPF programs from one object. No daemon. The `atlas-wg-mesh` CLI loads them and writes the maps.*

---

<!-- _class: small -->

# The maps that matter

| Map | Holds | Written by |
|---|---|---|
| `local_vms` | VM address → local interface | `vm sync` |
| `remote_vms` | VM address → host `fdab` address · LRU, 262,144 | uplink hook, from NDP |
| `peer_list` | peer IPv4, MAC, `fdab` address | `peers sync` |
| `privileged_vms` | tenant-0 addresses that reach every tenant | `privileged-vm replace` |
| `gateway_routes` | (VM, destination prefix) → gateway | `vm sync --route` |
| `owned_prefixes` · `moved_prefixes` | public prefix → owner, or new owner for 5 min | `vm sync --prefix` |

*No timers. A `remote_vms` entry lives until LRU eviction or a valid `NOT_HERE`.*

---

# The VM hook, in order

1. Drop anything sent to `fdab::/16`
2. Destination outside the mesh: send it to the VM's gateway
3. Drop a source address the VM does not own
4. Drop another tenant, unless one side is privileged
5. Same host: let Linux deliver
6. Known remote host: tunnel through WireGuard
7. Unknown: turn the packet into an NDP lookup

---

<!-- _class: pause -->

# Follow one packet

VM A on host 1 sends to VM B on host 2

---

<!-- _transition: fade 250ms -->

# Known host: check and wrap

![w:1120 VM A sends to VM B. The VM hook on host 1 checks the packet, finds VM B at fdab::2 in remote_vms, and adds an outer header for host 2.](assets/known-1.svg)

*Source owned by this interface, same tenant, host known. Next header 41 means IPv6 inside IPv6.*

---

<!-- _transition: fade 250ms -->

# Known host: WireGuard carries it

![w:1120 WireGuard on host 1 encrypts the tunnel packet and sends it as UDP over the private network to host 2.](assets/known-2.svg)

*Metal applies the WireGuard peers and keys from host sync.*

---

# Known host: unwrap and deliver

![w:1120 Host 2 decrypts the packet. Its WireGuard hook finds VM B in local_vms, removes the outer header, and Linux delivers the packet to VM B.](assets/known-3.svg)

*The receiving host checks the tenant again. VM B sees the packet exactly as VM A sent it.*

---

# What is on the wire

![w:1120 A VM packet on the wire, outer layer first: IPv4 and UDP between host addresses, WireGuard encryption, an IPv6 header from fdab::1 to fdab::2 with next header 41, the VM IPv6 packet, and the TCP payload.](assets/envelope.svg)

*VM MTU 1380 + 40-byte tunnel header = 1420, inside the 1440 of `wg0`.*

---

<!-- _class: pause -->

# What if host 1 has never seen VM B?

---

<!-- _transition: fade 250ms -->

# First contact: the packet becomes a question

![w:1120 Host 1 has no location for VM B. The VM hook replaces the packet with a neighbor solicitation that asks who has fdaa:1:0:2::7, and sends it on the private uplink. The data is lost.](assets/discovery-1.svg)

*Each VM interface may start 10 lookups a second, with a burst of 50.*

---

<!-- _transition: fade 250ms -->

# First contact: the owner answers

![w:1120 Host 2 has a proxy NDP entry for VM B, so Linux answers at once with host 2 uplink MAC.](assets/discovery-2.svg)

*`configure` sets `proxy_delay` to 0. Linux would otherwise wait up to 0.8 s before it answers.*

---

# First contact: remember the answer

![w:1120 The uplink hook on host 1 maps the answering MAC to host 2 through peer_list and stores VM B at fdab::2 in remote_vms. The retry uses WireGuard.](assets/discovery-3.svg)

*One packet is lost. In a test, a new VM was reachable about 5 ms after `vm sync`.*

---

# When the network drops multicast

- `peers sync --unicast` attaches the uplink **egress** hook
- It wraps each NDP message in IPv4, protocol 41
- It sends one copy to each peer
- The receiver accepts wrapped NDP only from a peer address

*Only discovery changes. Throughput stays the same.*

---

<!-- _class: pause -->

# What if VM B moves?

---

<!-- _transition: fade 250ms -->

# VM moved: the sender still points at host 2

![w:1120 VM B moved from host 2 to host 3. Host 1 missed the announcement and still tunnels to host 2 at fdab::2.](assets/moved-1.svg)

*The new host sent an unsolicited advertisement. Most hosts updated at once. Host 1 missed it.*

---

<!-- _transition: fade 250ms -->

# VM moved: host 2 says NOT_HERE

![w:1120 VM B is not in host 2 local_vms, so host 2 replies NOT_HERE. Host 1 checks that the reply came from the stored host and deletes the entry.](assets/moved-2.svg)

*`NOT_HERE` is IPv6 next header 253 with a 16-byte VM address. Only the stored host can clear an entry.*

---

# VM moved: ask again

![w:1120 Host 1 sends a new lookup on the uplink. Host 3 answers, and host 1 stores VM B at fdab::3.](assets/moved-3.svg)

*In a test, 15 moves took 1.5 ms to 10.5 ms, within one 10 ms ping.*

---

# Tenants stay apart

- The hook compares the 32-bit tenant fields of both addresses
- A different tenant is dropped, even on the same host
- A privileged tenant-0 VM passes both ways, so replies work
- Examples: HTTP proxy, Cargo, IPv6 router

---

<!-- _class: pause -->

# Traffic from outside the mesh

A public client reaches a tenant VM

---

# A gateway VM needs two flags

| Flag | Effect in WG Mesh |
|---|---|
| **Privileged** | In `privileged_vms`: passes the tenant check |
| **Network gateway** | In `gateways`: may send a source outside the mesh |

*The gateway's own software does NAT and firewalling. The mesh carries and checks.*

---

# A gateway route works both ways

```text
VM V:   2000::/3  via  fdaa:1::56      the IPv6 router
```

- **Out:** V's packets to public IPv6 go to the router
- **In:** an outside source reaches V only if V has a route back to it
- Key = V's address + destination: one trie holds a table per VM

*A public address that maps to a real VM gets nothing until Atlas adds the route.*

---

<!-- _transition: fade 250ms -->

# Public IPv6: in through the router

![w:1120 A public client sends to a public address. The provider router sends it to host 2, which owns the prefix. Linux routes it to the IPv6 router VM, which changes the destination to the mesh address of VM V and keeps the client source. The VM hook tunnels it to host 1, whose WireGuard hook checks that VM V has a gateway route back to the client.](assets/gateway-1.svg)

*The router changes only the destination. VM V sees the real client address.*

---

# Public IPv6: the reply

![w:1120 VM V replies to the client. The VM hook on host 1 finds the router in gateway_routes and sends a tunnel with next header 254 and the gateway address. Host 2 delivers it to the named gateway, and the router changes the source to the public address.](assets/gateway-2.svg)

*Next header 254 names the gateway, because one host can run several.*

---

# The gateway tunnel fits

```text
outer IPv6   fdab::1 → fdab::2, next header 254           40 bytes
gateway      fdaa:1::56                                   16 bytes
client       fdaa:1:0:abcd::5 → 2001:db8:ffff::10      ≤ 1380 bytes
                                                       ≤ 1436 bytes
wg0 MTU                                                  1440 bytes
```

- The router maps addresses with bit arithmetic: no table, no connection state

---

<!-- _transition: fade 250ms -->

# The router moved: the old host forwards

![w:1120 The router moved from host 2 to host 3. The provider still sends to host 2, whose public hook finds the prefix in moved_prefixes and tunnels the packet to host 3. Host 3 turns it into an unsolicited neighbor advertisement with the override flag, and the provider learns host 3 MAC.](assets/prefix-1.svg)

*The provider caches host 2's MAC and does not ask again. So host 3 tells it.*

---

# The router moved: the provider learns

![w:1120 The provider now sends the public address straight to host 3, and Linux routes it to the router VM.](assets/prefix-2.svg)

*One advertisement per address per second. The old host forwards for 5 minutes.*

---

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

[WG Mesh design](https://github.com/frappe/atlas/blob/develop/docs/networking/wg-mesh/index.md) · [How VMs reach each other](https://github.com/frappe/atlas/blob/develop/docs/networking/index.md) · [Gateway VMs](https://github.com/frappe/atlas/blob/develop/docs/networking/wg-mesh/gateways.md)

[vm.h](https://github.com/frappe/atlas/blob/develop/services/wg-mesh/bpf/vm.h) · [wireguard.h](https://github.com/frappe/atlas/blob/develop/services/wg-mesh/bpf/wireguard.h) · [uplink.h](https://github.com/frappe/atlas/blob/develop/services/wg-mesh/bpf/uplink.h) · [maps.h](https://github.com/frappe/atlas/blob/develop/services/wg-mesh/bpf/maps.h)

*frappe/atlas · all addresses are examples*
