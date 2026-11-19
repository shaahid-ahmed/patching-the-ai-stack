/** The explorer: 454 advisories, filterable, sortable, groupable, linkable.
 *
 * The whole pipeline is a `useMemo` over an array of 454 — microseconds — so
 * there is no virtualization, no index and no state library here. The URL is
 * the state; this component only reads it and renders.
 */
import { useCallback, useMemo, useState } from "react";
import { useLoaderData } from "react-router";

import type { AdvisoryIndex } from "@/data/types";
import { count } from "@/lib/format";

import { applyFilters, facetCounts, groupRows, sortRows } from "./filter";
import { EmptyState } from "./EmptyState";
import { FilterPanel } from "./FilterPanel";
import { FilterSheet } from "./FilterSheet";
import { GapStrip } from "./GapStrip";
import { GROUP_LABELS, SORT_LABELS } from "./facetLabels";
import { ResultTable } from "./ResultTable";
import { SummaryStrip } from "./SummaryStrip";
import {
  activeFilterCount,
  hasActiveFilters,
  type Filters,
  type GroupKey,
  type SortKey,
} from "./searchParams";
import { useFilters } from "./useFilters";
import styles from "./Explorer.module.css";

export function Explorer() {
  const index = useLoaderData() as AdvisoryIndex;
  const { filters, update, toggle, clearFacet, reset, commit } = useFilters();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const categoryLabels = useMemo(
    () =>
      Object.fromEntries(
        index.facets.categories.map((category) => [category.id, category.label]),
      ),
    [index.facets.categories],
  );

  const filtered = useMemo(
    () => applyFilters(index.rows, filters),
    [index.rows, filters],
  );

  const sorted = useMemo(
    () => sortRows(filtered, filters.sort, filters.direction),
    [filtered, filters.sort, filters.direction],
  );

  const groups = useMemo(
    () => groupRows(sorted, filters.group, categoryLabels),
    [sorted, filters.group, categoryLabels],
  );

  const counts = useMemo(
    () => facetCounts(index.rows, filters),
    [index.rows, filters],
  );

  const onSort = useCallback(
    (key: SortKey) => {
      // Clicking the active column flips it; a new column starts descending,
      // which is what a reader wants for every measure here except package.
      if (key === filters.sort) {
        update({ direction: filters.direction === "asc" ? "desc" : "asc" });
      } else {
        update({ sort: key, direction: key === "package" ? "asc" : "desc" });
      }
    },
    [filters.direction, filters.sort, update],
  );

  const onCopyLink = useCallback(async () => {
    // A push, not a replace: this is the one view worth a history entry.
    commit(filters, true);
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission can be refused; the URL bar now holds the view
      // regardless, which is the part that matters.
      setCopied(false);
    }
  }, [commit, filters]);

  const onToggleGroup = useCallback((key: string) => {
    setCollapsed((current) =>
      current.includes(key)
        ? current.filter((entry) => entry !== key)
        : [...current, key],
    );
  }, []);

  const active = activeFilterCount(filters);

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1 className={styles.title}>Every advisory in the study</h1>
        <p className={styles.standfirst}>
          {count(index.summary.rows)} advisory-package rows across{" "}
          {index.facets.packages.length} libraries. Filter it, sort it, open a
          row for the full record — the address bar keeps your view, so you can
          send it to someone.
        </p>
      </header>

      <div className={styles.layout}>
        <aside className={styles.rail} aria-label="Filters">
          <FilterPanel
            idPrefix="rail"
            facets={index.facets}
            counts={counts}
            filters={filters}
            onToggle={toggle}
            onUpdate={update}
            onReset={reset}
          />
        </aside>

        <section className={styles.results} aria-label="Results">
          <div className={styles.toolbar}>
            <button
              type="button"
              className={styles.filterButton}
              onClick={() => setSheetOpen(true)}
            >
              Filter{active > 0 ? ` (${active})` : ""}
            </button>

            <label className={styles.control}>
              <span>Sort</span>
              <select
                value={filters.sort}
                onChange={(event) => onSort(event.target.value as SortKey)}
              >
                {Object.entries(SORT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.control}>
              <span>Group by</span>
              <select
                value={filters.group}
                onChange={(event) => {
                  setCollapsed([]);
                  update({ group: event.target.value as GroupKey });
                }}
              >
                {Object.entries(GROUP_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className={styles.copy}
              onClick={() => void onCopyLink()}
            >
              {copied ? "Link copied" : "Copy link to this view"}
            </button>
          </div>

          <SummaryStrip
            rows={sorted}
            total={index.summary.rows}
            filtered={hasActiveFilters(filters)}
          />

          {sorted.length > 0 ? (
            <>
              <GapStrip
                rows={sorted}
                selected={filters.selected}
                onSelect={(id) => update({ selected: id })}
              />
              <ResultTable
                rows={sorted}
                groups={groups}
                grouped={filters.group !== "none"}
                sort={filters.sort}
                direction={filters.direction}
                selected={filters.selected}
                collapsed={collapsed}
                onSort={onSort}
                onSelect={(id) => update({ selected: id })}
                onToggleGroup={onToggleGroup}
              />
            </>
          ) : (
            <EmptyState
              rows={index.rows}
              filters={filters}
              onClearFacet={(facet: keyof Filters) => clearFacet(facet)}
              onReset={reset}
            />
          )}
        </section>
      </div>

      {sheetOpen ? (
        <FilterSheet
          index={index}
          filters={filters}
          onClose={() => setSheetOpen(false)}
          onApply={(next) => {
            commit(next);
            setSheetOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
