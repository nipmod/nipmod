import Link from "next/link";
import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsSequence, DocsShell, DocsTable } from "../docs-shell";
import { createPageMetadata } from "../metadata";
import { DemoRunner } from "./demo-runner";

export const metadata = createPageMetadata({
  description: "Run the Nipmod flow for package search, trust inspection and reviewable install planning.",
  path: "/demo",
  title: "Nipmod demo"
});

const agentPrompt = `Use Nipmod before adding external tooling.
If no key is available, issue one with POST https://nipmod.com/api/keys/beta.
Search sources, inspect the exact selected record and request an install plan.
Show source context, trust signals, warnings and the command boundary.
Do not install, clone, enable tools or edit files until I approve.`;

export default function DemoPage() {
  return (
    <DocsShell
      description="A public demo of the moment before an AI agent brings outside software into a workflow. Nipmod searches, checks, explains and stops before any workspace write."
      eyebrow="Demo"
      stats={[
        { label: "Decision", value: "before action" },
        { label: "Hosted writes", value: "0" },
        { label: "Output", value: "receipt" },
        { label: "Approval", value: "required" }
      ]}
      title="Run the agent preflight."
    >
      <DocsSection eyebrow="Plain English" title="What happens in the demo">
        <DocsSequence
          items={[
            {
              body: "The user asks an agent for a package, model, repository, SDK, CLI or MCP server.",
              label: "1",
              title: "An agent needs outside software"
            },
            {
              body: "Nipmod searches supported public sources instead of letting the agent guess from memory or random metadata.",
              label: "2",
              title: "Nipmod finds candidates"
            },
            {
              body: "The selected record is inspected for source context, trust signals, warnings and alternatives.",
              label: "3",
              title: "The choice gets explained"
            },
            {
              body: "Nipmod returns a reviewable install plan as data. The hosted API does not run the command.",
              label: "4",
              title: "Execution stays blocked"
            },
            {
              body: "The host or user can approve locally, reject it or store a receipt for the decision.",
              label: "5",
              title: "A human or host policy decides"
            }
          ]}
        />
      </DocsSection>

      <DocsSection eyebrow="Live" title="Interactive demo">
        <DemoRunner />
      </DocsSection>

      <DocsSection eyebrow="Agent" title="Copy the instruction">
        <DocsCode>{agentPrompt}</DocsCode>
      </DocsSection>

      <DocsSection eyebrow="Terminal" title="Run the same path with curl">
        <DocsGrid>
          <DocsCard label="1" title="Search">
            <DocsCode>{"curl 'https://nipmod.com/api/search?q=http%20client&limit=3' -H 'x-nipmod-api-key: <key>'"}</DocsCode>
          </DocsCard>
          <DocsCard label="2" title="Inspect">
            <DocsCode>{"curl 'https://nipmod.com/api/inspect?source=npm&name=undici' -H 'x-nipmod-api-key: <key>'"}</DocsCode>
          </DocsCard>
          <DocsCard label="3" title="Plan">
            <DocsCode>{"curl 'https://nipmod.com/api/install-plan?source=npm&name=undici' -H 'x-nipmod-api-key: <key>'"}</DocsCode>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection eyebrow="Boundary" title="What the demo proves">
        <DocsTable
          rows={[
            ["Key required", "Package intelligence calls require a beta or partner key."],
            ["Search works", "The resolver can query supported public sources."],
            ["Trust is visible", "The response includes source context and warnings."],
            ["Decision object", "Nipmod can express the result as a recommended candidate, scored comparison, security posture, alternatives, avoid list and receipt."],
            ["No remote write", "The hosted API returns a plan only."],
            ["Local approval", "Actual install remains a local, approved action."]
          ]}
        />
      </DocsSection>

      <DocsSection eyebrow="Readout" title="Why it matters">
        <DocsTable
          rows={[
            ["For agents", "They get a grounded package decision before acting."],
            ["For hosts", "They can enforce approval and policy before commands touch a workspace."],
            ["For partners", "They can add a package-intelligence step without building every source resolver themselves."],
            ["For investors", "It shows the product as infrastructure in the agent execution path, not only a static package directory."]
          ]}
        />
      </DocsSection>

      <DocsSection eyebrow="Receipt" title="What a host should store">
        <DocsTable
          rows={[
            ["Recommended", "Source, name, version, trust decision and decision score."],
            ["Comparison", "The candidates considered and their pass, review or block gate."],
            ["Security", "Warnings, high-risk signals and the hosted execution boundary."],
            ["Install plan", "The command as review data, never as hosted execution."],
            ["Archive", "Optional dry-run confirmation only after usefulness is confirmed."]
          ]}
        />
      </DocsSection>

      <DocsSection eyebrow="Machine" title="Agent-readable flow">
        <DocsTable
          rows={[
            ["Demo flow", <Link className="data-link" href="/agent-demo-flow.json" key="flow">/agent-demo-flow.json</Link>],
            ["API reference", <Link className="data-link" href="/api-access" key="api">/api-access</Link>],
            ["Integration kit", <Link className="data-link" href="/integrations" key="integrations">/integrations</Link>]
          ]}
        />
      </DocsSection>

      <div className="docs-next">
        <Link href="/investors">Investor brief</Link>
        <Link href="/proof">Proof loop</Link>
        <Link href="/benchmark">Benchmark</Link>
      </div>
    </DocsShell>
  );
}
