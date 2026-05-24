import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "../docs-shell";
import { createPageMetadata } from "../metadata";

export const metadata = createPageMetadata({
  description: "Nipmod quickstart for API access, package search, trust checks, install plans and optional local setup.",
  path: "/quickstart",
  title: "Nipmod docs"
});

const agentPrompt = `Use Nipmod before choosing a package.
Search sources, inspect the selected package and show me the install plan before writing anything to the workspace.`;

const completeFlow = `curl 'https://nipmod.com/api/search?q=http%20client&limit=3'
curl 'https://nipmod.com/api/inspect?source=npm&name=undici'
curl 'https://nipmod.com/api/install-plan?source=npm&name=undici'`;

const localSetup = `curl https://nipmod.com/i|bash
nipmod doctor --online
nipmod mcp serve`;

export default function QuickstartPage() {
  return (
    <DocsShell
      description="The fastest path is the hosted API. Local setup is optional and only needed when a user wants controlled workspace operations after approval."
      eyebrow="Quickstart"
      stats={[
        { label: "Start", value: "1 prompt" },
        { label: "Core calls", value: "3" },
        { label: "Local install", value: "optional" }
      ]}
      title="Start with the API."
    >
      <DocsSection title="Tell your agent this">
        <DocsCode>{agentPrompt}</DocsCode>
      </DocsSection>

      <DocsSection title="Run the flow">
        <DocsGrid>
          <DocsCard label="1" title="Search">
            <p>The agent asks for candidates from supported package sources.</p>
          </DocsCard>
          <DocsCard label="2" title="Inspect">
            <p>The agent checks the exact package record, trust fields, source URL and warnings.</p>
          </DocsCard>
          <DocsCard label="3" title="Plan">
            <p>The agent shows the install plan. The user approves before any workspace write.</p>
          </DocsCard>
        </DocsGrid>
        <DocsCode>{completeFlow}</DocsCode>
      </DocsSection>

      <DocsSection title="What good output looks like">
        <DocsTable
          rows={[
            {
              first: "Package",
              second: <code>npm:undici</code>,
              third: "Selected from search results after inspect, not from a blind install."
            },
            {
              first: "Source",
              second: <code>https://www.npmjs.com/package/undici</code>,
              third: "Original package ownership stays external."
            },
            {
              first: "Trust",
              second: <code>score, decision, risk, warnings</code>,
              third: "Show the user why this package is being recommended."
            },
            {
              first: "Install plan",
              second: <code>npm install undici</code>,
              third: "Review data only. Hosted Nipmod does not execute it."
            },
            {
              first: "Boundary",
              second: <code>manual-after-user-approval</code>,
              third: "No workspace write before the user approves."
            }
          ]}
        />
      </DocsSection>

      <DocsSection title="Optional local setup">
        <DocsGrid>
          <DocsCard title="CLI">
            <p>Use the CLI when the local host needs controlled commands, checks or MCP tools after approval.</p>
          </DocsCard>
          <DocsCard title="Hosted API first">
            <p>Most agents can start with HTTPS calls. No native platform integration is required for the basic flow.</p>
          </DocsCard>
        </DocsGrid>
        <DocsCode>{localSetup}</DocsCode>
      </DocsSection>
    </DocsShell>
  );
}
