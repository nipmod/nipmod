import { createPageMetadata } from "../metadata";
import { DocsCard, DocsCode, DocsGrid, DocsSection, DocsShell, DocsTable } from "../docs-shell";

export const metadata = createPageMetadata({
  description: "The public package sources Nipmod resolves through one API for agents.",
  path: "/sources",
  title: "Nipmod sources"
});

const sources = [
  {
    access: "public",
    example: "sources=npm",
    kind: "package registry",
    name: "npm",
    use: "JavaScript and TypeScript packages."
  },
  {
    access: "public",
    example: "sources=pypi",
    kind: "package registry",
    name: "PyPI",
    use: "Python packages."
  },
  {
    access: "public",
    example: "sources=github",
    kind: "source repositories",
    name: "GitHub",
    use: "Repository discovery and source context."
  },
  {
    access: "public",
    example: "sources=huggingface-model,huggingface-dataset",
    kind: "model and dataset hub",
    name: "Hugging Face",
    use: "Public model and dataset records."
  },
  {
    access: "public",
    example: "sources=mcp",
    kind: "tool registry",
    name: "MCP",
    use: "Public MCP server records."
  },
  {
    access: "internal",
    example: "/api/archive/*",
    kind: "confirmed records",
    name: "Nipmod archive",
    use: "Records saved after useful confirmed discovery."
  }
] as const;

export default function SourcesPage() {
  return (
    <DocsShell
      description="Nipmod bundles public package sources into one API response format. It links back to original sources and keeps source ownership external."
      eyebrow="Sources"
      stats={[
        { label: "Live sources", value: "6" },
        { label: "Ownership", value: "external retained" },
        { label: "Hosted writes", value: "none" }
      ]}
      title="Sources agents can search."
    >
      <DocsSection title="Supported sources">
        <DocsTable
          rows={sources.map((source) => ({
            first: source.name,
            second: source.use,
            third: `${source.kind} / ${source.access}`
          }))}
        />
      </DocsSection>

      <DocsSection title="Source selectors">
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
              third: "Returns configured source capabilities."
            },
            {
              first: "Live probe",
              second: <code>GET /api/sources/health?probe=live</code>,
              third: "Bounded live source check used by launch verification."
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
