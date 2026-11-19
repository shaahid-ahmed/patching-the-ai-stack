/** Q3 — the gap between a fix shipping and the advisory going public.
 *
 * Three honesty devices, all of them load-bearing:
 *
 *  1. The axis is clamped to a readable window, and everything beyond either
 *     bound collects into an end stub separated by a gap, labelled with its
 *     count. Nothing is hidden and no reader is asked to judge distance on a
 *     log axis.
 *  2. The 60 advisories with no fix at all have no gap to plot. They get a
 *     detached hatched block past the right stub rather than being dropped,
 *     because excluding them silently would flatter every median on the page.
 *  3. Outliers stay in. The caption reports the median with and without them.
 */
import { useId, useMemo, useState } from "react";

import { ChartFrame, type DataTable } from "@/charts/ChartFrame";
import {
  BottomAxis,
  HatchPattern,
  MARGIN,
  narrowMargin,
  niceTicks,
  ReferenceLine,
} from "@/charts/primitives";
import { chrome, token } from "@/charts/tokens";
import { useChartSize, useIsNarrow } from "@/charts/useChartSize";
import { useInView } from "@/charts/useInView";
import type { FigureQ3 } from "@/data/types";
import { count, days, gapPhrase } from "@/lib/format";

const DOMAIN_LOW = -120;
const DOMAIN_HIGH = 240;
const STUB = 26;
const STUB_GAP = 12;
const SAME_DAY_WINDOW = 3;

/** Deterministic jitter: the same advisory sits in the same place on every
 *  render and on every reader's screen, so a shared link matches. */
function jitter(id: string, span: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return ((Math.abs(hash) % 1000) / 1000 - 0.5) * span;
}

