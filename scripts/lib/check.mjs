// Rules for a page. Errors stop the deploy. A legacy page (no /kit/page.css)
// gets only the secret and title checks.

const SECRETS = [
  [/AKIA[0-9A-Z]{16}/, 'AWS access key'],
  [/\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}/, 'GitHub token'],
  [/github_pat_[A-Za-z0-9_]{40,}/, 'GitHub token'],
  [/\bsk-(ant-|proj-)?[A-Za-z0-9_-]{32,}/, 'API key'],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
]
const MAX_BYTES = 400_000

export function isKitPage(html) {
  return html.includes('/kit/page.css')
}

export function checkPage(html, file) {
  const errors = []
  const warnings = []
  for (const [pattern, name] of SECRETS) if (pattern.test(html)) errors.push(`${name} found. Remove it, and rotate it if it is real`)
  if (!/<title[^>]*>[^<]+<\/title>/i.test(html)) errors.push('no <title>')
  if (!isKitPage(html)) return { errors, warnings }

  if (!/<meta name="description" content="[^"]{20,}"/.test(html)) errors.push('no <meta name="description"> of 20 or more characters')
  if (!html.includes('name="viewport"')) errors.push('no viewport meta')
  if ((html.match(/<h1[\s>]/g) || []).length !== 1) errors.push('needs exactly one <h1>')
  if (!/<article[\s>]/.test(html)) errors.push('no <article>')
  if (!html.includes('class="lead"')) errors.push('no <p class="lead"> after the <h1>')
  if (/<script[^>]+src="https?:/i.test(html)) errors.push('external script. Keep the page self-contained')
  if (/<style[\s>]/i.test(html)) warnings.push('own <style>. Use the kit classes, keep extra CSS small')
  if (Buffer.byteLength(html) > MAX_BYTES) warnings.push(`over ${MAX_BYTES / 1000} KB. Move detail into <details> or a second page`)
  for (const m of html.matchAll(/<script type="text\/mermaid"([^>]*)>/g)) if (!/data-label="[^"]+"/.test(m[1])) errors.push('diagram without data-label')
  return { errors, warnings, file }
}
