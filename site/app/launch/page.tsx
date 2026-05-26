import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "../docs-shell";
import { createPageMetadata } from "../metadata";

export const metadata = createPageMetadata({
  description: "Public Nipmod launch paths for API use, proof checks, review and package readiness.",
  path: "/launch",
  title: "Nipmod launch"
});

export default function LaunchPage() {
  return (
    <DocsShell
      description="The public launch surface is the API, the source resolver, the archive boundary and the trust model. External adoption is tracked separately from product readiness."
      eyebrow="Launch"
      stats={[
        { label: "Core product", value: "API first" },
        { label: "Archive", value: "gated" },
        { label: "External adoption", value: "separate proof" }
      ]}
      title="Launch surface."
    >
      <DocsSection eyebrow="Ready" title="What is ready to show">
        <DocsGrid>
          <DocsCard label="API" title="One package surface">
            <p>Agents can search, inspect and request install plans through one hosted surface.</p>
          </DocsCard>
          <DocsCard label="Trust" title="Readable trust model">
            <p>The public docs explain source context, package identity, warnings and approval boundaries.</p>
          </DocsCard>
          <DocsCard label="Ops" title="Monitoring and receipts">
            <p>Source health, OpenAPI, archive status and production checks are exposed as machine readable receipts.</p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection eyebrow="Truth" title="What stays scoped">
        <DocsTable
          rows={[
            ["Product readiness", "API, source resolver, install plan and read only MCP paths can be verified."],
            ["External adoption", "Only call this live after external users or projects provide evidence."],
            ["Paid access", "Not part of the current launch surface."],
            ["Native partnerships", "Only claim them after the platform confirms them."]
          ]}
        />
      </DocsSection>

      <DocsSection eyebrow="Smoke" title="Public proof command">
        <DocsCode>{"curl 'https://nipmod.com/api/search?q=http%20client&limit=3' -H 'x-nipmod-api-key: <key>'\ncurl 'https://nipmod.com/api/sources/health' -H 'x-nipmod-api-key: <key>'\ncurl 'https://nipmod.com/api/archive/status' -H 'x-nipmod-api-key: <key>'"}</DocsCode>
      </DocsSection>
    </DocsShell>
  );
}
