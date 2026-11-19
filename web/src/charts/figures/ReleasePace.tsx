/** Q4 — do libraries that release more often patch faster?
 *
 * The honest answer is that it looks that way and sixteen packages cannot
 * prove it. So no fitted line is drawn. In its place the chart shows two
 * hundred bootstrap resamples of the same relationship: where they fan out,
 * the slope is not knowable from this sample, and a reader can see that
 * directly instead of being asked to trust a caption.
 *
 * Colour carries nothing here. Four category hues across sixteen scattered
 * points cannot clear the colour-blindness floors, and the package name is a
 * better label than a swatch, so every point is labelled directly.
 */
import { useMemo, useState } from "react";

import { ChartFrame, type DataTable } from "@/charts/ChartFrame";
import {
  BottomAxis,
  HorizontalGrid,
  LeftAxis,
  MARGIN,
  niceTicks,
  ReferenceLine,
} from "@/charts/primitives";
import { chrome, token } from "@/charts/tokens";
import { useChartSize, useIsNarrow } from "@/charts/useChartSize";
import { useInView } from "@/charts/useInView";
import type { FigureQ4 } from "@/data/types";
import { count, days, spell } from "@/lib/format";

type SortKey = "package" | "releases_per_year" | "median_gap";

interface Placed {
  x: number;
  y: number;
  r: number;
  label: string;
  labelX: number;
  labelY: number;
  anchor: "start" | "end";
  package: string;
  releases: number;
  gap: number;
  advisories: number;
}

const LABEL_HEIGHT = 13;
const CHAR_WIDTH = 6.1;

