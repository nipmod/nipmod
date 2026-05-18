import type { Metadata } from "next";
import { CommandBlock } from "../command-block";
import { homeContent } from "../content";

const skillInstall = "https://nipmod.com/integrations/bankr/nipmod/SKILL.md";
const githubSkillFolder = "https://github.com/nipmod/nipmod/tree/main/integrations/bankr/nipmod";

const services = [
  {
    label: "Search",
    title: "package-search",
    text: "Bankr agents can search verified Nipmod packages before choosing a tool."
  },
  {
    label: "Audit",
    title: "package-audit",
    text: "Agents can read trust, permissions and safe next commands without running package code."
  },
  {
    label: "Draft",
    title: "repo-package-draft",
    text: "A public Gitlawb repo can become a package draft with a clear owner claim path."
  }
];

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/bankr"
  },
  description: "Bankr integration for Nipmod packages, skills and x402 services.",
  openGraph: {
    description: "Install the Nipmod skill in Bankr and call package workflows through x402.",
    title: "Nipmod for Bankr agents",
    url: "https://nipmod.com/bankr"
  },
  title: "Nipmod for Bankr"
};

export default function BankrPage() {
  return (
    <main className="page-shell" id="main">
      <section className="quickstart-hero" aria-labelledby="bankr-title">
        <p className="eyebrow">Bankr</p>
        <h1 id="bankr-title">Nipmod for Bankr agents</h1>
        <p className="lead">Install the skill, search packages, inspect trust and call paid package services from Bankr.</p>
        <div className="actions" aria-label="Bankr actions">
          <a className="button button-primary" href="/integrations/bankr/nipmod/SKILL.md">
            Open Bankr skill file
          </a>
          <a className="button button-ghost" href="/integrations/bankr/bankr.x402.json">
            Open x402 config
          </a>
          <a
            className="button button-ghost"
            href={homeContent.links.bankrCoin}
            aria-label="Open Nipmod coin on Bankr in a new tab"
            rel="noreferrer"
            target="_blank"
          >
            Bankr coin
          </a>
        </div>
      </section>

      <section className="registry-section" aria-labelledby="bankr-install-title">
        <div className="section-head">
          <p className="eyebrow">Skill</p>
          <h2 id="bankr-install-title">Install the skill</h2>
          <p>Bankr installs skills from public GitHub folders. Gitlawb stays the canonical source, and GitHub mirrors the skill folder for review.</p>
        </div>
        <div className="quickstart-grid">
          <article className="quickstart-card">
            <span>Skill file</span>
            <h2>Use now</h2>
            <p>Open the public skill file in Bankr while the catalog mirror is pending.</p>
            <CommandBlock command={skillInstall} label="Copy public skill URL" />
          </article>
          <article className="quickstart-card">
            <span>Catalog</span>
            <h2>Ready for review</h2>
            <p>The same skill folder is ready for Bankr catalog review.</p>
            <CommandBlock command={githubSkillFolder} label="Copy GitHub skill folder" />
          </article>
        </div>
      </section>

      <section className="registry-section" aria-labelledby="bankr-x402-title">
        <div className="section-head">
          <p className="eyebrow">Services</p>
          <h2 id="bankr-x402-title">x402 services</h2>
          <p>USDC config is deploy ready. The $NPM asset file is a custom asset blueprint for Bankr review.</p>
        </div>
        <div className="quickstart-grid">
          {services.map((service) => (
            <article className="quickstart-card" key={service.title}>
              <span>{service.label}</span>
              <h2>{service.title}</h2>
              <p>{service.text}</p>
            </article>
          ))}
          <article className="quickstart-card">
            <span>Deploy</span>
            <h2>Bankr x402</h2>
            <p>Deploy from the Bankr integration folder after Bankr login.</p>
            <CommandBlock command={"cd integrations/bankr\nbankr x402 deploy"} label="Copy Bankr x402 deploy command" />
          </article>
        </div>
      </section>

      <section className="trust-section" aria-labelledby="bankr-boundaries-title">
        <div>
          <p className="eyebrow">Boundaries</p>
          <h2 id="bankr-boundaries-title">Clean integration path</h2>
        </div>
        <div className="check-list">
          {[
            "Bankr is the wallet, agent and payment surface.",
            "Gitlawb remains the source network for signed agent repos.",
            "Nipmod is the package, trust and install layer.",
            "Paid calls need explicit user approval inside Bankr."
          ].map((item) => (
            <article className="check-row" key={item}>
              <span className="check-dot check-ok" aria-hidden="true" />
              <div>
                <h3>{item}</h3>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
