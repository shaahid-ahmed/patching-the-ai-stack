/** Read and write the explorer's filters, which live only in the URL.
 *
 * Every control calls `update` or `toggle`; nothing here keeps a copy of the
 * filter state in React. That is what makes a view linkable, makes the back
 * button behave, and lets the talk open a prepared `/explore?…` link instead
 * of clicking through facets on stage.
 */
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

import {
  DEFAULT_FILTERS,
  parseFilters,
  serializeFilters,
  type Filters,
} from "./searchParams";

/** The facets whose values are multi-select lists. */
export type ListFacet = "categories" | "packages" | "severities" | "attackClasses";

export function useFilters() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo(() => parseFilters(params), [params]);

  const commit = useCallback(
    (next: Filters, push = false) => {
      // Ordinary control changes replace, so a reader who has nudged six
      // checkboxes does not have to press back six times to leave. Only an
      // explicit "copy this view" pushes an entry worth returning to.
      setParams(serializeFilters(next), { replace: !push });
    },
    [setParams],
  );

  const update = useCallback(
    (patch: Partial<Filters>, push = false) => commit({ ...filters, ...patch }, push),
    [commit, filters],
  );

  const toggle = useCallback(
    (facet: ListFacet, value: string) => {
      const current = filters[facet] as string[];
      const next = current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value];
      // Changing a filter invalidates whichever row was open.
      update({ [facet]: next, selected: null } as Partial<Filters>);
    },
    [filters, update],
  );

  const clearFacet = useCallback(
    (facet: keyof Filters) => {
      const blank =
        facet === "ai" || facet === "fix"
          ? "all"
          : facet === "query"
            ? ""
            : facet === "yearFrom" || facet === "yearTo" || facet === "selected"
              ? null
              : [];
      update({ [facet]: blank } as Partial<Filters>);
    },
    [update],
  );

  const reset = useCallback(
    () => commit({ ...DEFAULT_FILTERS, sort: filters.sort, direction: filters.direction }),
    [commit, filters.direction, filters.sort],
  );

  return { filters, update, toggle, clearFacet, reset, commit };
}
