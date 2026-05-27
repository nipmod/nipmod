import Link from "next/link";
import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "../docs-shell";
import { integrationKit } from "../../lib/integration-kit";
import { createPageMetadata } from "../metadata";

export const metadata = createPageMetadata({
  description: "Generic Nipmod integration kit for agent products, MCP servers, SDKs, CLIs, wallets, infra layers and devtools.",
  path: "/integrations",
  title: "Nipmod integration kit"
});

const hostInstruction = `Before this agent installs or enables external tooling, call Nipmod.
Search for the package, repo, model, dataset, MCP server, SDK or CLI.
Inspect the exact source record.
Request an install plan.
Show trust signals, warnings and the command boundary.
Continue only after user or host approval.`;

const httpContract = `POST https://nipmod.com/api/keys/beta
{"label":"partner-or-agent-host"}

GET https://nipmod.com/api/search?q=<query>&sources=npm,pypi,github,huggingface-model,huggingface-dataset,mcp&limit=5
Header: x-nipmod-api-key: <key>

GET https://nipmod.com/api/inspect?source=<source>&name=<name>
Header: x-nipmod-api-key: <key>

GET https://nipmod.com/api/install-plan?source=<source>&name=<name>
Header: x-nipmod-api-key: <key>`;

const mcpContract = `POST https://nipmod.com/api/mcp
Header: x-nipmod-api-key: <key>

{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"nipmod.resolve","arguments":{"query":"http client","sources":["npm","pypi","github","mcp"]}}}`;

export default function IntegrationsPage() {
  return (
    <DocsShell
      description="The generic integration surface for any team that wants package intelligence before an agent installs dependencies, pulls repos, enables MCP servers, uses models or adopts SDKs and CLIs."
      eyebrow="Integrations"
      stats={[
        { label: "Mode", value: "read only" },
        { label: "API", value: "key required" },
        { label: "Workspace writes", value: "0 hosted" },
        { label: "Audience", value: "any agent host" }
      ]}
      title="Integration kit."
    >
      <DocsSection eyebrow="Who" title="Who this is for">
        <DocsGrid>
          <DocsCard label="Agents" title="Coding and operator agents">
            <p>Use Nipmod before dependency selection, repo adoption, model usage or MCP tool enablement.</p>
          </DocsCard>
          <DocsCard label="Hosts" title="Agent products and runtimes">
            <p>Use the install plan as a policy input before the host allows local writes or tool activation.</p>
          </DocsCard>
          <DocsCard label="Builders" title="SDK, CLI and MCP teams">
            <p>Make your public tooling easier for agents to discover, inspect and install with explicit boundaries.</p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection eyebrow="Contract" title="HTTP integration">
        <DocsCode>{httpContract}</DocsCode>
      </DocsSection>

      <DocsSection eyebrow="MCP" title="Remote read-only MCP">
        <DocsCode>{mcpContract}</DocsCode>
      </DocsSection>

      <DocsSection eyebrow="Host prompt" title="Instruction to ship with an agent">
        <DocsCode>{hostInstruction}</DocsCode>
      </DocsSection>

      <DocsSection eyebrow="Modes" title="Integration modes">
        <DocsTable
          rows={integrationKit.integrationModes.map((mode) => [
            mode.name,
            mode.description,
            mode.id === "preflight" ? "Default first integration" : ""
          ])}
        />
      </DocsSection>

      <DocsSection eyebrow="Boundaries" title="What Nipmod does not take over">
        <DocsTable rows={integrationKit.nonGoals.map((goal) => [goal, "Not part of the hosted integration contract"])} />
      </DocsSection>

      <DocsSection eyebrow="Examples" title="Ecosystem examples">
        <DocsTable
          rows={integrationKit.ecosystemExamples.map((example) => [
            example.ecosystem,
            example.fit,
            <Link className="data-link" href={example.page} key={example.ecosystem}>{example.page.replace("https://nipmod.com", "")}</Link>
          ])}
        />
      </DocsSection>

      <DocsSection eyebrow="Machine" title="Agent-readable kit">
        <DocsTable
          rows={[
            ["Integration kit", <Link className="data-link" href="/integration-kit.json" key="kit">/integration-kit.json</Link>],
            ["Demo flow", <Link className="data-link" href="/agent-demo-flow.json" key="demo">/agent-demo-flow.json</Link>],
            ["Source quality", <Link className="data-link" href="/source-quality.json" key="quality">/source-quality.json</Link>]
          ]}
        />
      </DocsSection>

      <div className="docs-next">
        <Link href="/demo">Run demo</Link>
        <Link href="/api-access">Open API docs</Link>
        <Link href="/source-quality">View source quality</Link>
      </div>
    </DocsShell>
  );
}
