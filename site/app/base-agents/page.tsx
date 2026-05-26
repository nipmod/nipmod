import Link from "next/link";
import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "../docs-shell";
import { createPageMetadata } from "../metadata";

export const metadata = createPageMetadata({
  description: "A read-only package intelligence preflight for agents building around Base MCP, x402 and ecosystem tooling.",
  path: "/base-agents",
  title: "Nipmod for Base agents"
});

const baseAgentFlow = `curl -fsS 'https://nipmod.com/api/search?q=base%20agent%20sdk&sources=npm,pypi,github,mcp&limit=5' \\
  -H 'x-nipmod-api-key: <key>'

curl -fsS 'https://nipmod.com/api/inspect?source=npm&name=<package-name>' \\
  -H 'x-nipmod-api-key: <key>'

curl -fsS 'https://nipmod.com/api/install-plan?source=npm&name=<package-name>' \\
  -H 'x-nipmod-api-key: <key>'`;

const baseMcpPrompt = `Before installing or enabling a Base ecosystem SDK, CLI, MCP server or package, use Nipmod.
Search the source, inspect the exact record, show trust signals and request an install plan.
Do not write files, install dependencies or enable tools until the user approves the plan.`;

const remoteMcp = `POST https://nipmod.com/api/mcp
Header: x-nipmod-api-key: <key>

{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"nipmod.resolve","arguments":{"query":"Base MCP tooling","sources":["npm","github","mcp"]}}}`;

const machineSpec = `GET https://nipmod.com/base-agent-preflight.json
GET https://nipmod.com/base-agent-integration.json
GET https://nipmod.com/base-agent-demo-flow.json

Use this JSON before Base-focused package, SDK, CLI, MCP, repo or x402 client decisions.`;

const baseBuilderCode = `Base Builder Code: bc_vu9r71xi
ERC-8021 data suffix:
0x62635f76753972373178690b0080218021802180218021802180218021`;

const pluginBoundary = `Base custom plugin:
  prepares unsigned calldata or maps protocol output to send_calls

Nipmod preflight:
  checks package/tool/source trust before that plugin, SDK or MCP server is installed or enabled`;

