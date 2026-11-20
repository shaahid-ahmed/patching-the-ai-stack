# Patching the AI stack

How quickly do open-source AI libraries fix their security vulnerabilities, and
what kinds of flaws dominate? An editorial data explorer built on 419 security
advisories across 16 Python packages, 2022–2026.

**Live site:** _add your Render URL here after the first deploy_

## The finding

The median advisory was quietly patched **18.4 days** before it was published, users were protected before they were told to worry. But about **one in eight**
went public while no fixed release existed, and **60 of 454** advisory-package
rows still have no patch at all.

Advisories against these libraries rose seventeenfold between early 2023 and
late 2026. Most describe ordinary weaknesses, denial of service, path
traversal, command injection, in unusual places: the libraries that load model
weights get attacked through the weights, and the ones that fetch URLs on a
prompt's instruction get attacked through the instructions.

## Where the data comes from

| Source | Role |
|---|---|
| [GitHub Global Security Advisories API](https://docs.github.com/en/rest/security-advisories/global-advisories) | Reviewed advisories for pip packages |
| [PyPI JSON API](https://docs.pypi.org/api/json/) | Release history, used to date each fix |
| [Anthropic Claude API](https://platform.claude.com/docs) | Labels each advisory's attack class and whether it is AI-specific |

The headline measure is `days_fix_before_disclosure`: the fixed release date on
PyPI minus the advisory's publication date. Positive means the fix shipped
first. Negative means users were warned about a flaw they could not yet escape.

The site's `/methods` page carries the limitations in full, chiefly that an
advisory's publication date is not the date the flaw was found, that the
AI-specific labels currently come from a keyword fallback rather than a model
pass, and that 16 packages is a small sample.

## Architecture

Python owns every number; JavaScript owns none.

```
pipeline/  →  web/public/data/*.json  (content-hashed)
           →  web/src/data/manifest.json  (compiled into the bundle)
```

Artifact filenames carry a content hash, so they can be cached forever and a
data refresh can never be served stale. The manifest is the one unhashed file
and it is *imported* rather than fetched, so new data produces a new bundle
hash and the page can never disagree with its own data.

```
pipeline/        Python. Reads the analysis CSVs, writes the JSON artifacts.
  questions/     One module per research question.
web/             The site: Vite, React 19, TypeScript. See web/README.md.
  src/charts/    Hand-drawn SVG figures. No chart library.
  src/features/  One folder per thing a reader can do.
  src/styles/    Design tokens: colour, typography, motion.
  public/data/   Generated artifacts. Committed on purpose.
render.yaml      Render Blueprint.
```

Charts are hand-built rather than pulled from a library because each one turns
on a device a chart grammar will not express: a hatched partial quarter with a
projection outline, overflow stubs that keep a −464-day outlier on screen, a
detached block for advisories with no fix, Wilson intervals on small
denominators, and a scatter that deliberately omits its trend line in favour of
200 bootstrap resamples.

## Running it

```bash
cd web && npm ci
npm run dev          # http://localhost:5173
```

## Deploying

Render builds this as a **static site**. No Python runs in production, so
`ANTHROPIC_API_KEY` never exists in the deployed environment, the enrichment
ran once, locally, and its output is committed.

A static site is also what avoids the free-tier spin-down: a free *web service*
sleeps after 15 minutes idle and takes about a minute to wake, which is exactly
its state when someone opens the link cold.

1. Push to GitHub.
2. In Render: **New → Blueprint**, point it at this repository.
3. `render.yaml` sets the build command, publish path, SPA rewrite and cache
   headers. There is nothing to configure in the dashboard and no environment
   variables to add.

## Re-running the enrichment

Attack class and the AI-specific flag are assigned by a model, not by the
advisory. The site currently ships the **keyword fallback**, which is crude and
is labelled as preliminary on every chart that uses it.

Put your key in `.env` at the repository root. It is gitignored, and the
pipeline reads it automatically; nothing needs exporting.

```bash
make setup               # pandas, scipy, openai
make doctor              # confirm this machine has them, and sees your key

cp .env.example .env     # if you do not have one yet
# then edit .env:
#   MODEL_API_KEY=your-key-from-dev.meta.ai

pip install openai                      # only for the Meta provider

make enrich-estimate                    # what it will call, and roughly the cost
make enrich                             # Meta Model API, muse-spark-1.3
make artifacts && make verify           # fold the new labels into the site
```

Other providers: `make enrich PROVIDER=anthropic`, or `PROVIDER=keyword` for the
offline pass. Override the model with `ARGS="--model muse-spark-1.2"`.

A real environment variable always beats `.env`, so a one-off
`MODEL_API_KEY=... make enrich` still works.

Every reply is cached per advisory under `phase3/enrichment_cache/`, so an
interrupted run resumes for free and a re-run spends nothing. One call is made
per *advisory*, not per row, since an advisory affecting both `langchain` and
`langchain-core` is one piece of text.

`enrich.py` writes `label_source` into the CSV, and the site reads it: once the
labels come from a model rather than the keyword pass, the "Preliminary label"
pills disappear and the methods page updates itself. Nothing in the frontend
needs changing.

## Regenerating the data

`make artifacts` rebuilds `web/public/data/` from the analysis CSVs, and
`make verify` checks the result against the manifest and typechecks the site.

Both need the Phase III analysis notebook and its CSV outputs, which are **not
in this repository**, they live in the local project folder this site was
split out of. Without them the pipeline will stop and say so. The committed
artifacts are complete and current, so this is only needed to refresh the data.

## Licence

Advisory data is from GitHub and PyPI under their respective terms.
