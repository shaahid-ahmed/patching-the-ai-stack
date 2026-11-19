# Design tokens

Three files, three owners. Components **never** hardcode a colour, a font size,
a duration or an easing curve — they read `var(--token)`. That rule is what lets
the palette change without touching a component.

| File | Owner | Holds |
|---|---|---|
| `color.css` | colour specialist | surfaces, text, borders, accent, and the five data scales |
| `typography.css` | typography specialist | families, the type scale, rhythm, measure |
| `motion.css` | motion specialist | durations, easings, stagger, reduced-motion overrides |

`../tokens.css` imports all three and is imported once, in `main.tsx`.

## The colour contract

`color.css` must define every name below. Charts resolve them at render time
through `charts/tokens.ts`, so a token rename breaks loudly rather than
silently drawing the wrong hue.

### Surfaces and text
`--color-page`, `--color-surface`, `--color-surface-raised`, `--color-surface-sunken`,
`--color-text`, `--color-text-secondary`, `--color-text-muted`, `--color-text-inverse`,
`--color-border`, `--color-border-strong`, `--color-rule`

### Interactive
`--color-accent`, `--color-accent-hover`, `--color-accent-contrast`,
`--color-focus`, `--color-selected`, `--color-hover`

### Data scale 1 — severity (ordered, 4 steps)
`--color-severity-low`, `--color-severity-medium`, `--color-severity-high`,
`--color-severity-critical`

### Data scale 2 — package category (categorical, 4 classes)
`--color-category-model-libraries`, `--color-category-application-frameworks`,
`--color-category-serving-and-web-tools`, `--color-category-agent-tools`

### Data scale 3 — fix-to-disclosure gap (diverging, anchored at zero)
`--color-gap-before` (fix shipped first), `--color-gap-same`,
`--color-gap-after` (warned with no fix), plus
`--color-gap-before-soft` / `--color-gap-after-soft` for fills under text.

### Data scale 4 — AI-specific (binary)
`--color-ai-specific`, `--color-ai-general`

### Data scale 5 — unpatched (the one alarm)
`--color-unpatched`, `--color-unpatched-soft`

### Chart furniture
`--color-grid`, `--color-axis`, `--color-baseline`, `--color-reference`,
`--color-mark-neutral`, `--color-mark-dim`, `--color-annotation`

## Re-vendoring

These files are written by the design specialists and pasted in whole. Do not
hand-tune a value here to fix one component — fix the component, or change the
token at source and replace the file.
