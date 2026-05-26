import { DocsCode, DocsSection, DocsShell, DocsTable } from "../../docs-shell";
import { createPageMetadata } from "../../metadata";

export const metadata = createPageMetadata({
  description: "Use Nipmod from agent hosts for package search, trust checks and safe install plans.",
  path: "/agents/mcp-hosts",
  title: "Nipmod for agent hosts"
});

export default function AgentHostsPage() {
  return (
    <DocsShell
      description="Agent hosts use the same Nipmod surface: hosted API first, read only hosted MCP when useful, local MCP only for controlled workspace operations."
      eyebrow="Agent hosts"
      title="One API for every host."
    >
      <DocsSection eyebrow="API" title="Default path">
        <DocsCode>{"GET https://nipmod.com/api/search?q=<query> with x-nipmod-api-key\nGET https://nipmod.com/api/inspect?source=npm&name=undici with x-nipmod-api-key\nGET https://nipmod.com/api/install-plan?source=npm&name=undici with x-nipmod-api-key"}</DocsCode>
      </DocsSection>

      <DocsSection eyebrow="Local" title="Optional local server">
        <DocsCode>{"curl https://nipmod.com/i|bash\nnipmod mcp serve"}</DocsCode>
      </DocsSection>

      <DocsSection eyebrow="Boundary" title="Host wording">
        <DocsTable
          rows={[
            ["Compatible", "The host can use Nipmod if it can call HTTPS or MCP."],
            ["Official", "Only use this word after the host confirms it."],
            ["Safe", "Hosted calls remain read only and local writes require approval."]
          ]}
        />
      </DocsSection>
    </DocsShell>
  );
}
