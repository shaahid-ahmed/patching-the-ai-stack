import { Link, useLoaderData } from "react-router";

import { categoryColor, severityColor } from "@/charts/tokens";
import { packageNames } from "@/data/client";
import type { PackageDetail as PackageDetailData, Severity } from "@/data/types";
import { attackClassLabel, count, days, month } from "@/lib/format";

import { AdvisoryList } from "./AdvisoryList";
import { GapComparison } from "./GapComparison";
import { PackageTimeline } from "./PackageTimeline";
import styles from "./PackageDetail.module.css";

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number; color: string }[];
}) {
  const peak = rows.reduce((max, row) => Math.max(max, row.value), 1);
  return (
    <div className={styles.breakdown}>
      <h3 className={styles.breakdownTitle}>{title}</h3>
      {rows.map((row) => (
        <div className={styles.barRow} key={row.label}>
          <span className={styles.barLabel}>{row.label}</span>
          <span className={styles.barTrack}>
            <span
              className={styles.barFill}
              style={{
                inlineSize: `${(row.value / peak) * 100}%`,
                background: row.color,
              }}
            />
          </span>
          <span className={styles.barValue}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

export function PackageDetail() {
  const data = useLoaderData() as PackageDetailData;

  const index = packageNames.indexOf(data.package);
  const previous = index > 0 ? packageNames[index - 1] : undefined;
  const next = index >= 0 && index < packageNames.length - 1
    ? packageNames[index + 1]
    : undefined;

  const cadence =
    data.firstRelease && data.latestRelease
      ? (() => {
          const span =
            (Date.parse(data.latestRelease) - Date.parse(data.firstRelease)) /
            (1000 * 60 * 60 * 24 * 365.25);
          return span > 0.25 ? data.counts.releases / span : null;
        })()
      : null;

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header>
          <p className={styles.eyebrow}>{data.categoryLabel}</p>
          <h1 className={styles.name}>{data.package}</h1>
          <p className={styles.blurb}>
            {count(data.counts.advisories)} advisor
            {data.counts.advisories === 1 ? "y" : "ies"} across{" "}
            {count(data.counts.releases)} published releases
            {data.firstRelease ? `, starting ${month(data.firstRelease)}` : ""}.
          </p>

          <p className={styles.facts}>
            <span className={styles.fact}>
              Median gap{" "}
              <strong>
                {data.gap.median === null ? "—" : `${days(data.gap.median)} days`}
              </strong>
            </span>
            {cadence !== null ? (
              <span className={styles.fact}>
                <strong>{days(Math.round(cadence))}</strong> releases a year
              </span>
            ) : null}
            <span className={styles.fact}>
              <strong>{count(data.counts.aiSpecific)}</strong> AI-specific
            </span>
            <span className={`${styles.fact} ${styles.alarm}`}>
              <strong>{count(data.counts.unpatched)}</strong> with no fixed version
            </span>
            {data.gap.negative > 0 ? (
              <span className={`${styles.fact} ${styles.alarm}`}>
                <strong>{count(data.gap.negative)}</strong> published before a fix
                existed
              </span>
            ) : null}
          </p>
        </header>

        <section className={styles.section} aria-labelledby="timeline-heading">
          <h2 className={styles.sectionHead} id="timeline-heading">
            When the releases came, and when the warnings did
          </h2>
          <PackageTimeline data={data} />
        </section>

        <section className={styles.section} aria-labelledby="gap-heading">
          <h2 className={styles.sectionHead} id="gap-heading">
            How this compares with the rest of the stack
          </h2>
          <GapComparison data={data} />
        </section>

        <section className={styles.section} aria-labelledby="breakdown-heading">
          <h2 className={styles.sectionHead} id="breakdown-heading">
            What kind of flaws these were
          </h2>
          <div className={styles.columns}>
            <Breakdown
              title="By severity"
              rows={SEVERITY_ORDER.filter((s) => (data.severity[s] ?? 0) > 0).map(
                (severity) => ({
                  label: severity,
                  value: data.severity[severity] ?? 0,
                  color: severityColor(severity),
                }),
              )}
            />
            <Breakdown
              title="By attack class"
              rows={data.attackClasses.map((entry) => ({
                label: attackClassLabel(entry.id),
                value: entry.count,
                color: categoryColor(data.category),
              }))}
            />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="advisories-heading">
          <h2 className={styles.sectionHead} id="advisories-heading">
            Every advisory, newest first
          </h2>
          <AdvisoryList advisories={data.advisories} />
        </section>

        <nav className={styles.pager} aria-label="Other packages">
          {previous ? (
            <Link to={`/package/${previous}`}>
              ← <code>{previous}</code>
            </Link>
          ) : (
            <span />
          )}
          <Link to="/explore">All advisories</Link>
          {next ? (
            <Link to={`/package/${next}`}>
              <code>{next}</code> →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </div>
    </div>
  );
}
