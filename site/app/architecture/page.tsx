import Link from "next/link";
import { ArchitectureDiagram, DocsProse, DocsSection, DocsSequence, DocsShell, DocsTable } from "../docs-shell";
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
              first: "Local Deep Scan",
              second: "If package files are already present, the CLI can run a static local scan before approval.",
              third: "No downloads, clones, unpacking, execution or writes."
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
        <DocsSequence
          items={[
            {
              body: "The agent searches live sources. Nipmod returns candidates without treating them as verified archive entries.",
              label: "1",
              title: "Ephemeral search"
            },
            {
              body: "The agent selects one record and reads source, version, license, warnings and trust fields.",
              label: "2",
              title: "Exact inspect"
            },
            {
              body: "Nipmod returns commands and risk context for review. This is still not execution.",
              label: "3",
              title: "Install plan"
            },
            {
              body: "If source or package files already exist locally, the agent can run a static deep scan without installing or executing code.",
              label: "4",
              title: "Local deep scan"
            },
            {
              body: "The user or local host decides whether the command can run in the workspace.",
              label: "5",
              title: "Approval"
            },
            {
              body: "If the result is useful, it can become a reusable record with source context, trust checks and receipts.",
              label: "6",
              title: "Confirmed archive"
            }
          ]}
        />
      </DocsSection>

      <DocsSection title="What is not happening">
        <DocsProse>
          <p>
            Search, Inspect and Install Plan do not download packages, run package managers or change lockfiles. The hosted
            API gives the agent package intelligence, not local execution power. Deep scan is local only and reads files that
            are already present on disk.
          </p>
          <p>
            Nipmod does not claim ownership of npm, PyPI, GitHub, Hugging Face or MCP records. Source ownership remains with
            the original publisher, and Nipmod records only the context needed for agents to make safer decisions.
          </p>
          <p>
            Package descriptions, READMEs, model cards and MCP descriptions are always treated as untrusted data. They can be
            summarized and inspected, but they cannot override the user, the host or the safety boundary.
          </p>
        </DocsProse>
      </DocsSection>

      <DocsSection title="Beta rollout">
        <DocsProse>
          <p>
            The API starts free and rate limited so real agents can test the flow while the trust model improves. This phase is
            about observing real package searches, improving source quality and learning which package records are useful
            enough to become durable intelligence.
          </p>
          <p>
            We are using the Base ecosystem as the first collaboration surface because the project, token and early community
            are already there. After the API and archive loop are stable, the same structure applies to agent builders beyond
            Base.
          </p>
          <p>
            Premium access and higher usage tiers can come later, after the public beta proves the package layer with real
            usage. The product boundary stays the same: search, inspect, install plan, approval, then optional archive
            confirmation.
          </p>
        </DocsProse>
      </DocsSection>

      <div className="docs-next">
        <Link href="/quickstart">Start quickstart</Link>
        <Link href="/api-access">Open API reference</Link>
        <Link href="/trust">Read trust model</Link>
      </div>
    </DocsShell>
  );
}