export function GapDistribution({ data }: { data: FigureQ3 }) {
  const { ref, width, height, ready } = useChartSize(0.42, 250, 360);
  const { ref: viewRef, inView } = useInView<HTMLDivElement>();
  const narrow = useIsNarrow(width);
  const hatchId = useId();
  const [hovered, setHovered] = useState<string | null>(null);

  const margin = narrow ? narrowMargin(16) : { ...MARGIN, left: 16, right: 16 };
  const noFixWidth = 54;
  const plotWidth = Math.max(
    0,
    width - margin.left - margin.right - noFixWidth - STUB_GAP,
  );
  const plotHeight = Math.max(0, height - margin.top - margin.bottom);

  const geometry = useMemo(() => {
    const inner = plotWidth - 2 * (STUB + STUB_GAP);
    const span = DOMAIN_HIGH - DOMAIN_LOW;
    const scale = (value: number) => {
      if (value < DOMAIN_LOW) return STUB / 2;
      if (value > DOMAIN_HIGH) return plotWidth - STUB / 2;
      return STUB + STUB_GAP + ((value - DOMAIN_LOW) / span) * inner;
    };
    return { scale, inner };
  }, [plotWidth]);

  const { points, lowOverflow, highOverflow } = useMemo(() => {
    const low = data.points.filter((p) => p.gap < DOMAIN_LOW);
    const high = data.points.filter((p) => p.gap > DOMAIN_HIGH);
    return { points: data.points, lowOverflow: low, highOverflow: high };
  }, [data.points]);

  const colors = ready ? chrome() : null;
  const before = ready ? token("--color-gap-before") : "";
  const after = ready ? token("--color-gap-after") : "";
  const same = ready ? token("--color-gap-same") : "";
  const unpatched = ready ? token("--color-unpatched") : "";

  const bandTop = plotHeight * 0.18;
  const bandHeight = plotHeight * 0.64;
  const centre = bandTop + bandHeight / 2;

  const summary = data.summary;
  const noOutliers = data.summary_excluding_outliers;
  const measurable = data.coverage.gap_measurable;

  const table: DataTable = {
    caption:
      "Gap between a fix shipping on PyPI and the advisory being published, by package category.",
    columns: [
      { key: "label", label: "Category" },
      { key: "n", label: "With a measurable gap", numeric: true },
      { key: "median", label: "Median days", numeric: true },
      { key: "q1", label: "25th percentile", numeric: true },
      { key: "q3", label: "75th percentile", numeric: true },
      { key: "noFix", label: "No fix at all", numeric: true },
    ],
    rows: data.by_category.map((row) => ({
      label: row.label,
      n: row.box.n,
      median: row.box.median !== undefined ? days(row.box.median) : "—",
      q1: row.box.q1 !== undefined ? days(row.box.q1) : "—",
      q3: row.box.q3 !== undefined ? days(row.box.q3) : "—",
      noFix: row.no_fix,
    })),
  };

  const ticks = niceTicks(DOMAIN_LOW, DOMAIN_HIGH, narrow ? 4 : 6).filter(
    (t) => t >= DOMAIN_LOW && t <= DOMAIN_HIGH,
  );

  return (
    <ChartFrame
      title={`The fix usually ships before the warning — by a median of ${days(
        summary.median ?? 0,
      )} days`}
      subtitle={`One dot per advisory · days between the fixed release and public disclosure · n = ${count(
        measurable,
      )} with a measurable gap, ${count(data.coverage.no_fix)} with no fix at all`}
      note={`${count(data.coverage.outliers)} outliers are kept, several of them back-filled records where a release long predates the advisory system. Excluding them moves the median only to ${days(
        noOutliers.median ?? 0,
      )} days. An advisory's publication date is not the date the flaw was found, so this measures exposure after a fix existed, not time to fix.`}
      table={table}
    >
      <div ref={viewRef}>
        <div ref={ref}>
          {ready ? (
            <svg
              width={width}
              height={height}
              role="group"
              aria-label="Distribution of the gap between fix and disclosure"
            >
              <defs>
                <HatchPattern id={hatchId} color={unpatched} />
              </defs>
              <g transform={`translate(${margin.left},${margin.top})`}>
                {/* Interquartile band, drawn behind the dots as context. */}
                {data.box.q1 !== undefined && data.box.q3 !== undefined ? (
                  <rect
                    x={geometry.scale(data.box.q1)}
                    y={bandTop}
                    width={geometry.scale(data.box.q3) - geometry.scale(data.box.q1)}
                    height={bandHeight}
                    fill={colors!.surface}
                    stroke={colors!.grid}
                  />
                ) : null}

                <ReferenceLine
                  orientation="vertical"
                  at={geometry.scale(0)}
                  from={bandTop - 10}
                  to={bandTop + bandHeight + 10}
                  color={colors!.baseline}
                  label={narrow ? "same day" : "fix and advisory the same day"}
                  labelColor={colors!.textSecondary}
                  labelAnchor="middle"
                />

                {points.map((point, index) => {
                  const clamped = Math.max(
                    DOMAIN_LOW - 1,
                    Math.min(DOMAIN_HIGH + 1, point.gap),
                  );
                  const fill =
                    Math.abs(point.gap) <= SAME_DAY_WINDOW
                      ? same
                      : point.gap > 0
                        ? before
                        : after;
                  const active = hovered === point.id;
                  return (
                    <circle
                      key={point.id}
                      cx={geometry.scale(clamped)}
                      cy={centre + jitter(point.id, bandHeight * 0.82)}
                      r={active ? 5.5 : 3.5}
                      fill={fill}
                      stroke={colors!.surface}
                      strokeWidth={1}
                      opacity={inView ? (hovered === null || active ? 0.72 : 0.18) : 0}
                      style={{
                        transition: `opacity var(--dur-2) var(--ease-out) ${Math.min(
                          index * 1.2,
                          300,
                        )}ms, r var(--dur-1) var(--ease-micro)`,
                      }}
                      onPointerEnter={() => setHovered(point.id)}
                      onPointerLeave={() => setHovered(null)}
                    >
                      <title>{`${point.package} — ${gapPhrase(point.gap)}`}</title>
                    </circle>
                  );
                })}

                {/* Overflow stubs: every row stays on screen, with its count
                    readable, without compressing the axis. */}
                {[
                  { side: "low" as const, rows: lowOverflow, x: 0 },
                  { side: "high" as const, rows: highOverflow, x: plotWidth - STUB },
                ].map(({ side, rows, x }) =>
                  rows.length ? (
                    <g key={side}>
                      <rect
                        x={x}
                        y={bandTop}
                        width={STUB}
                        height={bandHeight}
                        fill={colors!.surface}
                        stroke={colors!.grid}
                        strokeDasharray="2 2"
                      />
                      <text
                        x={x + STUB / 2}
                        y={bandTop + bandHeight + 15}
                        textAnchor="middle"
                        className="chart-label"
                        fill={colors!.textSecondary}
                      >
                        {rows.length}
                      </text>
                      <text
                        x={x + STUB / 2}
                        y={bandTop - 8}
                        textAnchor="middle"
                        className="chart-label"
                        fill={colors!.textSecondary}
                      >
                        {side === "low" ? `<${DOMAIN_LOW}` : `>${DOMAIN_HIGH}`}
                      </text>
                    </g>
                  ) : null,
                )}

                {/* The rows that have no gap because they have no fix. */}
                <g transform={`translate(${plotWidth + STUB_GAP},0)`}>
                  <rect
                    x={0}
                    y={bandTop}
                    width={noFixWidth}
                    height={bandHeight}
                    fill={`url(#${hatchId})`}
                    stroke={unpatched}
                  />
                  <text
                    x={noFixWidth / 2}
                    y={bandTop - 8}
                    textAnchor="middle"
                    className="chart-label"
                    fill={unpatched}
                  >
                    no fix
                  </text>
                  <text
                    x={noFixWidth / 2}
                    y={bandTop + bandHeight + 15}
                    textAnchor="middle"
                    className="chart-label"
                    fill={unpatched}
                  >
                    {count(data.coverage.no_fix)}
                  </text>
                </g>

                <g transform={`translate(0,${plotHeight})`}>
                  <BottomAxis
                    color={colors!.axis}
                    ticks={ticks.map((tick) => ({
                      value: tick,
                      offset: geometry.scale(tick),
                      label: tick > 0 ? `+${tick}` : String(tick),
                    }))}
                  />
                </g>
              </g>
            </svg>
          ) : (
            <div style={{ height }} />
          )}
        </div>
      </div>
    </ChartFrame>
  );
}
