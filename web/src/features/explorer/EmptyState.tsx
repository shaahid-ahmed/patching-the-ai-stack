/** Never just "no results".
 *
 * An empty table is almost always one facet's fault, so name that facet and
 * offer to lift it. `narrowestFacet` finds the single filter whose removal
 * recovers the most rows.
 */
import type { Advisory } from "@/data/types";
import { count } from "@/lib/format";

import { narrowestFacet } from "./filter";
import { FACET_LABELS } from "./facetLabels";
import type { Filters } from "./searchParams";
import styles from "./EmptyState.module.css";

interface Props {
  rows: Advisory[];
  filters: Filters;
  onClearFacet: (facet: keyof Filters) => void;
  onReset: () => void;
}

export function EmptyState({ rows, filters, onClearFacet, onReset }: Props) {
  const culprit = narrowestFacet(rows, filters);
  const label = culprit ? FACET_LABELS[culprit.facet] ?? String(culprit.facet) : null;

  return (
    <div className={styles.wrap}>
      <h2 className={styles.heading}>Nothing matches all of those filters at once.</h2>
      {culprit && label ? (
        <>
          <p className={styles.body}>
            The <strong>{label}</strong> filter is doing most of the narrowing, lifting it brings back {count(culprit.removed)}{" "}
            {culprit.removed === 1 ? "advisory" : "advisories"}.
          </p>
          <button
            type="button"
            className={styles.action}
            onClick={() => onClearFacet(culprit.facet)}
          >
            Clear the {label} filter
          </button>
        </>
      ) : (
        <p className={styles.body}>
          No single filter explains it, these constraints have no overlap in the
          data.
        </p>
      )}
      <button type="button" className={styles.secondary} onClick={onReset}>
        Clear everything
      </button>
    </div>
  );
}
