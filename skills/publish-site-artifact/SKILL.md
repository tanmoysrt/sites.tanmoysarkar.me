---
name: publish-site-artifact
description: Create or publish a report, guide, plan, or Marp presentation for sites.tanmoysarkar.me. Use for artifacts intended for this archive, not for unrelated websites or slide decks.
---

# Publish a site artifact

This archive lives in `tanmoysrt/sites.tanmoysarkar.me` on `main`. See [llms.txt](https://sites.tanmoysarkar.me/llms.txt) for paths and the required GitHub CLI publishing commands. In a checkout, read the local `llms.txt`.

## Shape the artifact

- If the request leaves the topic, intended audience, or desired depth unclear, ask a few concise questions before choosing the format. Use answers already given; do not repeat questions.
- Choose `research/<slug>/index.html` for reports, `learning/<slug>/index.html` for guides, and `plans/<slug>/index.html` for project plans. Use lowercase kebab-case slugs.
- Make each document a self-contained static page with readable HTML, inline CSS, and any local assets in its folder. Keep the site minimal and light. Do not copy an existing page's wording or design wholesale.
- Check factual claims against sources when the topic needs it. Keep links to the sources visible on the artifact.

## Presentations

Use Marp for presentations and place each deck in `research`, `learning`, or `plans` based on its purpose. Keep editable Markdown at `raw/<section>/<slug>/slides.md` and local assets under `raw/<section>/<slug>/assets/`. Set `marp: true` and a meaningful `title` in the frontmatter. Check `marp --version` first. If Marp CLI is missing, ask the user to install it globally with `npm install -g @marp-team/marp-cli`. Build with `npm run build:deck -- <section> <slug>`; commit the raw source and `<section>/<slug>/` output together.

Keep decks easy to scan: a white canvas, dark sans text, thin lines, plenty of empty space, and only a little color to mark the current state. Use one idea per slide and short labels or fragments instead of paragraphs. Show actual code, tables, or product screens when they explain the point faster than prose. A slide should make sense at a glance and need little effort to read. Use a brief question or section title as an occasional pause.

For concepts and flows, favor simple tldraw or Excalidraw-like diagrams: plain boxes, arrows, handwritten-feeling lines, and direct labels. Keep them deliberately rough and useful, without glossy icons, gradients, shadows, or decorative illustrations. Give each actor or operation a consistent color; use a stronger accent only for the path or state under discussion. Put short annotations next to the relevant part of the diagram.

Show each slide's content immediately. When a flow genuinely needs stages, reuse the same diagram across consecutive slides. Keep actors and nodes in the same positions; change or highlight only the operation, branch, or result being explained. Use only the steps the audience needs to compare, and end with the complete state. If motion clarifies the sequence, put `<!-- _transition: fade 250ms -->` on the slide before the next step. Keep other transitions off.

Marp references: [CLI](https://github.com/marp-team/marp-cli) and [slide transitions](https://github.com/marp-team/marp-cli/blob/main/docs/bespoke-transitions/README.md).

## Publish

Run `gh auth status` before publication. For a new single HTML page, use the `gh api` PUT command in `llms.txt`; include the existing file SHA when updating. For a deck or other multi-file artifact, use `gh repo clone tanmoysrt/sites.tanmoysarkar.me`, then commit and push the source and generated files. Do not use raw token-based HTTP publishing. Publish only when the user has asked for it. Confirm the public URL works before reporting success.
