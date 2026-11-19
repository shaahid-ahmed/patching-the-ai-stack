/** The facet controls. Fully controlled, so the same component serves as the
 *  desktop rail (wired straight to the URL) and as the body of the mobile
 *  sheet (wired to a draft that is applied on a button).
 *
 *  Within a facet, ticked values are alternatives; across facets they
 *  intersect. Counts beside each value are computed with every *other* facet
 *  still applied, so an unticked value shows what it would add rather than a
 *  misleading zero.
 */
import { useId, useMemo, useState } from "react";

import type { Facets } from "@/data/types";
import { count } from "@/lib/format";

import type { FacetCounts } from "./filter";
import { AI_LABELS } from "./facetLabels";
import type { AiFilter, Filters, FixFilter } from "./searchParams";
import type { ListFacet } from "./useFilters";
import styles from "./FilterPanel.module.css";

interface Props {
  facets: Facets;
  counts: FacetCounts;
  filters: Filters;
  onToggle: (facet: ListFacet, value: string) => void;
  onUpdate: (patch: Partial<Filters>) => void;
  onReset: () => void;
  idPrefix?: string;
}

interface CheckOption {
  value: string;
  label: string;
  total: number;
}

function FacetGroup({
  legend,
  facet,
  options,
  selected,
  counts,
  onToggle,
  idPrefix,
  searchable,
}: {
  legend: string;
  facet: ListFacet;
  options: CheckOption[];
  selected: string[];
  counts: Record<string, number>;
  onToggle: (facet: ListFacet, value: string) => void;
  idPrefix: string;
  searchable?: boolean;
}) {
  const [needle, setNeedle] = useState("");
  const searchId = useId();

  const visible = useMemo(() => {
    if (!searchable || !needle.trim()) return options;
    const query = needle.trim().toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(query));
  }, [needle, options, searchable]);

  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>
        {legend}
        {selected.length ? <span className={styles.badge}>{selected.length}</span> : null}
      </legend>

      {searchable ? (
        <>
          <label className={styles.srOnly} htmlFor={`${idPrefix}-${searchId}`}>
            Filter the {legend.toLowerCase()} list
          </label>
          <input
            id={`${idPrefix}-${searchId}`}
            type="search"
            className={styles.search}
            placeholder="Find a package"
            value={needle}
            onChange={(event) => setNeedle(event.target.value)}
          />
        </>
      ) : null}

      <ul className={styles.options}>
        {visible.map((option) => {
          const checked = selected.includes(option.value);
          const available = counts[option.value] ?? 0;
          const id = `${idPrefix}-${facet}-${option.value}`;
          return (
            <li key={option.value}>
              <label
                className={styles.option}
                htmlFor={id}
                data-empty={!checked && available === 0 ? "true" : undefined}
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(facet, option.value)}
                  className={styles.checkbox}
                />
                <span className={styles.optionLabel}>{option.label}</span>
                <span className={styles.optionCount}>{count(available)}</span>
              </label>
            </li>
          );
        })}
        {visible.length === 0 ? (
          <li className={styles.noMatch}>No match</li>
        ) : null}
      </ul>
    </fieldset>
  );
}

function RadioGroup<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  idPrefix,
}: {
  legend: string;
  name: string;
  value: T;
  options: { value: T; label: string; total?: number }[];
  onChange: (value: T) => void;
  idPrefix: string;
}) {
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{legend}</legend>
      <ul className={styles.options}>
        {options.map((option) => {
          const id = `${idPrefix}-${name}-${option.value}`;
          return (
            <li key={option.value}>
              <label className={styles.option} htmlFor={id}>
                <input
                  id={id}
                  type="radio"
                  name={`${idPrefix}-${name}`}
                  checked={value === option.value}
                  onChange={() => onChange(option.value)}
                  className={styles.checkbox}
                />
                <span className={styles.optionLabel}>{option.label}</span>
                {option.total !== undefined ? (
                  <span className={styles.optionCount}>{count(option.total)}</span>
                ) : null}
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

export function FilterPanel({
  facets,
  counts,
  filters,
  onToggle,
  onUpdate,
  onReset,
  idPrefix = "f",
}: Props) {
  const searchId = useId();
  const years = facets.years;
  const firstYear = years[0];
  const lastYear = years[years.length - 1];

  return (
    <div className={styles.panel}>
      <div className={styles.group}>
        <label className={styles.legend} htmlFor={`${idPrefix}-${searchId}`}>
          Search
        </label>
        <input
          id={`${idPrefix}-${searchId}`}
          type="search"
          className={styles.search}
          placeholder="Package, CVE, CWE, summary"
          value={filters.query}
          onChange={(event) => onUpdate({ query: event.target.value, selected: null })}
        />
      </div>

      <FacetGroup
        legend="Category"
        facet="categories"
        idPrefix={idPrefix}
        selected={filters.categories}
        counts={counts.categories}
        onToggle={onToggle}
        options={facets.categories.map((category) => ({
          value: category.id,
          label: category.label,
          total: category.count,
        }))}
      />

      <FacetGroup
        legend="Package"
        facet="packages"
        idPrefix={idPrefix}
        searchable
        selected={filters.packages}
        counts={counts.packages}
        onToggle={onToggle}
        options={facets.packages.map((pkg) => ({
          value: pkg.name,
          label: pkg.name,
          total: pkg.count,
        }))}
      />

      <FacetGroup
        legend="Severity"
        facet="severities"
        idPrefix={idPrefix}
        selected={filters.severities}
        counts={counts.severities}
        onToggle={onToggle}
        options={[...facets.severities].reverse().map((severity) => ({
          value: severity.id,
          label: severity.id,
          total: severity.count,
        }))}
      />

      <FacetGroup
        legend="Attack class"
        facet="attackClasses"
        idPrefix={idPrefix}
        selected={filters.attackClasses}
        counts={counts.attackClasses}
        onToggle={onToggle}
        options={facets.attackClasses.map((entry) => ({
          value: entry.id,
          label: entry.id,
          total: entry.count,
        }))}
      />

      <RadioGroup<AiFilter>
        legend="AI-specific"
        name="ai"
        idPrefix={idPrefix}
        value={filters.ai}
        onChange={(value) => onUpdate({ ai: value, selected: null })}
        options={[
          { value: "all", label: AI_LABELS.all as string },
          { value: "ai", label: AI_LABELS.ai as string },
          { value: "general", label: AI_LABELS.general as string },
        ]}
      />

      <RadioGroup<FixFilter>
        legend="Fix status"
        name="fix"
        idPrefix={idPrefix}
        value={filters.fix}
        onChange={(value) => onUpdate({ fix: value, selected: null })}
        options={[
          { value: "all", label: "Any" },
          ...facets.fixStatus.map((status) => ({
            value: status.id as FixFilter,
            label: status.label,
            total: status.count,
          })),
        ]}
      />

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Published</legend>
        <div className={styles.range}>
          <label className={styles.rangeField}>
            <span>From</span>
            <select
              value={filters.yearFrom ?? ""}
              onChange={(event) =>
                onUpdate({
                  yearFrom: event.target.value ? Number(event.target.value) : null,
                  selected: null,
                })
              }
            >
              <option value="">{firstYear ?? ", "}</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.rangeField}>
            <span>To</span>
            <select
              value={filters.yearTo ?? ""}
              onChange={(event) =>
                onUpdate({
                  yearTo: event.target.value ? Number(event.target.value) : null,
                  selected: null,
                })
              }
            >
              <option value="">{lastYear ?? ", "}</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <button type="button" className={styles.reset} onClick={onReset}>
        Clear all filters
      </button>
    </div>
  );
}
