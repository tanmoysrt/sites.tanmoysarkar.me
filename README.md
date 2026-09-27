# sites.tanmoysarkar.me

A minimal archive for LLM-generated reports, guides, plans, and Marp decks.

## Add content

- Static pages: `<section>/<slug>/index.html`, where section is `research`, `learning`, or `plans`.
- Marp decks: `raw/<section>/<slug>/slides.md`, with optional files in `assets/`. Install Marp CLI globally with `npm install -g @marp-team/marp-cli`, then run `npm run build:deck -- <section> <slug>`.

Use lowercase kebab-case slugs. See the [publishing skill](skills/publish-site-artifact/SKILL.md) for content guidance.

## Install the skill

Install globally for Codex and Claude Code:

```sh
npx skills add tanmoysrt/sites.tanmoysarkar.me --skill publish-site-artifact -g -a claude-code -a codex -y
```

Or run `bash install-skills.sh` from this checkout.

## Publish

Follow the GitHub CLI commands in [`llms.txt`](llms.txt). Pushing to `main` updates the listings and deploys the site.
