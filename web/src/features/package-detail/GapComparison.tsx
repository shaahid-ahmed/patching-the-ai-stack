/** This package's fix-to-disclosure gaps against every other package's.
 *
 * The global distribution sits behind in muted ink so a reader can see whether
 * this package is unusual or ordinary. Without that backdrop a median of 41
 * days means nothing: the only useful question is "compared with what?".
 */
import { useEffect, useMemo, useState } from "react";

import { ChartFrame, type DataTable } from "@/charts/ChartFrame";
import { BottomAxis, niceTicks, ReferenceLine } from "@/charts/primitives";
import { chrome, token } from "@/charts/tokens";
import { useChartSize, useIsNarrow } from "@/charts/useChartSize";
import { loadFigure } from "@/data/client";
import type { FigureQ3, PackageDetail } from "@/data/types";
import { count, days, gapPhrase } from "@/lib/format";

const DOMAIN_LOW = -120;
const DOMAIN_HIGH = 240;

function jitter(id: string, span: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(hash) % 1000) / 1000 - 0.5) * span;
}

export function GapComparison({ data }: { data: PackageDetail }) {
  const { ref, width, height, ready } = useChartSize(0.3, 190, 260);
  const narrow = useIsNarrow(width);
  const [global, setGlobal] = useState<FigureQ3 | null>(null);

  useEffect(() => {
    let live = true;
    // The client caches by URL, so this is free on any route that already
    // loaded the figure.
    loadFigure("q3")
      .then((figure) => {
        if (live) setGlobal(figure);
      })
      .catch(() => {
        /* The backdrop is context, not content: the chart still reads without it. */
      });
    return () => {
      live = false;
    };
  }, []);

  const colors = ready ? chrome() : null;
  const before = ready ? token("--color-gap-before") : "";
  const after = ready ? token("--color-gap-after") : "";
  const dim = ready ? token("--color-mark-dim") : "";

  const margin = { top: 14, right: 16, bottom: 32, left: 16 };
  const plotWidth = Math.max(0, width - margin.left - margin.right);
  const plotHeight = Math.max(0, height - margin.top - margin.bottom);

  const scale = (value: number) => {
    const clamped = Math.max(DOMAIN_LOW, Math.min(DOMAIN_HIGH, value));
    return ((clamped - DOMAIN_LOW) / (DOMAIN_HIGH - DOMAIN_LOW)) * plotWidth;
  };

  const mine = useMemo(
    () => data.advisories.filter((a) => a.gap !== null),
    [data.advisories],
  );

  const backdrop = useMemo(
    () => (global ? global.points.filter((p) => p.package !== data.package) : []),
    [global, data.package],
  );

  const table: DataTable = {
    caption: `Gap between fix and disclosure for every ${data.package} advisory that has one.`,
    columns: [
      { key: "id", label: "Advisory" },
      { key: "gap", label: "Days", numeric: true },
      { key: "direction", label: "Direction" },
    ],
    rows: mine
      .slice()
      .sort((a, b) => (a.gap ?? 0) - (b.gap ?? 0))
      .map((a) => ({
        id: a.id,
        gap: a.gap !== null ? days(Math.round(a.gap)) : "—",
        direction: gapPhrase(a.gap),
      })),
  };

  const globalMedian = global?.summary.median ?? null;
  const ticks = niceTicks(DOMAIN_LOW, DOMAIN_HIGH, narrow ? 4 : 6);

  return (
    <ChartFrame
      title={
        data.gap.median === null
          ? `No ${data.package} advisory has a measurable gap`
          : globalMedian !== null && data.gap.median > globalMedian
            ? `${data.package} sits behind the overall median, at ${days(data.gap.median)} days`
            : `${data.package} patches ahead of the overall median, at ${days(
                data.gap.median,
              )} days`
      }
      subtitle={`${count(data.gap.n)} of ${count(
        data.counts.advisories,
      )} advisories have a measurable gap${
        data.gap.negative > 0
          ? ` · ${count(data.gap.negative)} were published before any fix existed`
          : ""
      }`}
      note="Faint marks are every advisory from the other fifteen packages, for comparison."
      table={table}
    >
      <div ref={ref}>
        {ready ? (
          <svg
            width={width}
            height={height}
            role="group"
            aria-label={`Fix-to-disclosure gap for ${data.package} against all packages`}
          >
            <g transform={`translate(${margin.left},${margin.top})`}>
              {backdrop.map((point) => (
                <circle
                  key={point.id}
                  cx={scale(point.gap)}
                  cy={plotHeight / 2 + jitter(point.id, plotHeight * 0.75)}
                  r={2.5}
                  fill={dim}
                  opacity={0.3}
                />
              ))}

              <ReferenceLine
                orientation="vertical"
                at={scale(0)}
                from={0}
                to={plotHeight}
                color={colors!.baseline}
                label={narrow ? "same day" : "fix and advisory the same day"}
                labelColor={colors!.textSecondary}
                labelAnchor="middle"
              />

              {globalMedian !== null ? (
                <ReferenceLine
                  orientation="vertical"
                  at={scale(globalMedian)}
                  from={plotHeight * 0.1}
                  to={plotHeight}
                  color={colors!.reference}
                  dashed
                />
              ) : null}

              {mine.map((advisory) => (
                <circle
                  key={advisory.id}
                  cx={scale(advisory.gap as number)}
                  cy={plotHeight / 2 + jitter(advisory.id, plotHeight * 0.62)}
                  r={4.5}
                  fill={(advisory.gap as number) < 0 ? after : before}
                  stroke={colors!.surface}
                  strokeWidth={1}
                >
                  <title>{`${advisory.id} — ${gapPhrase(advisory.gap)}`}</title>
                </circle>
              ))}

              <g transform={`translate(0,${plotHeight})`}>
                <BottomAxis
                  color={colors!.axis}
                  ticks={ticks.map((tick) => ({
                    value: tick,
                    offset: scale(tick),
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
    </ChartFrame>
  );
}
