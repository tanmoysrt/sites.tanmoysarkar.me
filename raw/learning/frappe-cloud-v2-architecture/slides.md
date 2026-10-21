---
marp: true
title: 'Frappe Cloud v2: how the parts connect'
description: A top-down map of Frappe Cloud v2. Central, the regional Atlas app, Cargo, the service VMs, Metal hosts, WG Mesh and Pilot, and which part calls which.
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
  table { font-size: 22px; border-collapse: collapse; }
  th, td { border: none !important; border-bottom: 1px solid #dee2e6 !important; padding: 7px 16px; background: #ffffff !important; text-align: left; vertical-align: top; }
  th { color: #6c757d; font-weight: 600; }
  img { background: transparent; }
  section::after { color: #adb5bd; font-size: 16px; }
  section.lead { justify-content: center; text-align: center; }
  section.lead h1 { font-size: 62px; margin: 8px 0 6px; }
  section.pause { justify-content: center; }
  section.pause h1 { font-size: 52px; font-weight: 600; margin: 0; }
  section.pause p { color: #6c757d; margin: 12px 0 0; }
  section.small table { font-size: 19px; }
  section.small th, section.small td { padding: 5px 12px; }
  section.seq h1 { margin-bottom: 8px; }
---

<!-- _class: lead -->
<!-- _paginate: false -->

# Frappe Cloud v2

How the parts connect, from the top down

*Central · Atlas · Cargo · service VMs · Metal · WG Mesh · Pilot*

---

# One click touches many parts

- A customer clicks **Create server** in the dashboard
- A global service records the request
- A regional service selects a host
- A host daemon makes the disk and starts the VM
- A private network gives the VM a fixed address
- The site in the VM must then be reachable from the internet

*This deck shows which part does each job, and which part calls which.*

---

# Three layers

![w:1080 Three layers. Global: the customer browser calls Central. Region: Central calls Atlas, Cargo and the HTTP proxy cluster; Atlas sends state webhooks back to Central; Cargo asks Atlas for machines. The WireGuard gateway and IPv6 router are also regional services. Hosts: Atlas calls Metal on each host over mutual TLS, and WG Mesh joins the hosts with WireGuard tunnels.](assets/overview.svg)

---

# Two kinds of traffic

| | Control traffic | Data traffic |
|---|---|---|
| **What it is** | Requests that change something | Packets to and from sites and VMs |
| **Example** | Create a VM, add a route | A browser opens a site |
| **Parts on the path** | Central, Atlas, Cargo, Metal | Proxy, gateway, router, WG Mesh |

- Central and Atlas are **not** on the data path
- If Central or Atlas stops, running sites continue to work
- If they stop, no customer can make a change

---

<!-- _class: pause -->
<!-- header: '' -->

# Layer 1 · Central

The global control plane

---

<!-- header: '1 · Central' -->

# Central talks to four parties

![w:1120 Central in the middle. The browser calls Central. Central calls Atlas in each region, and Atlas sends signed VM state webhooks back. Central calls Cargo for buckets, and Cargo sends a webhook when a cluster is usable. Central writes site and domain routes to the HTTP proxy cluster. Central calls Pilot for login, rename and admin domain, and Pilot enrolls, sends heartbeats and registers domains.](assets/central.svg)

---

# What Central owns

| Central owns | Central does not own |
|---|---|
| Users, teams, roles and capabilities | Hosts and host selection |
| Plans, billing and limits | VM disks and processes |
| Which region a server goes to | Packets to sites |
| Server, site and domain records | Route storage on proxy nodes |
| Each request as a **Resource Action** | Bucket data |

*Central checks capabilities before every regional call, and the plan before each purchase.*

---

# Central never waits for a host

- Central saves a **Resource Action**, then a background job calls Atlas
- Atlas replies when Metal has saved the request, not when the VM runs
- The final state comes back later in a **state webhook**
- A sweep every 10 minutes reads VM state from Atlas, as a second source

*Push for speed. Poll as a backup.*

---

<!-- _class: pause -->
<!-- header: '' -->

# Layer 2 · Region

One Atlas app and its services in each location

---

<!-- header: '2 · Region' -->

# Atlas makes the regional decisions

![w:1100 Atlas in the middle of a region. Central and Cargo call the Atlas tenant API. Atlas calls Metal on every host over mutual TLS for VM changes and a host sync every 10 seconds. Atlas orders hosts from server providers, writes DNS records and certificates, keeps image artifacts in object storage, and installs and configures service VMs over SSH. Atlas and Metal push metrics to Datum.](assets/region.svg)

---

# Atlas calls Metal. Metal never calls Atlas.

- Atlas sends each VM change to the host over **mutual TLS**
- Every 10 seconds, Atlas sends a **host sync**:
  - Atlas sends peers, network policy and images
  - Metal returns capacity and the state of each VM
- Atlas uses the latest host sync to select hosts
- If Atlas stops, Metal continues with its saved state

*Atlas keeps a cache of VM state. Metal holds the true state.*

---

# Service VMs

Atlas makes these through the same VM service as customer VMs.

| Service | Job | Who calls it | Nodes |
|---|---|---|---|
| **HTTP proxy** | Public web traffic to sites | Browsers; Central and Atlas for routes | 1 to 5 |
| **WireGuard gateway** | Customer devices into private VM addresses | Customer devices | 1 to 5 |
| **IPv6 router** | Public IPv6 to VM mesh addresses | Internet clients | 1 per IPv6 block |
| **Cargo** | Object storage, Pilot images, telemetry hosts | Central, Atlas | 1 Cargo VM + its clusters |

*Service VMs are tenant 0. They can reach VMs of every tenant through WG Mesh.*

---

<!-- _class: seq -->

# Cargo uses Atlas like a customer

![w:1100 Cargo asks Atlas for a machine as tenant 0, Atlas calls Metal, Cargo polls until the machine runs, installs Garage over SSH through WG Mesh, joins the layout through the Garage admin API, writes S3 routes to the proxy, and tells Central with a webhook that the cluster is usable.](assets/cargo-setup.svg)

---

<!-- _class: pause -->
<!-- header: '' -->

# Layer 3 · Hosts

Metal, Firecracker, ZFS and WG Mesh

---

<!-- header: '3 · Hosts' -->

# Inside two Metal hosts

![w:1100 Two Metal hosts. Atlas calls metald on each host over mutual TLS. metald starts Firecracker VMs and keeps their disks in a ZFS pool. VMs connect through veth to wg0 with eBPF programs. The hosts share a WireGuard tunnel, and the two metald daemons talk directly for migration. Object storage sends images to the ZFS pools and receives snapshots.](assets/host.svg)

---

# Metal saves first, then works

- A request writes `config.json`: what must run
- Metal replies `202 Accepted` after the file is saved
- A loop then makes the host match `config.json`
- The loop writes `status.json`: what the host did
- After a crash, Metal continues from these two files

*Each change has a generation number. When observed equals desired, the change is applied.*

---

# WG Mesh: one fixed address per VM

- Each VM gets one private IPv6 address: its **mesh address**
- The address stays the same when the VM moves to another host
- Each pair of hosts shares one **WireGuard tunnel**
- eBPF programs on each host send packets to the correct host
- Hosts learn where a VM is from neighbour discovery, not from a central map

*WG Mesh has no daemon. Metal configures it on each host.*

---

<!-- _class: pause -->
<!-- header: '' -->

# One server, top to bottom

The same diagram, one step at a time

---

<!-- header: 'Create a server' -->
<!-- _class: seq -->

# Central accepts and forwards the request

![w:1060 Step 1 of the create sequence. The customer asks Central to create a server. Central checks the plan, saves an action, queues a job, and calls Atlas.](assets/create-1.svg)

---

<!-- _class: seq -->

# Atlas selects a host. Metal saves the request.

![w:1060 Step 2. Atlas selects a host and saves a draft VM. Atlas sends the VM to Metal. Metal saves it to disk and replies 202. Atlas returns the VM id to Central.](assets/create-2.svg)

---

<!-- _class: seq -->

# Metal builds the VM

![w:1060 Step 3. Metal clones the image into a ZFS disk and boots the VM with Firecracker.](assets/create-3.svg)

---

<!-- _class: seq -->

# The state comes back up

![w:1060 Step 4. The next host sync reports that the VM is running. Atlas sends a state webhook to Central.](assets/create-4.svg)

---

<!-- _class: seq -->

# Pilot joins and the site gets a route

![w:1060 Step 5. Pilot in the VM enrolls with Central. Central writes the site route to the HTTP proxy.](assets/create-5.svg)

---

<!-- header: 'Data paths' -->

# A browser opens a site

![w:1100 The browser asks DNS which proxy node to use, sends HTTPS to the proxy VM, and the proxy VM reads its route map and sends HTTP to the site VM mesh address over WG Mesh.](assets/web-request.svg)

*The proxy reads only its local route map. No call to Central or Atlas.*

---

# Two more ways into a VM

![w:1100 A customer device connects with WireGuard to a gateway VM, which forwards over WG Mesh to the tenant VM. An internet client sends public IPv6 to the IPv6 router VM, which translates the address and forwards over WG Mesh to the tenant VM.](assets/vpn-ipv6.svg)

---

# Buckets: control through Cargo, data through the proxy

![w:1100 Central asks Cargo for a bucket and keys. Cargo calls the Garage admin API over WG Mesh. A bench sends S3 over HTTPS to the proxy VM, which forwards to the Garage gateway node, which stores copies on the storage nodes.](assets/bucket.svg)

---

<!-- header: 'Summary' -->
<!-- _class: small -->

# Who calls whom

| From → to | What | How |
|---|---|---|
| Browser → Central | Dashboard and API | HTTPS |
| Central → Atlas | VMs, images, IPs, snapshots, console tokens | Tenant API, signed token |
| Atlas → Central | VM state changes | Signed webhook |
| Central → Cargo · Cargo → Central | Buckets and keys · cluster state | Signed token · signed webhook |
| Central → HTTP proxy | Site and domain routes | Proxy control API |
| Central ↔ Pilot | Login, rename · enroll, heartbeat, domains | HTTPS |
| Cargo → Atlas | Machines for storage and image builds | Tenant API as tenant 0 |
| Atlas → Metal | VM changes, host sync every 10 s | Mutual TLS |
| Atlas → service VMs | Install and configuration | SSH through the host |
| Metal ↔ Metal | Migration | Coordination API, TLS disk stream |
| Metal → object storage | Image download, snapshot upload | Signed URLs |
| Atlas, Metal → Datum | Metrics and logs | HTTPS push |

---

<!-- _class: small -->

# Where state lives

| State | Owner | After a crash |
|---|---|---|
| Users, plans, requests | Central database | Jobs continue from saved Resource Actions |
| Regional requests, host choice | Atlas database | Atlas jobs continue from saved records |
| What a host must run | Metal `config.json` | Metal continues unfinished work |
| What a host did | Metal `status.json` | Metal reads it at start |
| Disks and images | ZFS on each host | Metal continues storage work |
| Route maps | Each proxy node | Nodes elect a leader and repair stale nodes |
| VM locations | WG Mesh maps on each host | Hosts learn locations again |
| Objects | Garage storage nodes | Copies on other nodes |

---

<!-- header: '' -->

# Sources

- Atlas handbook: `docs/start/architecture.md`, `docs/start/how-a-vm-request-works.md`
- Region and services: `docs/region/service-vms.md`, `docs/region/cargo.md`, `docs/region/host-sync.md`
- Networking: `docs/networking/` (HTTP proxy, WG Mesh, WireGuard gateway, IPv6 router)
- Cargo contracts: `docs/atlas-contract.md`, `docs/central-contract.md`
- Central: `CAPABILITIES.md`, `central/integrations/`, `central/api/state_delivery.py`

*Related decks: [Atlas HTTP proxy](../atlas-http-proxy/) · [Atlas WG Mesh](../atlas-wg-mesh/)*
