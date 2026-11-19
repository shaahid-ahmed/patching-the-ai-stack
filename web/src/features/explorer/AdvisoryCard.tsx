/** The full record for one advisory, shown when a row is opened.
 *
 * The gap is stated in words rather than as a signed number, because "−12" is
 * meaningless without knowing which direction is bad.
 */
import type { ReactNode } from "react";
import { Link } from "react-router";

import type { Advisory } from "@/data/types";
import { attackClassLabel, date, exploitProbability, gapPhrase } from "@/lib/format";

import styles from "./AdvisoryCard.module.css";

export function AdvisoryCard({ row }: { row: Advisory }) {
  const fields: { label: string; value: ReactNode }[] = [
    { label: "Advisory", value: <code>{row.id}</code> },
    { label: "CVE", value: row.cve ? <code>{row.cve}</code> : "none assigned" },
    { label: "Published", value: date(row.published) },
    { label: "Affected versions", value: <code>{row.affected}</code> },
    {
      label: "First patched version",
      value: row.patched ? <code>{row.patched}</code> : (
        <span className={styles.alarm}>no patched version</span>
      ),
    },
    { label: "Fix released", value: row.fixDate ? date(row.fixDate) : "—" },
    { label: "CVSS", value: row.cvss !== null ? row.cvss.toFixed(1) : "—" },
    {
      label: "Exploit probability (30 days)",
      value: exploitProbability(row.epss),
    },
    {
      label: "Weakness",
      value: row.cwe.length ? (
        <span className={styles.cwes}>
          {row.cwe.map((cwe) => (
            <code key={cwe}>{cwe}</code>
          ))}
        </span>
      ) : (
        "none recorded"
      ),
    },
    { label: "Attack class", value: attackClassLabel(row.attackClass) },
  ];

  return (
    <div className={styles.card}>
      <p className={styles.summary}>{row.summary}</p>

      <p className={styles.gap} data-direction={row.gap === null ? "none" : row.gap < 0 ? "after" : "before"}>
        {gapPhrase(row.gap)}
        {row.outlier ? <span className={styles.flag}>statistical outlier</span> : null}
        {row.aiSpecific ? <span className={styles.flag}>AI-specific</span> : null}
      </p>

      <dl className={styles.fields}>
        {fields.map((field) => (
          <div className={styles.field} key={field.label}>
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </dl>

      <p className={styles.links}>
        <Link to={`/package/${row.package}`}>
          All advisories for {row.package}
        </Link>
        <a
          href={`https://github.com/advisories/${row.id}`}
          target="_blank"
          rel="noreferrer noopener"
        >
          View on GitHub
        </a>
      </p>
    </div>
  );
}
