/** Q2, which weakness classes dominate, and whether the mix differs between
 *  older machine-learning libraries and newer large-language-model frameworks.
 *
 * Small multiples rather than a heatmap of raw counts: the four categories have
 * wildly unequal totals, so colour-by-count would encode category size instead
 * of the mix we are asking about. Each panel shows within-category share, with
 * the all-package share drawn behind as a grey reference bar, and every panel
 * keeps the same row order, that fixed order is what makes them comparable.
 *
 * The Agent tools category is a single library (mcp). Giving it share bars
 * would invite a reader to compare a one-package rate against a five-package
 * one, so it gets a dot strip and a label saying so instead.
 */
import { useMemo } from "react";

import { ChartFrame, type DataTable } from "@/charts/ChartFrame";
import { BottomAxis, niceTicks } from "@/charts/primitives";
import { categoryColor, chrome, token } from "@/charts/tokens";
import { useChartSize, useIsNarrow } from "@/charts/useChartSize";
import { useInView } from "@/charts/useInView";
import type { CategoryId, FigureQ2 } from "@/data/types";
import { count, percent } from "@/lib/format";

/** Full class names run to 48 characters; the row label column cannot. */
const SHORT_LABEL: Record<string, string> = {
  "unsafe model or file loading": "Unsafe model loading",
  "prompt injection or unsafe model output": "Prompt injection",
  "code, command or query injection": "Code / command injection",
  "path traversal or file access": "Path traversal",
  "server-side request forgery": "Server-side request forgery",
  "authentication or authorization": "Authentication",
  "information disclosure": "Information disclosure",
  "web flaw (scripting, request forgery, redirects)": "Web flaws",
  "denial of service": "Denial of service",
  other: "Other",
};

const shortLabel = (value: string) => SHORT_LABEL[value] ?? value;

const ROW_HEIGHT = 24;
const PANEL_HEADER = 46;
const AXIS_HEIGHT = 26;
const AI_COLUMN = 34;
const AI_GAP = 10;

interface PanelRow {
  attackClass: string;
  label: string;
  share: number | null;
  count: number;
  overallShare: number | null;
  aiShare: number | null;
  aiCount: number;
}

const CATEGORY_PANEL_ORDER: CategoryId[] = [
  "model-libraries",
  "application-frameworks",
  "serving-and-web-tools",
  "agent-tools",
];

