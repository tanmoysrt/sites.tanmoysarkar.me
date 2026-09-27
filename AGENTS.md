# Repository instructions for agents

When creating or publishing an artifact for this site, read `skills/publish-site-artifact/SKILL.md` and `llms.txt` first. Keep the root site minimal and light. Use Marp for presentations.

Before any push or GitHub API upload, review every new or changed source and generated file. Never publish PII, including private names, contact details, addresses, IDs, or personal records; remove it from both `raw/` and the published page. If a file contains unexplained high-entropy data, such as a token-like string, encoded blob, or binary, ask the user what it is before publishing. Leave it out until confirmed safe. Generated assets still need this review. `.gitignore` is not a security check.
