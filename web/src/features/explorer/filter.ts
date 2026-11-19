/** Pure filtering, sorting and grouping. No React, no fetch, no DOM.
 *
 * 454 rows is small enough that this runs in well under a millisecond, which
 * is why the explorer needs no virtualization, no memoized index and no state
 * library, the URL changes, this reruns, the table redraws.
 */
import type { Advisory, CategoryId, Severity } from "@/data/types";
import { severityRank } from "@/lib/format";
import type { Filters, GroupKey, SortKey } from "./searchParams";

export interface FacetCounts {
  categories: Record<string, number>;
  packages: Record<string, number>;
  severities: Record<string, number>;
  attackClasses: Record<string, number>;
}

const matchesQuery = (row: Advisory, query: string): boolean => {
  if (!query) return true;
  const needle = query.toLowerCase();
  return (
    row.id.toLowerCase().includes(needle) ||
    (row.cve?.toLowerCase().includes(needle) ?? false) ||
    row.package.toLowerCase().includes(needle) ||
    row.summary.toLowerCase().includes(needle) ||
    row.attackClass.toLowerCase().includes(needle) ||
    row.cwe.some((cwe) => cwe.toLowerCase().includes(needle))
  );
};

const matchesFix = (row: Advisory, fix: Filters["fix"]): boolean => {
  switch (fix) {
    case "has-fix":
      return row.hasFix;
    case "no-fix":
      return !row.hasFix;
    case "fix-after-disclosure":
      return row.gap !== null && row.gap < 0;
    default:
      return true;
  }
};

const matchesYear = (row: Advisory, from: number | null, to: number | null): boolean => {
  if (from === null && to === null) return true;
  const year = new Date(row.published).getUTCFullYear();
  if (from !== null && year < from) return false;
  if (to !== null && year > to) return false;
  return true;
};

/**
 * Within a facet the values are alternatives (OR); across facets they
 * intersect (AND). That is what a reader expects from checkbox groups, and it
 * is the behaviour the facet counts below are computed against.
 */
export function applyFilters(rows: Advisory[], filters: Filters): Advisory[] {
  return rows.filter(
    (row) =>
      (filters.categories.length === 0 || filters.categories.includes(row.category)) &&
      (filters.packages.length === 0 || filters.packages.includes(row.package)) &&
      (filters.severities.length === 0 || filters.severities.includes(row.severity)) &&
      (filters.attackClasses.length === 0 ||
        filters.attackClasses.includes(row.attackClass)) &&
      (filters.ai === "all" ||
        (filters.ai === "ai" ? row.aiSpecific : !row.aiSpecific)) &&
      matchesFix(row, filters.fix) &&
      matchesYear(row, filters.yearFrom, filters.yearTo) &&
      matchesQuery(row, filters.query.trim()),
  );
}

const compare = (a: Advisory, b: Advisory, key: SortKey): number => {
  switch (key) {
    case "gap":
      // Nulls are rows with no fix at all. They sort last in either direction
      // rather than reading as a gap of zero.
      if (a.gap === null && b.gap === null) return 0;
      if (a.gap === null) return 1;
      if (b.gap === null) return -1;
      return a.gap - b.gap;
    case "cvss":
      return (a.cvss ?? -1) - (b.cvss ?? -1);
    case "epss":
      return (a.epss ?? -1) - (b.epss ?? -1);
    case "package":
      return a.package.localeCompare(b.package);
    case "severity":
      return severityRank[a.severity] - severityRank[b.severity];
    case "published":
    default:
      return Date.parse(a.published) - Date.parse(b.published);
  }
};

export function sortRows(
  rows: Advisory[],
  key: SortKey,
  direction: "asc" | "desc",
): Advisory[] {
  const sign = direction === "asc" ? 1 : -1;
  // Stable tiebreak on id, so the same filters always produce the same order
  // and a shared link shows the reader exactly what the sender saw.
  return [...rows].sort((a, b) => {
    const result = compare(a, b, key);
    return result !== 0 ? result * sign : a.id.localeCompare(b.id);
  });
}

export interface Group {
  key: string;
  label: string;
  rows: Advisory[];
  medianGap: number | null;
  unpatched: number;
}

const groupValue = (row: Advisory, key: GroupKey): string => {
  switch (key) {
    case "package":
      return row.package;
    case "category":
      return row.category;
    case "attackClass":
      return row.attackClass;
    case "severity":
      return row.severity;
    default:
      return "";
  }
};

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] as number;
  return ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

/**
 * Group headers carry the per-group median gap and n. That summary is the
 * reason to group at all, a flat sortable table is something a spreadsheet
 * already does better.
 */
export function groupRows(
  rows: Advisory[],
  key: GroupKey,
  labels: Record<string, string> = {},
): Group[] {
  if (key === "none") return [];
  const buckets = new Map<string, Advisory[]>();
  for (const row of rows) {
    const value = groupValue(row, key);
    const bucket = buckets.get(value);
    if (bucket) bucket.push(row);
    else buckets.set(value, [row]);
  }
  return [...buckets.entries()]
    .map(([value, bucketRows]) => ({
      key: value,
      label: labels[value] ?? value,
      rows: bucketRows,
      medianGap: median(
        bucketRows.map((r) => r.gap).filter((g): g is number => g !== null),
      ),
      unpatched: bucketRows.filter((r) => !r.hasFix).length,
    }))
    .sort((a, b) => b.rows.length - a.rows.length);
}

/**
 * Counts shown beside each facet value: how many rows that value would yield
 * if it were toggled on, with every *other* facet still applied. Counting
 * against the fully filtered set instead would show zero for every unselected
 * value in the same facet, which reads as a bug.
 */
export function facetCounts(rows: Advisory[], filters: Filters): FacetCounts {
  const countFor = (exclude: keyof Filters): Advisory[] =>
    applyFilters(rows, { ...filters, [exclude]: DEFAULT_FOR[exclude] } as Filters);

  const tally = <T extends string>(source: Advisory[], pick: (r: Advisory) => T) => {
    const result: Record<string, number> = {};
    for (const row of source) {
      const value = pick(row);
      result[value] = (result[value] ?? 0) + 1;
    }
    return result;
  };

  return {
    categories: tally(countFor("categories"), (r) => r.category as CategoryId),
    packages: tally(countFor("packages"), (r) => r.package),
    severities: tally(countFor("severities"), (r) => r.severity as Severity),
    attackClasses: tally(countFor("attackClasses"), (r) => r.attackClass),
  };
}

const DEFAULT_FOR: Partial<Record<keyof Filters, unknown>> = {
  categories: [],
  packages: [],
  severities: [],
  attackClasses: [],
};

/** Which single filter is doing the most narrowing, for the empty state. */
export function narrowestFacet(
  rows: Advisory[],
  filters: Filters,
): { facet: keyof Filters; removed: number } | null {
  const total = applyFilters(rows, filters).length;
  if (total > 0) return null;

  const candidates: (keyof Filters)[] = [
    "categories",
    "packages",
    "severities",
    "attackClasses",
    "ai",
    "fix",
    "query",
  ];
  let best: { facet: keyof Filters; removed: number } | null = null;
  for (const facet of candidates) {
    const relaxed = {
      ...filters,
      [facet]: facet === "ai" || facet === "fix" ? "all" : facet === "query" ? "" : [],
    } as Filters;
    const gained = applyFilters(rows, relaxed).length;
    if (gained > 0 && (best === null || gained > best.removed)) {
      best = { facet, removed: gained };
    }
  }
  return best;
}
