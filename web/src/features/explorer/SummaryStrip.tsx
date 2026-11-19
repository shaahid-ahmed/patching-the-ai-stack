/** One line of running text, deliberately not a row of stat cards.
 *
 * Four bordered boxes with big numbers is the strongest dashboard signal
 * there is, and this piece is an argument rather than a console. The counts
 * recompute against whatever is currently filtered, so no filtered view can
 * imply a larger sample than it has.
 */
import { useMemo } from "react";

import type { Advisory } from "@/data/types";
import { count, days } from "@/lib/format";

import { median } from "./filter";
import styles from "./SummaryStrip.module.css";

interface Props {
  rows: Advisory[];
  total: number;
  filtered: boolean;
}

export function SummaryStrip({ rows, total, filtered }: Props) {
  const stats = useMemo(() => {
    const gaps = rows.map((row) => row.gap).filter((gap): gap is number => gap !== null);
    return {
      medianGap: median(gaps),
      unpatched: rows.filter((row) => !row.hasFix).length,
      warnedFirst: gaps.filter((gap) => gap < 0).length,
    };
  }, [rows]);

  return (
    <p className={styles.strip} aria-live="polite">
      <strong className={styles.count}>{count(rows.length)}</strong>{" "}
      {rows.length === 1 ? "advisory-package" : "advisory-packages"}
      {filtered ? (
        <span className={styles.of}> of {count(total)}</span>
      ) : null}
      <span className={styles.sep}>·</span>
      {stats.medianGap === null ? (
        <>no measurable gap</>
      ) : (
        <>
          median gap <strong>{days(stats.medianGap)}</strong> days
        </>
      )}
      <span className={styles.sep}>·</span>
      <strong>{count(stats.unpatched)}</strong> unpatched
      {stats.warnedFirst > 0 ? (
        <>
          <span className={styles.sep}>·</span>
          <strong>{count(stats.warnedFirst)}</strong> warned before a fix existed
        </>
      ) : null}
    </p>
  );
}
