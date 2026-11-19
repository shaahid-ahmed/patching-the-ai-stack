/** Releases and advisories on one shared time axis.
 *
 * This is the page's centrepiece: it is where a reader sees that a cluster of
 * advisories is followed by a burst of releases, or — more tellingly — that it
 * is not.
 *
 * `litellm` has over 900 releases, so drawing one tick per release would paint
 * a solid block. Releases are binned by month and drawn as a cadence profile;
 * advisories stay individual, because 90 marks is still readable and each one
 * is a thing a reader might want to point at. Where an advisory has a fix, a
 * connector runs from the advisory to the release that fixed it, so the gap
 * this whole project measures is visible as a length.
 */
import { useId, useMemo, useState } from "react";

import { ChartFrame, type DataTable } from "@/charts/ChartFrame";
import { chrome, severityColor, token } from "@/charts/tokens";
import { useChartSize, useIsNarrow } from "@/charts/useChartSize";
import type { PackageDetail } from "@/data/types";
import { count, date as formatDate, gapPhrase } from "@/lib/format";

const MONTH_MS = 1000 * 60 * 60 * 24 * 30.4375;

interface Bin {
  start: number;
  releases: number;
}

function monthKey(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

export function PackageTimeline({ data }: { data: PackageDetail }) {
  const { ref, width, height, ready } = useChartSize(0.4, 260, 380);
  const narrow = useIsNarrow(width);
  const clipId = useId();
  const [hovered, setHovered] = useState<string | null>(null);

  const model = useMemo(() => {
    const releaseTimes = data.releaseTimeline
      .map((r) => Date.parse(r.date))
      .filter((t) => Number.isFinite(t));
    const advisoryTimes = data.advisories
      .map((a) => Date.parse(a.published))
      .filter((t) => Number.isFinite(t));
    const fixTimes = data.advisories
      .map((a) => (a.fixDate ? Date.parse(a.fixDate) : Number.NaN))
      .filter((t) => Number.isFinite(t));

    const all = [...releaseTimes, ...advisoryTimes, ...fixTimes];
    if (all.length === 0) return null;

    // Advisories only begin in 2022; a package first released in 2015 would
    // otherwise squeeze every mark into the right-hand sliver. Start the axis
    // a year before the first advisory unless releases start later.
    const firstAdvisory = advisoryTimes.length ? Math.min(...advisoryTimes) : Math.min(...all);
    const domainStart = Math.max(
      Math.min(...all),
      firstAdvisory - MONTH_MS * 12,
    );
    const domainEnd = Math.max(...all) + MONTH_MS * 0.5;

    const bins = new Map<number, Bin>();
    for (const t of releaseTimes) {
      if (t < domainStart) continue;
      const key = monthKey(t);
      const bin = bins.get(key);
      if (bin) bin.releases += 1;
      else bins.set(key, { start: key, releases: 1 });
    }
    const binList = [...bins.values()].sort((a, b) => a.start - b.start);
    const peak = binList.reduce((max, b) => Math.max(max, b.releases), 1);

    const years: number[] = [];
    for (
      let y = new Date(domainStart).getUTCFullYear();
      y <= new Date(domainEnd).getUTCFullYear();
      y += 1
    ) {
      const tick = Date.UTC(y, 0, 1);
      if (tick >= domainStart && tick <= domainEnd) years.push(tick);
    }

    return {
      domainStart,
      domainEnd,
      bins: binList,
      peak,
      years,
      releasesBefore: releaseTimes.filter((t) => t < domainStart).length,
    };
  }, [data]);

  const colors = ready ? chrome() : null;
  const releaseInk = ready ? token("--color-mark-neutral") : "";
  const unpatchedInk = ready ? token("--color-unpatched") : "";
  const beforeInk = ready ? token("--color-gap-before") : "";
  const afterInk = ready ? token("--color-gap-after") : "";

  const table: DataTable = useMemo(() => {
    const byYear = new Map<number, { releases: number; advisories: number }>();
    for (const r of data.releaseTimeline) {
      const y = new Date(r.date).getUTCFullYear();
      const row = byYear.get(y) ?? { releases: 0, advisories: 0 };
      row.releases += 1;
      byYear.set(y, row);
    }
    for (const a of data.advisories) {
      const y = new Date(a.published).getUTCFullYear();
      const row = byYear.get(y) ?? { releases: 0, advisories: 0 };
      row.advisories += 1;
      byYear.set(y, row);
    }
    return {
      caption: `Releases and advisories per year for ${data.package}.`,
      columns: [
        { key: "year", label: "Year" },
        { key: "releases", label: "Releases", numeric: true },
        { key: "advisories", label: "Advisories", numeric: true },
      ],
      rows: [...byYear.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([year, row]) => ({
          year,
          releases: row.releases,
          advisories: row.advisories,
        })),
    };
  }, [data]);

  if (!model) {
    return null;
  }

  // One geometry, two orientations. `main` runs along time; `cross` is the
  // lane offset. On a phone time runs down the page, because a 390px-wide
  // five-year axis puts every mark on top of its neighbour.
  const pad = narrow ? 44 : 52;
  const mainLength = Math.max(
    0,
    (narrow ? height : width) - (narrow ? 36 : pad + 24),
  );
  const crossLength = narrow ? width - pad - 16 : height - 48;

  const toMain = (ms: number) =>
    ((ms - model.domainStart) / (model.domainEnd - model.domainStart)) * mainLength;

  const releaseLane = narrow ? crossLength * 0.26 : crossLength * 0.3;
  const advisoryLane = narrow ? crossLength * 0.72 : crossLength * 0.78;
  const laneGap = Math.abs(advisoryLane - releaseLane);

  const place = (mainValue: number, crossValue: number) =>
    narrow
      ? { x: pad + crossValue, y: 18 + mainValue }
      : { x: pad + mainValue, y: 16 + crossValue };

  const binWidth = Math.max(
    2,
    (mainLength / Math.max(1, model.bins.length)) * 0.8,
  );

  return (
    <ChartFrame
      title={
        data.counts.unpatched > 0
          ? `${data.package} shipped ${count(data.counts.releases)} releases, and ${count(
              data.counts.unpatched,
            )} of its advisories still have no fixed version`
          : `Every advisory against ${data.package} has a fixed release`
      }
      subtitle={`Release cadence by month against individual advisories · ${
        model.releasesBefore > 0
          ? `${count(model.releasesBefore)} earlier releases fall before this window · `
          : ""
      }connectors run from an advisory to the release that fixed it`}
      note="Releases are binned by month; bar height is the number of releases that month. Advisory marks are coloured by severity."
      table={table}
    >
      <div ref={ref}>
        {ready ? (
          <svg
            width={width}
            height={height}
            role="group"
            aria-label={`Timeline of releases and advisories for ${data.package}`}
          >
            <defs>
              <clipPath id={clipId}>
                <rect x={0} y={0} width={width} height={height} />
              </clipPath>
            </defs>
            <g clipPath={`url(#${clipId})`}>
              {/* Year gridlines */}
              {model.years.map((tick) => {
                const a = place(toMain(tick), 0);
                const b = place(toMain(tick), crossLength);
                return (
                  <g key={tick}>
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={colors!.grid}
                      shapeRendering="crispEdges"
                    />
                    <text
                      x={narrow ? 4 : a.x}
                      y={narrow ? a.y + 4 : height - 6}
                      textAnchor={narrow ? "start" : "middle"}
                      className="chart-label"
                      fill={colors!.axis}
                    >
                      {new Date(tick).getUTCFullYear()}
                    </text>
                  </g>
                );
              })}

              {/* Release cadence */}
              {model.bins.map((bin) => {
                const extent = (bin.releases / model.peak) * (laneGap * 0.55);
                const base = place(toMain(bin.start), releaseLane);
                return narrow ? (
                  <rect
                    key={bin.start}
                    x={base.x - extent}
                    y={base.y}
                    width={Math.max(1, extent)}
                    height={binWidth}
                    fill={releaseInk}
                    opacity={0.55}
                  >
                    <title>{`${bin.releases} releases`}</title>
                  </rect>
                ) : (
                  <rect
                    key={bin.start}
                    x={base.x}
                    y={base.y - extent}
                    width={binWidth}
                    height={Math.max(1, extent)}
                    fill={releaseInk}
                    opacity={0.55}
                  >
                    <title>{`${bin.releases} releases`}</title>
                  </rect>
                );
              })}

              {/* Lane baselines */}
              {[releaseLane, advisoryLane].map((lane) => {
                const a = place(0, lane);
                const b = place(mainLength, lane);
                return (
                  <line
                    key={lane}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={colors!.baseline}
                    strokeWidth={1}
                    shapeRendering="crispEdges"
                  />
                );
              })}

              {/* Advisories, with a connector to the fix where one exists */}
              {data.advisories.map((advisory) => {
                const published = Date.parse(advisory.published);
                if (!Number.isFinite(published) || published < model.domainStart) {
                  return null;
                }
                const at = place(toMain(published), advisoryLane);
                const active = hovered === advisory.id;
                const fix = advisory.fixDate ? Date.parse(advisory.fixDate) : Number.NaN;
                const hasConnector =
                  Number.isFinite(fix) && fix >= model.domainStart;
                const fixPoint = hasConnector
                  ? place(toMain(fix), releaseLane)
                  : null;
                const connectorInk =
                  advisory.gap !== null && advisory.gap < 0 ? afterInk : beforeInk;

                return (
                  <g
                    key={advisory.id}
                    onPointerEnter={() => setHovered(advisory.id)}
                    onPointerLeave={() => setHovered(null)}
                    opacity={hovered === null || active ? 1 : 0.3}
                    style={{ transition: "opacity var(--dur-1) var(--ease-micro)" }}
                  >
                    {fixPoint ? (
                      <line
                        x1={at.x}
                        y1={at.y}
                        x2={fixPoint.x}
                        y2={fixPoint.y}
                        stroke={connectorInk}
                        strokeWidth={active ? 1.75 : 1}
                        opacity={active ? 0.9 : 0.35}
                      />
                    ) : null}
                    <circle
                      cx={at.x}
                      cy={at.y}
                      r={active ? 6 : 4}
                      fill={
                        advisory.hasFix
                          ? severityColor(advisory.severity)
                          : unpatchedInk
                      }
                      stroke={colors!.surface}
                      strokeWidth={1}
                      style={{ transition: "r var(--dur-1) var(--ease-micro)" }}
                    >
                      <title>
                        {`${advisory.id} · ${advisory.severity} · ${formatDate(
                          advisory.published,
                        )} · ${gapPhrase(advisory.gap)}`}
                      </title>
                    </circle>
                  </g>
                );
              })}

              {/* Lane labels */}
              <text
                x={narrow ? width - 4 : pad}
                y={narrow ? 12 : place(0, releaseLane).y - laneGap * 0.6 - 6}
                textAnchor={narrow ? "end" : "start"}
                className="chart-label"
                fill={colors!.textSecondary}
              >
                releases per month
              </text>
              <text
                x={narrow ? width - 4 : pad}
                y={narrow ? 26 : place(0, advisoryLane).y + 20}
                textAnchor={narrow ? "end" : "start"}
                className="chart-label"
                fill={colors!.textSecondary}
              >
                advisories
              </text>
            </g>
          </svg>
        ) : (
          <div style={{ height }} />
        )}
      </div>
    </ChartFrame>
  );
}
