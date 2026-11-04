import html, json, sys
from pathlib import Path

data = json.loads(Path(__file__).with_name("status.json").read_text())
e = html.escape
done = sum(1 for item in data["items"] if item["status"] in ("done",))
total = len(data["items"])
def figures(images):
    if not images:
        return ""
    body = "".join(
        f'<figure><img src="img/{e(i["src"])}" alt="{e(i["caption"])}" loading="lazy"><figcaption>{e(i["caption"])}</figcaption></figure>'
        for i in images
    )
    return f'<dt>Screens</dt><dd class="shots">{body}</dd>'


def checks_html(sections):
    out = []
    for section in sections:
        rows = "".join(
            f'<tr><td>{e(r[0])}</td><td><span class="badge {e(r[1])}">{e(r[1])}</span></td><td>{e(r[2])}</td></tr>'
            for r in section["rows"]
        )
        out.append(f"""<section class="card"><header><h2>{e(section['title'])}</h2></header>
<p class="lead">{e(section.get('intro', ''))}</p><table><thead><tr><th>Item</th><th>Result</th><th>Evidence</th></tr></thead><tbody>{rows}</tbody></table>
{('<dl>' + figures(section.get('images', [])) + '</dl>') if section.get('images') else ''}</section>""")
    return "".join(out)


cards = []
for index, item in enumerate(data["items"], 1):
    rows = "".join(f"<dt>{e(k)}</dt><dd>{e(v)}</dd>" for k, v in item.get("details", {}).items())
    rows += figures(item.get("images", []))
    title = e(item["title"])
    if item.get("issue"):
        title = f'<a href="https://github.com/frappe/pilot/issues/{item["issue"]}">#{item["issue"]}</a> {title}'
    if item.get("pr"):
        rows += f'<dt>Pull request</dt><dd><a href="{e(item["pr"])}">{e(item["pr"])}</a></dd>'
    cards.append(f"""<section class="card"><header><span class="step">{index}</span><h2>{title}</h2>
<span class="badge {e(item['status'])}">{e(item.get('label', item['status']))}</span></header>
<dl>{rows}</dl></section>""")
log = "".join(f"<li><b>{e(t)}</b> {e(m)}</li>" for t, m in reversed(data.get("log", [])))
page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pilot overnight stack</title>
<style>
:root {{ --bg:#fff; --fg:#1f2328; --muted:#656d76; --line:#d8dee4; --accent:#0969da; --ok:#1a7f37; --warn:#9a6700; --bad:#cf222e; }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg:#0d1117; --fg:#e6edf3; --muted:#8d96a0; --line:#30363d; --accent:#4493f8; --ok:#3fb950; --warn:#d29922; --bad:#f85149; }} }}
* {{ box-sizing:border-box; }}
body {{ margin:0; background:var(--bg); color:var(--fg); font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif; }}
main {{ max-width:860px; margin:0 auto; padding:32px 16px 64px; }}
h1 {{ font-size:1.6rem; margin:0 0 4px; }} h3 {{ font-size:1rem; margin:28px 0 8px; }}
.lead {{ color:var(--muted); margin:0 0 8px; }}
.bar {{ height:6px; background:var(--line); border-radius:3px; margin:16px 0 28px; overflow:hidden; }}
.bar span {{ display:block; height:100%; background:var(--ok); width:{100*done//max(total,1)}%; }}
.card {{ border:1px solid var(--line); border-radius:8px; padding:14px 18px; margin:0 0 14px; }}
.card header {{ display:flex; gap:10px; align-items:baseline; flex-wrap:wrap; }}
.card h2 {{ font-size:1.02rem; margin:0; flex:1 1 300px; }}
.step {{ color:var(--muted); font-variant-numeric:tabular-nums; }}
a {{ color:var(--accent); }}
dl {{ margin:8px 0 0; }} dt {{ font-weight:600; font-size:.82rem; margin-top:8px; color:var(--muted); }} dd {{ margin:2px 0 0; white-space:pre-line; }}
.badge {{ font-size:.75rem; border:1px solid var(--line); border-radius:999px; padding:1px 8px; color:var(--muted); white-space:nowrap; }}
.badge.working {{ color:var(--warn); border-color:var(--warn); }}
.badge.done {{ color:var(--ok); border-color:var(--ok); }}
.badge.blocked {{ color:var(--bad); border-color:var(--bad); }}
.shots {{ display:grid; gap:12px; white-space:normal; }}
figure {{ margin:0; }} figure img {{ max-width:100%; border:1px solid var(--line); border-radius:6px; display:block; }}
figcaption {{ color:var(--muted); font-size:.82rem; margin-top:4px; }}
table {{ width:100%; border-collapse:collapse; font-size:.9rem; margin-top:8px; }} th, td {{ text-align:left; vertical-align:top; padding:6px 8px 6px 0; border-top:1px solid var(--line); }} th {{ color:var(--muted); font-weight:600; font-size:.8rem; }}
.badge.ok {{ color:var(--ok); border-color:var(--ok); }} .badge.fixed {{ color:var(--accent); border-color:var(--accent); }} .badge.note {{ color:var(--warn); border-color:var(--warn); }}
ul.log {{ padding-left:18px; color:var(--muted); font-size:.9rem; }} ul.log b {{ color:var(--fg); font-weight:600; }}
</style></head><body><main>
<h1>Pilot overnight stack</h1>
<p class="lead">{e(data['intro'])}</p>
<p class="lead">Progress: {done} of {total} done. Updated {e(data['updated'])}.</p>
<div class="bar" role="img" aria-label="{done} of {total} done"><span></span></div>
{''.join(cards)}
{checks_html(data.get("checks", []))}
<h3>Log</h3><ul class="log">{log}</ul>
</main></body></html>
"""
output = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).with_name("index.html")
output.write_text(page)
