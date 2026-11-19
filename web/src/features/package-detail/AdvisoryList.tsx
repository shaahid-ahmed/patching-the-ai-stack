import { useState } from "react";

import { severityColor } from "@/charts/tokens";
import type { Advisory } from "@/data/types";
import {
  attackClassLabel,
  date as formatDate,
  exploitProbability,
  gapPhrase,
  gapShort,
} from "@/lib/format";

import styles from "./PackageDetail.module.css";

type Row = Advisory & { description: string };

function gapClass(advisory: Row): string {
  if (!advisory.hasFix) return styles.gapNone as string;
  if (advisory.gap === null) return "";
  return (advisory.gap < 0 ? styles.gapAfter : styles.gapBefore) as string;
}

export function AdvisoryList({ advisories }: { advisories: Row[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <ul className={styles.list}>
      {advisories.map((advisory) => {
        const isOpen = open === advisory.id;
        const panelId = `advisory-${advisory.id}`;
        return (
          <li key={advisory.id} className={styles.item}>
            <button
              type="button"
              className={styles.itemButton}
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpen(isOpen ? null : advisory.id)}
            >
              <span
                className={styles.sev}
                style={{ background: severityColor(advisory.severity) }}
                aria-hidden="true"
              />
              <span>
                <span className={styles.itemTitle}>{advisory.summary}</span>
                <span className={styles.itemMeta}>
                  {advisory.cve ?? advisory.id} · {formatDate(advisory.published)} ·{" "}
                  {advisory.severity}
                  {advisory.cvss !== null ? ` · CVSS ${advisory.cvss}` : ""} ·{" "}
                  {attackClassLabel(advisory.attackClass)}
                  {advisory.aiSpecific ? " · AI-specific" : ""}
                </span>
              </span>
              <span className={`${styles.itemGap} ${gapClass(advisory)}`}>
                {advisory.hasFix ? `${gapShort(advisory.gap)} d` : "no fix"}
              </span>
            </button>

            {isOpen ? (
              <div className={styles.panel} id={panelId}>
                <p>{advisory.description}</p>
                <div className={styles.meta}>
                  <span>
                    Affected <code>{advisory.affected}</code>
                  </span>
                  <span>
                    {advisory.patched ? (
                      <>
                        Fixed in <code>{advisory.patched}</code>
                      </>
                    ) : (
                      "No patched version recorded"
                    )}
                  </span>
                  {advisory.fixDate ? (
                    <span>Fix shipped {formatDate(advisory.fixDate)}</span>
                  ) : null}
                  <span>{gapPhrase(advisory.gap)}</span>
                  {advisory.epss !== null ? (
                    <span>Exploit probability {exploitProbability(advisory.epss)}</span>
                  ) : null}
                  {advisory.cwe.length ? <span>{advisory.cwe.join(", ")}</span> : null}
                  {advisory.outlier ? <span>Flagged as a gap outlier</span> : null}
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
