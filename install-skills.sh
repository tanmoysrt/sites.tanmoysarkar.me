#!/usr/bin/env bash
# Installs the skills of sites.tanmoysarkar.me for Claude Code and Codex.
# Run it from a clone, or with: curl -fsSL https://sites.tanmoysarkar.me/install-skills.sh | bash
set -euo pipefail

site="https://sites.tanmoysarkar.me"
skills=(
  "publish-site-artifact:SKILL.md"
  "state-chart:SKILL.md scripts/render.mjs"
)

script_dir=""
if [[ -n "${BASH_SOURCE[0]-}" && -f "${BASH_SOURCE[0]}" ]]; then
  script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
fi

codex_root="${CODEX_HOME:-$HOME/.codex}"
claude_root="${CLAUDE_HOME:-$HOME/.claude}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

for entry in "${skills[@]}"; do
  name="${entry%%:*}"
  read -r -a files <<< "${entry#*:}"
  for file in "${files[@]}"; do
    mkdir -p "$work/$name/$(dirname "$file")"
    if [[ -n "$script_dir" && -f "$script_dir/skills/$name/$file" ]]; then
      cp "$script_dir/skills/$name/$file" "$work/$name/$file"
    else
      curl -fsSL "$site/skills/$name/$file" -o "$work/$name/$file"
    fi
  done
  if ! head -n 5 "$work/$name/SKILL.md" | grep -q "^name: $name$"; then
    echo "The downloaded file is not the $name skill." >&2
    exit 1
  fi
  for target in "$codex_root/skills/$name" "$claude_root/skills/$name"; do
    mkdir -p "$target"
    cp -R "$work/$name/." "$target/"
    echo "Installed $target"
  done
done
