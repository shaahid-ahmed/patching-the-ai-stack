/** Where the caveats live.
 *
 * Every limitation gets a real anchor, because caveat pills next to charts
 * elsewhere in the app deep-link here (`/methods#ai-labels`). Breaking one of
 * those ids silently would leave a reader clicking a pill that goes nowhere.
 */
import { useLoaderData } from "react-router";

import type { Limitation, Methods } from "@/data/types";
import { count, date, days, percent, NO_VALUE } from "@/lib/format";

import styles from "./MethodsPage.module.css";

function LimitationSection({ limitation }: { limitation: Limitation }) {
  const important = limitation.severity === "important";
  return (
    <section
      id={limitation.id}
      className={`${styles.limitation} ${important ? styles.important : ""}`}
      aria-labelledby={`${limitation.id}-head`}
    >
      {important ? <p className={styles.tag}>Read this one</p> : null}
      <h3 className={styles.limitationHead} id={`${limitation.id}-head`}>
        <a href={`#${limitation.id}`}>{limitation.headline}</a>
      </h3>
      <p className={styles.limitationBody}>{limitation.detail}</p>

      {limitation.examples && limitation.examples.length > 0 ? (
        <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption>
            All {count(limitation.examples.length)} flagged values, largest gap
            first.
          </caption>
          <thead>
            <tr>
              <th scope="col">Advisory</th>
              <th scope="col">Package</th>
              <th scope="col" className={styles.num}>
                Gap, days
              </th>
              <th scope="col">Summary</th>
            </tr>
          </thead>
          <tbody>
            {limitation.examples.map((example) => (
              <tr key={example.id}>
                <td>
                  <code>{example.id}</code>
                </td>
                <td>
                  <code>{example.package}</code>
                </td>
                <td className={styles.num}>
                  {example.gap === null ? NO_VALUE : days(Math.round(example.gap))}
                </td>
                <td>{example.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      ) : null}
    </section>
  );
}

export function MethodsPage() {
  const data = useLoaderData() as Methods;
  const { counts, headline } = data;

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header>
          <p className={styles.eyebrow}>Methods</p>
          <h1 className={styles.title}>
            How these numbers were made, and what they cannot tell you
          </h1>
          <p className={styles.standfirst}>
            Two public APIs, one labelling pass, and a set of limitations worth
            reading before you quote anything on this site.
          </p>

          <p className={styles.facts}>
            <span>
              <strong>{count(counts.rows)}</strong> advisory-package rows
            </span>
            <span>
              <strong>{count(counts.advisories)}</strong> distinct advisories
            </span>
            <span>
              <strong>{count(counts.packages)}</strong> packages
            </span>
            <span>
              <strong>{count(counts.releases)}</strong> releases
            </span>
            <span>
              median gap <strong>{days(headline.medianGap)} days</strong>
            </span>
            <span>
              <strong>{count(counts.withoutFix)}</strong> with no fix
            </span>
          </p>
        </header>

        {data.labelsPreliminary ? (
          <div className={styles.banner} role="note">
            <p className={styles.bannerHead}>
              The attack-class and AI-specific labels on this site are
              preliminary.
            </p>
            <p className={styles.bannerBody}>
              They currently come from a keyword fallback (
              <code>{data.labelSource}</code>), not from the language-model pass
              the method describes: the pipeline runs the fallback whenever no{" "}
              <code>ANTHROPIC_API_KEY</code> is configured. The fallback is
              cruder, particularly for the <code>other</code> class, which
              absorbs anything it cannot place, {data.labelCheck.agreement === null
                ? " and the 30-advisory hand-check that would measure its accuracy has not been completed, so no agreement rate is reported."
                : ` a hand-check of ${count(
                    data.labelCheck.checked,
                  )} advisories agrees with it ${percent(
                    data.labelCheck.agreement,
                  )} of the time.`}{" "}
              Treat every count of AI-specific flaws on this site as indicative
              rather than settled.
            </p>
          </div>
        ) : null}

        <section className={styles.section} aria-labelledby="sources-heading">
          <h2 className={styles.sectionHead} id="sources-heading">
            Where the data comes from
          </h2>
          <ul className={styles.sources}>
            {data.sources.map((source) => (
              <li key={source.id} className={styles.source} id={source.id}>
                <p className={styles.sourceName}>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.name}
                  </a>
                </p>
                <p className={styles.sourceRole}>{source.role}</p>
                <p className={styles.sourceAuth}>{source.auth}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="scope-heading">
          <h2 className={styles.sectionHead} id="scope-heading">
            What was studied
          </h2>
          <div className={styles.prose}>
            <p>
              Sixteen Python packages, chosen to cover four distinct roles in an
              AI stack rather than sampled at random. Every advisory GitHub has
              reviewed for those packages was collected, and each one was joined
              to the PyPI release history of the package it affects so that the
              date a fix actually reached users could be recovered.
            </p>
          </div>
          <ul className={styles.catList}>
            {data.categories.map((category) => (
              <li key={category.id} className={styles.cat}>
                <p className={styles.catName}>{category.label}</p>
                <p className={styles.catBlurb}>{category.blurb}</p>
                <p className={styles.catPackages}>
                  {category.packages.join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="limits-heading">
          <h2 className={styles.sectionHead} id="limits-heading">
            Limitations
          </h2>
          <div className={styles.prose}>
            <p>
              These are listed in full rather than summarised, because each one
              changes how a particular number on this site should be read.
            </p>
          </div>
          {data.limitations.map((limitation) => (
            <LimitationSection key={limitation.id} limitation={limitation} />
          ))}
        </section>

        <p className={styles.generated}>
          Built {date(data.generatedAt)} from advisories published up to{" "}
          {date(data.observedThrough)}.
        </p>
      </div>
    </div>
  );
}
