# sites.tanmoysarkar.me

A minimal archive for LLM-generated reports, guides, plans, demos, and Marp decks.

## Add content

- Direct HTML pages: `<section>/<slug>/index.html`, where section is `research`, `learning`, `plans`, or `demos`.
- Demos: put each static site in `demos/<slug>/`. Use relative asset paths so it works at that URL. The site host cannot run a server for a demo.
- Generated pages: keep editable source, configuration, and source assets in `raw/<section>/<slug>/`, and built files in `<section>/<slug>/`. Commit both. Put the build command in `raw/<section>/<slug>/README.md` when the repo has no build script for that tool.
- Pages with Pele diagrams: write `raw/<section>/<slug>/index.html` with Mermaid in `<script type="text/mermaid" data-label="...">` blocks, run `npm install` once, then `npm run build:page -- <section> <slug>`.
- Marp decks: `raw/<section>/<slug>/slides.md`, with optional files in `assets/`. Install Marp CLI globally with `npm install -g @marp-team/marp-cli`, then run `npm run build:deck -- <section> <slug>`.

Use lowercase kebab-case slugs. See the [publishing skill](skills/tanmoy-publish/SKILL.md) for content guidance.

## Install the skills

- `tanmoy-publish`: write and publish pages for this site.
- `tanmoy-state-chart`: draw a state chart with phases, rules and the path to each bug. It also renders a chart to an SVG with `scripts/render.mjs`.

Install both globally for Claude Code, Codex and Pi:

```sh
curl -fsSL https://sites.tanmoysarkar.me/install-skills.sh | bash
```

Or run `bash install-skills.sh` from this checkout. It writes each skill to `~/.claude/skills`, `~/.codex/skills` and `~/.agents/skills`. Pi reads `~/.agents/skills`. In Pi, run `/reload` or start a new session, then use `/skill:tanmoy-state-chart` to load a skill by name.

## Publish

Follow the GitHub CLI commands in [`llms.txt`](llms.txt). Pushing to `main` updates the listings and deploys the site.
