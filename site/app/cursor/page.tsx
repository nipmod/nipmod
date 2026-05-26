import { DocsCode, DocsSection, DocsShell, DocsTable } from "../docs-shell";
import { createPageMetadata } from "../metadata";

export const metadata = createPageMetadata({
  description: "Use Nipmod from Cursor through the same API and optional local MCP boundaries as other agent hosts.",
  path: "/cursor",
  title: "Nipmod for Cursor"
});

export default function CursorPage() {
  return (
    <DocsShell
      description="Cursor can use Nipmod through the same hosted API path as any other agent. Local MCP setup is optional and should be described as a user controlled setup path, not a marketplace partnership."
      eyebrow="Cursor"
      title="Use the API first."
    >
      <DocsSection eyebrow="Recommended" title="Hosted API">
        <DocsCode>{"GET https://nipmod.com/api/search?q=<query> with x-nipmod-api-key\nGET https://nipmod.com/api/inspect?source=npm&name=undici with x-nipmod-api-key\nGET https://nipmod.com/api/install-plan?source=npm&name=undici with x-nipmod-api-key"}</DocsCode>
      </DocsSection>

      <DocsSection eyebrow="Optional" title="Local MCP">
        <DocsCode>{"curl https://nipmod.com/i|bash\nnipmod mcp serve"}</DocsCode>
      </DocsSection>

      <DocsSection eyebrow="Boundary" title="Claim scope">
        <DocsTable
          rows={[
            ["Works through API", "Any Cursor workflow that can call HTTPS can use Nipmod."],
            ["Local setup", "Users can run the local MCP server when they want local tool access."],
            ["Official status", "Do not describe this as official Cursor listing unless Cursor confirms it."]
          ]}
        />
      </DocsSection>
    </DocsShell>
  );
}
