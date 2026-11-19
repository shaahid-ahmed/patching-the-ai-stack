import type { ReactNode } from "react";

import { useInView } from "@/charts/useInView";
import styles from "./Narrative.module.css";

interface Props {
  id: string;
  kicker: string;
  heading: string;
  children: ReactNode;
}

/**
 * One section of the argument. Revealed once on first intersection and never
 * replayed — a reader scrolling back up sees finished content, and nothing
 * re-animates on a laptop driving a projector.
 */
export function Section({ id, kicker, heading, children }: Props) {
  const { ref, inView } = useInView<HTMLElement>(0.15);
  return (
    <section
      id={id}
      ref={ref}
      className={`${styles.section} ${styles.reveal}`}
      data-revealed={inView ? "true" : "false"}
      aria-labelledby={`${id}-heading`}
    >
      <div className={styles.column}>
        <p className={styles.kicker}>{kicker}</p>
        <h2 id={`${id}-heading`} className={styles.heading}>
          {heading}
        </h2>
      </div>
      {children}
    </section>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className={`${styles.column} ${styles.prose}`}>{children}</div>
  );
}

export function Wide({ children }: { children: ReactNode }) {
  return <div className={styles.wide}>{children}</div>;
}

export function Beat({ figure, children }: { figure: string; children: ReactNode }) {
  return (
    <div className={`${styles.column} ${styles.beat}`}>
      <span className={styles.beatFigure}>{figure}</span>
      <p className={styles.beatBody}>{children}</p>
    </div>
  );
}
