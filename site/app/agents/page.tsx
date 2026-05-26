import { createPageMetadata } from "../metadata";
import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "../docs-shell";

export const metadata = createPageMetadata({
  description: "Use the Nipmod package API from any agent that can call HTTPS or MCP.",
  path: "/agents",
  title: "Nipmod agents"
});

export default function AgentsPage() {
  return (
    <DocsShell
      description="Agents do not need a native Nipmod integration. They call the hosted API, read the trust response and only write locally after the user approves an install plan."
      eyebrow="Agents"
      stats={[
        { label: "Core path", value: "HTTPS" },
        { label: "MCP", value: "read only hosted" },
        { label: "Workspace writes", value: "local only" }
      ]}
      title="Use Nipmod from any agent."
    >
      <DocsSection eyebrow="Default" title="The recommended agent flow">
        <DocsTable
          rows={[
            ["1", "User asks the agent for a package, tool, workflow or library."],
            ["2", "The agent calls Nipmod search across supported sources."],
            ["3", "The agent inspects the best candidate and shows trust context."],
            ["4", "The agent asks for an install plan. The hosted API still does not write."],
            ["5", "If the user approves, the local environment performs the install itself."]
          ]}
        />
      </DocsSection>

      <DocsSection eyebrow="Surfaces" title="Two ways agents can call Nipmod">
        <DocsGrid>
          <DocsCard label="Hosted" title="HTTP API">
            <p>Use this first. It works from any agent runtime with outbound HTTPS.</p>
            <DocsCode>{"GET https://nipmod.com/api/search?q=<query> with x-nipmod-api-key\nGET https://nipmod.com/api/inspect?source=npm&name=undici with x-nipmod-api-key\nGET https://nipmod.com/api/install-plan?source=npm&name=undici with x-nipmod-api-key"}</DocsCode>
          </DocsCard>
          <DocsCard label="Hosted" title="Read only MCP">
            <p>Use the same package surface through MCP JSON-RPC. Remote MCP calls never read or write the caller workspace.</p>
            <DocsCode>{"POST https://nipmod.com/api/mcp with x-nipmod-api-key"}</DocsCode>
          </DocsCard>
          <DocsCard label="Optional" title="Local CLI">
            <p>Install locally only when the workspace needs controlled writes after the plan is approved.</p>
            <DocsCode>{"curl https://nipmod.com/i|bash\nnipmod doctor --online"}</DocsCode>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection eyebrow="Boundary" title="What this page does not claim">
        <DocsTable
          rows={[
            ["No marketplace claim", "This is not a claim that a third party platform has officially listed Nipmod."],
            ["No remote writes", "The hosted API and hosted MCP surface do not mutate user workspaces."],
            ["No hidden approval", "Every install plan still requires local approval before code enters a workspace."]
          ]}
        />
      </DocsSection>
    </DocsShell>
  );
}
