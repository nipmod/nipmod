import { createPageMetadata } from "../metadata";
import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "../docs-shell";

export const metadata = createPageMetadata({
  description: "The public package sources Nipmod resolves through one API for agents.",
  path: "/sources",
  title: "Nipmod sources"
});

const sources = [
  {
    access: "key-required",
    example: "curl 'https://nipmod.com/api/inspect?source=npm&name=undici' -H 'x-nipmod-api-key: <key>'",
    kind: "package registry",
    name: "npm",
    use: "JavaScript and TypeScript packages."
  },
  {
    access: "key-required",
    example: "curl 'https://nipmod.com/api/inspect?source=pypi&name=requests' -H 'x-nipmod-api-key: <key>'",
    kind: "package registry",
    name: "PyPI",
    use: "Python packages."
  },
  {
    access: "key-required",
    example: "curl 'https://nipmod.com/api/inspect?source=github&name=vercel/next.js' -H 'x-nipmod-api-key: <key>'",
    kind: "source repositories",
    name: "GitHub",
    use: "Repository discovery and source context."
  },
  {
    access: "key-required",
    example: "curl 'https://nipmod.com/api/inspect?source=huggingface-model&name=google-bert/bert-base-uncased' -H 'x-nipmod-api-key: <key>'",
    kind: "model and dataset hub",
    name: "Hugging Face",
    use: "Public model and dataset records."
  },
  {
    access: "key-required",
    example: "curl 'https://nipmod.com/api/inspect?source=mcp&name=ac.tandem/docs-mcp' -H 'x-nipmod-api-key: <key>'",
    kind: "tool registry",
    name: "MCP",
    use: "Public MCP server records."
  },
  {
    access: "key-required",
    example: "curl 'https://nipmod.com/api/archive/prepare?source=npm&name=undici' -H 'x-nipmod-api-key: <key>'",
    kind: "confirmed records",
    name: "Nipmod archive",
    use: "Records saved after useful confirmed discovery."
  }
] as const;

export default function SourcesPage() {
  return (
    <DocsShell
      description="Nipmod resolves public sources into one agent-readable response format. The archive is separate: it stores confirmed useful records, not every search."
      eyebrow="Sources"
      stats={[
        { label: "Sources", value: "5" },
        { label: "Archive", value: "confirmed records" },
        { label: "Ownership", value: "external retained" },
        { label: "Hosted writes", value: "none" }
      ]}
      title="Sources agents can search."
    >
      <DocsSection title="Supported sources">
        <DocsTable
          rows={sources.slice(0, 5).map((source) => ({
            first: source.name,
            second: source.use,
            third: `${source.kind} / ${source.access}`
          }))}
        />
      </DocsSection>

      <DocsSection title="Archive source">
        <DocsGrid>
          <DocsCard title="Confirmed records">
            <p>The Nipmod archive is not a public package host like npm or PyPI. It stores useful package intelligence after confirmation.</p>
          </DocsCard>
          <DocsCard title="No bulk copying">
            <p>Search can read external sources, but a package becomes durable only through an explicit archive flow.</p>
          </DocsCard>
          <DocsCard title="Reusable context">
            <p>Archived records keep source context, trust checks and receipts so later agents can reuse known decisions.</p>
          </DocsCard>
        </DocsGrid>
      </DocsSection>

      <DocsSection title="Exact examples">
        <DocsGrid>
          {sources.slice(0, 5).map((source) => (
            <DocsCard key={source.name} label={source.kind} title={source.name}>
              <p>{source.use}</p>
              <DocsCode>{source.example}</DocsCode>
            </DocsCard>
          ))}
        </DocsGrid>
      </DocsSection>

      <DocsSection title="Health and limits">
        <DocsTable
          rows={[
            {
              first: "Capability health",
              second: <code>GET /api/sources/health</code>,
              third: "Requires x-nipmod-api-key and returns configured source capabilities."
            },
            {
              first: "Live probe",
              second: <code>GET /api/sources/health?probe=live</code>,
              third: "Requires x-nipmod-api-key. Bounded live source check used by launch verification."
            },
            {
              first: "Circuit metadata",
              second: "Every source report includes circuit status and resolver metadata.",
              third: "Useful when one upstream is slow or degraded."
            }
          ]}
        />
      </DocsSection>
    </DocsShell>
  );
}
