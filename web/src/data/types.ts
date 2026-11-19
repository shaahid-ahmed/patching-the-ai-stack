/** Shapes of the artifacts emitted by `python3 -m pipeline.build`.
 *
 * These mirror the payload builders in pipeline/. If the pipeline changes a
 * field, change it here in the same commit: `npm run check` is what catches
 * the drift before a page renders `undefined`.
 */

export type CategoryId =
  | "model-libraries"
  | "application-frameworks"
  | "serving-and-web-tools"
  | "agent-tools";

export type Severity = "low" | "medium" | "high" | "critical";

export interface Advisory {
  id: string;
  cve: string | null;
  package: string;
  category: CategoryId;
  severity: Severity;
  cvss: number | null;
  epss: number | null;
  published: string;
  affected: string;
  patched: string | null;
  fixDate: string | null;
  /** Days the fix shipped before disclosure. Negative: warned with no fix. */
  gap: number | null;
  outlier: boolean;
  hasFix: boolean;
  attackClass: string;
  aiSpecific: boolean;
  cwe: string[];
  summary: string;
}

export interface Facets {
  categories: { id: CategoryId; label: string; blurb: string; count: number }[];
  packages: { name: string; category: CategoryId; count: number }[];
  severities: { id: Severity; count: number }[];
  attackClasses: { id: string; count: number }[];
  fixStatus: { id: string; label: string; count: number }[];
  years: number[];
}

export interface AdvisoryIndex {
  rows: Advisory[];
  facets: Facets;
  summary: {
    rows: number;
    advisories: number;
    medianGap: number;
    unpatched: number;
  };
}

export interface Summary {
  n: number;
  median?: number;
  mean?: number;
  sd?: number | null;
  min?: number;
  q1?: number;
  q3?: number;
  max?: number;
  negative?: number;
  negative_share?: number;
}

export interface BoxStats {
  n: number;
  q1?: number;
  median?: number;
  q3?: number;
  iqr?: number;
  whisker_low?: number;
  whisker_high?: number;
  outliers?: number[];
}

export interface FigureQ1 {
  quarters: {
    quarter: string;
    start: string;
    label: string;
    total: number;
    unique_advisories: number;
    partial: boolean;
    observed_days: number;
    total_days: number;
    coverage: number;
    projected_total: number | null;
    by_category: Record<CategoryId, number>;
    by_severity: Record<Severity, number>;
    ai_specific: number;
  }[];
  partial_quarter: string | null;
  observed_through: string;
  categories: { id: CategoryId; label: string; blurb: string }[];
  growth: {
    from_quarter: string | null;
    from_count: number | null;
    to_quarter: string | null;
    to_count: number | null;
    multiple: number | null;
  };
  note: string;
}

export interface FigureQ2 {
  classes: {
    attack_class: string;
    total: number;
    share: number | null;
    ai_specific: number;
    ai_specific_share: number | null;
    by_category: Record<CategoryId, number>;
    by_category_share: Record<CategoryId, number | null>;
    by_severity: Record<Severity, number>;
    median_cvss: number | null;
  }[];
  total_rows: number;
  old_vs_new: {
    old: { id: CategoryId; label: string; n: number };
    new: { id: CategoryId; label: string; n: number };
    rows: {
      attack_class: string;
      old_count: number;
      new_count: number;
      old_share: number | null;
      new_share: number | null;
      difference: number;
    }[];
  };
  ai_specific: {
    true: number;
    false: number;
    share: number | null;
    by_category: Record<CategoryId, { true: number; total: number; share: number | null }>;
    top_classes: { attack_class: string; count: number }[];
  };
  label_source: string | null;
  note: string;
}

