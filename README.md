# sites.tanmoysarkar.me

A minimal dumpyard for LLM-generated static sites: reports, guides, and plans. Any section can contain Slidev presentations. The visual style borrows the light palette and system fonts from [tanmoysarkar.me](https://tanmoysarkar.me/).

## Add content

- Static pages go in `research/<slug>/index.html`, `learning/<slug>/index.html`, or `plans/<slug>/index.html`.
- Slidev source goes in `decks/<section>/<slug>/slides.md`. Run `npm ci` and `npm run build:deck -- <section> <slug>` to build `<section>/<slug>/`.
- Use lowercase kebab-case slugs. Static pages should work without a build step.
- The GitHub Pages workflow creates section listings during deployment.

For full agent instructions, see [`llms.txt`](llms.txt) and the [publishing skill](skills/publish-site-artifact/SKILL.md). Publishing uses GitHub CLI; this is a repository convention.

## Install the skill

From this checkout, run `bash install-skills.sh`. It installs the skill globally for Codex and Claude. Once the site is live, the same installer can be run with `curl -fsSL https://sites.tanmoysarkar.me/install-skills.sh | bash`.

## Publish

Run `gh auth status`, then follow the required GitHub CLI commands in [`llms.txt`](llms.txt). A single HTML page is uploaded with `gh api`. For a Slidev deck, clone with `gh repo clone`, add the source and built files, then commit and push. The `Deploy archive` workflow generates section listings and publishes the site after content reaches `main`.
