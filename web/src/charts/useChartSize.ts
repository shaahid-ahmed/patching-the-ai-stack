import { useCallback, useEffect, useRef, useState } from "react";

/** Measure a chart's container so the SVG can be laid out in real pixels.
 *
 * Charts here are not drawn with a viewBox stretched to fit: tick density and
 * label collision depend on the actual rendered width, so a 390px phone needs
 * genuinely different geometry rather than a scaled-down desktop chart.
 */
export function useChartSize(aspect = 0.55, minHeight = 240, maxHeight = 520) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  const measure = useCallback(() => {
    if (ref.current) setWidth(ref.current.clientWidth);
  }, []);

  useEffect(() => {
    measure();
    if (!ref.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [measure]);

  const height = Math.max(minHeight, Math.min(maxHeight, Math.round(width * aspect)));
  return { ref, width, height, ready: width > 0 };
}

export const BREAKPOINT_NARROW = 560;
export const useIsNarrow = (width: number) => width > 0 && width < BREAKPOINT_NARROW;
