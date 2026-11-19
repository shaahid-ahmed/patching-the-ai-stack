import { useId, useState, type ReactNode } from "react";
import { Link } from "react-router";

import styles from "./ChartFrame.module.css";

export interface DataTable {
  caption: string;
  columns: { key: string; label: string; numeric?: boolean }[];
  rows: Record<string, string | number | null>[];
}

interface Props {
  /** The assertion the chart supports, written as a sentence. */
  title: string;
  /** Units and sample size. Never a restatement of the title. */
  subtitle?: string;
  /** The caveat specific to this chart. */
  note?: string;
  /** Rendered when the labels come from the preliminary keyword pass. */
  preliminaryLabels?: boolean;
  table: DataTable;
  children: ReactNode;
}

/**
 * Wraps every figure so that the furniture is identical across the piece: an
 * assertion as the title, units in the subtitle, one caveat line underneath,
 * and the underlying numbers available as a real table, both for screen
 * readers and for a sceptical reader who wants to check the drawing.
 */
export function ChartFrame({
  title,
  subtitle,
  note,
  preliminaryLabels,
  table,
  children,
}: Props) {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();

  return (
    <figure className={styles.frame}>
      <div className={styles.head}>
        <h3 className={styles.title}>{title}</h3>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>

      <div className={styles.plot}>{children}</div>

      <figcaption className={styles.foot}>
        {note ? <p className={styles.note}>{note}</p> : <span />}
        {preliminaryLabels ? (
          <Link className={styles.pill} to="/methods#ai-labels">
            Preliminary label
          </Link>
        ) : null}
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={showTable}
          aria-controls={tableId}
          onClick={() => setShowTable((open) => !open)}
        >
          {showTable ? "Hide the numbers" : "Show the numbers"}
        </button>
      </figcaption>

      <div id={tableId} className={showTable ? undefined : styles.sr}>
        <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption>{table.caption}</caption>
          <thead>
            <tr>
              {table.columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={column.numeric ? styles.num : undefined}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => (
              <tr key={index}>
                {table.columns.map((column) => (
                  <td
                    key={column.key}
                    className={column.numeric ? styles.num : undefined}
                  >
                    {row[column.key] ?? ", "}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </figure>
  );
}
