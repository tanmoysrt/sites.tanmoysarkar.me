# Beacon operator review

`review.json` contains the reviewed findings, proposed form hierarchy and response flows. The data in layout examples is illustrative. The report distinguishes observed behavior from source-level findings and proposals.

From the archive repository root, build the report with:

```sh
python3 raw/plans/beacon-incident-manager/operations-review/build.py
```

Output: `plans/beacon-incident-manager/operations.html`.

The `mockup/` folder contains the editable moki prototype. Upload those files to the `beacon-operations` project. The prototype has no live API calls. Do not treat its buttons as implemented Beacon features.
