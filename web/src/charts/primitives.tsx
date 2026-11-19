/** Shared chart furniture: margins, gridlines, ticks, hatching, annotations.
 *
 * Every figure uses these so the grammar is identical across the piece, * value-axis gridlines only, no rotated axis titles, units carried by the
 * subtitle rather than the axis.
 */
import type { ReactNode } from "react";

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const MARGIN: Margin = { top: 16, right: 56, bottom: 36, left: 48 };

export const narrowMargin = (left = 36): Margin => ({
  top: 12,
  right: 16,
  bottom: 34,
  left,
});

/** Diagonal hatch, used wherever a value is incomplete or estimated rather
 *  than observed. Registering it once per chart keeps ids unique. */
export function HatchPattern({ id, color }: { id: string; color: string }) {
  return (
    <pattern
      id={id}
      width={6}
      height={6}
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <rect width={6} height={6} fill="none" />
      <line x1={0} y1={0} x2={0} y2={6} stroke={color} strokeWidth={2.5} />
    </pattern>
  );
}

interface GridProps {
  ticks: number[];
  scale: (value: number) => number;
  x0: number;
  x1: number;
  color: string;
}

export function HorizontalGrid({ ticks, scale, x0, x1, color }: GridProps) {
  return (
    <g aria-hidden="true">
      {ticks.map((tick) => (
        <line
          key={tick}
          x1={x0}
          x2={x1}
          y1={scale(tick)}
          y2={scale(tick)}
          stroke={color}
          strokeWidth={1}
          shapeRendering="crispEdges"
        />
      ))}
    </g>
  );
}

interface AxisProps {
  ticks: { value: number | string; offset: number; label: string }[];
  color: string;
  /** Distance from the axis line to the label baseline. */
  gap?: number;
}

export function BottomAxis({ ticks, color, gap = 16 }: AxisProps) {
  return (
    <g aria-hidden="true">
      {ticks.map((tick) => (
        <text
          key={String(tick.value)}
          x={tick.offset}
          y={gap}
          textAnchor="middle"
          className="chart-label"
          fill={color}
        >
          {tick.label}
        </text>
      ))}
    </g>
  );
}

export function LeftAxis({ ticks, color, gap = 8 }: AxisProps) {
  return (
    <g aria-hidden="true">
      {ticks.map((tick) => (
        <text
          key={String(tick.value)}
          x={-gap}
          y={tick.offset}
          dy="0.32em"
          textAnchor="end"
          className="chart-label"
          fill={color}
        >
          {tick.label}
        </text>
      ))}
    </g>
  );
}

interface AnnotationProps {
  x: number;
  y: number;
  width: number;
  children: ReactNode;
  anchor?: "start" | "middle" | "end";
}

/** Annotation copy sits in a foreignObject so it wraps like prose rather than
 *  needing hand-placed tspans. */
export function Annotation({ x, y, width, children, anchor = "start" }: AnnotationProps) {
  const dx = anchor === "end" ? -width : anchor === "middle" ? -width / 2 : 0;
  return (
    <foreignObject x={x + dx} y={y} width={width} height={120} className="chart-annotation">
      <div className="chart-annotation-body">{children}</div>
    </foreignObject>
  );
}

/** A reference line with its label riding on top of it. */
export function ReferenceLine({
  orientation,
  at,
  from,
  to,
  label,
  color,
  labelColor,
  dashed = false,
  labelAnchor = "start",
}: {
  orientation: "horizontal" | "vertical";
  at: number;
  from: number;
  to: number;
  label?: string;
  color: string;
  labelColor?: string;
  dashed?: boolean;
  labelAnchor?: "start" | "middle" | "end";
}) {
  const isHorizontal = orientation === "horizontal";
  const labelX = isHorizontal ? (labelAnchor === "end" ? to : from) : at;
  const labelY = isHorizontal ? at - 6 : from - 6;
  return (
    <g>
      <line
        x1={isHorizontal ? from : at}
        x2={isHorizontal ? to : at}
        y1={isHorizontal ? at : from}
        y2={isHorizontal ? at : to}
        stroke={color}
        strokeWidth={1}
        strokeDasharray={dashed ? "3 3" : undefined}
        shapeRendering="crispEdges"
      />
      {label ? (
        <text
          x={labelX}
          y={labelY}
          textAnchor={labelAnchor}
          className="chart-label"
          fill={labelColor ?? color}
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}

/** Nice round tick values for a linear axis, capped at `count` steps. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min];
  const span = max - min;
  const rawStep = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const step =
    (normalized >= 7.5 ? 10 : normalized >= 3.5 ? 5 : normalized >= 1.5 ? 2 : 1) *
    magnitude;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= max + 1e-9; value += step) {
    const rounded = Math.round(value * 1e6) / 1e6;
    // Normalise negative zero, which would otherwise render as "-0".
    ticks.push(rounded === 0 ? 0 : rounded);
  }
  return ticks;
}
