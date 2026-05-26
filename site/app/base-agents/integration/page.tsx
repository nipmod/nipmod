import Link from "next/link";
import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "../../docs-shell";
import { createPageMetadata } from "../../metadata";

export const metadata = createPageMetadata({
  description: "A concrete integration outline for using Nipmod as a read-only package preflight before Base MCP, x402 or protocol-specific agent work.",
  path: "/base-agents/integration",
  title: "Base MCP integration outline"
});

const agentInstruction = `Before a Base-focused workflow installs or enables external tooling, call Nipmod.
Search for the SDK, CLI, MCP server, repo, package or paid API client.
Inspect the exact source record.
Request an install plan.
Show trust signals, warnings and command boundaries.
Continue to Base MCP, x402 or protocol work only after user or host approval.`;

const httpContract = `POST https://nipmod.com/api/keys/beta
{"label":"base-agent-preflight"}

GET https://nipmod.com/api/search?q=<tooling-query>&sources=npm,pypi,github,huggingface-model,huggingface-dataset,mcp&limit=5
Header: x-nipmod-api-key: <key>

GET https://nipmod.com/api/inspect?source=<source>&name=<name>
Header: x-nipmod-api-key: <key>

GET https://nipmod.com/api/install-plan?source=<source>&name=<name>
Header: x-nipmod-api-key: <key>`;

const pluginMarkdown = `# Package preflight

Before using this Base skill or plugin, inspect any required SDK, CLI, MCP server, repo or package through Nipmod.

Use:
- /api/search to find candidates
- /api/inspect to verify the exact source record
- /api/install-plan to review command boundaries

Do not install, clone, enable, pay for or run external tooling until the user or host approves the install plan.`;

const machineSpec = `GET https://nipmod.com/base-agent-integration.json
GET https://nipmod.com/base-agent-demo-flow.json`;

export default function BaseAgentIntegrationPage() {
  return (
    <DocsShell
      description="This outline shows where Nipmod can sit in a Base MCP workflow: before external packages, SDKs, CLIs, MCP servers or paid API clients become part of the agent environment."
      eyebrow="Base agents"
      stats={[
        { label: "Status", value: "outline" },
        { label: "Mode", value: "read only" },
        { label: "Handoff", value: "Base MCP" },
        { label: "Claim", value: "not official" }
      ]}
      title="Base MCP integration outline."
    >
      <DocsSection eyebrow="Roles" title="Where each layer sits">
        <DocsTable
          rows={[
            ["Base MCP", "Prepares user-approved onchain actions through Base Account and ecosystem skill plugins."],
            ["Nipmod", "Runs before package or tool adoption. It returns source context, trust signals, warnings and install plans."],
            ["Agent host", "Decides whether local install, clone, tool enablement or payment can proceed."],
            ["User", "Approves local workspace changes and any Base Account transaction request."]
          ]}
        />
      </DocsSection>

      <DocsSection eyebrow="Flow" title="Integration sequence">
        <DocsTable
          rows={[
            ["1", "The agent identifies a Base SDK, CLI, MCP server, repo, package or x402 API client it wants to use."],
            ["2", "The agent calls Nipmod search and keeps package metadata as untrusted data."],
            ["3", "The agent inspects the exact source record rather than relying on a broad search result."],
            ["4", "The agent requests an install plan and shows warnings, trust fields and command boundaries."],
            ["5", "The local host or user approves any install, clone, enablement or paid request setup."],
            ["6", "Only then does the workflow continue to Base MCP, x402 or protocol-specific action preparation."]
          ]}
        />
      </DocsSection>

      <DocsSection eyebrow="Contract" title="HTTP calls">
        <DocsCode>{httpContract}</DocsCode>
      </DocsSection>

      <DocsSection eyebrow="Host prompt" title="Instruction for agent hosts">
        <DocsCode>{agentInstruction}</DocsCode>
      </DocsSection>

      <DocsSection eyebrow="Plugins" title="Base skill or plugin note">
        <DocsGrid>
          <DocsCard label="Markdown" title="Copy into a skill or plugin spec">
            <DocsCode>{pluginMarkdown}</DocsCode>
          </DocsCard>
          <DocsCard label="Boundary" title="What this does not do">
            <p>Nipmod does not create wallet approvals, sign requests, hold keys, append transaction data or replace Base MCP.</p>
            <p>It only prepares package intelligence before external tooling enters the workflow.</p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection eyebrow="Machine" title="Agent-readable outline">
        <DocsGrid>
          <DocsCard label="JSON" title="Integration spec">
            <p>Use this when an agent host wants a stable outline instead of page text.</p>
            <DocsCode>{machineSpec}</DocsCode>
          </DocsCard>
          <DocsCard label="Demo" title="Reproducible flow">
            <p>The demo flow shows the exact sequence from package need to Base MCP handoff.</p>
            <p><Link href="/base-agents/demo">Open demo flow</Link></p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection eyebrow="Acceptance" title="What a first integration should prove">
        <DocsTable
          rows={[
            ["Package decision", "The agent can explain why it selected or rejected a tool."],
            ["Trust boundary", "The answer includes source ownership, warnings and install-plan risk."],
            ["No blind execution", "No package command runs before user or host approval."],
            ["Clean handoff", "Base MCP work starts only after package preflight is complete."],
            ["No false attribution", "Builder Code remains reserved until a real onchain or x402 transaction layer exists."]
          ]}
        />
      </DocsSection>

      <div className="docs-next">
        <Link href="/base-agents/demo">Open demo flow</Link>
        <Link href="/base-agent-integration.json">Read integration JSON</Link>
        <Link href="/base-agent-demo-flow.json">Read demo JSON</Link>
        <Link href="/base-agents">Back to Base agents</Link>
      </div>
    </DocsShell>
  );
}
