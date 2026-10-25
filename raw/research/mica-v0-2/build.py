#!/usr/bin/env python3
"""Builds research/mica-v0-2/index.html from page.html and the diagrams below.

    python3 raw/research/mica-v0-2/build.py

Each {{name}} in page.html is replaced with the SVG of the diagram `name`.
"""
from html import escape
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[2] / "research" / "mica-v0-2" / "index.html"


class Svg:
    def __init__(self, name, width, height, title):
        self.name, self.width, self.height, self.title = name, width, height, title
        self.parts = []

    def add(self, s):
        self.parts.append(s)

    def band(self, y, h, label, cls):
        self.add(f'<rect class="band {cls}" x="0" y="{y}" width="{self.width}" height="{h}" rx="8"/>')
        self.add(f'<text class="bandlbl" x="16" y="{y + 22}">{escape(label)}</text>')

    def box(self, x, y, w, h, lines, cls="", plain=False):
        self.add(f'<rect class="box {cls}" x="{x}" y="{y}" width="{w}" height="{h}" rx="6"/>')
        lines = lines.split("\n")
        first = y + h / 2 - (len(lines) - 1) * 9 + 5
        for i, line in enumerate(lines):
            weight = ' class="strong"' if i == 0 and len(lines) > 1 and not plain else ""
            self.add(f'<text{weight} x="{x + w / 2}" y="{first + i * 18}" text-anchor="middle">{escape(line)}</text>')

    def group(self, x, y, w, h, label):
        self.add(f'<rect class="group" x="{x}" y="{y}" width="{w}" height="{h}" rx="8"/>')
        self.add(f'<text class="grouplbl" x="{x + 12}" y="{y + 19}">{escape(label)}</text>')

    def path(self, points, cls="", both=False):
        d = " ".join(f"{'M' if i == 0 else 'L'}{x},{y}" for i, (x, y) in enumerate(points))
        marker = "acc" if "acc" in cls else "ink"
        start = f' marker-start="url(#{self.name}-{marker})"' if both else ""
        self.add(f'<path class="arr {cls}" d="{d}"{start} marker-end="url(#{self.name}-{marker})"/>')

    def line(self, x1, y1, x2, y2, cls="", both=False):
        self.path([(x1, y1), (x2, y2)], cls, both)

    def text(self, x, y, s, cls="lbl", anchor="start"):
        for i, line in enumerate(s.split("\n")):
            self.add(f'<text class="{cls}" x="{x}" y="{y + i * 16}" text-anchor="{anchor}">{escape(line)}</text>')

    def step(self, x, y, n, s=""):
        """A numbered badge, then a label. (x, y) is the badge's left baseline."""
        self.add(f'<circle class="badge" cx="{x + 9}" cy="{y - 4}" r="9"/>')
        self.add(f'<text class="badgenum" x="{x + 9}" y="{y}" text-anchor="middle">{n}</text>')
        if s:
            self.text(x + 24, y, s)

    def render(self):
        defs = "".join(
            f'<marker id="{self.name}-{kind}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" '
            f'markerHeight="8" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z" class="head {kind}"/></marker>'
            for kind in ("ink", "acc")
        )
        body = "\n".join(self.parts)
        return (
            f'<svg class="dg" viewBox="0 0 {self.width} {self.height}" role="img" aria-labelledby="{self.name}-t">'
            f'<title id="{self.name}-t">{escape(self.title)}</title><defs>{defs}</defs>\n{body}\n</svg>'
        )


