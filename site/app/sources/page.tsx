import { createPageMetadata } from "../metadata";
import { homeContent } from "../content";
import { OnePagePanelDeck, type OnePagePanel } from "../one-page-panels";

export const metadata = createPageMetadata({
  description: "npm, PyPI, GitHub, Hugging Face, MCP and the Nipmod archive through one API for agents.",
  path: "/sources",
  title: "Nipmod sources"
});

const sourceDetails: Record<string, OnePagePanel["rows"]> = {
  GitHub: [
    {
      code: "GET /api/search?q=agent%20repo&sources=github&limit=5",
      label: "Search",
      text: "Find source repositories through the same hosted API surface.",
      title: "Repository search"
    },
    {
      code: "GET /api/inspect?source=github&name=owner/repo",
      label: "Inspect",
      text: "Return source links, license context, public metrics and trust factors when available.",
      title: "Repo context"
    }
  ],
  "Hugging Face": [
    {
      code: "GET /api/search?q=embedding&sources=huggingface-model,huggingface-dataset&limit=5",
      label: "Search",
      text: "Resolve public model and dataset records into one agent-readable format.",
      title: "Models and datasets"
    },
    {
      label: "Boundary",
      text: "Nipmod links back to the original Hugging Face record and does not claim ownership.",
      title: "Original source retained"
    }
  ],
  MCP: [
    {
      code: "GET /api/search?q=browser&sources=mcp&limit=5",
      label: "Search",
      text: "Find public MCP tool servers and return source-owned records.",
      title: "Tool registry"
    },
    {
      code: "POST /api/mcp",
      label: "MCP",
      text: "Agents can reach the same package intelligence surface through MCP JSON-RPC.",
      title: "Hosted read-only MCP"
    }
  ],
  "Nipmod archive": [
    {
      code: "GET /api/archive/status",
      label: "Status",
      text: "Check whether durable archive writes are enabled.",
      title: "Archive mode"
    },
    {
      code: "GET /api/archive/prepare?source=npm&name=undici",
      label: "Prepare",
      text: "Prepare a confirmed-use record before anything is written to the durable archive.",
      title: "Confirmed records"
    }
  ],
  PyPI: [
    {
      code: "GET /api/search?q=http%20client&sources=pypi&limit=5",
      label: "Search",
      text: "Find Python packages through the public PyPI source.",
      title: "Python packages"
    },
    {
      code: "GET /api/inspect?source=pypi&name=requests",
      label: "Inspect",
      text: "Return source metadata, license context, version data and trust factors.",
      title: "Package context"
    }
  ],
  npm: [
    {
      code: "GET /api/search?q=react&sources=npm&limit=5",
      label: "Search",
      text: "Find JavaScript packages through the public npm registry.",
      title: "JavaScript packages"
    },
    {
      code: "GET /api/inspect?source=npm&name=react",
      label: "Inspect",
      text: "Return package metadata, repository links, integrity signals and trust factors.",
      title: "Package context"
    }
  ]
};

export default function SourcesPage() {
  const panels = homeContent.platformRoadmap.items.map<OnePagePanel>((source) => ({
    eyebrow: source.label,
    id: source.name.toLowerCase().replaceAll(" ", "-"),
    rows: [
      {
        label: "Status",
        text: `${source.name} is live as a ${source.label} source. External ownership stays with the original source.`,
        title: source.status
      },
      ...(sourceDetails[source.name] ?? [])
    ],
    summary: source.text,
    title: source.name
  }));

  return (
    <main className="page-shell api-page-shell one-page-shell" id="main">
      <section className="quickstart-hero one-page-hero sources-one-page-hero" aria-labelledby="sources-title">
        <div>
          <p className="eyebrow">Sources</p>
          <h1 id="sources-title">Sources agents can search.</h1>
          <p className="lead">
            Nipmod resolves public package sources and returns one agent-readable format. External packages stay owned by
            their original source.
          </p>
        </div>
      </section>

      <section className="one-page-board sources-one-page-board" aria-label="Package sources">
        <div className="source-boundary-compact">
          <article>
            <span>Does</span>
            <p>Search public metadata.</p>
          </article>
          <article>
            <span>Returns</span>
            <p>Trust context and install plans.</p>
          </article>
          <article>
            <span>Does not</span>
            <p>Claim ownership of external packages.</p>
          </article>
        </div>
        <OnePagePanelDeck panels={panels} />
      </section>
    </main>
  );
}
