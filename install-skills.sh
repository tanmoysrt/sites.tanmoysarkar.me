#!/usr/bin/env bash
# Installs the skills of sites.tanmoysarkar.me for Claude Code, Codex and Pi.
# Pi reads ~/.agents/skills, the shared Agent Skills folder, so the skills do not go
# into ~/.pi/agent/skills too. Two copies would give Pi a name collision.
# Run it from a clone, or with: curl -fsSL https://sites.tanmoysarkar.me/install-skills.sh | bash
set -euo pipefail

site="https://sites.tanmoysarkar.me"
skills=(
  "tanmoy-publish:SKILL.md"
  "tanmoy-state-chart:SKILL.md scripts/render.mjs"
)

# Old names. The installer removes them, so that an agent sees each skill once.
old_skills=(publish-site-artifact state-chart)

script_dir=""
if [[ -n "${BASH_SOURCE[0]-}" && -f "${BASH_SOURCE[0]}" ]]; then
  script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
fi

codex_root="${CODEX_HOME:-$HOME/.codex}"
claude_root="${CLAUDE_HOME:-$HOME/.claude}"
agents_root="${AGENTS_HOME:-$HOME/.agents}"
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
  for target in "$agents_root/skills/$name" "$codex_root/skills/$name" "$claude_root/skills/$name"; do
    mkdir -p "$target"
    cp -R "$work/$name/." "$target/"
    echo "Installed $target"
  done
done

for root in "$agents_root" "$codex_root" "$claude_root"; do
  for name in "${old_skills[@]}"; do
    old="$root/skills/$name"
    if [[ -L "$old" ]] || grep -qs "^name: $name$" "$old/SKILL.md"; then
      rm -rf "$old"
      echo "Removed old $old"
    fi
  done
done
