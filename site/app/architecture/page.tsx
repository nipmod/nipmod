import Link from "next/link";
import { ArchitectureDiagram, DocsCard, DocsGrid, DocsSection, DocsShell, DocsTable } from "../docs-shell";
import { createPageMetadata } from "../metadata";

export const metadata = createPageMetadata({
  description: "The current Nipmod architecture: source adapters, trust engine, policy boundary, install plans and optional archive records.",
  path: "/architecture",
  title: "Nipmod architecture"
});

export default function ArchitecturePage() {
  return (
    <DocsShell
      description="The hosted API is a read-only package intelligence layer. It turns existing package sources into agent-readable decisions and install plans."
      eyebrow="Architecture"
      stats={[
        { label: "Hosted execution", value: "none" },
        { label: "Sources", value: "external" },
        { label: "Archive", value: "confirmed use" }
      ]}
      title="How Nipmod works."
    >
      <DocsSection title="System map">
        <ArchitectureDiagram />
      </DocsSection>

      <DocsSection title="Main components">
        <DocsTable
          rows={[
            {
              first: "Agent or host",
              second: "A coding agent, local tool, MCP host or automation calls the Nipmod API before choosing a package.",
              third: "The user still controls approval."
            },
            {
              first: "Source adapters",
              second: "Resolvers query npm, PyPI, GitHub, Hugging Face and MCP sources through public surfaces.",
              third: "Source ownership stays external."
            },
            {
              first: "Normalizer",
              second: "Different source formats are converted into one agent-readable package record.",
              third: "Agents get one shape instead of five."
            },
            {
              first: "Trust engine",
              second: "Nipmod evaluates source context, metadata, warnings, install risk and available evidence.",
              third: "Popularity is not install approval."
            },
            {
              first: "Policy boundary",
              second: "Results are marked as recommended, review or blocked depending on risk and evidence.",
              third: "The agent should show that status."
            },
            {
              first: "Install Plan",
              second: "The API returns commands as review data. It does not run them.",
              third: "Workspace writes happen only after approval."
            },
            {
              first: "Archive",
              second: "Useful confirmed discoveries can be saved as durable package intelligence records.",
              third: "Search alone is not a verified archive entry."
            }
          ]}
        />
      </DocsSection>

      <DocsSection title="Lifecycle">
        <DocsGrid>
          <DocsCard label="1" title="Ephemeral search">
            <p>The agent searches. Nipmod returns candidates from live sources without treating the result as verified.</p>
          </DocsCard>
          <DocsCard label="2" title="Exact inspect">
            <p>The agent selects one record and reads source, version, license, warnings and trust fields.</p>
          </DocsCard>
          <DocsCard label="3" title="Install plan">
            <p>Nipmod returns a safe plan for review. This is still not execution.</p>
          </DocsCard>
          <DocsCard label="4" title="Approval">
            <p>The user or local host decides if the command can run in the workspace.</p>
          </DocsCard>
          <DocsCard label="5" title="Confirmed archive">
            <p>If the result is useful, it can become a reusable record with source context, trust checks and receipts.</p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection title="What is not happening">
        <DocsGrid>
          <DocsCard title="No hidden install">
            <p>Search, Inspect and Install Plan do not download packages, run package managers or change lockfiles.</p>
          </DocsCard>
          <DocsCard title="No source takeover">
            <p>Nipmod does not claim ownership of npm, PyPI, GitHub, Hugging Face or MCP records.</p>
          </DocsCard>
          <DocsCard title="No blind trust">
            <p>Package descriptions, READMEs, model cards and MCP descriptions are treated as untrusted data.</p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection title="Beta rollout">
        <DocsGrid>
          <DocsCard title="Public beta">
            <p>The API starts free and rate limited so real agents can test the flow while the trust model improves.</p>
          </DocsCard>
          <DocsCard title="Base ecosystem first">
            <p>We are using the Base ecosystem as the first collaboration surface because the project, token and early community are already there.</p>
          </DocsCard>
          <DocsCard title="Wider agent market next">
            <p>After the API and archive loops are stable, the same structure applies to agent builders beyond Base.</p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <div className="docs-next">
        <Link href="/quickstart">Start quickstart</Link>
        <Link href="/api-access">Open API reference</Link>
        <Link href="/trust">Read trust model</Link>
      </div>
    </DocsShell>
  );
}
