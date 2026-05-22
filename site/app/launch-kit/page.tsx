import type { Metadata } from "next";
import { withPreviewImage } from "../metadata";
import { CommandBlock } from "../command-block";

const posts = [
  {
    label: "Package API",
    text:
      "Nipmod is moving to one package API for agents.\n\nAgents can search npm, PyPI, GitHub, Hugging Face, MCP and the Nipmod archive through one API, then receive source context, trust checks and safe install plans.\n\nhttps://nipmod.com/api-access"
  },
  {
    label: "Proof reply",
    text:
      "Proof path is public:\n\nSystem readiness: https://nipmod.com/compatibility/system-readiness.json\nPlatform readiness: https://nipmod.com/compatibility/platform-readiness.json\nDemo: https://nipmod.com/demo"
  },
  {
    label: "Package author",
    text:
      "Got a Gitlawb repo you own and want agents to reuse?\n\nUse the self service package path. It gives you local files, owner claim checks and a publish dry run:\nhttps://nipmod.com/package"
  }
];

const assets = [
  { label: "API access", href: "/api-access" },
  { label: "Sources", href: "/sources" },
  { label: "Demo", href: "/demo" },
  { label: "Status", href: "/status" },
  { label: "Examples", href: "/examples" },
  { label: "GitHub", href: "https://github.com/nipmod/nipmod" }
];

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/launch-kit"
  },
  description: "Nipmod launch kit with posts, proof links, demo links and package author next steps.",
  openGraph: withPreviewImage({
    description: "Shareable Nipmod launch kit for proof links, demo paths and short posts.",
    title: "Nipmod launch kit",
    url: "https://nipmod.com/launch-kit"
  }),
  title: "Nipmod launch kit"
};

export default function LaunchKitPage() {
  return (
    <main className="page-shell" id="main">
      <section className="quickstart-hero" aria-labelledby="launch-kit-title">
        <p className="eyebrow">Launch kit</p>
        <h1 id="launch-kit-title">Short posts with proof behind them</h1>
        <p className="lead">Use the copy below only when the matching product path is live and green.</p>
        <div className="actions" aria-label="Launch kit actions">
          <a className="button button-primary" href="/status">
            Check status
          </a>
          <a className="button button-ghost" href="/demo">
            Demo
          </a>
          <a className="button button-ghost" href="/proof">
            Proof
          </a>
        </div>
      </section>

      <section className="registry-section" aria-labelledby="posts-title">
        <div className="section-head">
          <p className="eyebrow">Copy</p>
          <h2 id="posts-title">Post copy</h2>
          <p>Keep public claims tied to what the receipts prove. Do not claim partner approval unless the partner says it.</p>
        </div>
        <div className="quickstart-grid">
          {posts.map((post) => (
            <article className="quickstart-card" key={post.label}>
              <span>{post.label}</span>
              <h2>{post.label}</h2>
              <p>Short copy for X or a reply under a technical question.</p>
              <CommandBlock command={post.text} label={`Copy ${post.label} post`} />
            </article>
          ))}
        </div>
      </section>

      <section className="proof-section" aria-labelledby="assets-title">
        <div>
          <p className="eyebrow">Links</p>
          <h2 id="assets-title">Shareable surfaces</h2>
          <p>These are human pages. Raw JSON receipts stay behind data links on the status page.</p>
        </div>
        <div className="fact-row">
          {assets.map((asset) => (
            <a key={asset.label} href={asset.href}>
              {asset.label}
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
