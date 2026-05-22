import type { Metadata } from "next";
import { withPreviewImage } from "../metadata";
import { homeContent } from "../content";

export const metadata: Metadata = {
  alternates: { canonical: "https://nipmod.com/sources" },
  description: "Public package sources Nipmod can resolve for agents.",
  openGraph: withPreviewImage({
    description: "npm, PyPI, GitHub, Hugging Face, MCP and the Nipmod archive through one API for agents.",
    title: "Nipmod sources",
    url: "https://nipmod.com/sources"
  }),
  title: "Nipmod"
};

export default function SourcesPage() {
  return (
    <main className="page-shell api-page-shell" id="main">
      <section className="quickstart-hero" aria-labelledby="sources-title">
        <div>
          <p className="eyebrow">Sources</p>
          <h1 id="sources-title">Sources agents can search.</h1>
          <p className="lead">
            Nipmod resolves public package sources and returns one agent-readable format. External packages stay owned by
            their original source.
          </p>
        </div>
      </section>

      <section className="source-grid" aria-label="Package sources">
        {homeContent.platformRoadmap.items.map((source) => (
          <article className="source-card" key={source.name}>
            <div>
              <p className="eyebrow">{source.label}</p>
              <h2>{source.name}</h2>
            </div>
            <p>{source.text}</p>
            <span>{source.status}</span>
          </article>
        ))}
      </section>

      <section className="api-section" aria-labelledby="source-boundary-title">
        <div className="archive-section-head">
          <div>
            <p className="eyebrow">Boundary</p>
            <h2 id="source-boundary-title">Clear boundary</h2>
          </div>
        </div>
        <div className="source-boundary-grid">
          <article>
            <h3>Does</h3>
            <p>Search public metadata.</p>
          </article>
          <article>
            <h3>Does</h3>
            <p>Return trust context and install plans.</p>
          </article>
          <article>
            <h3>Does not</h3>
            <p>Claim ownership of external packages.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
