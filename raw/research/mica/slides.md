---
marp: true
title: 'mica: disks that follow your VMs and containers'
description: How mica works. A block device whose data lives in S3, with local SSD speed.
theme: default
paginate: true
style: |
  section {
    background: #ffffff;
    color: #1e1e1e;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 28px;
    padding: 52px 60px 44px;
    justify-content: flex-start;
  }
  h1 { font-size: 44px; font-weight: 650; color: #111111; margin: 0 0 22px; letter-spacing: -0.01em; }
  p, li { line-height: 1.45; }
  li { margin: 6px 0; }
  strong { color: #111111; font-weight: 650; }
  em { font-style: normal; color: #6c757d; font-size: 23px; }
  code { background: #f1f3f5; color: #1e1e1e; font-size: 0.85em; border-radius: 4px; }
  pre { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; font-size: 21px; line-height: 1.5; }
  pre code { background: transparent; font-size: 1em; }
  table { font-size: 22px; border-collapse: collapse; }
  th, td { border: none !important; border-bottom: 1px solid #dee2e6 !important; padding: 7px 16px; background: #ffffff !important; text-align: left; }
  th { color: #6c757d; font-weight: 600; }
  img { background: transparent; }
  section::after { color: #adb5bd; font-size: 16px; }
  section.lead { justify-content: center; text-align: center; }
  section.lead h1 { font-size: 64px; margin: 8px 0 4px; }
  section.pause { justify-content: center; }
  section.pause h1 { font-size: 52px; font-weight: 600; }
---

<!-- _class: lead -->
<!-- _paginate: false -->

![w:96 mica logo](assets/mica-icon.svg)

# mica

Disks that follow your VMs and containers

*A block device whose data lives in S3*

---

# A sandbox should start on any node

- **Copy the disk first?** 20 GiB at 100 Mbit/s: about 30 min
- **Network block storage?** A storage cluster, and every read is remote
- **But a boot reads little:** about 700 MB of a 20 GiB disk

---

# What we want

1. Attach on any node, at once
2. Download only what is read
3. Write at local SSD speed

---

# The idea

![w:1120 A VM or container uses /dev/mica/disk. The mica daemon writes to the local SSD, fetches chunks from S3 on demand, and uploads changes every 3 minutes.](assets/idea.svg)

*S3 keeps the durable copy. The SSD makes it fast.*

---

# Three rules

1. **Writes land on the local SSD.** The guest never waits for S3.
2. **Reads go to S3 only on a miss.** Nothing is copied at attach.
3. **A checkpoint uploads changes** every 3 minutes, and at detach.

---

<!-- _class: pause -->

# How does a disk become objects?

---

# A disk is a row of 4 MiB chunks

![w:1120 A disk drawn as a row of 4 MiB chunks. A read at byte 1,073,745,920 lands 4,096 bytes into chunk 256.](assets/chunks.svg)

```text
chunk  = 1,073,745,920 / 4 MiB = 256
inside = 1,073,745,920 % 4 MiB = 4,096
```

---

# Each chunk is named by its SHA-256

![w:1080 Two disks list chunks a, b, zero, and c or d. Chunks a and b are one S3 object each, shared by both disks. The zero chunk has no object.](assets/dedup.svg)

*Thin: zero chunks cost nothing. Deduplicated: equal chunks are stored once.*

---

# What is in S3

```text
chunks/<xx>/<sha256>      4 MiB of data             never changes
manifests/<sha256>        the full chunk list       never changes
disks/<disk>/head         the current manifest      one PUT per commit
disks/<disk>/attached     the owner node            only while attached
snapshots/<name>          a named manifest
```

- No conditional writes. R2, Ceph and Garage work the same.

---

<!-- _transition: fade 250ms -->

# A manifest is the whole disk

![w:1120 The head of disk-1 points to manifest 42, which points to parents 41 and 40. Writing the head commits a new manifest.](assets/manifest-1.svg)

*800 KiB describes 100 GiB. One PUT of the head moves the disk to its next full state.*

---

# Snapshots and new disks copy nothing

![w:1120 A snapshot and a new disk both point to manifest 40. Neither copies data.](assets/manifest-2.svg)

*Old manifests stay as restore points until GC.*

---

# What is on the local SSD

```text
/var/lib/mica/
  node-id                   random ID of this node
  cache/<xx>/<sha256>       clean chunks, all in S3
  disks/<disk>/
    state                   attached or orphaned, ublk device number
    dirty/<index>.chunk     changed by the guest
    dirty/<index>.frozen    being uploaded
    dirty/<index>.tmp       being made, deleted after a crash
```

- Only `dirty/` holds data S3 lacks. It is never deleted before a commit.
- The cache can lose any file at any time.

---

<!-- _class: pause -->

# What happens to one read and one write?

---

<!-- _transition: fade 250ms -->

# Read: the first match wins

![w:1120 The read finds the chunk in the dirty folder, the guest's own recent write.](assets/read-1.svg)

---

<!-- _transition: fade 250ms -->

# Read: the first match wins

![w:1120 The chunk is not dirty and not zero, so the read uses the cached copy.](assets/read-2.svg)

---

# Read: the first match wins

![w:1120 Nothing local has the chunk, so mica fetches it from S3, checks its hash and saves it in the cache.](assets/read-3.svg)

*Many misses on one chunk share one GET.*

---

<!-- _transition: fade 250ms -->

# Write: the first write to a chunk

![w:1120 On the first write to a chunk, mica copies the clean chunk to a temp file, syncs it and renames it to .chunk.](assets/write-1.svg)

---

<!-- _transition: fade 250ms -->

# Write: the data

![w:1120 mica writes the data into the .chunk file and returns to the guest without a sync.](assets/write-2.svg)

---

# Next writes to this chunk skip 1 and 2

![w:1120 The full write path: copy, sync and rename on the first write, then write data and return.](assets/write-all.svg)

*A crash never leaves a half-copied chunk. The lock holds until the data is in the file.*

---

# Most requests stay on the queue thread

![w:1120 A request whose chunks are all local runs on the queue thread with io_uring. Other requests go to the disk engine on tokio.](assets/fast-path.svg)

*No thread hop, no copy. Up to 4 queue threads per disk.*

---

# A flush never touches S3

![w:1120 A guest flush makes mica sync the changed chunk files and the dirty folder on the local SSD. S3 is not touched.](assets/flush.svg)

*A failed sync stops the disk: Linux may drop unsynced pages, so a retry proves nothing.*

---

<!-- _transition: fade 250ms -->

# Checkpoint: freeze

![w:1080 Step 1: each changed chunk file is renamed from .chunk to .frozen. Guest writes continue into new .chunk files.](assets/checkpoint-1.svg)

---

<!-- _transition: fade 250ms -->

# Checkpoint: upload

![w:1080 Step 2: frozen chunks are uploaded, 16 at a time, then the manifest.](assets/checkpoint-2.svg)

---

<!-- _transition: fade 250ms -->

# Checkpoint: commit

![w:1080 Step 3: mica checks the attached marker is still its own, then writes the head. This is the commit.](assets/checkpoint-3.svg)

---

<!-- _transition: fade 250ms -->

# Checkpoint: repair and clean up

![w:1080 Step 4: mica checks every committed chunk exists and uploads any missing one, then moves frozen files into the cache.](assets/checkpoint-4.svg)

---

# Checkpoint

![w:1080 All checkpoint steps: rename, upload chunks and manifest, check owner and write head, repair and move to cache.](assets/checkpoint-all.svg)

*Only while dirty. An idle disk makes no requests.*

---

<!-- _transition: fade 250ms -->

# Moving a disk: node A lets go

![w:1120 Node A uploads its last checkpoint and deletes the attached marker.](assets/move-1.svg)

---

<!-- _transition: fade 250ms -->

# Moving a disk: node B claims it

![w:1120 Node B writes its marker, waits one second and reads it back.](assets/move-2.svg)

---

<!-- _transition: fade 250ms -->

# Moving a disk: node B starts

![w:1120 Node B reads the head and manifest, starts the sandbox, and downloads chunks as they are read.](assets/move-3.svg)

---

# Moving a disk

![w:1120 The full move: node A checkpoints and releases, node B claims, reads the head and fetches chunks on demand.](assets/move-all.svg)

*Unmount returns only when S3 has everything. A 100 GiB disk attaches with two GETs.*

---

<!-- _class: pause -->

# What can go wrong?

---

# What mica promises

1. **Flushed data survives** a mica crash or a node reboot.
2. **While uploads keep up,** S3 is at most about 5 minutes behind.
3. **After a detach,** S3 has everything.
4. **Local data S3 lacks** is never deleted.
5. **Corrupt chunks** are never served: every download is hashed.
6. **A second writer** is detected, not prevented.

*On a slow link the disk shows as behind. `wait_when_behind` makes writes wait instead.*

---

# When something fails

| Failure | What happens | Data lost |
|---|---|---|
| mica crashes or restarts | Kernel holds I/O, new daemon takes over | None |
| Node reboots | Local chunks upload at boot | Unflushed writes |
| Node lost for good | Another node attaches with `--force` | About 5 min |
| S3 down or slow | Writes continue on the SSD, checkpoints retry | None |
| Disk taken by another node | The old node stops within a minute | Its unsaved writes, kept locally |
| Local `fsync` fails | The disk stops and keeps its data | The guest sees an error |
| GC deletes a chunk mid-commit | The checkpoint uploads it again | None |

---

<!-- _transition: fade 250ms -->

# One owner without conditional writes

![w:1120 Nodes A and B write claims to the attached marker at the same moment.](assets/fence-1.svg)

*Garage ignores `If-Match`. Ceph support varies. So mica needs neither.*

---

# One owner without conditional writes

![w:1120 After one second both read the marker back. Node B sees its own claim and wins. Node A backs off.](assets/fence-2.svg)

*Full manifests make any leftover race harmless: a head always names one full disk.*

---

<!-- _transition: fade 250ms -->

# GC can race a checkpoint

![w:1120 GC finds chunk X old and unused. A checkpoint uploads X again, GC deletes it, and the checkpoint commits a head that needs X.](assets/gc-1.svg)

---

# The checkpoint repairs it

![w:1120 After the commit the checkpoint checks X, finds it missing and uploads it again from its local copy.](assets/gc-2.svg)

*GC also skips objects younger than 24 h, and stops if it cannot read every root.*

---

# Upgrades without downtime

![w:1120 The old daemon checkpoints and exits but keeps the device. The kernel holds guest I/O. The new daemon opens the local chunk files, takes over the device, and gets the held I/O.](assets/restart.svg)

*Tested: a writer ran through `mica service restart`. Longest pause 0.8 s, no errors.*

---

<!-- _class: pause -->

# How fast, and what does it cost?

---

# Local I/O

| Test | Plain NVMe | mica |
|---|---|---|
| Sequential write, 1 MiB | 836 MiB/s | 535 MiB/s |
| Sequential read from cached chunks, 1 MiB | 2008 MiB/s | 1603 MiB/s |
| Random read 4K, depth 1 | 15k IOPS · 64 µs | **83k IOPS · 10 µs** |
| Random read 4K, depth 8 | 126k IOPS | **283k IOPS** |
| Random write 4K, depth 1 | 28k IOPS | **52k IOPS** |
| Random write 4K, depth 8 | 112k IOPS | 67k IOPS |
| 4K write + `fdatasync` | 970/s | 917/s |

*`O_DIRECT` in the guest, one laptop NVMe with btrfs. Small test data stays in the host page cache, so warm reads beat the raw drive.*

---

# Cold boot: the network decides

An Ubuntu 24.04 boot in Firecracker, cold cache: **173 chunks, 692 MiB**

| Download speed | Time |
|---|---|
| 2.2 MB/s, the test link | about 5.5 min |
| 50 MB/s, a server link | about 14 s |
| 110 MB/s, 1 Gbit/s | about 6 s |
| Warm node, no downloads | root mounted at 0.8 s |

*Keep base images warm with `mica disk warm`. 4 MiB chunks make scattered reads costly.*

---

# Cost on Cloudflare R2

| Action | Requests | Cost |
|---|---|---|
| Idle attached disk | none | $0 |
| Write 1 GiB of new data | 256 PUT | $0.0012 |
| Stop and start a sandbox | ~6 PUT, ~90 GET | $0.00006 |
| A disk busy all day, every day | ~144k PUT a month | ~$0.65 a month |
| 1 TB stored | – | ~$15 a month |

*Storage dominates. Disks from one image share its chunks.*

---

<!-- _class: pause -->

# How do you use it?

---

# The CLI

```text
mica status
mica disk      ls  create  warm  attach  mount  unmount  detach  resize  delete
mica snapshot  ls  create  delete
mica gc
mica cache     status  prune
mica service   setup  start  stop  restart  status  logs
```

```bash
mica disk create sandbox-7 --from-snapshot base-image
mica disk attach sandbox-7 --prefetch 32
mica disk mount data-1 /srv/data --owner www-data
mica disk unmount data-1        # returns when S3 has everything
```

---

# Running a node

- `mica service setup` tests the bucket and installs `mica.service`
- Mounts are `mica-mount@<disk>` units: back after reboot, uploaded at shutdown
- The `mica` group works without sudo; mounts stay in `/mnt`, `/srv`, `/media`
- Upgrade = setup again. Attached disks keep running.

---

# What is next

- Read-ahead for cold sequential reads
- Smaller chunks for boot disks, measured on the same image
- Parallel writes on the queue thread: depth 8 fell from 195k to 67k IOPS
- Automated tests for the engine, checkpoints and crash recovery
- vhost-user-blk as a second frontend for VMs

---

<!-- _class: lead -->
<!-- _paginate: false -->

![w:72 mica logo](assets/mica-icon.svg)

# mica

Local SSD speed, S3 durability, disks that move

*github.com/tanmoysrt/mica*
