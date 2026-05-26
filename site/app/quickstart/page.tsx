import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "../docs-shell";
import { createPageMetadata } from "../metadata";

export const metadata = createPageMetadata({
  description: "Nipmod quickstart for API access, package search, trust checks, install plans and optional local setup.",
  path: "/quickstart",
  title: "Nipmod docs"
});

const agentPrompt = `Use Nipmod before choosing a package.
If no API key is available, issue one with POST /api/keys/beta.
Search sources with x-nipmod-api-key, inspect the selected package and show me the install plan before writing anything to the workspace.`;

const completeFlow = `curl 'https://nipmod.com/api/search?q=http%20client&limit=3' -H 'x-nipmod-api-key: <key>'
curl 'https://nipmod.com/api/inspect?source=npm&name=undici' -H 'x-nipmod-api-key: <key>'
curl 'https://nipmod.com/api/install-plan?source=npm&name=undici' -H 'x-nipmod-api-key: <key>'`;

const localSetup = `curl https://nipmod.com/i|bash
nipmod doctor --online
nipmod mcp serve`;

export default function QuickstartPage() {
  return (
    <DocsShell
      description="Most users do not install Nipmod first. They tell their agent to call the hosted API, review the result and approve only when a local command should run."
      eyebrow="Quickstart"
      stats={[
        { label: "Start", value: "tell your agent" },
        { label: "Core calls", value: "3" },
        { label: "Local install", value: "optional" }
      ]}
      title="Start with your agent."
    >
      <DocsSection title="Before anything installs">
        <DocsGrid>
          <DocsCard title="No package is downloaded">
            <p>Search and Inspect only read public package metadata. They do not download a package into your project.</p>
          </DocsCard>
          <DocsCard title="No file is changed">
            <p>Install Plan returns a command as text. It does not edit files, lockfiles or workspace settings.</p>
          </DocsCard>
          <DocsCard title="Approval comes first">
            <p>Your agent should show the plan and wait. The local tool or terminal runs the command only after approval.</p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

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
            <p>Install the CLI only when you want local checks or a local MCP server. The hosted API does not require it.</p>
          </DocsCard>
          <DocsCard title="Hosted API first">
            <p>Most agents can start with HTTPS calls. No native platform integration is required for the basic flow.</p>
          </DocsCard>
          <DocsCard title="Local execution">
            <p>If you approve an install plan, your own workspace tool runs the command. Nipmod does not run it remotely.</p>
          </DocsCard>
        </DocsGrid>
        <DocsCode>{localSetup}</DocsCode>
      </DocsSection>
    </DocsShell>
  );
}
