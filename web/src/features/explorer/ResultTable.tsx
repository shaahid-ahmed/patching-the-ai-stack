/** The results, as a dense table on desktop and a card feed on a phone.
 *
 * Not a horizontally scrolling table at narrow widths and not a column-toggle
 * menu: both ask the reader to reconstruct a row from fragments. The card
 * leads with the gap in words, because that is the measure this whole piece is
 * about.
 */
import { Fragment } from "react";

import type { Advisory } from "@/data/types";
import {
  attackClassLabel,
  count,
  date,
  days,
  gapPhrase,
  gapShort,
} from "@/lib/format";

import { AdvisoryCard } from "./AdvisoryCard";
import type { Group } from "./filter";
import type { SortDirection, SortKey } from "./searchParams";
import { useNarrow } from "./useNarrow";
import styles from "./ResultTable.module.css";

interface Props {
  rows: Advisory[];
  groups: Group[];
  grouped: boolean;
  sort: SortKey;
  direction: SortDirection;
  selected: string | null;
  collapsed: string[];
  onSort: (key: SortKey) => void;
  onSelect: (id: string | null) => void;
  onToggleGroup: (key: string) => void;
}

const COLUMNS: { key: SortKey | null; label: string; numeric?: boolean }[] = [
  { key: "package", label: "Package" },
  { key: "severity", label: "Severity" },
  { key: "published", label: "Published" },
  { key: "gap", label: "Gap (days)", numeric: true },
  { key: "cvss", label: "CVSS", numeric: true },
  { key: null, label: "Summary" },
];

function SeverityChip({ severity }: { severity: Advisory["severity"] }) {
  return (
    <span className={styles.severity} data-severity={severity}>
      {severity}
    </span>
  );
}

function RowBody({ row, open }: { row: Advisory; open: boolean }) {
  return (
    <>
      <td>
        <code className={styles.pkg}>{row.package}</code>
      </td>
      <td>
        <SeverityChip severity={row.severity} />
      </td>
      <td className={styles.num}>{date(row.published)}</td>
      <td
        className={styles.num}
        data-direction={row.gap === null ? "none" : row.gap < 0 ? "after" : "before"}
      >
        {gapShort(row.gap)}
      </td>
      <td className={styles.num}>{row.cvss !== null ? row.cvss.toFixed(1) : ", "}</td>
      <td className={styles.summaryCell}>
        <span className={open ? undefined : styles.clamp}>{row.summary}</span>
      </td>
    </>
  );
}

export function ResultTable({
  rows,
  groups,
  grouped,
  sort,
  direction,
  selected,
  collapsed,
  onSort,
  onSelect,
  onToggleGroup,
}: Props) {
  const narrow = useNarrow();

  if (narrow) {
    return (
      <ul className={styles.feed}>
        {rows.map((row) => {
          const open = selected === row.id;
          return (
            <li key={row.id} className={styles.feedItem}>
              <button
                type="button"
                className={styles.feedButton}
                aria-expanded={open}
                onClick={() => onSelect(open ? null : row.id)}
              >
                <span className={styles.feedHead}>
                  <code className={styles.pkg}>{row.package}</code>
                  <SeverityChip severity={row.severity} />
                </span>
                <span
                  className={styles.feedGap}
                  data-direction={
                    row.gap === null ? "none" : row.gap < 0 ? "after" : "before"
                  }
                >
                  {gapPhrase(row.gap)}
                </span>
                <span className={styles.feedMeta}>
                  {date(row.published)} · {attackClassLabel(row.attackClass)}
                </span>
                <span className={styles.feedSummary}>{row.summary}</span>
              </button>
              {open ? <AdvisoryCard row={row} /> : null}
            </li>
          );
        })}
      </ul>
    );
  }

  const renderRows = (source: Advisory[]) =>
    source.map((row) => {
      const open = selected === row.id;
      return (
        <Fragment key={row.id}>
          <tr
            className={styles.row}
            data-open={open ? "true" : undefined}
            onClick={() => onSelect(open ? null : row.id)}
            tabIndex={0}
            role="button"
            aria-expanded={open}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(open ? null : row.id);
              }
            }}
          >
            <RowBody row={row} open={open} />
          </tr>
          {open ? (
            <tr className={styles.detailRow}>
              <td colSpan={COLUMNS.length}>
                <AdvisoryCard row={row} />
              </td>
            </tr>
          ) : null}
        </Fragment>
      );
    });

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          {COLUMNS.map((column) => {
            const active = column.key !== null && column.key === sort;
            return (
              <th
                key={column.label}
                scope="col"
                className={column.numeric ? styles.num : undefined}
                aria-sort={
                  active
                    ? direction === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                {column.key ? (
                  <button
                    type="button"
                    className={styles.sortButton}
                    data-active={active ? "true" : undefined}
                    onClick={() => onSort(column.key as SortKey)}
                  >
                    {column.label}
                    <span aria-hidden="true" className={styles.caret}>
                      {active ? (direction === "asc" ? "▲" : "▼") : "•"}
                    </span>
                  </button>
                ) : (
                  column.label
                )}
              </th>
            );
          })}
        </tr>
      </thead>

      {grouped ? (
        groups.map((group) => {
          const isCollapsed = collapsed.includes(group.key);
          return (
            <tbody key={group.key} className={styles.group}>
              <tr className={styles.bandRow}>
                <td colSpan={COLUMNS.length}>
                  <button
                    type="button"
                    className={styles.band}
                    aria-expanded={!isCollapsed}
                    onClick={() => onToggleGroup(group.key)}
                  >
                    <span aria-hidden="true" className={styles.bandCaret}>
                      {isCollapsed ? "▸" : "▾"}
                    </span>
                    <span className={styles.bandLabel}>{group.label}</span>
                    <span className={styles.bandStats}>
                      {count(group.rows.length)}{" "}
                      {group.rows.length === 1 ? "advisory" : "advisories"}
                      {group.medianGap !== null ? (
                        <> · median gap {days(group.medianGap)} days</>
                      ) : (
                        <> · no measurable gap</>
                      )}
                      {group.unpatched > 0 ? (
                        <> · {count(group.unpatched)} unpatched</>
                      ) : null}
                    </span>
                  </button>
                </td>
              </tr>
              {isCollapsed ? null : renderRows(group.rows)}
            </tbody>
          );
        })
      ) : (
        <tbody>{renderRows(rows)}</tbody>
      )}
    </table>
  );
}
