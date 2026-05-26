import { createPageMetadata } from "../metadata";
import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "../docs-shell";

export const metadata = createPageMetadata({
  description: "Source and access paths behind the Nipmod package API for agents.",
  path: "/platforms",
  title: "Nipmod source and access"
});

export default function PlatformsPage() {
  return (
    <DocsShell
      description="The public product surface is source coverage plus one agent API. Native partner listings are not required for the core product path."
      eyebrow="Access"
      stats={[
        { label: "Sources", value: "5" },
        { label: "API", value: "one surface" },
        { label: "Native integrations", value: "not required" }
      ]}
      title="Source and access paths."
    >
      <DocsSection eyebrow="Current" title="What is live">
        <DocsGrid>
          <DocsCard label="Sources" title="Public package sources">
            <p>npm, PyPI, GitHub, Hugging Face and MCP are queried through the source resolver. The Nipmod archive stores confirmed records separately.</p>
          </DocsCard>
          <DocsCard label="Access" title="Hosted API">
            <p>Agents use search, inspect and install plan endpoints instead of a custom integration for each agent host.</p>
          </DocsCard>
          <DocsCard label="MCP" title="Remote read-only MCP">
            <p>MCP hosts can use the same surface through JSON RPC without granting workspace write access.</p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection eyebrow="Calls" title="The platform surface is the API">
        <DocsCode>{"GET /api/search?q=<query>&sources=npm,pypi,github,huggingface-model,huggingface-dataset,mcp with x-nipmod-api-key\nGET /api/inspect?source=npm&name=undici with x-nipmod-api-key\nGET /api/install-plan?source=npm&name=undici with x-nipmod-api-key\nPOST /api/mcp with x-nipmod-api-key"}</DocsCode>
      </DocsSection>

      <DocsSection eyebrow="Claims" title="How to read the status">
        <DocsTable
          rows={[
            ["Source coverage", "Nipmod can query public source metadata and normalize records for agents."],
            ["Official partnership", "Only claim this after the external platform confirms it publicly."],
            ["Agent compatibility", "Any agent with HTTPS or MCP access can use the key-required surface."],
            ["Workspace execution", "Always local and approval based. The hosted API does not execute installs."]
          ]}
        />
      </DocsSection>
    </DocsShell>
  );
}
