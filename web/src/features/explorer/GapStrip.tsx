/** The current result set, drawn on the gap axis.
 *
 * This sits above the table so that filtering reads as a change of shape
 * rather than only a change of row count — a reader who ticks "Serving and web
 * tools" should *see* the cloud slide toward zero, not have to compare two
 * numbers. The table is never the primary visual.
 */
import { useEffect, useMemo, useRef, useState } from "react";

import type { Advisory } from "@/data/types";
import { count, gapPhrase } from "@/lib/format";

import styles from "./GapStrip.module.css";

const DOMAIN_LOW = -90;
const DOMAIN_HIGH = 180;
const SAME_DAY = 3;
const HEIGHT = 108;
const PAD = 28;

/** Same hashing idea as the narrative figure: one advisory always lands in the
 *  same spot, so a shared link shows the sender's exact picture. */
function jitter(id: string, span: number): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) | 0;
  }
  return ((Math.abs(hash) % 1000) / 1000 - 0.5) * span;
}

interface Props {
  rows: Advisory[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}

export function GapStrip({ rows, selected, onSelect }: Props) {
  const wrap = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);

  // A ResizeObserver would be overkill for a strip that only needs to be
  // roughly right; the container is measured on mount and on window resize.
  useEffect(() => {
    const measure = () => setWidth(wrap.current?.clientWidth ?? 0);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const { withGap, noFix, trulyUnpatched } = useMemo(
    () => ({
      withGap: rows.filter((row) => row.gap !== null),
      noFix: rows.filter((row) => row.gap === null),
      trulyUnpatched: rows.filter((row) => !row.hasFix).length,
    }),
    [rows],
  );

  const noFixWidth = noFix.length ? 46 : 0;
  const plotWidth = Math.max(0, width - PAD * 2 - noFixWidth);
  const centre = HEIGHT / 2;

  const scale = (value: number) => {
    const clamped = Math.max(DOMAIN_LOW, Math.min(DOMAIN_HIGH, value));
    return ((clamped - DOMAIN_LOW) / (DOMAIN_HIGH - DOMAIN_LOW)) * plotWidth;
  };

  const active = hovered ?? selected;
  const activeRow = active ? rows.find((row) => row.id === active) ?? null : null;

  return (
    <div className={styles.wrap} ref={wrap}>
      {width > 0 ? (
        <svg
          width={width}
          height={HEIGHT}
          className={styles.svg}
          role="img"
          aria-label={`${count(withGap.length)} advisories plotted by the gap between fix and disclosure`}
        >
          <g transform={`translate(${PAD},0)`}>
            <line
              x1={scale(0)}
              x2={scale(0)}
              y1={14}
              y2={HEIGHT - 22}
              className={styles.zero}
            />
            <text x={scale(0)} y={10} className={styles.zeroLabel} textAnchor="middle">
              same day
            </text>

            {withGap.map((row) => {
              const gap = row.gap as number;
              const tone =
                Math.abs(gap) <= SAME_DAY ? "same" : gap > 0 ? "before" : "after";
              const isActive = active === row.id;
              return (
                <circle
                  key={row.id}
                  cx={scale(gap)}
                  cy={centre + jitter(row.id, HEIGHT * 0.46)}
                  r={isActive ? 5 : 3}
                  className={`${styles.dot} ${styles[tone]}`}
                  data-dim={active !== null && !isActive ? "true" : undefined}
                  onPointerEnter={() => setHovered(row.id)}
                  onPointerLeave={() => setHovered(null)}
                  onClick={() => onSelect(selected === row.id ? null : row.id)}
                >
                  <title>{`${row.package} — ${gapPhrase(row.gap)}`}</title>
                </circle>
              );
            })}

            <text
              x={0}
              y={HEIGHT - 6}
              className={styles.axisLabel}
              textAnchor="start"
            >
              warned first
            </text>
            <text
              x={plotWidth}
              y={HEIGHT - 6}
              className={styles.axisLabel}
              textAnchor="end"
            >
              fixed first
            </text>

            {noFix.length ? (
              <g transform={`translate(${plotWidth + 14},0)`}>
                <rect
                  x={0}
                  y={18}
                  width={noFixWidth - 14}
                  height={HEIGHT - 48}
                  className={styles.noFix}
                >
                  <title>
                    {`${count(noFix.length)} rows have no gap to plot: ${count(trulyUnpatched)} with no patched version at all, and ${count(noFix.length - trulyUnpatched)} whose fixed version could not be matched to a release.`}
                  </title>
                </rect>
                <text
                  x={(noFixWidth - 14) / 2}
                  y={14}
                  className={styles.noFixLabel}
                  textAnchor="middle"
                >
                  no gap
                </text>
                <text
                  x={(noFixWidth - 14) / 2}
                  y={HEIGHT - 20}
                  className={styles.noFixLabel}
                  textAnchor="middle"
                >
                  {count(noFix.length)}
                </text>
              </g>
            ) : null}
          </g>
        </svg>
      ) : (
        <div style={{ height: HEIGHT }} />
      )}

      <p className={styles.readout} aria-live="polite">
        {activeRow ? (
          <>
            <code>{activeRow.package}</code> — {gapPhrase(activeRow.gap)}
            <span className={styles.readoutSummary}>{activeRow.summary}</span>
          </>
        ) : (
          <span className={styles.readoutHint}>
            Each dot is one advisory. Hover to identify, click to open.
          </span>
        )}
      </p>
    </div>
  );
}
