/** Resolve design tokens into values JavaScript can hand to a scale.
 *
 * Charts need colour as a string, but the palette lives in CSS custom
 * properties so that a token change flows through without touching chart code.
 * Reading them at render time rather than importing a JS palette is what keeps
 * the two in step, and it means a colour-scheme change needs no rebuild.
 */
import type { CategoryId, Severity } from "@/data/types";

const cache = new Map<string, string>();

export function token(name: string): string {
  const cached = cache.get(name);
  if (cached !== undefined) return cached;
  if (typeof window === "undefined") return "";
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (!value) {
    // Loud rather than silent: a missing token would otherwise paint
    // transparent marks and look like a data problem.
    console.warn(`[charts] design token ${name} is not defined`);
  }
  cache.set(name, value);
  return value;
}

/** Call when the colour scheme changes; the next read repopulates. */
export const clearTokenCache = () => cache.clear();

export const severityColor = (severity: Severity) =>
  token(`--color-severity-${severity}`);

export const categoryColor = (category: CategoryId) =>
  token(`--color-category-${category}`);

export const gapColor = (gap: number, sameDayWindow = 3) => {
  if (Math.abs(gap) <= sameDayWindow) return token("--color-gap-same");
  return gap > 0 ? token("--color-gap-before") : token("--color-gap-after");
};

export const chrome = () => ({
  grid: token("--color-grid"),
  axis: token("--color-axis"),
  baseline: token("--color-baseline"),
  reference: token("--color-reference"),
  neutral: token("--color-mark-neutral"),
  dim: token("--color-mark-dim"),
  annotation: token("--color-annotation"),
  surface: token("--color-surface"),
  text: token("--color-text"),
  textSecondary: token("--color-text-secondary"),
});
