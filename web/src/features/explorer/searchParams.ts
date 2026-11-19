/** The URL is the explorer's only state.
 *
 * Filters in React state would mean a view cannot be linked, and the back
 * button would do the wrong thing. Both matter here: the two-minute talk opens
 * a prepared link rather than clicking through filters on stage.
 *
 * Defaults are omitted from the query string, so an untouched explorer is just
 * `/explore`.
 */
import type { CategoryId, Severity } from "@/data/types";

export type SortKey = "gap" | "published" | "cvss" | "epss" | "package" | "severity";
export type SortDirection = "asc" | "desc";
export type GroupKey = "none" | "package" | "category" | "attackClass" | "severity";
export type AiFilter = "all" | "ai" | "general";
export type FixFilter = "all" | "has-fix" | "no-fix" | "fix-after-disclosure";

export interface Filters {
  categories: CategoryId[];
  packages: string[];
  severities: Severity[];
  attackClasses: string[];
  ai: AiFilter;
  fix: FixFilter;
  yearFrom: number | null;
  yearTo: number | null;
  query: string;
  sort: SortKey;
  direction: SortDirection;
  group: GroupKey;
  selected: string | null;
}

export const DEFAULT_FILTERS: Filters = {
  categories: [],
  packages: [],
  severities: [],
  attackClasses: [],
  ai: "all",
  fix: "all",
  yearFrom: null,
  yearTo: null,
  query: "",
  sort: "published",
  direction: "desc",
  group: "none",
  selected: null,
};

const list = (params: URLSearchParams, key: string): string[] => {
  const raw = params.get(key);
  return raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];
};

const oneOf = <T extends string>(
  params: URLSearchParams,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T => {
  const raw = params.get(key);
  return raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
};

const integer = (params: URLSearchParams, key: string): number | null => {
  const raw = params.get(key);
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

export function parseFilters(params: URLSearchParams): Filters {
  return {
    categories: list(params, "cat") as CategoryId[],
    packages: list(params, "pkg"),
    severities: list(params, "sev") as Severity[],
    attackClasses: list(params, "class"),
    ai: oneOf(params, "ai", ["all", "ai", "general"] as const, "all"),
    fix: oneOf(
      params,
      "fix",
      ["all", "has-fix", "no-fix", "fix-after-disclosure"] as const,
      "all",
    ),
    yearFrom: integer(params, "from"),
    yearTo: integer(params, "to"),
    query: params.get("q") ?? "",
    sort: oneOf(
      params,
      "sort",
      ["gap", "published", "cvss", "epss", "package", "severity"] as const,
      DEFAULT_FILTERS.sort,
    ),
    direction: oneOf(params, "dir", ["asc", "desc"] as const, DEFAULT_FILTERS.direction),
    group: oneOf(
      params,
      "group",
      ["none", "package", "category", "attackClass", "severity"] as const,
      "none",
    ),
    selected: params.get("sel"),
  };
}

export function serializeFilters(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  const put = (key: string, value: string[] | string | number | null) => {
    if (value === null || value === "" ) return;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(","));
      return;
    }
    params.set(key, String(value));
  };

  put("cat", filters.categories);
  put("pkg", filters.packages);
  put("sev", filters.severities);
  put("class", filters.attackClasses);
  if (filters.ai !== DEFAULT_FILTERS.ai) put("ai", filters.ai);
  if (filters.fix !== DEFAULT_FILTERS.fix) put("fix", filters.fix);
  put("from", filters.yearFrom);
  put("to", filters.yearTo);
  put("q", filters.query.trim());
  if (filters.sort !== DEFAULT_FILTERS.sort) put("sort", filters.sort);
  if (filters.direction !== DEFAULT_FILTERS.direction) put("dir", filters.direction);
  if (filters.group !== DEFAULT_FILTERS.group) put("group", filters.group);
  put("sel", filters.selected);
  return params;
}

/** How many facets are narrowing the result set, for the mobile "Filter (3)" button. */
export function activeFilterCount(filters: Filters): number {
  let active = 0;
  if (filters.categories.length) active += 1;
  if (filters.packages.length) active += 1;
  if (filters.severities.length) active += 1;
  if (filters.attackClasses.length) active += 1;
  if (filters.ai !== "all") active += 1;
  if (filters.fix !== "all") active += 1;
  if (filters.yearFrom !== null || filters.yearTo !== null) active += 1;
  if (filters.query.trim()) active += 1;
  return active;
}

export const hasActiveFilters = (filters: Filters) => activeFilterCount(filters) > 0;
