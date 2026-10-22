"""Build research/atlas-reliability-audit/index.html from data.json and log.md."""

import html
import json
import pathlib
import re

HERE = pathlib.Path(__file__).parent
OUT = HERE.parents[2] / "research" / "atlas-reliability-audit" / "index.html"

STATUS_CLASS = {"Handled": "ok", "Partial": "warn", "Not handled": "bad", "Bug": "bad", "Untested": "muted"}
SEVERITY_CLASS = {"Critical": "bad", "High": "bad", "Medium": "warn", "Low": "muted"}
SEVERITY_ORDER = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}


def inline(text: str) -> str:
	text = html.escape(text)
	return re.sub(r"`([^`]+)`", r"<code>\1</code>", text)


def badge(value: str) -> str:
	css = STATUS_CLASS.get(value) or SEVERITY_CLASS.get(value, "muted")
	return f'<span class="badge {css}">{inline(value)}</span>'


def scenario_rows(scenarios: list[dict]) -> str:
	rows = []
	for scenario in scenarios:
		rows.append(
			"<tr>"
			f"<td>{inline(scenario['area'])}</td>"
			f"<td>{inline(scenario['scenario'])}</td>"
			f"<td>{inline(scenario['behavior'])}</td>"
			f"<td>{badge(scenario['status'])}</td>"
			f"<td>{inline(scenario.get('evidence', ''))}</td>"
			f"<td>{inline(scenario.get('fallback', ''))}</td>"
			"</tr>"
		)
	return "\n".join(rows)


def finding_items(findings: list[dict]) -> str:
	items = []
	for finding in sorted(findings, key=lambda item: (SEVERITY_ORDER.get(item["severity"], 9), item["id"])):
		items.append(
			f'<article class="finding" id="{finding["id"]}">'
			f'<h3><span class="fid">{finding["id"]}</span> {inline(finding["title"])} {badge(finding["severity"])}</h3>'
			f'<p class="where">{inline(finding["where"])}</p>'
			f"<p><b>What breaks.</b> {inline(finding['problem'])}</p>"
			f"<p><b>Effect.</b> {inline(finding['effect'])}</p>"
			f"<p><b>Fallback to add.</b> {inline(finding['fix'])}</p>"
			f'<p class="where">Verified by: {inline(finding.get("verified", "code reading"))}</p>'
			"</article>"
		)
	return "\n".join(items)


def checklist_items(checklist: list[dict]) -> str:
	parts = []
	for group in checklist:
		parts.append(f"<h3>{inline(group['feature'])}</h3><ul class='check'>")
		for item in group["items"]:
			mark = {"yes": "✓", "no": "✗", "partial": "~"}[item["state"]]
			parts.append(f'<li class="c-{item["state"]}"><span>{mark}</span> {inline(item["text"])}</li>')
		parts.append("</ul>")
	return "\n".join(parts)


def log_items(log_text: str) -> str:
	entries = [line[2:] for line in log_text.splitlines() if line.startswith("- ")]
	return "\n".join(f"<li>{inline(entry)}</li>" for entry in reversed(entries))


def main() -> None:
	data = json.loads((HERE / "data.json").read_text())
	template = (HERE / "template.html").read_text()
	scenarios = data["scenarios"]
	counts = {status: sum(1 for s in scenarios if s["status"] == status) for status in STATUS_CLASS}
	summary = " · ".join(f"{count} {status.lower()}" for status, count in counts.items() if count)
	page = (
		template.replace("{{status}}", inline(data["status"]))
		.replace("{{updated}}", inline(data["updated"]))
		.replace("{{summary}}", summary)
		.replace("{{scenarios}}", scenario_rows(scenarios))
		.replace("{{findings}}", finding_items(data["findings"]))
		.replace("{{finding_count}}", str(len(data["findings"])))
		.replace("{{checklist}}", checklist_items(data["checklist"]))
		.replace("{{log}}", log_items((HERE / "log.md").read_text()))
	)
	OUT.parent.mkdir(parents=True, exist_ok=True)
	OUT.write_text(page)


if __name__ == "__main__":
	main()
