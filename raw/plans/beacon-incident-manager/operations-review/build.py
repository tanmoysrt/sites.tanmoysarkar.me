from html import escape
import json
from pathlib import Path


class ReviewPage:
    def __init__(self, source):
        self.source = source
        self.data = json.loads((source / "review.json").read_text())

    def build(self):
        sections = [self.introduction(), self.findings(), self.layouts(), self.flows(), self.delivery()]
        style = (self.source / "report.css").read_text()
        return f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Beacon operator review and response flows</title><style>{style}</style></head><body><main>{"".join(sections)}</main></body></html>'

    def introduction(self):
        links = "".join(f'<a href="#{key}">{name}</a>' for key, name in [("findings", "Findings"), ("layouts", "Every form"), ("flows", "Response flows"), ("delivery", "Implementation order")])
        principles = "".join(f"<li>{escape(item)}</li>" for item in self.data["principles"])
        return f'''<a href="./">← Beacon design</a><h1>Beacon operator review</h1>
<p class="lead">A responder should see what failed, how current the evidence is, who is acting, and what to do next. The current forms hide too much of this context.</p>
<p class="meta">Reviewed {escape(self.data['date'])} · Current implementation reviewed; changes below are proposed.</p>
<nav>{links}</nav>
<p>{escape(self.data['scope'])}</p>
<p><a href="https://moki.tanmoysarkar.me/#/p/beacon-operations/v1">Open the interactive layout review in moki →</a></p>
<aside><b>Fix the response contract first.</b> The review found a UTC clock mismatch, lost service-impact rows during Publish, blank evidence panels, and gaps in public impact handling. Moving fields alone will not fix these failures.</aside>
<h2>Review method and limits</h2>
<p>I read all 19 DocType definitions, their controllers and form scripts, the workflow objects, job entry points, public API and Vue views. I opened the local Desk forms and public routes. The five unused HTML panels and the UTC clock mismatch were checked directly. The invalid public incident route returned a safe message.</p>
<p>No incident was acknowledged, published, resolved or paged. No silence, source removal or maintenance action was submitted. Findings about these actions come from source tracing, including the Frappe document-method handler. Provider delivery, concurrency and scheduler recovery still need controlled verification. Browser screenshot calls timed out, so the live review used DOM inspection. Proposed mockups have separate desktop and phone visual checks.</p>
<p>P1 means a response or customer-status contract is broken. P2 means the flow should be corrected before routine operational use. These are priorities for this review, not a production incident severity.</p>
<h2>Design rules</h2><ul>{principles}</ul>
<p>The approach follows Google's guidance on a working incident record, actionable monitoring and timely measurements. It keeps Beacon small: no new workflow engine, internal API layer, frontend framework or stored status just for display. See <a href="https://sre.google/workbook/incident-response/">Incident response</a>, <a href="https://sre.google/sre-book/monitoring-distributed-systems/">Monitoring distributed systems</a>, and <a href="https://sre.google/workbook/monitoring/">Monitoring</a>.</p>'''

    def findings(self):
        rows = "".join(f'<tr><td><a href="#{f["id"]}">{f["id"]}</a></td><td>{f["priority"]}</td><td>{escape(f["title"])}</td></tr>' for f in self.data["findings"])
        cards = []
        for f in self.data["findings"]:
            details = "".join(f'<p><b>{label}.</b> {escape(f[key])}</p>' for key, label in [("scenario", "Current behavior"), ("effect", "Effect during response"), ("evidence", "Evidence"), ("fix", "Proposed correction"), ("check", "Acceptance check")])
            cards.append(f'<article id="{f["id"]}"><h3><span class="priority">{f["priority"]} · {f["id"]}</span> {escape(f["title"])}</h3>{details}</article>')
        return f'<section id="findings"><h2>Prioritized findings</h2><div class="table"><table><tr><th>Finding</th><th>Priority</th><th>Failure</th></tr>{rows}</table></div>{"".join(cards)}</section>'

    def layouts(self):
        jump = " · ".join(f'<a href="#page-{p["id"]}">{escape(p["name"])}</a>' for p in self.data["pages"])
        pages = []
        for p in self.data["pages"]:
            pairs = [("First screen", p["first"]), ("Tab order", " → ".join(p["tabs"])), ("Evidence and links", p["evidence"]), ("Move later", p["later"]), ("List view", p["columns"]), ("Primary task", p["primary"]), ("Other actions", "; ".join(p["secondary"]))]
            rows = "".join(f'<tr><th>{label}</th><td>{escape(value)}</td></tr>' for label, value in pairs)
            pages.append(f'<article id="page-{p["id"]}"><h3>{escape(p["name"])}</h3><p class="question">{escape(p["question"])}</p><table>{rows}</table></article>')
        children = "".join(f'<tr><th>Beacon {escape(name)}</th><td>{escape(value)}</td></tr>' for name, value in self.data["child_tables"])
        return f'''<section id="layouts"><h2>Proposed hierarchy for every page</h2>
<p>All internal work stays in native Desk. “Primary task” means the useful next action for the shown state. Existing actions remain in the Actions group; an optional prominent shortcut must call that same controller method. Do not duplicate business logic in the form script. Do not make state-machine fields editable.</p>
<p>{jump}</p>
<h3>Dashboard and sidebar</h3><p>Keep the approved sidebar and six counts. Keep Public status page directly under Dashboard. Add a compact exception summary for paused paging, stale evaluations, failed sources, held removals and Unknown health. Each item opens a filtered native list. Put it before the open-incident and firing-alert lists. Counts alone are insufficient proof that monitoring is healthy.</p>
<p>Keep two count cards per phone row. Put severity, state and title before identifiers. Preserve the selected filters when returning from a record. Default operational lists to unresolved incidents, firing alerts and active silences. Keep evaluation and measurement logs under the collapsed Logs section.</p>
{''.join(pages)}
<h3>Five child tables</h3><p>Use the same source of truth as the operation. A preview must use the same scope expansion and suppression rules as Save.</p><table>{children}</table>
<h3>Public status, history and detail</h3>
<p>Show declared customer impact and measurement availability as separate facts. Give Global services their own group. Label the last measured time. Keep response refresh time secondary. Show the uptime period, usable coverage and maintenance exclusion beside the percentage.</p>
<p>Keep the configured site title on status, history and incident detail. On route changes, reload by incident identity and ignore late responses from a previous request. Reset old detail before loading the next incident. Show loading, empty, unavailable and invalid-link states.</p>
<p>Make each daily history bar accessible by keyboard and tap. Open a date detail with good and valid observations, observed minutes, impact and excluded maintenance. Keep public messages separate from internal notes. An unlisted URL grants access to that incident only; keep it out of public indexes.</p></section>'''

    def flows(self):
        items = []
        for flow in self.data["flows"]:
            steps = "".join(f"<li>{escape(step)}</li>" for step in flow["steps"])
            items.append(f'<article><h3>{escape(flow["title"])}</h3><p><b>Start:</b> {escape(flow["trigger"])}</p><ol>{steps}</ol><p><b>Done:</b> {escape(flow["success"])}</p></article>')
        return '<section id="flows"><h2>Operator flows</h2><p>These flows describe the intended response after the proposed corrections. They are not a claim that each action was exercised in the local review.</p>' + "".join(items) + '</section>'

    def delivery(self):
        return '''<section id="delivery"><h2>Implementation order and checks</h2>
<ol><li><b>Correct contracts.</b> Enforce UTC, preserve impact rows, keep read helpers free of acknowledgement side effects, and correct Unknown and Global public impact handling. Check existing local timestamp history before any repair.</li>
<li><b>Expose evidence.</b> Fill the five empty panels. Show related alerts, runbooks, current acknowledgement, latest page outcome and freshness. Use native related lists and permission checks. Show the exact failure when a read fails.</li>
<li><b>Reorder native forms.</b> Apply the approved field and tab hierarchy. Add useful list columns and filters. Show source-file ownership. Keep administrative settings out of a responder's action menu.</li>
<li><b>Reduce action cost.</b> Remove redundant safe-read confirmations. Give Publish, Silence, held removals, monitoring disable and test calls a concrete scope preview. Replace raw JSON results with a readable summary and expandable diagnostics.</li>
<li><b>Complete public and mobile flows.</b> Show measurement time and coverage, fix route reloads, retain the site title, and add accessible daily detail. Verify keyboard use, a 390-pixel phone and both themes.</li></ol>
<h3>Action safeguards</h3><table><tr><th>Action</th><th>Proposed behavior</th></tr>
<tr><td>Acknowledge</td><td>One deliberate action when Triggered. Update incident and notification acknowledgement together. Reading an incident or its related records must not acknowledge it.</td></tr>
<tr><td>Test rule, test SLI, check connection</td><td>Run directly. Show loading, success, no-data or error. Keep credentials and raw SQL errors out of public views.</td></tr>
<tr><td>Run now, fetch now</td><td>Say Queued first. Link to the eventual persisted result. Prevent repeated submissions while the request is pending.</td></tr>
<tr><td>Publish or change visibility</td><td>Preview audience, service, region, impact, title and full message. Preserve rows when an argument is absent.</td></tr>
<tr><td>Resolve</td><td>Show remaining firing alerts and the existing resolution guard. A required silence must show exact scope and expiry. Reopen is available only within the configured window.</td></tr>
<tr><td>Send test page</td><td>Require a valid recipient for Call or Email. Preview channel and destination. Explain that a call can incur a charge. Limit the action to the proper role.</td></tr>
<tr><td>Apply held removals or disable monitoring</td><td>Show the complete count, descendants and effect. Label a sample as a sample. Link to all matched resources. Require explicit confirmation.</td></tr></table>
<h3>Boundary and concurrency checks</h3>
<p>Keep business guards in document methods and workflow objects. Do not trust a hidden button as authorization. Read related records with permission checks. Do not call a provider while holding database locks. Check duplicate clicks, stale saves, state changes during an open dialog, late provider replies and simultaneous scheduler work. Re-read state before applying a destructive action.</p>
<p>Manual verification should cover a fresh sample, a stale sample, an errored query, no measurements, a new service in its warm-up window, scheduled and in-progress maintenance, suppressed and unsuppressed alerts, missing on-call recipients, paused paging, held removals, and public versus internal versus unlisted data. Keep existing guards: query failure never resolves an alert, source failure never deletes resources, and Beacon never publishes automatically.</p>
<p><b>Approval boundary:</b> This review changes documentation and mockups only. The app and stored records were not changed. Real DocType and dialog layout work follows mockup approval, as required by the repository and the user's moki rule.</p>
<p><a href="./">Back to the main design</a> · <a href="https://moki.tanmoysarkar.me/#/p/beacon-operations/v1">Review the proposed forms in moki</a></p></section>'''


if __name__ == "__main__":
    source = Path(__file__).resolve().parent
    destination = source.parents[3] / "plans/beacon-incident-manager/operations.html"
    destination.write_text(ReviewPage(source).build())
    data = json.loads((source / "review.json").read_text())
    (source / "mockup/data.js").write_text("const REVIEW = " + json.dumps({"pages": data["pages"]}, ensure_ascii=False) + ";\n")
    mockup = (source / "mockup/index.html").read_text()
    for page in data["pages"]:
        if page["id"] != "incident":
            (source / f'mockup/{page["id"]}.html').write_text(mockup.replace("<body>", f'<body data-page="{page["id"]}">'))
    print(destination)