export default function BaseAgentsPage() {
  return (
    <DocsShell
      description="Base MCP gives agents a wallet and onchain action surface. Nipmod sits before package, SDK, CLI and MCP decisions so the agent can inspect what it is about to install or enable."
      eyebrow="Base agents"
      stats={[
        { label: "Position", value: "preflight" },
        { label: "Machine spec", value: "public" },
        { label: "Hosted writes", value: "none" },
        { label: "Builder Code", value: "registered" }
      ]}
      title="Nipmod for Base agents."
    >
      <DocsSection eyebrow="Fit" title="Where Nipmod belongs">
        <DocsTable
          rows={[
            [
              "Base MCP",
              "Wallet, onchain action and ecosystem skill surface for agents.",
              <Link href="https://www.base.org/agents" key="base-agents">Base agents</Link>
            ],
            [
              "Nipmod",
              "Package intelligence before an agent installs or enables SDKs, CLIs, MCP servers, models, repos or packages.",
              <Link href="/architecture" key="architecture">Architecture</Link>
            ],
            [
              "Boundary",
              "Nipmod does not sign transactions, hold keys, create wallet approvals or replace Base MCP.",
              "It returns source context, trust signals and install plans."
            ]
          ]}
        />
      </DocsSection>

      <DocsSection eyebrow="Flow" title="Package preflight for Base agents">
        <DocsTable
          rows={[
            ["1", "The agent needs a Base ecosystem package, SDK, CLI, MCP server or repo."],
            ["2", "The agent calls Nipmod search across npm, PyPI, GitHub and MCP sources."],
            ["3", "The agent inspects the exact source record instead of trusting package text."],
            ["4", "Nipmod returns trust signals, warnings and a safe install plan."],
            ["5", "The user or host approves any local install or tool enablement."],
            ["6", "Only after that should the agent continue to Base MCP, x402 or protocol-specific work."]
          ]}
        />
      </DocsSection>

      <DocsSection eyebrow="Calls" title="HTTP preflight">
        <DocsCode>{baseAgentFlow}</DocsCode>
      </DocsSection>

      <DocsSection eyebrow="Machine" title="Agent-readable entrypoint">
        <DocsGrid>
          <DocsCard label="JSON" title="Base preflight spec">
            <p>Agents can fetch compact machine-readable workflows for Base-related package and tool decisions.</p>
            <DocsCode>{machineSpec}</DocsCode>
            <p><Link href="/base-agent-preflight.json">Open preflight JSON</Link></p>
          </DocsCard>
          <DocsCard label="Prompts" title="Prompt pack">
            <p>The public prompt pack includes the Base preflight instruction and links back to this page.</p>
            <p><Link href="/agent-prompts.json">Open agent prompts</Link></p>
          </DocsCard>
          <DocsCard label="Outline" title="Integration outline">
            <p>A concrete handoff model for using Nipmod before Base MCP, x402 or protocol-specific work.</p>
            <p><Link href="/base-agents/integration">Open integration outline</Link></p>
          </DocsCard>
          <DocsCard label="Demo" title="Reproducible flow">
            <p>A step-by-step package preflight demo that agents and host teams can test directly.</p>
            <p><Link href="/base-agents/demo">Open demo flow</Link></p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection eyebrow="MCP" title="Read-only MCP option">
        <DocsGrid>
          <DocsCard label="Remote" title="Nipmod MCP">
            <p>The hosted Nipmod MCP endpoint exposes package intelligence only. It does not read local files and does not write the caller workspace.</p>
            <DocsCode>{remoteMcp}</DocsCode>
          </DocsCard>
          <DocsCard label="Prompt" title="Agent instruction">
            <p>Use this when a Base-focused agent is about to add external tooling.</p>
            <DocsCode>{baseMcpPrompt}</DocsCode>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection eyebrow="Plugins" title="How this fits Base custom plugins">
        <DocsTable
          rows={[
            [
              "Base custom plugin",
              "Defines how an agent calls a protocol API, CLI or MCP server and maps prepared output into Base MCP actions.",
              <Link href="https://docs.base.org/ai-agents/plugins/custom-plugins" key="plugins">Base plugin docs</Link>
            ],
            [
              "Nipmod preflight",
              "Runs before that dependency is trusted. It inspects the SDK, CLI, MCP server, repo or package the agent wants to enable.",
              <Link href="/base-agent-preflight.json" key="spec">Preflight spec</Link>
            ],
            [
              "Clean integration",
              "A Base skill or plugin can instruct the assistant to call Nipmod first, then continue to Base MCP after local approval.",
              "No wallet custody, no signing, no transaction construction."
            ]
          ]}
        />
        <DocsCode>{pluginBoundary}</DocsCode>
      </DocsSection>

      <DocsSection eyebrow="Base surfaces" title="What this helps with">
        <DocsGrid>
          <DocsCard label="Base MCP" title="Skill and toolkit dependencies">
            <p>Agents can inspect package and MCP tooling before enabling a new onchain workflow.</p>
          </DocsCard>
          <DocsCard label="x402" title="Paid service clients">
            <p>Agents can check SDKs and API clients before spending through pay-per-request services.</p>
          </DocsCard>
          <DocsCard label="Ecosystem" title="Partner tooling">
            <p>Projects with SDK, CLI, MCP or package surfaces can become easier for agents to discover and review.</p>
          </DocsCard>
          <DocsCard label="Builder Codes" title="Attribution boundary">
            <p>Nipmod has a Base Builder Code reserved for future onchain attribution. The current hosted API does not append it because Nipmod does not build or submit transactions.</p>
            <DocsCode>{baseBuilderCode}</DocsCode>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection eyebrow="Operator checklist" title="Ready without overclaiming">
        <DocsTable
          rows={[
            ["Base app verification", "Homepage verification meta is present. Claim verified only after the Base app flow confirms it."],
            ["Builder Codes", "Base Builder Code is registered for future attribution. Current hosted API remains read-only and does not append transaction data."],
            ["Base MCP", "Nipmod can be used beside Base MCP today as a read-only package preflight, using HTTPS or the hosted Nipmod MCP endpoint."],
            ["Integration outline", <Link href="/base-agents/integration" key="integration">A concrete package preflight handoff is published for agent hosts.</Link>],
            ["Demo flow", <Link href="/base-agents/demo" key="demo">A reproducible Base package preflight demo is published for testing.</Link>],
            ["Public wording", "Use 'Base agent preflight' or 'integration path'. Do not say 'official Base integration' until Base lists or approves it."]
          ]}
        />
      </DocsSection>

      <DocsSection eyebrow="Links" title="Base references">
        <DocsTable
          rows={[
            ["Base agents", <Link href="https://www.base.org/agents" key="agents">base.org/agents</Link>],
            ["Base MCP quickstart", <Link href="https://docs.base.org/ai-agents/quickstart" key="quickstart">docs.base.org/ai-agents/quickstart</Link>],
            ["Custom plugins", <Link href="https://docs.base.org/ai-agents/plugins/custom-plugins" key="plugins">docs.base.org/ai-agents/plugins/custom-plugins</Link>],
            ["Builder Codes", <Link href="https://docs.base.org/apps/builder-codes/builder-codes" key="builder-codes">docs.base.org/apps/builder-codes/builder-codes</Link>]
          ]}
        />
      </DocsSection>

      <DocsSection eyebrow="Claims" title="What this page does not claim">
        <DocsTable
          rows={[
            ["No official listing", "This page does not claim Base has approved, listed or endorsed Nipmod."],
            ["No wallet custody", "Nipmod never holds user keys, Base Account credentials or signing authority."],
            ["No remote execution", "The hosted API and hosted MCP endpoint do not install packages, clone repos or change workspaces."],
            ["No automatic trust", "A recommended package is still review data. The local host decides whether anything is installed."]
          ]}
        />
      </DocsSection>

      <div className="docs-next">
        <Link href="/api-access">Open API reference</Link>
        <Link href="/base-agents/integration">Open integration outline</Link>
        <Link href="/base-agents/demo">Run demo flow</Link>
        <Link href="/mcp">Use Nipmod MCP</Link>
        <Link href="/base-agent-preflight.json">Read machine spec</Link>
      </div>
    </DocsShell>
  );
}
