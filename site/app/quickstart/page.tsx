import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "../docs-shell";
import { createPageMetadata } from "../metadata";

export const metadata = createPageMetadata({
  description: "Nipmod quickstart for API access, package search, trust checks, install plans and optional local setup.",
  path: "/quickstart",
  title: "Nipmod docs"
});

export default function QuickstartPage() {
  return (
    <DocsShell
      description="The shortest path is the hosted API. Local install is optional and only needed after a user approves workspace writes."
      eyebrow="Quickstart"
      toc={[
        { href: "#tell-your-agent-this", label: "Agent prompt" },
        { href: "#three-calls", label: "Three calls" },
        { href: "#local-setup", label: "Local setup" }
      ]}
      title="Start with the API."
    >
      <DocsSection eyebrow="Agent" title="Tell your agent this">
        <DocsCode>{"Use Nipmod before choosing a package. Search sources, inspect the selected package, then show me the install plan before writing anything to the workspace."}</DocsCode>
      </DocsSection>

      <DocsSection eyebrow="Calls" title="Three calls">
        <DocsGrid>
          <DocsCard label="1" title="Search">
            <DocsCode>{"curl 'https://nipmod.com/api/search?q=http%20client&limit=3'"}</DocsCode>
          </DocsCard>
          <DocsCard label="2" title="Inspect">
            <DocsCode>{"curl 'https://nipmod.com/api/inspect?source=npm&name=undici'"}</DocsCode>
          </DocsCard>
          <DocsCard label="3" title="Install plan">
            <DocsCode>{"curl 'https://nipmod.com/api/install-plan?source=npm&name=undici'"}</DocsCode>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection eyebrow="Optional" title="Local setup">
        <DocsTable
          rows={[
            ["Install CLI", <DocsCode key="install">{"curl https://nipmod.com/i|bash"}</DocsCode>],
            ["Check", <DocsCode key="doctor">{"nipmod doctor --online"}</DocsCode>],
            ["Local MCP", <DocsCode key="mcp">{"nipmod mcp serve"}</DocsCode>]
          ]}
        />
      </DocsSection>
    </DocsShell>
  );
}