export function ReleasePace({ data }: { data: FigureQ4 }) {
  const { ref, width, height, ready } = useChartSize(0.62, 300, 460);
  const { ref: viewRef, inView } = useInView<HTMLDivElement>();
  const narrow = useIsNarrow(width);
  const [hovered, setHovered] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("releases_per_year");
  const [ascending, setAscending] = useState(false);

  const plotted = useMemo(
    () => data.packages.filter((p) => p.median_gap !== null),
    [data.packages],
  );
  const omitted = data.packages.length - plotted.length;

  const margin = { ...MARGIN, left: 52, right: 28, top: 24 };
  const plotWidth = Math.max(0, width - margin.left - margin.right);
  const plotHeight = Math.max(0, height - margin.top - margin.bottom);

  const geometry = useMemo(() => {
    const xs = plotted.map((p) => p.releases_per_year);
    const ys = plotted.map((p) => p.median_gap as number);
    const xMax = Math.max(10, ...xs) * 1.08;
    // Pad below the lowest point so a package with a negative median gap does
    // not sit on the axis line with its label struck through by it.
    const lowest = Math.min(0, ...ys);
    const yMin = lowest < 0 ? lowest - Math.max(6, Math.abs(lowest) * 0.25) : 0;
    const yMax = Math.max(10, ...ys) * 1.1;
    const maxAdvisories = Math.max(1, ...plotted.map((p) => p.advisories));

    const xScale = (value: number) => (value / xMax) * plotWidth;
    const yScale = (value: number) =>
      plotHeight - ((value - yMin) / (yMax - yMin)) * plotHeight;
    // Area-proportional: a package with four times the advisories gets four
    // times the ink, not four times the radius.
    const rScale = (value: number) =>
      5 + 13 * Math.sqrt(value / maxAdvisories);

    return { xScale, yScale, rScale, xMax, yMin, yMax };
  }, [plotted, plotWidth, plotHeight]);

  /** Greedy label placement: try right, then left, then above, then below,
   *  and take the first position that clears everything already placed. */
  const placed = useMemo<Placed[]>(() => {
    if (!ready) return [];
    const boxes: { x0: number; y0: number; x1: number; y1: number }[] = [];
    const overlaps = (box: { x0: number; y0: number; x1: number; y1: number }) =>
      boxes.some(
        (other) =>
          box.x0 < other.x1 &&
          box.x1 > other.x0 &&
          box.y0 < other.y1 &&
          box.y1 > other.y0,
      );

    const ordered = [...plotted].sort((a, b) => b.advisories - a.advisories);
    const result: Placed[] = [];

    for (const item of ordered) {
      const x = geometry.xScale(item.releases_per_year);
      const y = geometry.yScale(item.median_gap as number);
      const r = geometry.rScale(item.advisories);
      const textWidth = item.package.length * CHAR_WIDTH;

      const candidates: { dx: number; dy: number; anchor: "start" | "end" }[] = [
        { dx: r + 5, dy: 4, anchor: "start" },
        { dx: -(r + 5), dy: 4, anchor: "end" },
        { dx: 0, dy: -(r + 7), anchor: "start" },
        { dx: 0, dy: r + 14, anchor: "start" },
        { dx: r + 5, dy: -8, anchor: "start" },
        { dx: -(r + 5), dy: -8, anchor: "end" },
      ];

      let chosen = candidates[0]!;
      for (const candidate of candidates) {
        const labelX = x + candidate.dx;
        const x0 = candidate.anchor === "start" ? labelX : labelX - textWidth;
        const box = {
          x0,
          y0: y + candidate.dy - LABEL_HEIGHT,
          x1: x0 + textWidth,
          y1: y + candidate.dy,
        };
        if (box.x0 < -margin.left + 2 || box.x1 > plotWidth + margin.right - 2) {
          continue;
        }
        if (!overlaps(box)) {
          chosen = candidate;
          boxes.push(box);
          break;
        }
      }

      result.push({
        x,
        y,
        r,
        label: item.package,
        labelX: x + chosen.dx,
        labelY: y + chosen.dy,
        anchor: chosen.anchor,
        package: item.package,
        releases: item.releases_per_year,
        gap: item.median_gap as number,
        advisories: item.advisories,
      });
    }
    return result;
  }, [plotted, geometry, ready, plotWidth, margin.left, margin.right]);

  const colors = ready ? chrome() : null;
  const markColor = ready ? token("--color-accent") : "";

  const sorted = useMemo(() => {
    const rows = [...data.packages];
    rows.sort((a, b) => {
      let result: number;
      if (sort === "package") result = a.package.localeCompare(b.package);
      else if (sort === "releases_per_year")
        result = a.releases_per_year - b.releases_per_year;
      else result = (a.median_gap ?? Infinity) - (b.median_gap ?? Infinity);
      return ascending ? result : -result;
    });
    return rows;
  }, [data.packages, sort, ascending]);

  const table: DataTable = {
    caption:
      "Release pace against median fix-to-disclosure gap, one row per package.",
    columns: [
      { key: "package", label: "Package" },
      { key: "releases", label: "Releases per year", numeric: true },
      { key: "gap", label: "Median gap, days", numeric: true },
      { key: "advisories", label: "Advisories", numeric: true },
    ],
    rows: data.packages.map((row) => ({
      package: row.package,
      releases: row.releases_per_year,
      gap: row.median_gap === null ? "—" : days(row.median_gap),
      advisories: row.advisories,
    })),
  };

  const rho = data.test.rho;
  const p = data.test.p_value;
  const subtitle = `Spearman rho = ${rho === null ? "—" : rho.toFixed(2)}, p = ${
    p === null ? "—" : p.toFixed(2)
  }, n = ${data.test.n} packages`;

  // "One time in N" stated from the p-value in the data rather than typed into
  // the caption, where it drifted once already.
  const oddsInWords = data.test.p_value
    ? spell(Math.round(1 / data.test.p_value))
    : "several";

  const toggleSort = (key: SortKey) => {
    if (key === sort) setAscending((value) => !value);
    else {
      setSort(key);
      setAscending(key === "package");
    }
  };

  const xTicks = niceTicks(0, geometry.xMax, 5);
  const yTicks = niceTicks(geometry.yMin, geometry.yMax, 5);

  return (
    <ChartFrame
      title="Libraries that ship often do seem to patch sooner — but sixteen packages cannot prove it"
      subtitle={subtitle}
      note={`${data.note}${
        omitted > 0
          ? ` ${omitted} package${omitted === 1 ? "" : "s"} had no measurable gap and ${
              omitted === 1 ? "is" : "are"
            } omitted from the plot but kept in the table.`
          : ""
      }`}
      table={table}
    >
      <div ref={viewRef}>
        <div ref={ref}>
          {!ready ? (
            <div style={{ height }} />
          ) : narrow ? (
            // Sixteen directly-labelled points cannot be legible at 390px, so
            // the chart becomes the thing a reader can actually use there.
            <div style={{ overflowX: "auto" }}>
              <p
                style={{
                  margin: "0 0 0.5rem",
                  fontFamily: "var(--ff-ui)",
                  fontSize: "var(--t-chart-label)",
                  color: "var(--color-text-muted)",
                }}
              >
                Tap a column heading to sort.
              </p>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontFamily: "var(--ff-ui)",
                  fontSize: "var(--t-data-table)",
                  fontVariantNumeric: "tabular-nums lining-nums",
                }}
              >
                <thead>
                  <tr>
                    {(
                      [
                        ["package", "Package", false],
                        ["releases_per_year", "Releases/yr", true],
                        ["median_gap", "Median gap", true],
                      ] as [SortKey, string, boolean][]
                    ).map(([key, label, numeric]) => (
                      <th
                        key={key}
                        scope="col"
                        style={{
                          textAlign: numeric ? "end" : "start",
                          padding: "0.35rem 0.5rem 0.35rem 0",
                          borderBottom: "1px solid var(--color-rule)",
                        }}
                        aria-sort={
                          sort === key
                            ? ascending
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort(key)}
                          style={{
                            background: "none",
                            border: 0,
                            padding: 0,
                            font: "inherit",
                            color: "var(--color-text-secondary)",
                            cursor: "pointer",
                          }}
                        >
                          {label}
                          {sort === key ? (ascending ? " ↑" : " ↓") : ""}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row) => (
                    <tr key={row.package}>
                      <td
                        style={{
                          padding: "0.35rem 0.5rem 0.35rem 0",
                          borderBottom: "1px solid var(--color-rule)",
                          fontFamily: "var(--ff-mono)",
                        }}
                      >
                        {row.package}
                      </td>
                      <td
                        style={{
                          textAlign: "end",
                          padding: "0.35rem 0.5rem 0.35rem 0",
                          borderBottom: "1px solid var(--color-rule)",
                        }}
                      >
                        {row.releases_per_year}
                      </td>
                      <td
                        style={{
                          textAlign: "end",
                          padding: "0.35rem 0.5rem 0.35rem 0",
                          borderBottom: "1px solid var(--color-rule)",
                        }}
                      >
                        {row.median_gap === null ? "—" : days(row.median_gap)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <svg
              width={width}
              height={height}
              role="group"
              aria-label="Release pace against median fix-to-disclosure gap"
            >
              <defs>
                <clipPath id="release-pace-clip">
                  <rect x={0} y={0} width={plotWidth} height={plotHeight} />
                </clipPath>
              </defs>
              <g transform={`translate(${margin.left},${margin.top})`}>
                <HorizontalGrid
                  ticks={yTicks}
                  scale={geometry.yScale}
                  x0={0}
                  x1={plotWidth}
                  color={colors!.grid}
                />
                <LeftAxis
                  ticks={yTicks.map((tick) => ({
                    value: tick,
                    offset: geometry.yScale(tick),
                    label: days(tick),
                  }))}
                  color={colors!.axis}
                />

                {/* Two hundred resamples instead of one confident line. */}
                <g clipPath="url(#release-pace-clip)" aria-hidden="true">
                  {data.bootstrap.map((line, index) => (
                    <line
                      key={index}
                      x1={geometry.xScale(line.x1)}
                      y1={geometry.yScale(line.y1)}
                      x2={geometry.xScale(line.x2)}
                      y2={geometry.yScale(line.y2)}
                      stroke={markColor}
                      strokeWidth={1}
                      opacity={inView ? 0.05 : 0}
                      style={{ transition: "opacity var(--dur-5) var(--ease-out)" }}
                    />
                  ))}
                </g>

                {geometry.yMin < 0 ? (
                  <ReferenceLine
                    orientation="horizontal"
                    at={geometry.yScale(0)}
                    from={0}
                    to={plotWidth}
                    color={colors!.baseline}
                  />
                ) : null}

                {placed.map((point) => {
                  const active = hovered === point.package;
                  return (
                    <g
                      key={point.package}
                      onPointerEnter={() => setHovered(point.package)}
                      onPointerLeave={() => setHovered(null)}
                    >
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={inView ? point.r : 0}
                        fill={markColor}
                        fillOpacity={active ? 0.5 : 0.26}
                        stroke={markColor}
                        strokeWidth={active ? 2 : 1.25}
                        style={{
                          transition:
                            "r var(--dur-4) var(--ease-out), fill-opacity var(--dur-1) var(--ease-micro)",
                        }}
                      >
                        <title>
                          {`${point.package}: ${point.releases} releases/yr, median gap ${days(
                            point.gap,
                          )} days, ${count(point.advisories)} advisories`}
                        </title>
                      </circle>
                      <text
                        x={point.labelX}
                        y={point.labelY}
                        textAnchor={point.anchor}
                        className="chart-label"
                        fill={active ? colors!.text : colors!.textSecondary}
                        style={{ fontFamily: "var(--ff-mono)" }}
                      >
                        {point.label}
                      </text>
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
                    ticks={xTicks.map((tick) => ({
                      value: tick,
                      offset: geometry.xScale(tick),
                      label: count(tick),
                    }))}
                  />
                </g>
              </g>
            </svg>
          )}

          {ready && !narrow ? (
            <p
              style={{
                margin: "0.5rem 0 0",
                maxInlineSize: "var(--measure-narrow)",
                fontFamily: "var(--ff-ui)",
                fontSize: "var(--t-chart-label)",
                lineHeight: 1.45,
                color: "var(--color-text-muted)",
              }}
            >
              Each faint line is the same relationship refitted to a resample of
              the sixteen packages. They fan out because the slope is not
              knowable at this sample size — a pattern this strong would appear
              about one time in {oddsInWords} by chance alone. Circle area is the number
              of advisories. No trend line is drawn here on purpose.
            </p>
          ) : null}
        </div>
      </div>
    </ChartFrame>
  );
}
