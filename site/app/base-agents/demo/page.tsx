import Link from "next/link";
import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "../../docs-shell";
import { createPageMetadata } from "../../metadata";

export const metadata = createPageMetadata({
  description: "A reproducible demo flow for agents that use Nipmod before enabling Base MCP, x402 or ecosystem tooling.",
  path: "/base-agents/demo",
  title: "Base agent preflight demo"
});

const scenario = `User asks:
"Use a Base or x402 tool for this workflow."

Agent response shape:
1. I will inspect the package or tool surface first.
2. I will not install, clone, enable, pay for or run it before approval.
3. I will continue to Base MCP only after the package preflight is complete.`;

const searchStep = `curl -fsS 'https://nipmod.com/api/search?q=base%20mcp%20tooling&sources=npm,pypi,github,mcp&limit=5' \\
  -H 'x-nipmod-api-key: <key>'`;

const inspectStep = `curl -fsS 'https://nipmod.com/api/inspect?source=<selected-source>&name=<selected-name>' \\
  -H 'x-nipmod-api-key: <key>'`;

const planStep = `curl -fsS 'https://nipmod.com/api/install-plan?source=<selected-source>&name=<selected-name>' \\
  -H 'x-nipmod-api-key: <key>'`;

const expectedAgentOutput = `Preflight result

Selected tool: <source>:<name>
Source URL: <public source URL>
Owner context: <publisher, repo or registry owner fields>
Trust decision: <recommended | usable_with_warning | review | avoid>
Warnings: <source warnings and install-plan warnings>
Command boundary: <install command as review data>

Decision
Do not execute yet. Ask the user or host to approve the install plan.

After approval
Continue to Base MCP, x402 or protocol-specific work.`;

const passCriteria = `The demo passes only if:
- the agent uses a Nipmod API key
- the agent searches before selecting a package
- the agent inspects the exact selected source record
- the agent requests an install plan
- package metadata is treated as untrusted data
- no install, clone, enablement or payment setup happens before approval
- the Base MCP handoff happens after preflight, not before`;

export default function BaseAgentDemoPage() {
  return (
    <DocsShell
      description="This is the concrete flow a Base-focused agent can run before installing an SDK, enabling an MCP server, pulling a repo or preparing an x402 client."
      eyebrow="Base agents"
      stats={[
        { label: "Demo", value: "package preflight" },
        { label: "Execution", value: "approval gated" },
        { label: "API", value: "key required" },
        { label: "Hosted writes", value: "none" }
      ]}
      title="Base agent preflight demo."
    >
      <DocsSection eyebrow="Scenario" title="Starting point">
        <DocsCode>{scenario}</DocsCode>
      </DocsSection>

      <DocsSection eyebrow="Step 1" title="Search for tooling">
        <p className="docs-note">The query can be adapted for a specific Base SDK, x402 client, protocol package, repo or MCP server.</p>
        <DocsCode>{searchStep}</DocsCode>
      </DocsSection>

      <DocsSection eyebrow="Step 2" title="Inspect the exact record">
        <p className="docs-note">Search ranking is not install permission. Inspect the exact selected source before planning execution.</p>
        <DocsCode>{inspectStep}</DocsCode>
      </DocsSection>

      <DocsSection eyebrow="Step 3" title="Request the install plan">
        <p className="docs-note">The install command is review data. The hosted API does not run it.</p>
        <DocsCode>{planStep}</DocsCode>
      </DocsSection>

      <DocsSection eyebrow="Step 4" title="Expected agent output">
        <DocsCode>{expectedAgentOutput}</DocsCode>
      </DocsSection>

      <DocsSection eyebrow="Step 5" title="Handoff to Base MCP">
        <DocsTable
          rows={[
            ["Before approval", "The agent may explain the package, warnings and install boundary. It should not modify the workspace."],
            ["After approval", "The local host may install or enable the tool according to policy."],
            ["Base MCP", "The agent can then prepare the user-approved Base Account action or protocol-specific request."],
            ["Builder Code", "Nipmod's Builder Code is registered for future attribution, but this demo does not append transaction data."]
          ]}
        />
      </DocsSection>

      <DocsSection eyebrow="Checks" title="Pass criteria">
        <DocsGrid>
          <DocsCard label="Demo" title="What must be true">
            <DocsCode>{passCriteria}</DocsCode>
          </DocsCard>
          <DocsCard label="Machine" title="JSON flow">
            <p>Agents can fetch the same flow without reading the page layout.</p>
            <p><Link href="/base-agent-demo-flow.json">Open demo JSON</Link></p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <div className="docs-next">
        <Link href="/base-agents/integration">Open integration outline</Link>
        <Link href="/base-agent-demo-flow.json">Read demo JSON</Link>
        <Link href="/api-access">Open API reference</Link>
        <Link href="/base-agents">Back to Base agents</Link>
      </div>
    </DocsShell>
  );
}