def stack():
    s = Svg("stack", 900, 495, (
        "One guest write. In the guest VM, the app writes, ext4 and the virtio-blk driver pass it to Firecracker. "
        "Firecracker writes to /dev/mica/disk, a ublk block device in the host kernel. The ublk driver hands the "
        "request to the mica queue thread through io_uring. The queue thread writes the disk's data file through "
        "the host filesystem, which writes to the local SSD. Later, the mica disk engine uploads chunks to S3."))
    s.band(0, 105, "GUEST VM", "guest")
    s.band(115, 140, "HOST · USER SPACE", "user")
    s.band(265, 120, "HOST · KERNEL", "kernel")
    s.band(395, 95, "DEVICES", "dev")
    col = {0: 120, 1: 330, 2: 540, 3: 730}
    w = {0: 170, 1: 170, 2: 150, 3: 160}
    mid = {k: col[k] + w[k] / 2 for k in col}
    # Guest
    s.box(col[1], 38, w[1], 52, "app\nwrite()")
    s.box(col[2], 38, w[2], 52, "ext4")
    s.box(col[3], 38, w[3], 52, "virtio-blk\ndriver")
    s.line(col[1] + w[1], 64, col[2], 64)
    s.line(col[2] + w[2], 64, col[3], 64)
    # Host user space
    s.group(110, 150, 400, 96, "mica daemon")
    s.box(col[0], 178, w[0], 58, "disk engine\nmisses · FLUSH · uploads")
    s.box(col[1], 178, w[1], 58, "queue thread\nio_uring", "acc")
    s.line(col[0] + w[0] + 2, 207, col[1] - 2, 207, both=True)
    s.box(col[3], 178, w[3], 58, "Firecracker\nvirtio-blk device")
    # Host kernel
    s.box(col[0], 305, w[0], 60, "network\nTCP · TLS")
    s.box(col[1], 305, w[1], 60, "host filesystem\npage cache")
    s.box(col[2], 305, w[2], 60, "ublk driver\n/dev/ublkc0")
    s.box(col[3], 305, w[3], 60, "/dev/mica/disk\n= /dev/ublkb0")
    # Devices
    s.box(col[0], 428, w[0], 46, "S3 (remote)", "soft")
    s.box(col[1], 428, w[1], 46, "local SSD")
    # The path of one write
    s.line(mid[3], 90, mid[3], 178)
    s.step(mid[3] - 112, 140, 1, "virtqueue")
    s.line(mid[3], 236, mid[3], 305)
    s.step(mid[3] + 12, 278, 2, "write")
    s.line(col[3], 335, col[2] + w[2], 335)
    s.step(col[2] + w[2] + 11, 322, 3)
    s.path([(mid[2], 305), (mid[2], 207), (col[1] + w[1], 207)], "acc")
    s.step(mid[2] + 10, 262, 4, "request + data\nvia io_uring")
    s.line(mid[1], 236, mid[1], 305, "acc")
    s.step(mid[1] + 10, 278, 5, "write the data file")
    s.line(mid[1], 365, mid[1], 428)
    s.step(mid[1] + 10, 408, 6, "writeback · sync on FLUSH")
    s.line(mid[0], 236, mid[0], 305, both=True)
    s.line(mid[0], 365, mid[0], 428, both=True)
    s.step(mid[0] + 10, 408, 7, "later: S3 requests")
    return s.render()


def chunks():
    s = Svg("chunks", 900, 350, (
        "A 20 GiB disk is a row of 81,920 chunks of 256 KiB. A 4 KiB write at byte 1,056,768 lands in chunk 4, "
        "8 KiB into it. On each write, chunk 4 changes in place in the data file data-0. At a checkpoint, mica "
        "hashes chunk 4 with SHA-256, uploads it as chunks/3f/3fa9c1..., writes the hash into slot 4 of page 0, "
        "and the root names page 0."))
    s.text(20, 20, "A 20 GiB disk: 81,920 chunks of 256 KiB", "title")
    for i in range(6):
        x = 20 + i * 100
        s.box(x, 48, 100, 46, f"chunk {i}", "acc tint" if i == 4 else "")
    s.text(670, 76, "…", "dots", "middle")
    s.box(720, 48, 160, 46, "chunk 81,919")
    for i, label in enumerate(["0", "256 KiB", "512 KiB", "768 KiB", "1 MiB", "1.25 MiB", "1.5 MiB"]):
        s.text(20 + i * 100, 112, label, "tick", "middle")
        s.add(f'<line class="tickline" x1="{20 + i * 100}" y1="94" x2="{20 + i * 100}" y2="100"/>')
    s.text(880, 112, "20 GiB", "tick", "middle")
    s.add('<rect class="mark" x="423" y="48" width="5" height="46"/>')
    s.add('<line class="callout" x1="425" y1="48" x2="425" y2="34"/>')
    s.text(432, 38, "a 4 KiB write at byte 1,056,768 = 1 MiB + 8 KiB", "lbl strong")
    # From the chunk to its places
    s.line(470, 94, 470, 120)
    s.add('<circle class="dot" cx="470" cy="150" r="3"/>')
    s.path([(470, 120), (470, 150), (140, 150), (140, 190)])
    s.text(150, 142, "every write: in place, no sync")
    s.line(470, 150, 470, 190, "acc")
    s.text(480, 176, "at a checkpoint", "lbl accent")
    s.box(20, 190, 240, 70, "dirty/data-0 (local SSD)\nbytes 1 MiB to 1.25 MiB\nof a sparse 1 GiB file")
    s.box(350, 190, 240, 60, "SHA-256 of the chunk\n3fa9c1…", "acc")
    s.box(650, 190, 230, 60, "chunks/3f/3fa9c1…\nin S3, zstd body", "soft")
    s.line(590, 220, 650, 220, "acc")
    s.text(620, 212, "PUT", "lbl accent", "middle")
    s.line(470, 250, 470, 285)
    s.box(350, 285, 240, 50, "page 0, slot 4\n= 3fa9c1…")
    s.box(650, 285, 230, 50, "root\npage 0 = 81c0…")
    s.line(590, 310, 650, 310)
    return s.render()


