import type { Metadata } from "next";
import { CommandBlock } from "../command-block";
import { homeContent } from "../content";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/quickstart"
  },
  description: "Install nipmod, inspect a verified package, install it to a workspace and run the author preflight.",
  openGraph: {
    description: "Install nipmod, inspect a verified package, install it to a workspace and run the author preflight.",
    title: "nipmod quickstart",
    url: "https://nipmod.com/quickstart"
  },
  title: "nipmod quickstart"
};

export default function QuickstartPage() {
  return (
    <main className="page-shell" id="main">
      <section className="quickstart-hero" aria-labelledby="quickstart-title">
        <p className="eyebrow">Start</p>
        <h1 id="quickstart-title">Start with one command.</h1>
        <p className="lead">Install the CLI, inspect a package, then lock exact bytes into your workspace.</p>
        <div className="actions" aria-label="Quickstart actions">
          <a className="button button-primary" href="#install">
            Install
          </a>
          <a className="button button-ghost" href="/proof">
            Proof
          </a>
        </div>
      </section>

      <section className="quickstart-grid" aria-label="Quickstart steps">
        {homeContent.quickstartSteps.map((step, index) => (
          <article className="quickstart-card" id={step.label === "Install CLI" ? "install" : undefined} key={step.label}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h2>{step.label}</h2>
            <p>{step.text}</p>
            <CommandBlock command={step.command} label={`Copy ${step.label} command`} />
          </article>
        ))}
      </section>

      <section className="ecosystem-section" aria-labelledby="ops-title">
        <div className="section-head">
          <p className="eyebrow">Ops</p>
          <h2 id="ops-title">What is already watched.</h2>
        </div>
        <div className="usage-strip">
          {homeContent.operatorChecks.map((item) => (
            <article className="usage-item" key={item.label}>
              <h2>{item.label}</h2>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
