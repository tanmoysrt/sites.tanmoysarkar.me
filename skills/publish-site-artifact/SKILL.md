---
name: publish-site-artifact
description: Create or publish a report, guide, plan, or Marp presentation for sites.tanmoysarkar.me. Use for artifacts intended for this archive, not for unrelated websites or slide decks.
---

# Publish a site artifact

This archive lives in `tanmoysrt/sites.tanmoysarkar.me` on `main`. See [llms.txt](https://sites.tanmoysarkar.me/llms.txt) for paths and the required GitHub CLI publishing commands. In a checkout, read the local `llms.txt`.

## Shape the artifact

- Infer whether the user wants an artifact or a slideshow from the request. If both fit and the choice is still unclear, ask: "Would you like an artifact or a slideshow?" Use answers already given; do not repeat questions. Ask about audience or depth only when needed to make the result useful.
- Choose `research/<slug>/index.html` for reports, `learning/<slug>/index.html` for guides, and `plans/<slug>/index.html` for project plans. Use lowercase kebab-case slugs.
- For direct HTML pages, write readable, self-contained HTML with inline CSS and any local assets in the page's folder. Keep the site minimal and light. Do not copy an existing page's wording or design wholesale.
- When a tool generates the page, keep its editable source, configuration, and source assets in `raw/<section>/<slug>/`; put the built site in `<section>/<slug>/`. Record the build command in `raw/<section>/<slug>/README.md` unless a repository script already does so. Commit source and output together. Direct HTML pages need no duplicate raw copy.
- Check factual claims against sources when the topic needs it. Keep links to the sources visible on the artifact.

## Written reports, guides, and plans

Write like a clear engineering note. Start with the concrete situation and why the reader should care. Explain in causal order: the constraint, the idea or change, how it works, evidence, limits, and what happens next. Use only the sections the subject needs. Define a component's job before describing its internals, then trace one realistic request, action, or piece of data through the system.

Use short paragraphs, direct headings, and specific examples. Show the relevant lines of code or configuration, a real UI state, or a measured before/after result when that makes the idea easier to verify. Give numbers units and measurement conditions. Distinguish what exists, what was tested, what is proposed, and what remains uncertain; include meaningful tradeoffs and failed approaches. Edit repetitions and rough phrasing rather than imitating the source posts verbatim.

Use diagrams to answer one question at a time. Draw simple labeled components and directional arrows; show ownership or network boundaries when they matter. Label the data or action on important arrows, and use before/after diagrams for a redesign. Place each diagram next to its explanation and give it useful alternative text. Use a restrained hand-drawn look with plain lines and little color. Treat private reference posts as style examples; do not copy their text, screenshots, or infrastructure details into public artifacts.

For a guide, give actionable steps and expected results. For research, compare options using evidence and state a conclusion. For a plan, show sequence, dependencies, and how success will be checked.

## Presentations

Use Marp for presentations and place each deck in `research`, `learning`, or `plans` based on its purpose. Keep editable Markdown at `raw/<section>/<slug>/slides.md` and local assets under `raw/<section>/<slug>/assets/`. Set `marp: true` and a meaningful `title` in the frontmatter. Check `marp --version` first. If Marp CLI is missing, ask the user to install it globally with `npm install -g @marp-team/marp-cli`. Build with `npm run build:deck -- <section> <slug>`; commit the raw source and `<section>/<slug>/` output together.

Keep decks easy to scan: a white canvas, dark sans text, thin lines, plenty of empty space, and only a little color to mark the current state. Use one idea per slide and short labels or fragments instead of paragraphs. Show actual code, tables, or product screens when they explain the point faster than prose. A slide should make sense at a glance and need little effort to read. Use a brief question or section title as an occasional pause.

Keep the title at the same top position on every content slide. Center question and section slides vertically, with or without a short subtitle. Use the same type scale and spacing within each slide type throughout a deck.

For concepts and flows, favor simple tldraw or Excalidraw-like diagrams: plain boxes, arrows, handwritten-feeling lines, and direct labels. Keep them deliberately rough and useful, without glossy icons, gradients, shadows, or decorative illustrations. Give each actor or operation a consistent color; use a stronger accent only for the path or state under discussion. Put short annotations next to the relevant part of the diagram.

Choose the pace that makes the idea easiest to follow. Keep a slide static when it reads at a glance. For a process, keep the diagram in place and reveal the few steps or paths the audience needs; a brief transition or moving arrow can help show direction. Let the complete state remain visible when it helps the explanation. Avoid decorative motion and honor reduced-motion preferences.

Marp references: [CLI](https://github.com/marp-team/marp-cli) and [slide transitions](https://github.com/marp-team/marp-cli/blob/main/docs/bespoke-transitions/README.md).

## Publish

Before publication, review all new or changed source and generated files. Never publish PII; remove private names, contact details, addresses, IDs, and personal records from `raw/` and public output. Ask the user about unexplained high-entropy data, including token-like strings, encoded blobs, or binaries, and leave it out until confirmed safe. Do not rely on `.gitignore` to catch sensitive content.

Run `gh auth status` before publication. For a new direct HTML page, use the `gh api` PUT command in `llms.txt`; include the existing file SHA when updating. For a generated or multi-file artifact, use `gh repo clone tanmoysrt/sites.tanmoysarkar.me`, then commit and push the source and generated files. Do not use raw token-based HTTP publishing. Publish only when the user has asked for it. Confirm the public URL works before reporting success.
