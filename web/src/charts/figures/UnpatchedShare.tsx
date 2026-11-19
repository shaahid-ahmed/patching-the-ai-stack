/** Q5, what share of advisories have no patched version at all.
 *
 * Sixteen stacked percentage bars would make a package with three advisories
 * look as solid as one with ninety. So every row carries its Wilson 95%
 * interval, and the ranking is split: packages with fewer than ten advisories
 * sit below a rule, unranked and in muted ink. That split is what stops a
 * two-of-three package topping the chart at 67%.
 */
import { useMemo, useState } from "react";

import { ChartFrame, type DataTable } from "@/charts/ChartFrame";
import { BottomAxis, ReferenceLine } from "@/charts/primitives";
import { categoryColor, chrome, token } from "@/charts/tokens";
import { useChartSize, useIsNarrow } from "@/charts/useChartSize";
import { useInView } from "@/charts/useInView";
import type { FigureQ5 } from "@/data/types";
import { count, percent } from "@/lib/format";

const RANK_THRESHOLD = 10;
const ROW_HEIGHT = 26;
const HEADING_HEIGHT = 30;
const TOP_PADDING = 18;
const AXIS_HEIGHT = 34;

export function UnpatchedShare({ data }: { data: FigureQ5 }) {
  const { ref, width, ready } = useChartSize(0.6, 300, 560);
  const { ref: viewRef, inView } = useInView<HTMLDivElement>();
  const narrow = useIsNarrow(width);
  const [hovered, setHovered] = useState<string | null>(null);

  const { ranked, unranked } = useMemo(() => {
    const sorted = [...data.by_package].sort(
      (a, b) => (b.estimate ?? 0) - (a.estimate ?? 0),
    );
    return {
      ranked: sorted.filter((row) => row.total >= RANK_THRESHOLD),
      unranked: sorted
        .filter((row) => row.total < RANK_THRESHOLD)
        .sort((a, b) => b.total - a.total),
    };
  }, [data.by_package]);

  const labelWidth = narrow ? 124 : 168;
  const countWidth = 46;
  const margin = { top: TOP_PADDING, right: countWidth + 8, bottom: AXIS_HEIGHT, left: labelWidth };
  const plotWidth = Math.max(60, width - margin.left - margin.right);
  const bodyHeight =
    ranked.length * ROW_HEIGHT + HEADING_HEIGHT + unranked.length * ROW_HEIGHT;
  const height = margin.top + bodyHeight + margin.bottom;

  const xScale = (share: number) => share * plotWidth;

  const colors = ready ? chrome() : null;
  const alarm = ready ? token("--color-unpatched") : "";

  const table: DataTable = {
    caption:
      "Advisories with no patched version, by package, with Wilson 95% intervals.",
    columns: [
      { key: "package", label: "Package" },
      { key: "unpatched", label: "No fix", numeric: true },
      { key: "total", label: "Advisories", numeric: true },
      { key: "share", label: "Share", numeric: true },
      { key: "interval", label: "95% interval", numeric: true },
    ],
    rows: [...ranked, ...unranked].map((row) => ({
      package: row.package,
      unpatched: row.unpatched,
      total: row.total,
      share: percent(row.estimate, 1),
      interval: `${percent(row.low, 0)}–${percent(row.high, 0)}`,
    })),
  };

  const ticks = [0, 0.25, 0.5, 0.75, 1];

  const renderRow = (
    row: FigureQ5["by_package"][number],
    y: number,
    muted: boolean,
  ) => {
    const active = hovered === row.package;
    const fill = muted ? colors!.dim : categoryColor(row.category_id);
    const centre = y + ROW_HEIGHT / 2;
    return (
      <g
        key={row.package}
        onPointerEnter={() => setHovered(row.package)}
        onPointerLeave={() => setHovered(null)}
        opacity={hovered === null || active ? 1 : 0.45}
        style={{ transition: "opacity var(--dur-1) var(--ease-micro)" }}
      >
        <text
          x={-12}
          y={centre}
          dy="0.32em"
          textAnchor="end"
          className="chart-label"
          fill={muted ? colors!.textSecondary : colors!.text}
          style={{ fontFamily: "var(--ff-mono)" }}
        >
          {row.package}
        </text>

        {/* The interval is the finding. The dot alone would invite a ranking
            the sample size does not support. */}
        <line
          x1={xScale(row.low ?? 0)}
          x2={inView ? xScale(row.high ?? 0) : xScale(row.low ?? 0)}
          y1={centre}
          y2={centre}
          stroke={colors!.axis}
          strokeWidth={2}
          strokeLinecap="round"
          style={{ transition: "x2 var(--dur-4) var(--ease-out)" }}
        />
        <line
          x1={xScale(row.low ?? 0)}
          x2={xScale(row.low ?? 0)}
          y1={centre - 4}
          y2={centre + 4}
          stroke={colors!.axis}
          strokeWidth={1.5}
        />
        <line
          x1={xScale(row.high ?? 0)}
          x2={xScale(row.high ?? 0)}
          y1={centre - 4}
          y2={centre + 4}
          stroke={colors!.axis}
          strokeWidth={1.5}
          opacity={inView ? 1 : 0}
          style={{ transition: "opacity var(--dur-4) var(--ease-out)" }}
        />
        <circle
          cx={xScale(row.estimate ?? 0)}
          cy={centre}
          r={active ? 6.5 : 5}
          fill={row.unpatched > 0 && !muted ? alarm : fill}
          stroke={colors!.surface}
          strokeWidth={1.5}
          style={{ transition: "r var(--dur-1) var(--ease-micro)" }}
        >
          <title>
            {`${row.package}: ${row.unpatched} of ${row.total} with no patched version (${percent(
              row.estimate,
              1,
            )}; 95% interval ${percent(row.low, 0)} to ${percent(row.high, 0)})`}
          </title>
        </circle>

        <text
          x={plotWidth + 10}
          y={centre}
          dy="0.32em"
          className="chart-label"
          fill={colors!.textSecondary}
        >
          {`${row.unpatched}/${row.total}`}
        </text>
      </g>
    );
  };

  return (
    <ChartFrame
      title={`${count(data.overall.unpatched)} of ${count(
        data.overall.total,
      )} advisories have no patched version at all`}
      subtitle={`${percent(
        data.overall.estimate,
        1,
      )} of advisory-package rows · dots are the share with no fix, bars are Wilson 95% intervals`}
      note={data.note}
      table={table}
    >
      <div ref={viewRef}>
        {/* The one genuinely alarming number, allowed to be the loudest thing
            on the page, but set in the text column, not in a KPI tile. */}
        <p
          style={{
            margin: "0 0 var(--rhythm)",
            fontFamily: "var(--ff-display)",
            fontSize: "var(--t-number-hero)",
            lineHeight: "var(--lh-number-hero)",
            letterSpacing: "var(--ls-number-hero)",
            color: "var(--color-unpatched)",
            fontVariantNumeric: "lining-nums",
          }}
        >
          {percent(data.overall.estimate, 1)}
        </p>

        <div ref={ref}>
          {ready ? (
            <svg
              width={width}
              height={height}
              role="group"
              aria-label="Share of advisories with no patched version, by package"
            >
              <g transform={`translate(${margin.left},${margin.top})`}>
                <ReferenceLine
                  orientation="vertical"
                  at={xScale(data.overall.estimate ?? 0)}
                  from={-6}
                  to={bodyHeight}
                  color={alarm}
                  label={`all packages ${percent(data.overall.estimate, 0)}`}
                  labelColor={alarm}
                  labelAnchor="middle"
                  dashed
                />

                {ranked.map((row, index) => renderRow(row, index * ROW_HEIGHT, false))}

                <g transform={`translate(0,${ranked.length * ROW_HEIGHT})`}>
                  <line
                    x1={-labelWidth + 8}
                    x2={plotWidth + countWidth}
                    y1={HEADING_HEIGHT / 2 - 4}
                    y2={HEADING_HEIGHT / 2 - 4}
                    stroke={token("--color-rule")}
                    shapeRendering="crispEdges"
                  />
                  <text
                    x={-labelWidth + 8}
                    y={HEADING_HEIGHT - 4}
                    className="chart-label"
                    fill={colors!.textSecondary}
                  >
                    {`fewer than ${RANK_THRESHOLD} advisories, too few to rank`}
                  </text>
                </g>

                {unranked.map((row, index) =>
                  renderRow(
                    row,
                    ranked.length * ROW_HEIGHT + HEADING_HEIGHT + index * ROW_HEIGHT,
                    true,
                  ),
                )}

                <g transform={`translate(0,${bodyHeight})`}>
                  <line
                    x1={0}
                    x2={plotWidth}
                    y1={0}
                    y2={0}
                    stroke={colors!.baseline}
                    shapeRendering="crispEdges"
                  />
                  <BottomAxis
                    color={colors!.axis}
                    ticks={ticks.map((tick) => ({
                      value: tick,
                      offset: xScale(tick),
                      label: tick === 1 ? "100%" : `${Math.round(tick * 100)}`,
                    }))}
                  />
                </g>
              </g>
            </svg>
          ) : (
            <div style={{ height: 420 }} />
          )}
        </div>
      </div>
    </ChartFrame>
  );
}
