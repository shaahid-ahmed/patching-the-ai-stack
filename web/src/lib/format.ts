/** Framework-free formatting helpers.
 *
 * The gap formatters exist because "−12 days" is meaningless to a reader
 * without knowing which direction is bad. Everywhere a gap is shown, it is
 * shown with its direction spelled out.
 */
import type { Severity } from "@/data/types";

const integer = new Intl.NumberFormat("en-GB");
const oneDecimal = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** The marker for a value that does not exist, as opposed to one that is zero.
 * An en dash, which is the table convention and is not an em dash. */
export const NO_VALUE = "\u2013";

export const count = (value: number) => integer.format(value);

export const days = (value: number) =>
  Number.isInteger(value) ? integer.format(value) : oneDecimal.format(value);

export function percent(value: number | null, digits = 0): string {
  if (value === null || Number.isNaN(value)) return NO_VALUE;
  return `${(value * 100).toFixed(digits)}%`;
}

/** "41 days before disclosure" / "9 days after disclosure" / "same day". */
export function gapPhrase(gap: number | null): string {
  if (gap === null) return "no fixed version";
  const rounded = Math.round(gap);
  if (rounded === 0) return "fix and advisory the same day";
  if (rounded > 0) return `${days(rounded)} days before disclosure`;
  return `${days(Math.abs(rounded))} days after disclosure`;
}

/** The short form for tables, where the column header carries the direction. */
export function gapShort(gap: number | null): string {
  if (gap === null) return NO_VALUE;
  const rounded = Math.round(gap);
  return rounded > 0 ? `+${days(rounded)}` : days(rounded);
}

export const gapDirection = (gap: number | null): "before" | "after" | "same" | "none" => {
  if (gap === null) return "none";
  const rounded = Math.round(gap);
  if (rounded === 0) return "same";
  return rounded > 0 ? "before" : "after";
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export const date = (iso: string | null) =>
  iso ? dateFormatter.format(new Date(iso)) : ", ";

export const month = (iso: string | null) =>
  iso ? monthFormatter.format(new Date(iso)) : ", ";

export const severityRank: Record<Severity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

/** EPSS is a probability in [0,1]; below 0.1% a percentage reads as zero. */
export function exploitProbability(value: number | null): string {
  if (value === null) return NO_VALUE;
  if (value < 0.001) return "<0.1%";
  return `${(value * 100).toFixed(1)}%`;
}

export const titleCase = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

/** Sentence-cases an attack class for use mid-sentence without shouting. */
export const attackClassLabel = (value: string) => titleCase(value);

const WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve",
];

/** Spell small integers, because "one in 8" reads as a typo in running prose. */
export function spell(value: number): string {
  const rounded = Math.round(value);
  return WORDS[rounded] ?? count(rounded);
}

const ORDINALS = [
  "zeroth", "first", "second", "third", "fourth", "fifth", "sixth",
  "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth",
];

/**
 * Spell a rank, so prose can name where something sits without the rank being
 * typed into the sentence, where it would drift on the next pipeline run.
 */
export function ordinal(value: number): string {
  const rounded = Math.round(value);
  const word = ORDINALS[rounded];
  if (word) return word;
  const rem100 = rounded % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${count(rounded)}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[rounded % 10] ?? "th";
  return `${count(rounded)}${suffix}`;
}
