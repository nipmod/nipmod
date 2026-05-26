import { createPageMetadata } from "../metadata";
import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "../docs-shell";

export const metadata = createPageMetadata({
  description: "Optional local Nipmod setup for controlled workspace writes after an approved install plan.",
  path: "/setup",
  title: "Nipmod setup"
});

export default function SetupPage() {
  return (
    <DocsShell
      description="Most agents can start with the hosted API. Local setup is only needed when you want the Nipmod CLI or a local MCP server to perform controlled workspace actions."
      eyebrow="Setup"
      stats={[
        { label: "Install", value: "one line" },
        { label: "Doctor", value: "online check" },
        { label: "Write scope", value: "local" }
      ]}
      title="Local setup is optional."
    >
      <DocsSection eyebrow="Quickstart" title="Install and check">
        <DocsGrid>
          <DocsCard label="1" title="Install">
            <DocsCode>{"curl https://nipmod.com/i|bash"}</DocsCode>
          </DocsCard>
          <DocsCard label="2" title="Check the environment">
            <DocsCode>{"nipmod doctor --online"}</DocsCode>
          </DocsCard>
          <DocsCard label="3" title="Run local MCP only when needed">
            <DocsCode>{"nipmod mcp serve"}</DocsCode>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection eyebrow="When" title="Use local setup only for local control">
        <DocsTable
          rows={[
            ["Search", "Use hosted API first. No local install required."],
            ["Inspect", "Use hosted API first. No local install required."],
            ["Install plan", "Use hosted API first. It returns a plan, not a write."],
            ["Workspace write", "Use local CLI or local MCP after user approval."]
          ]}
        />
      </DocsSection>

      <DocsSection eyebrow="Agent prompt" title="What to tell an agent">
        <DocsCode>{"Use Nipmod through https://nipmod.com/api/search with x-nipmod-api-key, inspect the selected package, request an install plan, and do not write to the workspace until I approve the plan."}</DocsCode>
      </DocsSection>
    </DocsShell>
  );
}
