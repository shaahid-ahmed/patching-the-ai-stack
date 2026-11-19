# Patching the AI stack, the site

An editorial data explorer for the Phase III analysis: how quickly open-source
AI libraries fix security vulnerabilities, 2022–2026.

## Running it

```bash
make install     # from the repository root
make dev         # http://localhost:5173
```

## How data gets here

The site contains **no analysis code**. Python owns every number; JavaScript
only draws them.

```
phase3/*.csv  →  python3 -m pipeline.build  →  web/public/data/*.json
                                            →  web/src/data/manifest.json
```

`make artifacts` runs that, `make verify` checks the result. Artifact filenames
carry a content hash, so they can be cached forever and a data refresh can
never be served stale. The manifest is the one unhashed file and it is
*imported into the bundle*, not fetched, so new data means a new bundle hash,
and the page can never disagree with its own data.

Superseded artifacts are moved to `web/.trash/` rather than deleted (the
sandbox this was built in forbids deletion inside the project folder).
`make clean-trash` empties it.

## Layout

```
src/
  app/        shell: Layout, ErrorView
  charts/     presentation only, take arrays, return SVG, never fetch
    figures/  one file per research question
  components/ shared dumb UI
  data/       types.ts, client.ts, manifest.json, the only place fetch() appears
  features/   one folder per thing a reader can do
    narrative/      the argument, in fixed order
    explorer/       filter all 454 rows; URL is the only state
    package-detail/ one of the 16 packages
    methods/        provenance and limitations
  lib/        framework-free helpers
  styles/
    tokens/   colour, typography, motion, vendored from the design specs
```

**The rule for where a new file goes:** if exactly one feature can ever import
it, it lives in that feature's folder. The moment a second feature needs it, it
moves down a layer, to `charts/` if it draws data, `components/` if it is
generic UI, `lib/` if it is framework-free, `data/` if it knows artifact shapes.
No file in `features/` imports from another `features/` folder.

**Never hardcode a colour, size, duration or easing.** Components read
`var(--token)`; charts read tokens through `charts/tokens.ts`. The token
contract is documented in `src/styles/tokens/README.md`.

## If a build fails with EPERM

Some sandboxed environments forbid deleting files inside the project folder.
Vite clears `dist/` before each build, so it fails there with
`EPERM: operation not permitted, unlink`. On a normal machine this does not
happen. If you hit it, move the old build aside first:

```bash
mv dist .trash/dist-old && npm run build
```

## Deploying

Render builds this as a **static site**, no Python runs in production. See
`render.yaml` at the repository root; the reasoning is in its header comment.
`ANTHROPIC_API_KEY` is never present in the deployed environment: the
enrichment ran once, locally, and its output is committed.
