/** Q3, second panel, has the gap moved?
 *
 * Half-years rather than quarters, because several quarters hold too few
 * measurable gaps to support a median anyone should read. The n for each
 * period is printed under its tick for the same reason: a median of four
 * observations should not look like a median of ninety.
 */
import { useMemo } from "react";

import { ChartFrame, type DataTable } from "@/charts/ChartFrame";
import {
  BottomAxis,
  HorizontalGrid,
  LeftAxis,
  MARGIN,
  narrowMargin,
  niceTicks,
  ReferenceLine,
} from "@/charts/primitives";
import { chrome, token } from "@/charts/tokens";
import { useChartSize, useIsNarrow } from "@/charts/useChartSize";
import { useInView } from "@/charts/useInView";
import type { FigureQ3 } from "@/data/types";
import { count, days, NO_VALUE } from "@/lib/format";

export function GapOverTime({ data }: { data: FigureQ3 }) {
  const { ref, width, height, ready } = useChartSize(0.44, 240, 360);
  const { ref: viewRef, inView } = useInView<HTMLDivElement>();
  const narrow = useIsNarrow(width);

  const margin = narrow ? narrowMargin(34) : MARGIN;
  const plotWidth = Math.max(0, width - margin.left - margin.right);
  const plotHeight = Math.max(0, height - margin.top - margin.bottom);

  const periods = data.by_half_year;

  const { points, yScale, yTicks, ribbon } = useMemo(() => {
    const highs = periods.map((p) => p.box.q3 ?? 0);
    const lows = periods.map((p) => p.box.q1 ?? 0);
    const upper = Math.ceil(Math.max(...highs, 1) / 10) * 10;
    const lower = Math.min(0, Math.floor(Math.min(...lows) / 10) * 10);
    const scale = (value: number) =>
      plotHeight - ((value - lower) / (upper - lower)) * plotHeight;
    // Keep the end points off the plot boundaries: a centred label on a point
    // at x=0 runs back under the y-axis ticks, and a marker on the right edge
    // is clipped by it.
    const inset = Math.min(46, plotWidth * 0.07);
    const usable = Math.max(1, plotWidth - inset * 2);
    const step = periods.length > 1 ? usable / (periods.length - 1) : 0;

    const pts = periods.map((period, index) => ({
      ...period,
      x: periods.length > 1 ? inset + index * step : plotWidth / 2,
      y: scale(period.box.median ?? 0),
      yLow: scale(period.box.q1 ?? 0),
      yHigh: scale(period.box.q3 ?? 0),
    }));

    const area =
      pts.length > 0
        ? `M ${pts.map((p) => `${p.x} ${p.yHigh}`).join(" L ")} L ${pts
            .slice()
            .reverse()
            .map((p) => `${p.x} ${p.yLow}`)
            .join(" L ")} Z`
        : "";

    return {
      points: pts,
      yScale: scale,
      yTicks: niceTicks(lower, upper, narrow ? 4 : 5),
      ribbon: area,
    };
  }, [periods, plotWidth, plotHeight, narrow]);

  const colors = ready ? chrome() : null;
  const accent = ready ? token("--color-accent") : "";

  const table: DataTable = {
    caption: "Median gap between fix and disclosure, by half-year.",
    columns: [
      { key: "label", label: "Period" },
      { key: "n", label: "Advisories", numeric: true },
      { key: "median", label: "Median days", numeric: true },
      { key: "q1", label: "25th", numeric: true },
      { key: "q3", label: "75th", numeric: true },
    ],
    rows: periods.map((p) => ({
      label: p.label,
      n: p.box.n,
      median: p.box.median !== undefined ? days(p.box.median) : NO_VALUE,
      q1: p.box.q1 !== undefined ? days(p.box.q1) : NO_VALUE,
      q3: p.box.q3 !== undefined ? days(p.box.q3) : NO_VALUE,
    })),
  };

  const line =
    points.length > 0 ? `M ${points.map((p) => `${p.x} ${p.y}`).join(" L ")}` : "";

  // Eight half-year labels cannot fit at phone widths without colliding, so
  // narrow screens get one label per year. The markers all stay; only the
  // labels thin out.
  const labelled = narrow
    ? points.filter((point) => point.period.endsWith("H1"))
    : points;

  return (
    <ChartFrame
      title="The head start is not getting longer. It swings"
      subtitle="Median days between the fixed release and disclosure, by half-year · shaded band is the interquartile range"
      note="Periods with fewer than five measurable gaps are omitted. The sample size behind each point is printed beneath it, because a median of a dozen advisories should not be read like a median of ninety."
      table={table}
    >
      <div ref={viewRef}>
        <div ref={ref}>
          {ready ? (
            <svg
              width={width}
              height={height}
              role="group"
              aria-label="Median fix-to-disclosure gap by half-year"
            >
              <g transform={`translate(${margin.left},${margin.top})`}>
                <HorizontalGrid
                  ticks={yTicks}
                  scale={yScale}
                  x0={0}
                  x1={plotWidth}
                  color={colors!.grid}
                />
                <LeftAxis
                  ticks={yTicks.map((t) => ({
                    value: t,
                    offset: yScale(t),
                    label: days(t),
                  }))}
                  color={colors!.axis}
                />

                <path d={ribbon} fill={accent} opacity={inView ? 0.12 : 0} style={{ transition: "opacity var(--dur-4) var(--ease-out)" }} />
                <path
                  d={line}
                  fill="none"
                  stroke={accent}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  opacity={inView ? 1 : 0}
                  style={{ transition: "opacity var(--dur-4) var(--ease-out)" }}
                />

                <ReferenceLine
                  orientation="horizontal"
                  at={yScale(0)}
                  from={0}
                  to={plotWidth}
                  color={colors!.baseline}
                />

                {points.map((point) => (
                  <g key={point.period}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={4}
                      fill={colors!.surface}
                      stroke={accent}
                      strokeWidth={2}
                      opacity={inView ? 1 : 0}
                      style={{ transition: "opacity var(--dur-4) var(--ease-out)" }}
                    >
                      <title>{`${point.label}: median ${days(point.box.median ?? 0)} days, n = ${point.box.n}`}</title>
                    </circle>
                  </g>
                ))}

                <g transform={`translate(0,${plotHeight})`}>
                  <BottomAxis
                    color={colors!.axis}
                    ticks={labelled.map((point) => ({
                      value: point.period,
                      offset: point.x,
                      label: narrow ? point.period.slice(0, 4) : point.label,
                    }))}
                  />
                  <BottomAxis
                    color={colors!.textSecondary}
                    gap={30}
                    ticks={labelled.map((point) => ({
                      value: `${point.period}-n`,
                      offset: point.x,
                      label: `n=${count(point.box.n)}`,
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
