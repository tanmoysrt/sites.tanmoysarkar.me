# Pilot stack progress page

`status.json` contains the current scope, review notes, checks and pull request links. `build.py` renders the page. `assets/` contains the screenshots used by the page. Some screenshots show simulated responses; their captions identify them.

From the repository root:

```sh
cp raw/plans/pilot-overnight-stack/assets/* plans/pilot-overnight-stack/img/
python3 raw/plans/pilot-overnight-stack/build.py plans/pilot-overnight-stack/index.html
```

Review the source, screenshots and generated page before publishing. Never add test credentials or private infrastructure details.
