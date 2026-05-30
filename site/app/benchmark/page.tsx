import Link from "next/link";
import { DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "../docs-shell";
import { createPageMetadata } from "../metadata";
import { competitiveBenchmarkReport, type CompetitiveBenchmarkCategory, type CompetitiveBenchmarkTrack } from "../../lib/competitive-benchmark-public";

export const metadata = createPageMetadata({
  description: "Nipmod agent preflight benchmark with public methodology, scoring rubric, source scope, evidence limits and machine-readable results.",
  path: "/benchmark",
  title: "Nipmod benchmark"
});

export default function BenchmarkPage() {
  const report = competitiveBenchmarkReport;
  const tracks = [...report.tracks];
  const caseCount = report.cases.length;
  const nipmodTrack = tracks.find((track) => track.name === "Nipmod");
  if (!nipmodTrack) {
    throw new Error("Benchmark report is missing the Nipmod track.");
  }
  const limitedTracks = tracks.filter((track) => track.status === "warn");

  return (
    <DocsShell
      description="A coverage-adjusted benchmark for the evidence an agent receives before installing, pulling or reusing external code."
      eyebrow="Benchmark"
      stats={[
        { label: "Nipmod live", value: report.headline.liveChecks },
        { label: "Reviewable plans", value: report.headline.installPlanEvidence },
        { label: "Rubric score", value: String(report.headline.score) },
        { label: "Median latency", value: `${report.headline.medianLatencyMs} ms` }
      ]}
      title="Agent preflight benchmark."
    >
      <DocsSection eyebrow="Comparison" title="Agent preflight benchmark">
        <div className="benchmark-article-lede">
          <p>
            The run measures one specific moment: before an agent installs a package, pulls a model, reuses a repository or connects a tool. It does not rank security companies on a generic score.
          </p>
          <p>
            This is a Nipmod-authored {caseCount}-case snapshot with explicit limits, not independent proof or a malware-free safety claim.
          </p>
          <p>
            Each track is measured by what it exposes to that preflight decision. Specialized feeds keep their own scope visible, so advisory databases and repository scanners are not treated as full package-intelligence layers.
          </p>
        </div>

        <BenchmarkChart tracks={tracks} />
      </DocsSection>

      <DocsSection eyebrow="Readout" title="What the run shows">
        <div className="benchmark-readout-grid">
          <article>
            <span>Preflight fit</span>
            <strong>{nipmodTrack.score}</strong>
            <p>Coverage-adjusted score across the full agent preflight case set, not only the package ecosystems where a feed is strongest.</p>
          </article>
          <article>
            <span>Source scope</span>
            <strong>{nipmodTrack.applicable}/{caseCount}</strong>
            <p>npm, PyPI, GitHub, Hugging Face model and dataset, MCP and known vulnerable package cases completed in the live run.</p>
          </article>
          <article>
            <span>Execution preflight</span>
            <strong>{report.categoryBreakdown.find((category) => category.key === "execution-preflight")?.tracks[0]?.score ?? 0}</strong>
            <p>Read-only install-plan output, package-behavior context and execution boundary before workspace writes.</p>
          </article>
          <article>
            <span>Hosted execution</span>
            <strong>0</strong>
            <p>The benchmark performs no install, clone, artifact unpacking, model execution, paid inference call or workspace write.</p>
          </article>
        </div>
      </DocsSection>

      <DocsSection eyebrow="Audit" title="Strict reviewer answer">
        <DocsGrid>
          <article className="benchmark-panel">
            <span>Product benchmark</span>
            <strong>{report.reviewerAssessment.productGrade}</strong>
            <p>{report.reviewerAssessment.reason}</p>
          </article>
          <article className="benchmark-panel">
            <span>Academic benchmark</span>
            <strong>{report.reviewerAssessment.academicGrade}</strong>
            <p>The sample is small and the weights are authored by Nipmod, so the page does not claim independent proof or malware-free safety.</p>
          </article>
          <article className="benchmark-panel">
            <span>Measured question</span>
            <strong>preflight evidence</strong>
            <p>What can an agent know before installing, pulling, reusing or connecting external code?</p>
          </article>
        </DocsGrid>
      </DocsSection>

      <DocsSection eyebrow="Market context" title="Who this is measured against">
        <DocsTable
          rows={report.marketContext.map((item) => [
            item.name,
            item.scaleContext,
            <>
              <strong>{item.benchmarkRole}</strong>
              <br />
              {item.benchmarkBoundary}
              <br />
              <a className="data-link" href={item.sourceUrl} rel="noreferrer" target="_blank">{item.sourceLabel}</a>
            </>
          ])}
        />
        <p className="docs-note">
          Company size is included for context, not for scoring. The benchmark scores the API surface available at this hosted read-only preflight boundary.
        </p>
      </DocsSection>

      <DocsSection eyebrow="Scope" title="Why these tracks are included">
        <DocsTable
          rows={[
            ["Nipmod", "Full agent preflight layer: search, inspect, evidence, warnings and read-only install plan."],
            ["Native registries", "Source-of-truth metadata baseline from npm, PyPI, GitHub, Hugging Face and MCP."],
            ["OSV and deps.dev", "Advisory, dependency, provenance and package metadata evidence feeds."],
            ["Socket and Snyk", "Package security intelligence APIs. This snapshot marks their current API access limits instead of treating limits as product failure."],
            ["OpenSSF Scorecard", "Repository posture baseline for the GitHub case, not a package install-plan competitor."],
            ["Raw agent", "Baseline for an agent moving toward install without an independent package intelligence layer."]
          ]}
        />
        <p className="docs-note">
          Project scanners and update bots such as Dependabot, Renovate, npm audit, pip-audit, local Snyk CLI flows and install firewalls are useful, but they are not ranked in this API snapshot because they operate on manifests, local projects or install interception instead of this hosted read-only preflight boundary.
        </p>
      </DocsSection>

      <DocsSection eyebrow="Rubric" title="How the score is graded">
        <DocsTable
          rows={report.rubric.map((item) => [
            item.category,
            <>
              <strong>Full:</strong> {item.fullCredit}
              <br />
              <strong>Partial:</strong> {item.partialCredit}
              <br />
              <strong>Zero:</strong> {item.noCredit}
            </>,
            item.whyItMatters
          ])}
        />
      </DocsSection>

      <DocsSection eyebrow="Accounting" title="How the score is counted">
        <DocsTable
          rows={report.scoreAccounting.map((item) => [
            item.label,
            item.value,
            item.explanation
          ])}
        />
      </DocsSection>

      <DocsSection eyebrow="Weights" title="Category weights">
        <DocsTable
          rows={report.categoryWeights.map((category) => [
            category.category,
            category.weights.map((weight) => `${weight.dimension} ${weight.weight}`).join(", ")
          ])}
        />
      </DocsSection>

      <DocsSection eyebrow="Cases" title="What is tested">
        <DocsTable
          rows={report.cases.map((testCase) => [
            testCase.task,
            <>
              <strong>{testCase.source}</strong>
              <br />
              {testCase.expected}
            </>,
            testCase.reason
          ])}
        />
      </DocsSection>

      <DocsSection eyebrow="Categories" title="Separated scoring">
        <div className="benchmark-category-list">
          {report.categoryBreakdown.map((category) => (
            <BenchmarkCategoryPanel category={category} key={category.key} />
          ))}
        </div>
      </DocsSection>

      <DocsSection eyebrow="Controls" title="Fairness controls">
        <DocsTable rows={report.fairnessControls.map((control, index) => [`${index + 1}`, control])} />
      </DocsSection>

      <DocsSection eyebrow="Excluded" title="What is not ranked here">
        <DocsTable rows={report.excludedComparisons.map((item) => [item.name, item.reason])} />
      </DocsSection>

      <DocsSection eyebrow="Limits" title="Known limitations">
        <DocsTable rows={report.limitations.map((limitation, index) => [`${index + 1}`, limitation])} />
      </DocsSection>

      <DocsSection eyebrow="Definition" title="What is measured">
        <DocsTable
          rows={[
            ["8 cases", "npm package selection, known vulnerable npm package, PyPI package selection, Python schema package, Hugging Face model, Hugging Face dataset, MCP server and GitHub repository posture."],
            ["15 dimensions", "Search, identity, version, metadata, advisories, provenance, repository posture, source depth, package behavior, prompt boundary, install plan, read-only boundary, machine-readable output, agent JSON and multi-source coverage."],
            ["4 public categories", "Source resolution, security evidence, execution preflight and agent readiness."],
            ["8 tracks", "Nipmod, native registries, OSV, deps.dev, OpenSSF Scorecard, Socket, Snyk and a raw agent baseline."],
            ["Scope-adjusted score", "Unsupported source cases count as scope limits in the headline score. Applicable depth is still shown separately."],
            ["0 execution", "No package install, repository clone, artifact unpacking, model execution, paid inference call or workspace write is performed."]
          ]}
        />
      </DocsSection>

      <DocsSection eyebrow="Result" title="Measured result">
        <DocsGrid>
          <article className="benchmark-panel">
            <span>Nipmod score</span>
            <strong>{nipmodTrack.score}/100</strong>
            <p>{nipmodTrack.pass}/{nipmodTrack.applicable} live checks, {report.headline.installPlanEvidence} install-plan evidence, {nipmodTrack.warn} warnings. Applicable depth score {nipmodTrack.depthScore}/100.</p>
          </article>
          <article className="benchmark-panel">
            <span>Limited tracks</span>
            <strong>{limitedTracks.length}</strong>
            <p>{limitedTracks.map((track) => track.name).join(", ")} were authenticated or reachable, but marked limited in this snapshot.</p>
          </article>
          <article className="benchmark-panel">
            <span>Hosted writes</span>
            <strong>0</strong>
            <p>No package install, repository clone, artifact unpacking, model execution or workspace write is performed.</p>
          </article>
        </DocsGrid>
      </DocsSection>

      <DocsSection eyebrow="Numbers" title="Measured facts">
        <DocsTable
          rows={[
            [`${nipmodTrack.score}/100`, "Nipmod score in the current production benchmark snapshot."],
            [`${nipmodTrack.pass}/${nipmodTrack.applicable}`, "Live source cases completed by the Nipmod track."],
            [`${nipmodTrack.sourceCoveragePct}%`, "Nipmod source coverage across the full benchmark case set."],
            [`${nipmodTrack.depthScore}/100`, "Nipmod applicable depth score before source-coverage adjustment."],
            [report.headline.installPlanEvidence, "Read-only install-plan evidence returned by the Nipmod track."],
            [`${nipmodTrack.warn}`, "Nipmod track warnings in the latest snapshot."],
            ["0", "Hosted installs, repository clones, artifact unpacking, code execution or workspace writes performed by benchmark requests."]
          ]}
        />
      </DocsSection>

      <DocsSection eyebrow="Claims" title="What this page must not claim">
        <DocsTable rows={report.unsafeClaims.map((claim, index) => [`${index + 1}`, claim])} />
      </DocsSection>

      <DocsSection eyebrow="Method" title="How to rerun it">
        <DocsCode>{report.command}</DocsCode>
        <p className="docs-note">
          Last public snapshot: <time dateTime={report.checkedAt}>{formatDate(report.checkedAt)}</time>. Machine report:{" "}
          <Link className="data-link" href="/benchmark.json">/benchmark.json</Link>. Full methodology:{" "}
          <a className="data-link" href="https://github.com/nipmod/nipmod/blob/main/docs/competitive-benchmark.md" rel="noreferrer" target="_blank">docs/competitive-benchmark.md</a>. Share image:{" "}
          <Link className="data-link" href="/benchmark-agent-preflight.png">PNG</Link>{" "}
          and <Link className="data-link" href="/benchmark-agent-preflight.svg">SVG</Link>.
        </p>
      </DocsSection>

      <DocsSection eyebrow="References" title="External reference points">
        <DocsTable
          rows={[
            ["OSV", <a className="data-link" href="https://google.github.io/osv.dev/api/" rel="noreferrer" target="_blank">Official API docs for vulnerability queries by package version or commit hash.</a>],
            ["deps.dev", <a className="data-link" href="https://docs.deps.dev/api/v3/" rel="noreferrer" target="_blank">Official API docs for package versions, dependencies, licenses and advisories.</a>],
            ["Socket", <a className="data-link" href="https://docs.socket.dev/reference/batchpackagefetchbyorg" rel="noreferrer" target="_blank">Official PURL API docs for package metadata and alerts.</a>],
            ["Snyk", <a className="data-link" href="https://docs.snyk.io/snyk-api/reference/package" rel="noreferrer" target="_blank">Official package API docs and package-health endpoint boundary.</a>],
            ["OpenSSF Scorecard", <a className="data-link" href="https://openssf.org/scorecard/" rel="noreferrer" target="_blank">Official project description for repository security posture scoring.</a>],
            ["npm audit", <a className="data-link" href="https://docs.npmjs.com/cli/v8/commands/npm-audit/" rel="noreferrer" target="_blank">Official npm audit docs for dependency-tree advisory checks.</a>]
          ]}
        />
      </DocsSection>
    </DocsShell>
  );
}

function BenchmarkCategoryPanel({ category }: { category: CompetitiveBenchmarkCategory }) {
  const ordered = [...category.tracks].sort((left, right) => right.score - left.score);
  const topScore = ordered[0]?.score ?? 0;
  const leaders = ordered.filter((track) => track.score === topScore).map((track) => track.name);
  const scopedTracks = ordered.filter((track) => track.sourceCoveragePct > 0).length;

  return (
    <article className="benchmark-category-panel">
      <header>
        <div>
          <span>{category.dimensions}</span>
          <h3>{category.title}</h3>
        </div>
        <p>{category.description}</p>
      </header>
      <dl className="benchmark-category-summary">
        <div>
          <dt>Highest fit in snapshot</dt>
          <dd>{leaders.join(", ")}</dd>
        </div>
        <div>
          <dt>Top score</dt>
          <dd>{topScore}/100</dd>
        </div>
        <div>
          <dt>Tracks with scope</dt>
          <dd>{scopedTracks}</dd>
        </div>
      </dl>
      <div className="benchmark-category-bars">
        {category.tracks.map((track) => {
          const width = `${Math.max(2, Math.min(100, track.score))}%`;
          const isNipmod = track.name === "Nipmod";

          return (
            <div className={`benchmark-category-row${isNipmod ? " benchmark-category-row-primary" : ""}`} key={`${category.key}-${track.name}`}>
              <strong>{track.name}</strong>
              <div aria-label={`${category.title}: ${track.name} score ${track.score} out of 100`} className="benchmark-category-bar">
                <span style={{ width }} />
              </div>
              <b>{track.score}</b>
              <em>{track.sourceCoveragePct}% scope</em>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function BenchmarkChart({ tracks }: { tracks: CompetitiveBenchmarkTrack[] }) {
  return (
    <div className="benchmark-rank-list" role="table" aria-label="Agent preflight track comparison">
      <div className="benchmark-rank-head" role="row">
        <span role="columnheader">Status</span>
        <span role="columnheader">Track</span>
        <span role="columnheader">Preflight fit</span>
        <span role="columnheader">Scope</span>
        <span role="columnheader">Depth</span>
        <span role="columnheader">Latency</span>
      </div>

      <div className="benchmark-rank-rows">
        {tracks.map((track) => {
          const latency = track.latencyMs === null ? "n/a" : `${track.latencyMs} ms`;
          const width = `${Math.max(2, Math.min(100, track.score))}%`;
          const isNipmod = track.name === "Nipmod";

          return (
            <article className={`benchmark-rank-row benchmark-rank-row-${track.status}${isNipmod ? " benchmark-rank-row-primary" : ""}`} key={track.name} role="row">
              <strong className="benchmark-rank-index" role="cell">{track.status === "pass" ? "pass" : "limited"}</strong>
              <div className="benchmark-rank-track" role="cell">
                <strong>{track.name}</strong>
                <span>{track.role}</span>
              </div>
              <div className="benchmark-rank-score" role="cell" aria-label={`${track.name} preflight fit ${track.score} out of 100`}>
                <div className="benchmark-rank-scorebar"><span style={{ width }} /></div>
                <b>{track.score}</b>
              </div>
              <dl className="benchmark-rank-metrics">
                <div role="cell">
                  <dt>Scope</dt>
                  <dd>{track.sourceCoveragePct}%</dd>
                </div>
                <div role="cell">
                  <dt>Depth</dt>
                  <dd>{track.depthScore}</dd>
                </div>
                <div role="cell">
                  <dt>Median</dt>
                  <dd>{latency}</dd>
                </div>
              </dl>
              {track.status === "warn" && track.name !== "Raw agent" ? <p className="benchmark-rank-warning">{track.note}</p> : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "UTC",
    timeZoneName: "short",
    year: "numeric"
  }).format(new Date(value));
}
