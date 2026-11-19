import { manifest } from "@/data/client";
import type { FigureQ3 } from "@/data/types";
import { count, days, month, spell } from "@/lib/format";

import { HeroStrip } from "./HeroStrip";
import styles from "./Narrative.module.css";

/**
 * The first viewport, before any scrolling. A visitor who reads only this
 * should leave with the thesis and the method: what was measured, across what,
 * and the one number that complicates the reassuring version of the story.
 */
export function Opening({ q3 }: { q3: FigureQ3 }) {
  const { counts, headline } = manifest;
  const oneIn = Math.round(1 / headline.negativeShareOfMeasurable);

  return (
    <header className={styles.hero}>
      <p className={styles.eyebrow}>Open-source AI security · 2022–2026</p>
      <h1 className={styles.headline}>
        The fix usually ships before the warning. Usually.
      </h1>
      <p className={styles.standfirst}>
        {count(counts.advisories)} security advisories against{" "}
        {count(counts.packages)} of the Python libraries almost every AI
        application depends on. The median one was quietly patched{" "}
        {days(headline.medianGap)} days before anyone was told, but about one
        in {spell(oneIn)} warned users about a flaw that had no fix yet, and{" "}
        {count(counts.withoutFix)} still have none.
      </p>

      <HeroStrip q3={q3} />

      <p className={styles.byline}>
        <span>Shaahid Ahmed</span>
        <span>Dealing with Data · NYU</span>
        <span>Data through {month(manifest.observedThrough)}</span>
      </p>
    </header>
  );
}