export interface FigureQ3 {
  summary: Summary;
  summary_excluding_outliers: Summary;
  box: BoxStats;
  histogram: { start: number; end: number; count: number; negative: boolean }[];
  by_category: {
    category_id: CategoryId;
    label: string;
    box: BoxStats;
    summary: Summary;
    summary_excluding_outliers: Summary;
    no_fix: number;
  }[];
  by_year: { year: number; box: BoxStats; summary: Summary }[];
  by_half_year: { period: string; label: string; box: BoxStats; summary: Summary }[];
  points: {
    id: string;
    package: string;
    category_id: CategoryId;
    gap: number;
    severity: Severity;
    outlier: boolean;
  }[];
  coverage: {
    rows_total: number;
    gap_measurable: number;
    no_fix: number;
    fix_version_unmatched: number;
    outliers: number;
  };
  tests: {
    serving_vs_frameworks: {
      n_a: number;
      n_b: number;
      median_a?: number;
      median_b?: number;
      u?: number;
      p_value: number | null;
      significant: boolean;
    };
  };
  negative_examples: {
    id: string;
    package: string;
    gap: number;
    severity: Severity;
    summary: string;
  }[];
  note: string;
}

export interface FigureQ4 {
  packages: {
    package: string;
    category_id: CategoryId;
    releases_recent: number;
    releases_per_year: number;
    releases_total: number;
    advisories: number;
    gap_measurable: number;
    median_gap: number | null;
    no_fix: number;
    median_cvss: number | null;
  }[];
  window: { start: string; end: string; years: number };
  test: { n: number; rho: number | null; p_value: number | null; significant: boolean };
  bootstrap: { x1: number; y1: number; x2: number; y2: number }[];
  alpha: number;
  verdict: string;
  note: string;
}

export interface Proportion {
  estimate: number | null;
  low: number | null;
  high: number | null;
  n: number;
}

export interface FigureQ5 {
  overall: { total: number; unpatched: number } & Proportion;
  cells: {
    id: string;
    package: string;
    category_id: CategoryId;
    severity: Severity;
    unpatched: boolean;
  }[];
  by_package: ({
    package: string;
    category_id: CategoryId;
    total: number;
    unpatched: number;
    unpatched_critical: number;
  } & Proportion)[];
  by_category: ({ category_id: CategoryId; label: string; total: number; unpatched: number } & Proportion)[];
  by_severity: ({ severity: Severity; total: number; unpatched: number } & Proportion)[];
  unpatched_advisories: {
    id: string;
    cve: string | null;
    package: string;
    category_id: CategoryId;
    severity: Severity;
    cvss: number | null;
    exploit_probability_30d: number | null;
    published: string;
    affected_versions: string;
    attack_class: string;
  }[];
  note: string;
}

export interface Limitation {
  id: string;
  severity: "important" | "note";
  headline: string;
  detail: string;
  examples?: { id: string; package: string; gap: number | null; summary: string }[];
}

export interface Methods {
  generatedAt: string;
  observedThrough: string;
  counts: Counts;
  headline: Headline;
  categories: { id: CategoryId; label: string; blurb: string; packages: string[] }[];
  labelSource: string;
  labelsPreliminary: boolean;
  labelCheck: { checked: number; agreement: number | null };
  sources: { id: string; name: string; url: string; role: string; auth: string }[];
  limitations: Limitation[];
}

export interface PackageDetail {
  package: string;
  category: CategoryId;
  categoryLabel: string;
  counts: { advisories: number; releases: number; unpatched: number; aiSpecific: number };
  gap: { median: number | null; n: number; negative: number };
  severity: Record<Severity, number>;
  attackClasses: { id: string; count: number }[];
  releaseTimeline: { version: string; date: string; yanked: boolean; prerelease: boolean }[];
  firstRelease: string | null;
  latestRelease: string | null;
  advisories: (Advisory & { description: string })[];
}

export interface Counts {
  rows: number;
  advisories: number;
  packages: number;
  releases: number;
  withFix: number;
  withoutFix: number;
  gapMeasurable: number;
  outliers: number;
  aiSpecific: number;
  negativeGap: number;
}

export interface Headline {
  medianGap: number;
  meanGap: number;
  negativeShare: number;
  negativeShareOfMeasurable: number;
  unpatchedShare: number;
}

export interface Manifest {
  schemaVersion: number;
  generatedAt: string;
  observedThrough: string;
  counts: Counts;
  headline: Headline;
  labelsPreliminary: boolean;
  files: {
    advisories: string;
    methods: string;
    figures: Record<"q1" | "q2" | "q3" | "q4" | "q5", string>;
    detail: Record<string, string>;
  };
}