def tree():
    s = Svg("tree", 900, 300, (
        "The head of disk-1 points to root 42. A snapshot points to root 41, and so does the head of disk-2, a clone. "
        "Root 42 and root 41 share page 0. Root 42 has a new page 1 prime, which names the changed chunk c prime."))
    s.box(20, 30, 170, 46, "disks/disk-1/head")
    s.box(20, 125, 170, 46, "snapshots/base")
    s.box(20, 220, 170, 46, "disks/disk-2/head")
    s.box(260, 30, 130, 46, "root 42", "acc")
    s.box(260, 160, 130, 46, "root 41")
    s.box(470, 20, 130, 44, "page 1′", "acc")
    s.box(470, 120, 130, 44, "page 0")
    s.box(470, 220, 130, 44, "page 1")
    s.box(690, 20, 190, 44, "chunk c′", "acc")
    s.box(690, 120, 190, 44, "chunks a, b")
    s.box(690, 220, 190, 44, "chunk c")
    s.line(190, 53, 260, 53)
    s.line(190, 148, 260, 176)
    s.line(190, 243, 260, 192)
    s.line(390, 46, 470, 42, "acc")
    s.line(390, 62, 470, 134)
    s.line(390, 176, 470, 150)
    s.line(390, 192, 470, 238)
    s.line(600, 42, 690, 42, "acc")
    s.line(600, 142, 690, 142)
    s.line(600, 242, 690, 242)
    s.text(450, 292, "Root 42 changed one chunk, so it has one new page. Everything else is shared.", "lbl", "middle")
    return s.render()


def flush():
    s = Svg("flush", 900, 250, (
        "A guest write goes into the data file in the page cache, and returns. A guest FLUSH syncs the data files, "
        "appends new chunks to the dirty log, and syncs the log. Every 16 MiB of writes, mica starts writeback early. "
        "A checkpoint every 30 s or 512 MiB reads chunks and uploads them to S3."))
    s.box(20, 30, 150, 60, "guest write")
    s.box(250, 25, 230, 70, "data file\nin the page cache\n+ chunk noted in memory")
    s.box(570, 30, 170, 60, "checkpoint\nevery 30 s or 512 MiB", "acc")
    s.box(800, 30, 80, 60, "S3", "soft")
    s.line(170, 60, 250, 60)
    s.text(210, 52, "returns", "lbl", "middle")
    s.line(480, 60, 570, 60, "acc")
    s.text(525, 52, "read", "lbl accent", "middle")
    s.line(740, 60, 800, 60, "acc")
    s.text(770, 52, "PUT", "lbl accent", "middle")
    s.box(20, 160, 150, 60, "guest FLUSH")
    s.box(250, 150, 230, 80, "1  fdatasync the data files\n2  append new chunks to the log\n3  fdatasync the log", plain=True)
    s.line(170, 190, 250, 190)
    s.line(365, 95, 365, 150)
    s.text(375, 127, "every 16 MiB: start writeback")
    s.text(570, 182, "A FLUSH never waits for S3.", "lbl accent strongish")
    s.text(570, 204, "When it returns, the data survives a power cut.")
    return s.render()


def move():
    s = Svg("move", 900, 345, (
        "Machine A stops the guest and unmounts, uploads the last checkpoint, and deletes the attached marker. "
        "Machine B creates the marker with If-None-Match, reads the head and the root, makes the device and starts "
        "the guest. Then it fetches the read profile and fills the rest of the disk."))
    lanes = {"Machine A": 150, "S3": 450, "Machine B": 750}
    for name, x in lanes.items():
        s.box(x - 75, 8, 150, 36, name, "soft" if name == "S3" else "")
        s.add(f'<line class="life" x1="{x}" y1="44" x2="{x}" y2="335"/>')
    a, b, c = lanes.values()
    s.box(a - 90, 62, 180, 32, "guest stops · umount")
    s.line(a, 125, b, 125)
    s.text((a + b) / 2, 117, "last checkpoint: chunks, pages, root, head", "lbl", "middle")
    s.line(a, 165, b, 165)
    s.text((a + b) / 2, 157, "DELETE the attached marker", "lbl", "middle")
    s.line(c, 205, b, 205)
    s.text((b + c) / 2, 197, "PUT the marker, If-None-Match: *", "lbl", "middle")
    s.line(c, 245, b, 245)
    s.text((b + c) / 2, 237, "GET head, GET root", "lbl", "middle")
    s.box(c - 110, 258, 220, 32, "/dev/mica/disk · guest starts", "acc")
    s.line(b, 320, c, 320, "acc")
    s.text((b + c) / 2, 312, "read profile first, then the fill", "lbl accent", "middle")
    return s.render()


def main():
    page = (HERE / "page.html").read_text()
    for name, build in {"stack": stack, "chunks": chunks, "tree": tree, "flush": flush, "move": move}.items():
        page = page.replace("{{" + name + "}}", build())
    assert "{{" not in page, "a placeholder has no diagram"
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(page)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
