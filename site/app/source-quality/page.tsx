import Link from "next/link";
import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "../docs-shell";
import { createPageMetadata } from "../metadata";
import { publicSourceQualityReport } from "../../lib/source-quality-public";

export const metadata = createPageMetadata({
  description: "Nipmod source quality benchmark and public source intelligence depth across npm, PyPI, GitHub, Hugging Face and MCP.",
  path: "/source-quality",
  title: "Nipmod source quality"
});

const benchmarkCommand = `pnpm search:benchmark`;

export default function SourceQualityPage() {
  const report = publicSourceQualityReport();
  const benchmark = report.benchmark.summary;
  return (
    <DocsShell
      description="A public view of source intelligence depth. This is not a safety guarantee; it shows what Nipmod can inspect, where the limits are and how search quality is checked."
      eyebrow="Source quality"
      stats={[
        { label: "Benchmark", value: `${benchmark.pass}/${benchmark.total} pass` },
        { label: "MRR", value: String(benchmark.meanReciprocalRank) },
        { label: "Recall at 3", value: String(benchmark.recallAt3) },
        { label: "Blocked recommended", value: String(benchmark.blockedRecommendedCount) }
      ]}
      title="Source quality benchmark."
    >
      <DocsSection eyebrow="Depth" title="Source intelligence depth">
        <div className="quality-profile-list">
          {report.profiles.map((profile) => (
            <article className="quality-profile" key={profile.source}>
              <div>
                <h3>{sourceLabel(profile.source)}</h3>
                <p>{profile.inspectDepth}</p>
              </div>
              <div className="quality-meter" aria-label={`${sourceLabel(profile.source)} depth score ${profile.depthScore} of ${profile.targetDepthScore}`}>
                <span style={{ width: `${Math.min(100, Math.round((profile.depthScore / profile.targetDepthScore) * 100))}%` }} />
              </div>
              <dl>
                <div><dt>Current</dt><dd>{profile.depthScore}</dd></div>
                <div><dt>Target</dt><dd>{profile.targetDepthScore}</dd></div>
                <div><dt>Coverage</dt><dd>{profile.coverage}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </DocsSection>

      <DocsSection eyebrow="Benchmark" title="Search quality gates">
        <DocsGrid>
          <DocsCard label="Command" title="Run locally">
            <DocsCode>{benchmarkCommand}</DocsCode>
          </DocsCard>
          <DocsCard label="Snapshot" title={`${benchmark.pass}/${benchmark.total} passing`}>
            <p>Mean reciprocal rank {benchmark.meanReciprocalRank}, recall at 1 {benchmark.recallAt1}, recall at 3 {benchmark.recallAt3}.</p>
          </DocsCard>
          <DocsCard label="Safety" title="No blocked recommendation">
            <p>Benchmark cases include unsafe decoys and partial source outage behavior.</p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection eyebrow="Profiles" title="What each source is best for">
        <DocsTable
          rows={report.profiles.map((profile) => [
            sourceLabel(profile.source),
            profile.bestFor.join("; "),
            profile.searchDepth
          ])}
        />
      </DocsSection>

      <DocsSection eyebrow="Limits" title="Limits we do not hide">
        <DocsTable
          rows={report.profiles.map((profile) => [
            sourceLabel(profile.source),
            profile.limitations[0] ?? "No source-specific limitation recorded.",
            profile.notClaimed.join("; ")
          ])}
        />
      </DocsSection>

      <DocsSection eyebrow="Machine" title="Agent-readable report">
        <DocsTable
          rows={[
            ["Source quality", <Link className="data-link" href="/source-quality.json" key="quality">/source-quality.json</Link>],
            ["Integration kit", <Link className="data-link" href="/integration-kit.json" key="kit">/integration-kit.json</Link>],
            ["Demo flow", <Link className="data-link" href="/agent-demo-flow.json" key="demo">/agent-demo-flow.json</Link>]
          ]}
        />
      </DocsSection>
    </DocsShell>
  );
}

function sourceLabel(source: string): string {
  switch (source) {
    case "huggingface-model":
      return "Hugging Face models";
    case "huggingface-dataset":
      return "Hugging Face datasets";
    case "pypi":
      return "PyPI";
    case "github":
      return "GitHub";
    case "mcp":
      return "MCP";
    default:
      return source;
  }
}