export function ClassMix({ data }: { data: FigureQ2 }) {
  const { ref, width, ready } = useChartSize(0.5, 200, 400);
  const { ref: viewRef, inView } = useInView<HTMLDivElement>();
  const narrow = useIsNarrow(width);

  const categories = useMemo(
    () =>
      // Panel order follows the stack itself, model libraries, then the
      // frameworks built on them, then serving, then agent tooling, not the
      // alphabetical key order. The category colours are a lightness ladder in
      // that same order, and the prose compares the first two side by side.
      (CATEGORY_PANEL_ORDER.filter(
        (id) => id in data.ai_specific.by_category,
      ) as CategoryId[]).map((id) => ({
        id,
        total: data.ai_specific.by_category[id].total,
      })),
    [data.ai_specific.by_category],
  );

  /** Narrow screens keep the top six classes and fold the rest into "other",
   *  because ten 24px rows across four stacked panels is a very long scroll. */
  const rows = useMemo(() => {
    const ordered = [...data.classes].sort((a, b) => b.total - a.total);
    if (!narrow || ordered.length <= 7) return ordered;
    const head = ordered.slice(0, 6);
    const tail = ordered.slice(6);
    const folded = {
      ...(tail[0] ?? ordered[0]!),
      attack_class: "other",
      total: tail.reduce((sum, c) => sum + c.total, 0),
      ai_specific: tail.reduce((sum, c) => sum + c.ai_specific, 0),
      by_category: Object.fromEntries(
        categories.map((c) => [
          c.id,
          tail.reduce((sum, row) => sum + row.by_category[c.id], 0),
        ]),
      ) as Record<CategoryId, number>,
    };
    return [...head, folded];
  }, [data.classes, narrow, categories]);

  /** One scale for every panel. A per-panel scale would make a 30% bar in a
   *  small category look like a 30% bar in a large one at a different length. */
  const maxShare = useMemo(() => {
    let max = 0;
    for (const row of rows) {
      for (const category of categories) {
        if (category.id === "agent-tools") continue;
        const share = row.by_category_share[category.id];
        if (share !== null && share > max) max = share;
      }
      if (row.share !== null && row.share > max) max = row.share;
    }
    return Math.min(1, Math.ceil(max * 20) / 20);
  }, [rows, categories]);

  const columns = narrow ? 1 : 2;
  const gutter = 28;
  const panelWidth = ready
    ? Math.max(200, Math.floor((width - gutter * (columns - 1)) / columns))
    : 0;
  const labelWidth = narrow ? 128 : Math.min(176, Math.max(120, panelWidth * 0.38));
  const barArea = Math.max(
    40,
    panelWidth - labelWidth - AI_COLUMN - AI_GAP - 36,
  );
  const xScale = (share: number) => (share / maxShare) * barArea;

  const colors = ready ? chrome() : null;
  const aiColor = ready ? token("--color-ai-specific") : "";
  const ghost = ready ? token("--color-mark-dim") : "";

  const table: DataTable = {
    caption:
      "Share of each category's advisories falling in each weakness class, with the all-package share for comparison.",
    columns: [
      { key: "label", label: "Weakness class" },
      { key: "total", label: "All packages", numeric: true },
      { key: "overall", label: "Share of all", numeric: true },
      ...categories.map((category) => ({
        key: category.id,
        label: category.id,
        numeric: true,
      })),
      { key: "ai", label: "AI-specific", numeric: true },
    ],
    rows: data.classes.map((row) => ({
      label: shortLabel(row.attack_class),
      total: row.total,
      overall: percent(row.share, 1),
      ...Object.fromEntries(
        categories.map((category) => [category.id, row.by_category[category.id]]),
      ),
      ai: row.ai_specific,
    })),
  };

  const ticks = niceTicks(0, maxShare, narrow ? 2 : 4).filter((t) => t <= maxShare);
  const panelHeight = PANEL_HEADER + rows.length * ROW_HEIGHT + AXIS_HEIGHT;

  const renderPanel = (category: { id: CategoryId; total: number }) => {
    const meta = data.ai_specific.by_category[category.id];
    const isSingleton = category.id === "agent-tools";
    const fill = ready ? categoryColor(category.id) : "";
    const label =
      category.id === "model-libraries"
        ? "Model libraries"
        : category.id === "application-frameworks"
          ? "Application frameworks"
          : category.id === "serving-and-web-tools"
            ? "Serving and web tools"
            : "Agent tools";

    const panelRows: PanelRow[] = rows.map((row) => ({
      attackClass: row.attack_class,
      label: shortLabel(row.attack_class),
      share: row.by_category_share[category.id] ?? null,
      count: row.by_category[category.id],
      overallShare: row.share,
      aiShare: row.ai_specific_share,
      aiCount: row.ai_specific,
    }));

    return (
      <svg
        key={category.id}
        width={panelWidth}
        height={panelHeight}
        role="group"
        aria-label={`${label}: weakness class mix`}
      >
        <text
          x={0}
          y={16}
          className="chart-label"
          fill={colors!.text}
          style={{ fontWeight: 600 }}
        >
          {label}
        </text>
        <text x={0} y={32} className="chart-label" fill={colors!.textSecondary}>
          {isSingleton
            ? `one library (mcp) · ${count(category.total)} advisories · counted, not rated`
            : `${count(category.total)} advisories · ${percent(meta.share, 0)} AI-specific`}
        </text>

        <g transform={`translate(0,${PANEL_HEADER})`}>
          {panelRows.map((row, rowIndex) => {
            const y = rowIndex * ROW_HEIGHT;
            const barY = y + ROW_HEIGHT / 2 - 7;
            const x0 = labelWidth + AI_COLUMN + AI_GAP;
            return (
              <g key={row.attackClass}>
                <text
                  x={labelWidth - 10}
                  y={y + ROW_HEIGHT / 2}
                  dy="0.32em"
                  textAnchor="end"
                  className="chart-label"
                  fill={colors!.textSecondary}
                >
                  {row.label}
                </text>

                {/* AI-specific share for this class, folded in as a micro-bar
                    rather than promoted to a chart of its own. */}
                <g transform={`translate(${labelWidth + 4},${barY + 3})`}>
                  <rect
                    width={AI_COLUMN - 8}
                    height={8}
                    fill={colors!.grid}
                    rx={1}
                  />
                  <rect
                    width={(AI_COLUMN - 8) * (row.aiShare ?? 0)}
                    height={8}
                    fill={aiColor}
                    rx={1}
                  >
                    <title>{`${row.aiCount} of ${
                      panelRows.find((r) => r.attackClass === row.attackClass)?.count ?? 0
                    } flagged AI-specific across all packages (${percent(
                      row.aiShare,
                      0,
                    )})`}</title>
                  </rect>
                </g>

                <g transform={`translate(${x0},0)`}>
                  {isSingleton ? (
                    // A dot strip: countable, and it refuses to imply a rate.
                    Array.from({ length: row.count }).map((_, dotIndex) => (
                      <circle
                        key={dotIndex}
                        cx={6 + dotIndex * 13}
                        cy={y + ROW_HEIGHT / 2}
                        r={inView ? 4 : 0}
                        fill={fill}
                        style={{
                          transition: `r var(--dur-3) var(--ease-out) ${
                            rowIndex * 20 + dotIndex * 10
                          }ms`,
                        }}
                      >
                        <title>{`${row.label}: ${row.count} advisor${
                          row.count === 1 ? "y" : "ies"
                        }`}</title>
                      </circle>
                    ))
                  ) : (
                    <>
                      <rect
                        x={0}
                        y={barY - 3}
                        width={xScale(row.overallShare ?? 0)}
                        height={20}
                        fill={ghost}
                        opacity={0.28}
                        rx={2}
                      >
                        <title>{`All packages: ${percent(row.overallShare, 1)}`}</title>
                      </rect>
                      <rect
                        x={0}
                        y={barY}
                        width={inView ? xScale(row.share ?? 0) : 0}
                        height={14}
                        fill={fill}
                        rx={2}
                        style={{
                          transition: `width var(--dur-4) var(--ease-out) ${
                            rowIndex * 24
                          }ms`,
                        }}
                      >
                        <title>{`${label}, ${row.label}: ${count(
                          row.count,
                        )} of ${count(category.total)} (${percent(row.share, 1)})`}</title>
                      </rect>
                      {/* A 20% bar built on two advisories is not a rate. */}
                      {row.count > 0 && row.count < 3 ? (
                        <text
                          x={xScale(row.share ?? 0) + 6}
                          y={y + ROW_HEIGHT / 2}
                          dy="0.32em"
                          className="chart-label"
                          fill={colors!.textSecondary}
                        >
                          {row.count}
                        </text>
                      ) : null}
                    </>
                  )}
                </g>
              </g>
            );
          })}

          {!isSingleton ? (
            <g transform={`translate(${labelWidth + AI_COLUMN + AI_GAP},${rows.length * ROW_HEIGHT})`}>
              <line
                x1={0}
                x2={barArea}
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
                  label: `${Math.round(tick * 100)}%`,
                }))}
              />
            </g>
          ) : null}
        </g>
      </svg>
    );
  };

  return (
    <ChartFrame
      title="The weaknesses are mostly ordinary software bugs, unsafe model loading is the exception"
      subtitle={`Share of each category's advisories by weakness class · ${count(
        data.total_rows,
      )} advisory-package rows · ${count(data.ai_specific.true)} flagged AI-specific`}
      note={data.note}
      preliminaryLabels={Boolean(data.label_source?.toLowerCase().includes("keyword"))}
      table={table}
    >
      <div ref={viewRef}>
        <div ref={ref}>
          {ready ? (
            <>
              <p
                className="chart-key"
                style={{
                  margin: "0 0 0.75rem",
                  fontFamily: "var(--ff-ui)",
                  fontSize: "var(--t-chart-label)",
                  color: "var(--color-text-muted)",
                }}
              >
                Coloured bar: this category. Grey bar behind: all sixteen
                packages. Small bar left of each row: the share of that
                weakness class flagged AI-specific.
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${columns}, ${panelWidth}px)`,
                  gap: `${gutter}px`,
                }}
              >
                {categories.map((category) => renderPanel(category))}
              </div>
            </>
          ) : (
            <div style={{ height: 320 }} />
          )}
        </div>
      </div>
    </ChartFrame>
  );
}
