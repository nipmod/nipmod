import type { Metadata } from "next";
import { CommandBlock } from "../command-block";
import registryData from "../registry-data.json";
import { packagePageHref } from "../packages/content";
import type { RegistryIndex } from "../../lib/registry";

const registry = registryData as RegistryIndex;
const exampleNames = [
  "gitlawb-repo-reader",
  "prompt-injection-scan",
  "dependency-risk-review",
  "github-issue-triage",
  "mcp-server-import-example",
  "package-migration-planner"
];
const examples = exampleNames
  .map((name) => registry.packages.find((pkg) => pkg.name === name))
  .filter((pkg): pkg is RegistryIndex["packages"][number] => Boolean(pkg));

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/examples"
  },
  description: "Example Nipmod packages for agent repo reading, safety review, imports and migration planning.",
  openGraph: {
    description: "A small set of package examples agents can search, inspect and install from Nipmod.",
    title: "Nipmod examples",
    url: "https://nipmod.com/examples"
  },
  title: "Nipmod examples"
};

export default function ExamplesPage() {
  return (
    <main className="page-shell" id="main">
      <section className="quickstart-hero" aria-labelledby="examples-title">
        <p className="eyebrow">Examples</p>
        <h1 id="examples-title">Useful first packages</h1>
        <p className="lead">
          Start with packages that demonstrate reading, guarding, importing and preparing agent package work.
        </p>
        <div className="actions" aria-label="Examples actions">
          <a className="button button-primary" href="/demo">
            Run demo
          </a>
          <a className="button button-ghost" href="/packages">
            All packages
          </a>
          <a className="button button-ghost" href="/setup">
            Setup agent
          </a>
        </div>
      </section>

      <section className="registry-section" aria-labelledby="examples-grid-title">
        <div className="section-head">
          <p className="eyebrow">Packages</p>
          <h2 id="examples-grid-title">Search, inspect, then plan</h2>
          <p>Every example uses the same safe path: view metadata, inspect proof, plan install, then write only after approval.</p>
        </div>
        <div className="package-grid">
          {examples.map((pkg) => (
            <article className="package-card" key={pkg.canonical}>
              <div className="package-card-top">
                <div>
                  <h3>
                    <a href={packagePageHref(pkg)}>{pkg.name}</a>
                  </h3>
                  <p>{pkg.description}</p>
                </div>
                <span className="trust-badge trust-verified">{pkg.trust.level}</span>
              </div>
              <CommandBlock command={`nipmod inspect ${pkg.canonical}@${pkg.version}\nnipmod install --plan ${pkg.name}`} label={`Copy ${pkg.name} commands`} />
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
