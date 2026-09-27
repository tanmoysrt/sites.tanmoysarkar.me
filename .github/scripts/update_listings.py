#!/usr/bin/env python3
"""Update section indexes from self-contained artifact pages."""

import html
import re
import sys
from pathlib import Path


SECTIONS = ("research", "learning", "plans", "demos")
EMPTY_LABELS = {
    "research": "reports",
    "learning": "guides",
    "plans": "plans",
    "demos": "demos",
}
START = "      <!-- entries:start -->"
END = "      <!-- entries:end -->"
SLUG = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*\Z")
TITLE = re.compile(r"<title\b[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
SITE_SUFFIX = " · sites.tanmoysarkar.me"


def page_title(page: Path) -> str:
    match = TITLE.search(page.read_text(encoding="utf-8"))
    if not match:
        raise ValueError(f"Missing <title> in {page}")
    title = " ".join(html.unescape(match.group(1)).split())
    if title.endswith(SITE_SUFFIX):
        title = title[: -len(SITE_SUFFIX)]
    return title


def render_entries(root: Path, section: str) -> str:
    pages = sorted((root / section).glob("*/index.html"))
    entries = []
    for page in pages:
        slug = page.parent.name
        if not SLUG.fullmatch(slug):
            raise ValueError(f"Invalid slug: {slug}")
        title = html.escape(page_title(page), quote=True)
        entries.append(f'      <li><a href="{slug}/">{title}</a></li>')

    if not entries:
        label = EMPTY_LABELS[section]
        entries.append(f'      <li class="empty">No {label} yet.</li>')
    return "\n".join(entries)


def update_section(root: Path, section: str) -> bool:
    index = root / section / "index.html"
    source = index.read_text(encoding="utf-8")
    if source.count(START) != 1 or source.count(END) != 1:
        raise ValueError(f"Missing listing markers in {index}")

    before, remainder = source.split(START, 1)
    _, after = remainder.split(END, 1)
    updated = f"{before}{START}\n{render_entries(root, section)}\n{END}{after}"
    if updated == source:
        return False
    index.write_text(updated, encoding="utf-8")
    return True


def main() -> None:
    root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[2]
    for section in SECTIONS:
        changed = update_section(root, section)
        print(f"{section}: {'updated' if changed else 'unchanged'}")


if __name__ == "__main__":
    main()
