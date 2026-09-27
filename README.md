# sites.tanmoysarkar.me

A minimal archive for LLM-generated reports, guides, plans, demos, and Marp decks.

## Add content

- Direct HTML pages: `<section>/<slug>/index.html`, where section is `research`, `learning`, `plans`, or `demos`.
- Demos: put each static site in `demos/<slug>/`. Use relative asset paths so it works at that URL. The site host cannot run a server for a demo.
- Generated pages: keep editable source, configuration, and source assets in `raw/<section>/<slug>/`, and built files in `<section>/<slug>/`. Commit both. Put the build command in `raw/<section>/<slug>/README.md` when the repo has no build script for that tool.
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
