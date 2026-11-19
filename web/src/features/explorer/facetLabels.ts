/** Human names for facets and their values.
 *
 * Kept out of the components so the empty state, the filter chips and the
 * group bands all name a thing the same way.
 */
import type { Filters } from "./searchParams";

export const FACET_LABELS: Partial<Record<keyof Filters, string>> = {
  categories: "category",
  packages: "package",
  severities: "severity",
  attackClasses: "attack class",
  ai: "AI-specific",
  fix: "fix status",
  query: "search",
  yearFrom: "year",
  yearTo: "year",
};

export const GROUP_LABELS: Record<string, string> = {
  none: "Nothing",
  package: "Package",
  category: "Category",
  attackClass: "Attack class",
  severity: "Severity",
};

export const SORT_LABELS: Record<string, string> = {
  published: "Published",
  gap: "Gap",
  cvss: "CVSS",
  epss: "Exploit probability",
  package: "Package",
  severity: "Severity",
};

export const AI_LABELS: Record<string, string> = {
  all: "All advisories",
  ai: "AI-specific only",
  general: "General software flaws only",
};
