import Link from "next/link";
import { DocsCard, DocsGrid, DocsProse, DocsSection, DocsSequence, DocsShell, DocsTable } from "../docs-shell";
import { createPageMetadata } from "../metadata";

export const metadata = createPageMetadata({
  description:
    "A plain-English Nipmod investor brief: what the product is, why agent package intelligence matters and which public proof points are already live.",
  path: "/investors",
  title: "Nipmod investor brief"
});

export default function InvestorsPage() {
  return (
    <DocsShell
      description="Nipmod is the package intelligence layer for AI agents. In simple terms: Google or Wikipedia for agents when they need to choose outside code, models, repos, SDKs, CLIs or tools."
      eyebrow="Investor brief"
      stats={[
        { label: "Position", value: "agent trust layer" },
        { label: "Build", value: "founder-led" },
        { label: "Mode", value: "API first" },
        { label: "Proof", value: "public live" }
      ]}
      title="Nipmod investor brief."
    >
      <DocsSection eyebrow="Simple version" title="What Nipmod is">
        <DocsProse>
          <p>
            AI agents are starting to do real work: install packages, connect tools, pull repositories, load models and
            prepare workflows. Before they act, they need a trusted place to ask basic questions: what is this package,
            where does it come from, what are the risks, which alternative is better and what command would be run?
          </p>
          <p>
            Nipmod turns public software sources into that preflight answer. The product gives agents a readable decision
            before anything is installed, cloned, executed or written into a workspace.
          </p>
        </DocsProse>
      </DocsSection>

      <DocsSection eyebrow="Why now" title="Why this category can be large">
        <DocsGrid>
          <DocsCard label="Market shift" title="Agents are moving from chat to action">
            <p>When agents act, they need outside software. Package choice becomes part of the agent execution path.</p>
          </DocsCard>
          <DocsCard label="Default layer" title="One check before many actions">
            <p>A preflight API can sit in front of SDK installs, MCP enablement, model loading, repo reuse and CLI setup.</p>
          </DocsCard>
          <DocsCard label="Timing" title="The infrastructure is still early">
            <p>AI infrastructure categories often get valued around future default positions before the final market shape is obvious.</p>
          </DocsCard>
        </DocsGrid>
        <p className="docs-note">
          This is a category thesis, not a return promise. The current public proof is product readiness, source depth and repeatable agent workflow evidence.
        </p>
      </DocsSection>

      <DocsSection eyebrow="Proof" title="What already exists">
        <DocsTable
          rows={[
            ["API and MCP", "Key-gated package search, inspect and install-plan calls, plus a hosted read-only MCP endpoint."],
            ["Six source families", "npm, PyPI, GitHub, Hugging Face models, Hugging Face datasets and MCP registries."],
            ["Agent demo", "A public path that issues a beta key, searches, inspects, creates a plan and stops before workspace writes."],
            ["Benchmark", "An 8-case public preflight benchmark with explicit limits and machine-readable results."],
            ["Source quality", "Offline regression gates that check search quality, source coverage and unsafe decoy handling."],
            ["Security boundary", "The hosted API does not install, clone, unpack, execute, sign, pay or write into the caller workspace."]
          ]}
        />
      </DocsSection>

      <DocsSection eyebrow="Roadmap" title="Where this goes">
        <DocsSequence
          items={[
            {
              body: "Nipmod is already a public API that agents and hosts can call before adding outside software.",
              label: "1",
              title: "Own the preflight moment"
            },
            {
              body: "Partner with agent hosts, MCP products, SDKs, wallets, CLIs and infrastructure teams that need safer tool discovery.",
              label: "2",
              title: "Distribute through agent platforms"
            },
            {
              body: "Turn useful decisions into reusable package intelligence, so the product gets better as more workflows are reviewed.",
              label: "3",
              title: "Build the intelligence archive"
            },
            {
              body: "Monetize through API usage, partner access, enterprise policy layers and hosted trust infrastructure.",
              label: "4",
              title: "Become the default trust layer"
            }
          ]}
        />
      </DocsSection>

      <DocsSection eyebrow="Team" title="Founder-led build">
        <DocsProse>
          <p>
            Nipmod is founder-led today. That is the point of leverage: product, API, public proof surfaces, benchmark,
            docs, safety boundaries and live monitors have been built with very little overhead.
          </p>
          <p>
            The next step is not to make the story more complicated. It is to turn the existing product proof into usage,
            partner conversations and repeatable distribution through agents that already need this decision layer.
          </p>
        </DocsProse>
      </DocsSection>

      <DocsSection eyebrow="Readout" title="Investor readout">
        <DocsTable
          rows={[
            ["Product", "Google or Wikipedia for AI agents before they choose external software."],
            ["Customer", "Agent hosts, MCP teams, developer tools, wallets, infrastructure companies and teams running agents at work."],
            ["Economic path", "API access, partner keys, usage-based plans and enterprise policy or trust layers."],
            ["Current strength", "A working public product with machine-readable proof, not only a slide concept."],
            ["Current risk", "Early category, founder-led capacity and distribution still need to compound."],
            ["Boundary", "Nipmod provides preflight evidence. It does not promise malware-free software or execute code for the user."]
          ]}
        />
      </DocsSection>

      <div className="docs-next">
        <Link href="/demo">Run the demo</Link>
        <Link href="/proof">Open proof loop</Link>
        <Link href="/benchmark">Benchmark</Link>
        <Link href="/partners">Partner pack</Link>
      </div>
    </DocsShell>
  );
}
