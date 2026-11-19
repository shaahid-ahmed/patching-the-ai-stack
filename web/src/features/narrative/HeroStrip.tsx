import { useMemo } from "react";

import { chrome, token } from "@/charts/tokens";
import { useChartSize } from "@/charts/useChartSize";
import { useInView } from "@/charts/useInView";
import type { FigureQ3 } from "@/data/types";
import { count } from "@/lib/format";

import styles from "./HeroStrip.module.css";

const LOW = -120;
const HIGH = 240;
const SAME_DAY = 3;

function jitter(id: string, span: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(hash) % 1000) / 1000 - 0.5) * span;
}

/**
 * The thesis as a picture, with no axis furniture: every advisory as a dot,
 * zero marked, the negative tail in the warning hue. It is the same measure the
 * piece spends five sections on, shown once before any argument is made.
 */
export function HeroStrip({ q3 }: { q3: FigureQ3 }) {
  const { ref, width, height, ready } = useChartSize(0.16, 120, 190);
  const { ref: viewRef, inView } = useInView<HTMLDivElement>(0.2);

  const colors = ready ? chrome() : null;
  const before = ready ? token("--color-gap-before") : "";
  const after = ready ? token("--color-gap-after") : "";
  const same = ready ? token("--color-gap-same") : "";

  const scale = useMemo(() => {
    const pad = 8;
    const inner = Math.max(1, width - pad * 2);
    return (value: number) =>
      pad + ((Math.max(LOW, Math.min(HIGH, value)) - LOW) / (HIGH - LOW)) * inner;
  }, [width]);

  const centre = height / 2;

  return (
    <div className={styles.wrap} ref={viewRef}>
      <div ref={ref}>
        {ready ? (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`Each of ${count(q3.points.length)} advisories plotted by how many days its fix shipped before public disclosure. ${count(q3.summary.negative ?? 0)} fall before zero, meaning no fix existed when the advisory was published.`}
          >
            <line
              x1={scale(0)}
              x2={scale(0)}
              y1={8}
              y2={height - 24}
              stroke={colors!.baseline}
              shapeRendering="crispEdges"
            />
            <text
              x={scale(0)}
              y={height - 8}
              textAnchor="middle"
              className="chart-label"
              fill={colors!.textSecondary}
            >
              fix and advisory the same day
            </text>
            {q3.points.map((point, index) => (
              <circle
                key={point.id}
                cx={scale(point.gap)}
                cy={centre + jitter(point.id, height * 0.52)}
                r={3}
                fill={
                  Math.abs(point.gap) <= SAME_DAY
                    ? same
                    : point.gap > 0
                      ? before
                      : after
                }
                opacity={inView ? 0.65 : 0}
                style={{
                  transition: `opacity var(--dur-3) var(--ease-out) ${Math.min(index * 1.1, 420)}ms`,
                }}
              />
            ))}
          </svg>
        ) : (
          <div style={{ height }} />
        )}
      </div>
      <p className={styles.caption}>
        <span className={styles.key}>
          <span className={styles.swatch} style={{ background: after }} />
          {count(q3.summary.negative ?? 0)} published with no fix available
        </span>
        <span className={styles.key}>
          <span className={styles.swatch} style={{ background: before }} />
          {count((q3.summary.n ?? 0) - (q3.summary.negative ?? 0))} patched first
        </span>
      </p>
    </div>
  );
}
