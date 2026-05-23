import { DocsCode, DocsSection, DocsShell, DocsTable } from "../docs-shell";
import { createPageMetadata } from "../metadata";

export const metadata = createPageMetadata({
  description: "Run the public Nipmod proof loop for package discovery, install planning and source health checks.",
  path: "/proof",
  title: "Nipmod proof"
});

export default function ProofPage() {
  return (
    <DocsShell
      description="Proof is the repeatable path that shows the API and resolver are reachable, structured and bounded."
      eyebrow="Proof"
      title="Public proof loop."
    >
      <DocsSection eyebrow="Run" title="Read only proof commands">
        <DocsCode>{"curl 'https://nipmod.com/api/openapi'\ncurl 'https://nipmod.com/api/search?q=http%20client&limit=3'\ncurl 'https://nipmod.com/api/inspect?source=npm&name=undici'\ncurl 'https://nipmod.com/api/install-plan?source=npm&name=undici'\ncurl 'https://nipmod.com/api/sources/health'\ncurl 'https://nipmod.com/api/archive/status'"}</DocsCode>
      </DocsSection>

      <DocsSection eyebrow="Expected" title="What a clean proof shows">
        <DocsTable
          rows={[
            ["OpenAPI", "The public contract returns a valid schema."],
            ["Search", "The resolver returns normalized candidate records."],
            ["Inspect", "An exact package record includes source and trust context."],
            ["Install plan", "The response requires approval before workspace writes."],
            ["Source health", "Supported source resolvers report status."],
            ["Archive status", "Archive mode is explicit."]
          ]}
        />
      </DocsSection>
    </DocsShell>
  );
}
