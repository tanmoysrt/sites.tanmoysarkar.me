"""Build research/atlas-reliability-audit/index.html from data.json and log.md."""

import html
import json
import pathlib
import re

HERE = pathlib.Path(__file__).parent
OUT = HERE.parents[2] / "research" / "atlas-reliability-audit" / "index.html"

BADGE_CLASS = {
	"Handled": "ok",
	"Partial": "warn",
	"Not handled": "bad",
	"Untested": "muted",
	"Critical": "bad",
	"High": "bad",
	"Medium": "warn",
	"Low": "muted",
}
SEVERITY_ORDER = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}


def inline(text: str) -> str:
	text = html.escape(text)
	text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
	return re.sub(r"\[(F\d+|S\d+)\]", r'<a href="#\1">\1</a>', text)


def badge(value: str) -> str:
	return f'<span class="badge {BADGE_CLASS.get(value, "muted")}">{inline(value)}</span>'


def score(value: float | None) -> str:
	if value is None:
		return '<span class="score">-</span>'
	css = "s-hi" if value >= 8 else "s-mid" if value >= 5 else "s-lo"
	return f'<span class="score {css}">{value:g}/10</span>'


def matrix_rows(scenarios: list[dict]) -> str:
	areas: dict[str, list[tuple[int, dict]]] = {}
	for index, scenario in enumerate(scenarios, start=1):
		areas.setdefault(scenario["area"], []).append((index, scenario))
	rows = []
	for area, items in sorted(areas.items(), key=lambda pair: (average(pair[1]) is None, average(pair[1]) or 0)):
		statuses = [item["status"] for _, item in items]
		scored = [(item["score"], index, item) for index, item in items if item.get("score") is not None]
		weakest = min(scored, key=lambda entry: entry[0]) if scored else None
		weakest_text = f'[S{weakest[1]}] {weakest[2]["scenario"]}' if weakest else ""
		values = [
			inline(area),
			score(average(items)),
			str(len(items)),
			*(str(statuses.count(status)) for status in ("Handled", "Partial", "Not handled", "Untested")),
			inline(weakest_text),
		]
		rows.append(f"<tr>{cells(values)}</tr>")
	return "\n".join(rows)


def average(items: list[tuple[int, dict]]) -> float | None:
	values = [item["score"] for _, item in items if item.get("score") is not None]
	return round(sum(values) / len(values), 1) if values else None


def cells(values: list[str]) -> str:
	return "".join(f"<td>{value}</td>" for value in values)


def scenario_rows(scenarios: list[dict]) -> str:
	rows = []
	for index, scenario in enumerate(scenarios, start=1):
		identifier = f"S{index}"
		values = [
			inline(scenario["area"]),
			inline(scenario["scenario"]),
			inline(scenario["behavior"]),
			badge(scenario["status"]),
			score(scenario.get("score")),
			inline(scenario.get("ideal", "")),
			inline(scenario.get("evidence", "")),
		]
		rows.append(f'<tr id="{identifier}"><td class="id">{identifier}</td>{cells(values)}</tr>')
	return "\n".join(rows)


def finding_rows(findings: list[dict]) -> str:
	rows = []
	for finding in sorted(findings, key=lambda item: (SEVERITY_ORDER[item["severity"]], int(item["id"][1:]))):
		values = [
			badge(finding["severity"]),
			inline(finding["area"]),
			inline(finding["problem"]),
			inline(finding["effect"]),
			inline(finding["fix"]),
			inline(finding["where"]),
			inline(finding.get("verified", "Code reading")),
		]
		rows.append(f'<tr id="{finding["id"]}"><td class="id">{finding["id"]}</td>{cells(values)}</tr>')
	return "\n".join(rows)


def checklist_items(checklist: list[dict]) -> str:
	marks = {"yes": "✓", "no": "✗", "partial": "~"}
	parts = []
	for group in checklist:
		parts.append(f"<h3>{inline(group['feature'])}</h3><ul class='check'>")
		for item in group["items"]:
			parts.append(f'<li class="c-{item["state"]}"><span>{marks[item["state"]]}</span> {inline(item["text"])}</li>')
		parts.append("</ul>")
	return "\n".join(parts)


def stat_cards(data: dict, log_count: int) -> str:
	scenarios = data["scenarios"]
	findings = data["findings"]
	cards = [
		(len(scenarios), "failure scenarios"),
		(sum(1 for s in scenarios if s["status"] == "Handled"), "handled"),
		(sum(1 for s in scenarios if s["status"] in ("Partial", "Not handled")), "with a gap"),
		(sum(1 for s in scenarios if s.get("injected")), "tested by fault injection"),
		(len(findings), "findings"),
		(sum(1 for f in findings if f["severity"] in ("Critical", "High")), "critical or high"),
		(log_count, "log entries"),
	]
	return "\n".join(f'<div class="stat"><b>{count}</b><span>{label}</span></div>' for count, label in cards)


def main() -> None:
	data = json.loads((HERE / "data.json").read_text())
	entries = [line[2:] for line in (HERE / "log.md").read_text().splitlines() if line.startswith("- ")]
	replacements = {
		"{{updated}}": inline(data["updated"]),
		"{{status}}": inline(data["status"]),
		"{{stats}}": stat_cards(data, len(entries)),
		"{{matrix}}": matrix_rows(data["scenarios"]),
		"{{scenarios}}": scenario_rows(data["scenarios"]),
		"{{findings}}": finding_rows(data["findings"]),
		"{{checklist}}": checklist_items(data["checklist"]),
		"{{next}}": "<ul>" + "".join(f"<li>{inline(item)}</li>" for item in data["next"]) + "</ul>",
		"{{log}}": "\n".join(f"<li>{inline(entry)}</li>" for entry in reversed(entries)),
	}
	page = (HERE / "template.html").read_text()
	for key, value in replacements.items():
		page = page.replace(key, value)
	OUT.parent.mkdir(parents=True, exist_ok=True)
	OUT.write_text(page)


if __name__ == "__main__":
	main()
