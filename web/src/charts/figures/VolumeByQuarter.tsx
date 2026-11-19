/** Q1, advisories per quarter.
 *
 * The honest problem here is the final quarter: collection stopped partway
 * through it, so a solid short column would read as a collapse that did not
 * happen. The observed count is drawn hatched, and an open outline extends to
 * the pro-rata projection, clearly marked as an estimate.
 */
import { useId, useMemo, useState } from "react";

import { ChartFrame, type DataTable } from "@/charts/ChartFrame";
import {
  BottomAxis,
  HatchPattern,
  HorizontalGrid,
  LeftAxis,
  MARGIN,
  narrowMargin,
  niceTicks,
} from "@/charts/primitives";
import { categoryColor, chrome, token } from "@/charts/tokens";
import { useChartSize, useIsNarrow } from "@/charts/useChartSize";
import { useInView } from "@/charts/useInView";
import type { FigureQ1 } from "@/data/types";
import { count } from "@/lib/format";

export function VolumeByQuarter({ data }: { data: FigureQ1 }) {
  const { ref, width, height, ready } = useChartSize(0.48, 260, 420);
  const { ref: viewRef, inView } = useInView<HTMLDivElement>();
  const narrow = useIsNarrow(width);
  const hatchId = useId();
  const [hovered, setHovered] = useState<string | null>(null);

  const categories = data.categories;
  const margin = narrow ? narrowMargin(32) : MARGIN;
  const plotWidth = Math.max(0, width - margin.left - margin.right);
  const plotHeight = Math.max(0, height - margin.top - margin.bottom);

  const { bars, yTicks, yScale } = useMemo(() => {
    const quarters = data.quarters;
    const peak = Math.max(
      ...quarters.map((q) => Math.max(q.total, q.projected_total ?? 0)),
    );
    const upper = Math.ceil((peak * 1.12) / 10) * 10;
    const scale = (value: number) => plotHeight - (value / upper) * plotHeight;
    const step = plotWidth / Math.max(1, quarters.length);
    const barWidth = Math.min(narrow ? 10 : 24, step * 0.62);

    return {
      yScale: scale,
      yTicks: niceTicks(0, upper, narrow ? 3 : 5),
      bars: quarters.map((quarter, index) => {
        // Stack from the oldest category upward, so the band that was there in
        // 2023 stays at the bottom and the newer ones visibly pile on top.
        let cursor = 0;
        const segments = categories.map((category) => {
          const value = quarter.by_category[category.id] ?? 0;
          const segment = {
            id: category.id,
            label: category.label,
            value,
            y0: cursor,
            y1: cursor + value,
          };
          cursor += value;
          return segment;
        });
        return {
          ...quarter,
          segments,
          x: index * step + step / 2,
          barWidth,
        };
      }),
    };
  }, [data.quarters, categories, plotWidth, plotHeight, narrow]);

  const colors = ready ? chrome() : null;
  const seriesColor = ready ? token("--color-accent") : "";

  const peakQuarter = useMemo(
    () => data.quarters.reduce((a, b) => (b.total > a.total ? b : a), data.quarters[0]!),
    [data.quarters],
  );

  const table: DataTable = {
    caption: "Advisory-package rows published per quarter.",
    columns: [
      { key: "quarter", label: "Quarter" },
      { key: "total", label: "Advisories", numeric: true },
      { key: "coverage", label: "Quarter observed", numeric: true },
    ],
    rows: data.quarters.map((q) => ({
      quarter: q.label,
      total: q.total,
      coverage: q.partial ? `${Math.round(q.coverage * 100)}%` : "complete",
    })),
  };

  const growth = data.growth;

  return (
    <ChartFrame
      title={
        growth.multiple
          ? `Advisories against these libraries have multiplied ${growth.multiple}× since ${growth.from_quarter?.slice(0, 4)}`
          : "Advisories against these libraries are rising"
      }
      subtitle={`Advisory-package rows per quarter · ${count(
        data.quarters.reduce((sum, q) => sum + q.total, 0),
      )} rows across ${data.categories.length} categories`}
      note={data.note}
      table={table}
    >
      <div ref={viewRef}>
        <ul className="chart-key">
          {categories.map((category) => (
            <li key={category.id}>
              <span
                className="chart-key-swatch"
                style={{ background: ready ? categoryColor(category.id) : "transparent" }}
              />
              {category.label}
            </li>
          ))}
          <li>
            <span className="chart-key-swatch chart-key-swatch--hatched" />
            partial quarter
          </li>
        </ul>
        <div ref={ref}>
          {ready ? (
            <svg
              width={width}
              height={height}
              role="group"
              aria-label="Advisories published per quarter, 2023 to 2026"
            >
              <defs>
                <HatchPattern id={hatchId} color={seriesColor} />
              </defs>
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
                    label: count(t),
                  }))}
                  color={colors!.axis}
                />

                {bars.map((bar) => {
                  const barTop = yScale(bar.total);
                  const projectedTop =
                    bar.projected_total !== null ? yScale(bar.projected_total) : null;
                  const active = hovered === bar.quarter;
                  return (
                    <g
                      key={bar.quarter}
                      onPointerEnter={() => setHovered(bar.quarter)}
                      onPointerLeave={() => setHovered(null)}
                    >
                      {/* The estimate, drawn as an open outline so it reads as
                          a boundary rather than a measured value. */}
                      {projectedTop !== null ? (
                        <path
                          d={`M ${bar.x - bar.barWidth / 2} ${barTop}
                              L ${bar.x - bar.barWidth / 2} ${projectedTop}
                              L ${bar.x + bar.barWidth / 2} ${projectedTop}
                              L ${bar.x + bar.barWidth / 2} ${barTop}`}
                          fill="none"
                          stroke={seriesColor}
                          strokeWidth={1}
                          strokeDasharray="3 2"
                        />
                      ) : null}
                      {bar.segments.map((segment) =>
                        segment.value > 0 ? (
                          <rect
                            key={segment.id}
                            x={bar.x - bar.barWidth / 2}
                            y={inView ? yScale(segment.y1) : plotHeight}
                            width={bar.barWidth}
                            height={
                              inView ? yScale(segment.y0) - yScale(segment.y1) : 0
                            }
                            fill={
                              bar.partial
                                ? `url(#${hatchId})`
                                : categoryColor(segment.id)
                            }
                            stroke={
                              bar.partial ? seriesColor : colors!.surface
                            }
                            strokeWidth={bar.partial ? 1 : 0.5}
                            opacity={hovered === null || active ? 1 : 0.35}
                            style={{
                              transition: `y var(--dur-4) var(--ease-out), height var(--dur-4) var(--ease-out), opacity var(--dur-1) var(--ease-micro)`,
                            }}
                          >
                            <title>
                              {`${bar.label} · ${segment.label}: ${count(segment.value)}`}
                            </title>
                          </rect>
                        ) : null,
                      )}
                      {!narrow && (bar.quarter === peakQuarter.quarter || bar.partial) ? (
                        <text
                          x={bar.x}
                          y={(projectedTop ?? barTop) - 8}
                          textAnchor="middle"
                          className="chart-label"
                          fill={colors!.textSecondary}
                        >
                          {count(bar.total)}
                        </text>
                      ) : null}
                    </g>
                  );
                })}

                <line
                  x1={0}
                  x2={plotWidth}
                  y1={plotHeight}
                  y2={plotHeight}
                  stroke={colors!.baseline}
                  shapeRendering="crispEdges"
                />
                <g transform={`translate(0,${plotHeight})`}>
                  <BottomAxis
                    color={colors!.axis}
                    ticks={bars
                      .filter((bar) => bar.quarter.endsWith("Q1"))
                      .map((bar) => ({
                        value: bar.quarter,
                        offset: bar.x,
                        label: bar.quarter.slice(0, 4),
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
