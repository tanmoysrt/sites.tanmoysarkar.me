---
name: publish-site-artifact
description: Create or publish a report, guide, plan, or Slidev presentation for sites.tanmoysarkar.me. Use for artifacts intended for this archive, not for unrelated websites or slide decks.
---

# Publish a site artifact

This archive lives in `tanmoysrt/sites.tanmoysarkar.me` on `main`. See [llms.txt](https://sites.tanmoysarkar.me/llms.txt) for paths and the required GitHub CLI publishing commands. In a checkout, read the local `llms.txt`.

## Shape the artifact

- If the request leaves the topic, intended audience, or desired depth unclear, ask a few concise questions before choosing the format. Use answers already given; do not repeat questions.
- Choose `research/<slug>/index.html` for reports, `learning/<slug>/index.html` for guides, and `plans/<slug>/index.html` for project plans. Use lowercase kebab-case slugs.
- Make each document a self-contained static page with readable HTML, inline CSS, and any local assets in its folder. Keep the site minimal and light. Do not copy an existing page's wording or design wholesale.
- Check factual claims against sources when the topic needs it. Keep links to the sources visible on the artifact.

## Presentations

Use Slidev for presentations and place each deck in `research`, `learning`, or `plans` based on its purpose. Keep editable source in `decks/<section>/<slug>/slides.md`. Set `title`, `titleTemplate: '%s'`, `colorSchema: light`, and `routerMode: hash` in the first frontmatter block. Build with `npm ci` and `npm run build:deck -- <section> <slug>`; commit the source and `<section>/<slug>/` output together.

Use the light, quiet style of the main site: system sans text, restrained color, generous contrast, and little ornament. Give each slide one clear point. Prefer a diagram, example, or small code excerpt over dense prose. Reveal a process or diagram one meaningful step at a time with Slidev's `v-click` or `v-clicks`. Use motion only to clarify sequence or cause and effect; avoid decorative transitions and automatic animation. Make the final state understandable when someone lands on or exports the slide.

Slidev references: [building and hosting](https://sli.dev/guide/hosting) and [click animations](https://sli.dev/guide/animations).

## Publish

Run `gh auth status` before publication. For a new single HTML page, use the `gh api` PUT command in `llms.txt`; include the existing file SHA when updating. For a deck or other multi-file artifact, use `gh repo clone tanmoysrt/sites.tanmoysarkar.me`, then commit and push the source and generated files. Do not use raw token-based HTTP publishing. Publish only when the user has asked for it. Confirm the public URL works before reporting success.
