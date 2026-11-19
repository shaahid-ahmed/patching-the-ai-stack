import { useSyncExternalStore } from "react";

/** True below the width at which a dense table stops being readable.
 *
 * Local to the explorer on purpose: the breakpoint is about this table, not a
 * site-wide layout rule.
 */
const QUERY = "(max-width: 44rem)";

const subscribe = (notify: () => void) => {
  if (typeof window === "undefined") return () => {};
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};

export const useNarrow = () =>
  useSyncExternalStore(
    subscribe,
    () => (typeof window === "undefined" ? false : window.matchMedia(QUERY).matches),
    () => false,
  );
