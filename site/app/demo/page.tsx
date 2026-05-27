import Link from "next/link";
import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "../docs-shell";
import { createPageMetadata } from "../metadata";
import { DemoRunner } from "./demo-runner";

export const metadata = createPageMetadata({
  description: "Run the Nipmod flow for package search, trust inspection and safe install planning.",
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
      description="A public agent preflight demo. Issue a beta key, search package sources, inspect the selected record, request an install plan and stop before workspace writes."
      eyebrow="Demo"
      stats={[
        { label: "Flow", value: "key, search, inspect, plan" },
        { label: "Execution", value: "none hosted" },
        { label: "Approval", value: "local only" }
      ]}
      title="Run the agent preflight."
    >
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
            ["No remote write", "The hosted API returns a plan only."],
            ["Local approval", "Actual install remains a local, approved action."]
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
    </DocsShell>
  );
}
