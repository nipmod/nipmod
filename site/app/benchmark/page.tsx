import Link from "next/link";
import { DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "../docs-shell";
import { createPageMetadata } from "../metadata";
import { competitiveBenchmarkReport, type CompetitiveBenchmarkCategory, type CompetitiveBenchmarkTrack } from "../../lib/competitive-benchmark-public";

export const metadata = createPageMetadata({
  description: "Nipmod competitive benchmark for agent package-decision depth across source metadata, advisories, repository posture and install-plan readiness.",
  path: "/benchmark",
  title: "Nipmod benchmark"
});

export default function BenchmarkPage() {
  const report = competitiveBenchmarkReport;
  const tracks = [...report.tracks].sort((left, right) => right.score - left.score);
  const primaryTracks = tracks.filter((track) => track.name !== "Surplus");
  const nipmodTrack = tracks.find((track) => track.name === "Nipmod");
  if (!nipmodTrack) {
    throw new Error("Benchmark report is missing the Nipmod track.");
  }
  const nextTrack = tracks.find((track) => track.name !== "Nipmod");
  const scoreGap = nextTrack ? nipmodTrack.score - nextTrack.score : 0;

  return (
    <DocsShell
      description="A visual readout of the latest production benchmark. It compares the evidence an agent receives before installing, pulling or reusing external code."
      eyebrow="Benchmark"
      stats={[
        { label: "Nipmod live", value: report.headline.liveChecks },
        { label: "Install plans", value: report.headline.installPlanEvidence },
        { label: "Score", value: String(report.headline.score) },
        { label: "Median latency", value: `${report.headline.medianLatencyMs} ms` }
      ]}
      title="Agent package-decision depth."
    >
      <DocsSection eyebrow="Comparison" title="Agent preflight benchmark">
        <div className="benchmark-article-lede">
          <p>
            This benchmark measures the moment before an agent installs, pulls or reuses external code. The question is not whether a tool can find one advisory or one repository signal. The question is how much usable evidence an agent receives before it crosses the install boundary.
          </p>
          <p>
            Nipmod is measured as an end-to-end preflight layer: search, inspect, source evidence, warnings and a read-only install plan. Other tracks are measured only by the evidence they expose.
          </p>
        </div>

        <BenchmarkChart tracks={primaryTracks} />
      </DocsSection>

      <DocsSection eyebrow="Categories" title="Separated scoring">
        <div className="benchmark-category-list">
          {report.categoryBreakdown.map((category) => (
            <BenchmarkCategoryPanel category={category} key={category.key} />
          ))}
        </div>
      </DocsSection>

      <DocsSection eyebrow="Scope" title="What is measured">
        <DocsTable
          rows={[
            ["7 cases", "npm package selection, known vulnerable npm package, PyPI package selection, Python schema package, Hugging Face model, MCP server and GitHub repository posture."],
            ["16 dimensions", "Search, identity, version, metadata, advisories, provenance, repository posture, source depth, package behavior, prompt boundary, install plan, read-only boundary, machine-readable output, agent JSON, multi-source coverage and adjacent cost-market context."],
            ["4 public categories", "Source discovery, advisory/provenance, install boundary and agent output. Cost-market context stays in the machine report as an adjacent reference."],
            ["8 tracks", "Nipmod, native registries, OSV, deps.dev, OpenSSF Scorecard, Socket, Snyk and a raw agent baseline."],
            ["1 reference", "Surplus is kept in the machine report as adjacent agent-infra context, not as a package-decision competitor."],
            ["0 execution", "No package install, repository clone, artifact unpacking, model execution, paid inference call or workspace write is performed."]
          ]}
        />
      </DocsSection>

      <DocsSection eyebrow="Result" title="Measured result">
        <DocsGrid>
          <article className="benchmark-panel">
            <span>Nipmod score</span>
            <strong>{nipmodTrack.score}/100</strong>
            <p>{nipmodTrack.pass}/{nipmodTrack.applicable} live checks, {report.headline.installPlanEvidence} install-plan evidence, {nipmodTrack.warn} warnings.</p>
          </article>
          <article className="benchmark-panel">
            <span>Score gap</span>
            <strong>+{scoreGap} points</strong>
            <p>Next measured track: {nextTrack?.name ?? "n/a"} at {nextTrack?.score ?? 0}/100 in this benchmark snapshot.</p>
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
            [report.headline.installPlanEvidence, "Read-only install-plan evidence returned by the Nipmod track."],
            [`${nipmodTrack.warn}`, "Nipmod track warnings in the latest snapshot."],
            [`+${scoreGap}`, `Nipmod score gap over the next measured track, ${nextTrack?.name ?? "n/a"} at ${nextTrack?.score ?? 0}/100.`],
            ["0", "Hosted installs, repository clones, artifact unpacking, code execution or workspace writes performed by benchmark requests."]
          ]}
        />
      </DocsSection>

      <DocsSection eyebrow="Method" title="How to rerun it">
        <DocsCode>{report.command}</DocsCode>
        <p className="docs-note">
          Last public snapshot: <time dateTime={report.checkedAt}>{formatDate(report.checkedAt)}</time>. Machine report:{" "}
          <Link className="data-link" href="/benchmark.json">/benchmark.json</Link>. Full methodology:{" "}
          <a className="data-link" href="https://github.com/nipmod/nipmod/blob/main/docs/competitive-benchmark.md" rel="noreferrer" target="_blank">docs/competitive-benchmark.md</a>.
        </p>
      </DocsSection>
    </DocsShell>
  );
}

function BenchmarkCategoryPanel({ category }: { category: CompetitiveBenchmarkCategory }) {
  return (
    <article className="benchmark-category-panel">
      <header>
        <div>
          <span>{category.dimensions}</span>
          <h3>{category.title}</h3>
        </div>
        <p>{category.description}</p>
      </header>
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
            </div>
          );
        })}
      </div>
    </article>
  );
}

function BenchmarkChart({ tracks }: { tracks: CompetitiveBenchmarkTrack[] }) {
  return (
    <div className="benchmark-scoreboard" role="table" aria-label="Competitive benchmark score chart">
      <div className="benchmark-scoreboard-head" role="row">
        <span role="columnheader">Track</span>
        <span role="columnheader">Score</span>
        <span role="columnheader">Checks</span>
        <span role="columnheader">Warnings</span>
        <span role="columnheader">Latency</span>
      </div>

      <div className="benchmark-scoreboard-grid">
        {tracks.map((track) => {
          const latency = track.latencyMs === null ? "n/a" : `${track.latencyMs} ms`;
          const height = `${Math.max(4, Math.min(100, track.score))}%`;
          const isNipmod = track.name === "Nipmod";

          return (
            <article className={`benchmark-scorecard benchmark-scorecard-${track.status}${isNipmod ? " benchmark-scorecard-primary" : ""}`} key={track.name} role="row">
              <div className="benchmark-scorebar" role="cell" aria-label={`${track.name} score ${track.score} out of 100`}>
                <span className="benchmark-scorebar-fill" style={{ height }} />
                <b>{track.score}</b>
              </div>
              <div className="benchmark-scorecard-track" role="cell">
                <strong>{track.name}</strong>
                <span>{track.note}</span>
              </div>
              <dl className="benchmark-scorecard-metrics">
                <div role="cell">
                  <dt>Checks</dt>
                  <dd>{track.pass}/{track.applicable}</dd>
                </div>
                <div role="cell">
                  <dt>Warnings</dt>
                  <dd>{track.warn}</dd>
                </div>
                <div role="cell">
                  <dt>Median</dt>
                  <dd>{latency}</dd>
                </div>
              </dl>
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
