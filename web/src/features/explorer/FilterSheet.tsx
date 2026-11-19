/** The phone filter surface.
 *
 * Edits a *draft* and applies on a button rather than filtering live. That is
 * the one place in the explorer where state is not the URL, and it is
 * deliberate: on a phone, live filtering re-renders the list under the
 * reader's thumb on every tap, and each tap would push a history entry.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import type { AdvisoryIndex } from "@/data/types";
import { count } from "@/lib/format";

import { applyFilters, facetCounts } from "./filter";
import { FilterPanel } from "./FilterPanel";
import { DEFAULT_FILTERS, type Filters } from "./searchParams";
import type { ListFacet } from "./useFilters";
import styles from "./FilterSheet.module.css";

interface Props {
  index: AdvisoryIndex;
  filters: Filters;
  onApply: (filters: Filters) => void;
  onClose: () => void;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function FilterSheet({ index, filters, onApply, onClose }: Props) {
  const [draft, setDraft] = useState<Filters>(filters);
  const panel = useRef<HTMLDivElement | null>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreTo.current = document.activeElement as HTMLElement | null;
    const node = panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    node?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      restoreTo.current?.focus();
    };
  }, []);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;
      const nodes = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  const counts = useMemo(() => facetCounts(index.rows, draft), [index.rows, draft]);
  const resultCount = useMemo(
    () => applyFilters(index.rows, draft).length,
    [index.rows, draft],
  );

  const update = useCallback(
    (patch: Partial<Filters>) => setDraft((current) => ({ ...current, ...patch })),
    [],
  );

  const toggle = useCallback((facet: ListFacet, value: string) => {
    setDraft((current) => {
      const list = current[facet] as string[];
      return {
        ...current,
        [facet]: list.includes(value)
          ? list.filter((entry) => entry !== value)
          : [...list, value],
      } as Filters;
    });
  }, []);

  return (
    <div className={styles.backdrop} onKeyDown={onKeyDown}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label="Filter advisories"
        ref={panel}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>Filter</h2>
          <button type="button" className={styles.close} onClick={onClose}>
            Cancel
          </button>
        </header>

        <div className={styles.body}>
          <FilterPanel
            idPrefix="sheet"
            facets={index.facets}
            counts={counts}
            filters={draft}
            onToggle={toggle}
            onUpdate={update}
            onReset={() =>
              setDraft({
                ...DEFAULT_FILTERS,
                sort: draft.sort,
                direction: draft.direction,
                group: draft.group,
              })
            }
          />
        </div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.apply}
            onClick={() => onApply({ ...draft, selected: null })}
            disabled={resultCount === 0}
          >
            {resultCount === 0
              ? "No advisories match"
              : `Show ${count(resultCount)} ${resultCount === 1 ? "advisory" : "advisories"}`}
          </button>
        </footer>
      </div>
    </div>
  );
}
