#!/usr/bin/env bash
set -euo pipefail

skill_name="publish-site-artifact"
source_file=""
temporary_file=""

if [[ -n "${BASH_SOURCE[0]-}" && -f "${BASH_SOURCE[0]}" ]]; then
  script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
  source_file="$script_dir/skills/$skill_name/SKILL.md"
fi

if [[ ! -f "$source_file" ]]; then
  temporary_file="$(mktemp)"
  trap 'rm -f "$temporary_file"' EXIT
  curl -fsSL "https://sites.tanmoysarkar.me/skills/$skill_name/SKILL.md" -o "$temporary_file"
  source_file="$temporary_file"
fi

if ! head -n 5 "$source_file" | grep -q "^name: $skill_name$"; then
  echo "The downloaded file is not the $skill_name skill." >&2
  exit 1
fi

codex_root="${CODEX_HOME:-$HOME/.codex}"
claude_root="${CLAUDE_HOME:-$HOME/.claude}"

for target in "$codex_root/skills/$skill_name" "$claude_root/skills/$skill_name"; do
  mkdir -p "$target"
  cp "$source_file" "$target/SKILL.md"
  echo "Installed $target/SKILL.md"
done
