import { Link, useLoaderData } from "react-router";

import { ClassMix } from "@/charts/figures/ClassMix";
import { GapDistribution } from "@/charts/figures/GapDistribution";
import { GapOverTime } from "@/charts/figures/GapOverTime";
import { ReleasePace } from "@/charts/figures/ReleasePace";
import { UnpatchedShare } from "@/charts/figures/UnpatchedShare";
import { VolumeByQuarter } from "@/charts/figures/VolumeByQuarter";
import { manifest } from "@/data/client";
import type {
  FigureQ1,
  FigureQ2,
  FigureQ3,
  FigureQ4,
  FigureQ5,
} from "@/data/types";
import { count, days, month, percent, spell } from "@/lib/format";

import { Beat, Prose, Section, Wide } from "./Section";
import { Opening } from "./Opening";
import { PackageJump } from "./PackageJump";
import styles from "./Narrative.module.css";

interface LoaderData {
  q1: FigureQ1;
  q2: FigureQ2;
  q3: FigureQ3;
  q4: FigureQ4;
  q5: FigureQ5;
}

export function Narrative() {
  const { q1, q2, q3, q4, q5 } = useLoaderData() as LoaderData;
  const { counts, headline } = manifest;

  const negativeOfMeasurable = headline.negativeShareOfMeasurable;
  const oneIn = Math.round(1 / negativeOfMeasurable);

  const unsafeLoading = q2.old_vs_new.rows.find(
    (row) => row.attack_class === "unsafe model or file loading",
  );
  const injection = q2.old_vs_new.rows.find(
    (row) => row.attack_class === "code, command or query injection",
  );

  const serving = q3.by_category.find((c) => c.category_id === "serving-and-web-tools");
  const frameworks = q3.by_category.find(
    (c) => c.category_id === "application-frameworks",
  );
  const servingTest = q3.tests.serving_vs_frameworks;

  const worstUnpatched = q5.by_package.filter((p) => p.total >= 10).slice(0, 3);

  // Named in the prose below, so they are read from the data rather than typed
  // into the sentence, where they would drift on the next pipeline run.
  const byName = (name: string) => q4.packages.find((p) => p.package === name);
  const torch = byName("torch");
  const langchainCore = byName("langchain-core");

  return (
    <article className={styles.piece}>
      <Opening q3={q3} />

      <Section
        id="volume"
        kicker="One: the pile"
        heading="In 2026, an advisory lands against these libraries every other day"
      >
        <Prose>
          <p>
            Almost every AI application is built on the same short list of
            open-source Python libraries. <code>transformers</code> loads the
            models. <code>langchain</code> and <code>llama-index</code> wire
            them into applications. <code>vllm</code> serves them,{" "}
            <code>gradio</code> puts a web interface in front of them, and the
            Model Context Protocol kit connects agents to outside tools. A flaw
            in any one of them reaches every application that installed it.
          </p>
          <p>
            Across the sixteen libraries in this study, published security
            advisories went from {count(q1.growth.from_count ?? 0)} in the first
            quarter of {q1.growth.from_quarter?.slice(0, 4)} to{" "}
            {count(q1.growth.to_count ?? 0)} in {q1.growth.to_quarter?.slice(0, 4)}{" "}, a {q1.growth.multiple}-fold rise. Some of that is real growth in
            the software itself: several of these projects barely existed in
            2022. Some of it is that more people are now looking, with better
            tools.
          </p>
        </Prose>

        <Wide>
          <VolumeByQuarter data={q1} />
        </Wide>

        <Prose>
          <p>
            What the rise cannot tell us on its own is whether anyone is keeping
            up. A rising count of advisories is equally consistent with a
            security crisis and with a maturing ecosystem that has finally
            started reporting its bugs properly. The rest of this piece is about
            the question that does separate those two readings: once a flaw is
            known, how long are its users left exposed?
          </p>
        </Prose>
      </Section>

      <Section
        id="classes"
        kicker="Two: the flaws"
        heading="Mostly the same old bugs, in new places"
      >
        <Prose>
          <p>
            The weaknesses behind these advisories are, for the most part,
            unremarkable. Denial of service, path traversal, command injection
            and broken authentication account for the bulk of them, the same
            catalogue that has troubled web software for twenty years. Only{" "}
            {count(q2.ai_specific.true)} of {count(q2.total_rows)} rows,{" "}
            {percent(q2.ai_specific.share)}, describe a flaw that exists
            specifically because the software runs models or agents.
          </p>
          <p>
            But the <em>mix</em> shifts sharply depending on what a library is
            for.{" "}
            {unsafeLoading ? (
              <>
                Unsafe model and file loading, a malicious checkpoint that runs
                code when you open it, accounts for{" "}
                <strong>{percent(unsafeLoading.old_share)}</strong> of advisories
                against model libraries, and{" "}
                <strong>{percent(unsafeLoading.new_share, 1)}</strong> of those
                against application frameworks.
              </>
            ) : null}{" "}
            {injection ? (
              <>
                Code and command injection runs the other way:{" "}
                {percent(injection.old_share)} of model-library advisories
                against {percent(injection.new_share)} of framework ones.
              </>
            ) : null}{" "}
            The libraries that load weights get attacked through the weights.
            The libraries that fetch URLs and run tools on a prompt's
            instruction get attacked through the instructions.
          </p>
        </Prose>

        <Wide>
          <ClassMix data={q2} />
        </Wide>

        <Prose>
          <p>
            The one category where AI-specific risk is not a minority is agent
            tooling. All {count(q2.ai_specific.by_category["agent-tools"].true)}{" "}
            advisories against the Model Context Protocol kit are AI-specific,
            for the simple reason that an agent tool connector has no purpose
            outside an AI system. It is also a single package, which is too
            little to generalise from, a caveat the chart above makes visible
            rather than burying.
          </p>
        </Prose>
      </Section>

      <Section
        id="gap"
        kicker="Three: the quiet"
        heading="The fix usually ships before the warning. Usually."
      >
        <Prose>
          <p>
            When a maintainer fixes a security flaw, two things happen on
            different days: a patched version appears on PyPI, and an advisory
            tells the world the flaw existed. The distance between those two
            dates is the measure this project is built on. When it is positive,
            users were quietly protected before they were told to worry. When it
            is negative, they were told about a flaw before any version existed
            that escaped it.
          </p>
        </Prose>

        <Beat figure={`${days(headline.medianGap)} days`}>
          is the median head start, the fix on PyPI before the public advisory,
          across {count(counts.gapMeasurable)} advisories where both dates could
          be established.
        </Beat>

        <Wide>
          <GapDistribution data={q3} />
        </Wide>

        <Prose>
          <p>
            The median is the honest summary here, because the mean is not. At
            one extreme an advisory went out{" "}
            {days(Math.abs(q3.summary.min ?? 0))} days before any fix existed;
            at the other, a fix had been sitting on PyPI for{" "}
            {days(Math.round(q3.summary.max ?? 0))} days before anyone was told. The
            standard deviation is {days(q3.summary.sd ?? 0)} days, dragged by a
            handful of back-filled records where a release long predates the
            advisory system. Removing
            all {count(q3.coverage.outliers)} statistical outliers moves the
            median by less than a day, from {days(headline.medianGap)} to{" "}
            {days(q3.summary_excluding_outliers.median ?? 0)}, which is the
            check worth running before trusting any of this.
          </p>
          <p>
            The tail on the left is the part that matters.{" "}
            <strong>
              {count(q3.summary.negative ?? 0)} advisories, about one in{" "}
              {spell(oneIn)} of those with a known fix
            </strong>, were published while no patched release existed. For those, the
            advisory was not a reassurance but a warning with nowhere to go.
          </p>
          <p>
            Who you depend on changes the answer substantially.{" "}
            {serving && frameworks ? (
              <>
                Serving and web tools reach users a median{" "}
                {days(serving.box.median ?? 0)} days ahead of disclosure;
                application frameworks, {days(frameworks.box.median ?? 0)} days.
                That difference survives a Mann-Whitney test (p ={" "}
                {servingTest.p_value?.toFixed(4)}, n ={" "}
                {count(servingTest.n_a)} against {count(servingTest.n_b)}), so it
                is unlikely to be noise.
              </>
            ) : null}
          </p>
          <p>
            What has <em>not</em> happened is improvement. Split by half-year,
            the median gap swings between under a day and nearly two months with
            no direction to it. On this evidence the ecosystem has not got
            better at protecting users before telling them. It has simply got
            busier.
          </p>
        </Prose>

        <Wide>
          <GapOverTime data={q3} />
        </Wide>
      </Section>

      <Section
        id="pace"
        kicker="Four: the hypothesis that fails"
        heading="Do libraries that ship often patch faster? Probably not provable here."
      >
        <Prose>
          <p>
            It is a reasonable guess that a project releasing every few days can
            get a security fix out faster than one releasing twice a year. The
            data leans that way and then refuses to commit: across the sixteen
            packages, release cadence and patch head start correlate at Spearman
            {`ρ = ${q4.test.rho?.toFixed(2)}, with p = ${q4.test.p_value?.toFixed(2)}.`}
          </p>
          <p>
            At sixteen points, a pattern this strong would turn up by chance
            roughly one time in five. That is not a finding. Rather than draw a
            trend line that would imply otherwise, the chart shows{" "}
            {count(q4.bootstrap.length)} bootstrap resamples of the same sixteen
            packages: the fan they make is the honest width of what this sample
            supports.
          </p>
        </Prose>

        <Wide>
          <ReleasePace data={q4} />
        </Wide>

        <Prose>
          <p>
            The counter-examples are instructive. <code>torch</code> releases
            rarely, {torch?.releases_per_year} releases a year, and its
            median advisory arrives{" "}
            {days(Math.abs(torch?.median_gap ?? 0))} days <em>before</em> a fix
            exists; <code>langchain-core</code> releases{" "}
            {langchainCore?.releases_per_year} times a year and lands within{" "}
            {days(langchainCore?.median_gap ?? 0)} day of disclosure. Cadence plainly helps, but
            disclosure timing is a policy decision made by people, not a
            mechanical consequence of how often a project cuts a release.
          </p>
        </Prose>
      </Section>

      <Section
        id="unpatched"
        kicker="Five: the residue"
        heading={`${count(counts.withoutFix)} of these advisories have no patch at all`}
      >
        <Prose>
          <p>
            Everything above concerns advisories that were eventually fixed. The
            rest were not. {count(counts.withoutFix)} of{" "}
            {count(counts.rows)} advisory-package rows ({" "}
            {percent(q5.overall.estimate, 1)}, with a 95% interval of{" "}
            {percent(q5.overall.low, 1)} to {percent(q5.overall.high, 1)}) record
            no fixed release at all. For those, there is no gap to measure,
            because there is no other side to it.
          </p>
        </Prose>

        <Beat figure={percent(q5.overall.estimate, 1)}>
          of advisory-package rows list no patched version. They are excluded
          from every median on this page, which is why that exclusion is stated
          rather than assumed.
        </Beat>

        <Wide>
          <UnpatchedShare data={q5} />
        </Wide>

        <Prose>
          <p>
            They are not spread evenly.{" "}
            {worstUnpatched.map((pkg, index) => (
              <span key={pkg.package}>
                {index > 0 ? ", " : ""}
                <Link to={`/package/${pkg.package}`}>
                  <code>{pkg.package}</code>
                </Link>{" "}
                carries {count(pkg.unpatched)} of {count(pkg.total)}
              </span>
            ))}
            . Read those as ranges rather than points: on these sample sizes the
            intervals overlap heavily, which is exactly why the chart draws them.
          </p>
          <p>
            An unpatched advisory is not necessarily an abandoned one. Some
            describe risks a maintainer has judged to be the user's
            configuration problem rather than a library defect, and reasonable
            people disagree about several of them. But for anyone running these
            libraries, the practical position is the same: the flaw is public,
            and upgrading will not fix it.
          </p>
        </Prose>
      </Section>

      <section className={`${styles.ending}`}>
        <div className={styles.column}>
          <h2 className={styles.heading}>Your library is in here</h2>
          <div className={styles.prose}>
            <p>
              This covers {count(counts.packages)} packages and{" "}
              {count(counts.advisories)} advisories published up to{" "}
              {month(manifest.observedThrough)}. It establishes that advisories
              against AI libraries are rising sharply, that most describe
              ordinary weaknesses in unusual places, and that the median user
              gets a {days(headline.medianGap)}-day head start that one advisory
              in {oneIn} does not provide. It does not establish why, and with
              sixteen packages it cannot.
            </p>
          </div>
          <PackageJump />
          <div className={styles.endingLinks}>
            <Link to="/explore">Search all {count(counts.rows)} advisories →</Link>
            <Link to="/methods">How this was collected, and what it misses →</Link>
          </div>
        </div>
      </section>
    </article>
  );
}
