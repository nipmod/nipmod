import type { Metadata } from "next";
import { CommandBlock } from "../command-block";
import { homeContent } from "../content";

const skillInstall = "https://nipmod.com/integrations/bankr/nipmod/SKILL.md";
const githubSkillFolder = "https://github.com/nipmod/nipmod/tree/main/integrations/bankr/nipmod";
const freeServiceMap = "https://nipmod.com/integrations/bankr/bankr.free.json";
const agentProof = "https://nipmod.com/integrations/bankr/bankr.agent-proof.json";
const catalogSubmission = "https://nipmod.com/integrations/bankr/CATALOG_SUBMISSION.md";
const bankrSkillDocs = "https://docs.bankr.bot/skills/in-bankr/skill-format/";
const bankrAgentPrompt =
  "Read https://nipmod.com/integrations/bankr/nipmod/SKILL.md and use Nipmod before installing agent packages.";
const bankrCodexPrompt =
  "Use Nipmod to prepare a Bankr safe package workflow. Search for gitlawb-repo-reader, inspect trust, create an install plan, and do not run wallet, trading or signing actions.";
const bankrProofPrompt =
  "Do not trade, transfer, sign, deploy, launch, swap, buy, sell, or spend anything. Read https://nipmod.com/integrations/bankr/nipmod/SKILL.md and https://nipmod.com/integrations/bankr/bankr.agent-proof.json. Prove the Nipmod workflow by returning JSON with: skillRead, packageFound, trustChecked, installPlanReady and safety. Use the proof package and commands from the proof JSON. Do not install packages or mutate the user's workspace.";
const bankrRuntimeSmoke = "BANKR_API_KEY=bk_... node tools/bankr-agent-smoke.mjs --require-auth";
const proofPackage = "pkg:did:key:z6MkqDAkKNtWH69ZYoFitErk1CCKofFP5AaFjVXy5bVQ4fbD/gitlawb-repo-reader@0.1.0";

const services = [
  {
    label: "Search",
    title: "Free package search",
    text: "Bankr agents use the public Nipmod registry and CLI search before choosing a package."
  },
  {
    label: "Audit",
    title: "Free package audit",
    text: "Agents read trust, permissions and safe next commands without running package code or paying Nipmod."
  },
  {
    label: "Plan",
    title: "Free install plan",
    text: "Agents can prepare the install graph and wait for explicit approval before any workspace write."
  }
];

const proofSteps = [
  {
    label: "Read",
    title: "Skill loaded",
    text: "The agent reads the Bankr skill and returns the safety boundaries before touching packages.",
    command: "curl -fsSL https://nipmod.com/integrations/bankr/nipmod/SKILL.md"
  },
  {
    label: "Find",
    title: "Package found",
    text: "The agent finds a real package in the public registry with verified trust and no permissions.",
    command: "nipmod search gitlawb-repo-reader --online --json"
  },
  {
    label: "Trust",
    title: "Trust checked",
    text: "The agent inspects provenance, witness evidence, digest, signature and permissions before install.",
    command: `nipmod inspect ${proofPackage} --json`
  },
  {
    label: "Plan",
    title: "Install plan only",
    text: "The agent prepares a plan and waits for approval before any workspace mutation.",
    command: `nipmod install --plan ${proofPackage} --json`
  }
];

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/bankr"
  },
  description: "Free Bankr integration for Nipmod packages and agent skills.",
  openGraph: {
    description: "Install the Nipmod skill in Bankr and use free package workflows.",
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
        <p className="lead">
          A free Bankr-ready integration pack for agent skills, package discovery, trust inspection and install planning.
        </p>
        <div className="actions" aria-label="Bankr actions">
          <a className="button button-primary" href="/integrations/bankr/nipmod/SKILL.md">
            Open Bankr skill file
          </a>
          <a className="button button-ghost" href="/integrations/bankr/bankr.free.json">
            Open free service map
          </a>
          <a className="button button-ghost" href="/integrations/bankr/bankr.agent-proof.json">
            Open agent proof
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
          <p>
            The skill follows the Bankr <code>SKILL.md</code> layout with optional references. Gitlawb stays the canonical
            source, and GitHub gives Bankr a public folder for review and installation.
          </p>
        </div>
        <div className="quickstart-grid">
          <article className="quickstart-card">
            <span>Prompt</span>
            <h2>Tell your agent</h2>
            <p>Use this when the skill is not installed from a catalog yet.</p>
            <CommandBlock command={bankrAgentPrompt} label="Copy Bankr agent prompt" />
          </article>
          <article className="quickstart-card">
            <span>Skill file</span>
            <h2>Use now</h2>
            <p>The public skill URL resolves on the live site.</p>
            <CommandBlock command={skillInstall} label="Copy public skill URL" />
          </article>
          <article className="quickstart-card">
            <span>Catalog</span>
            <h2>Ready for review</h2>
            <p>The same folder can be submitted to the Bankr skill catalog.</p>
            <CommandBlock command={githubSkillFolder} label="Copy GitHub skill folder" />
          </article>
          <article className="quickstart-card">
            <span>Submission</span>
            <h2>Catalog packet</h2>
            <p>The PR packet lists the target path, README row, PR body and smoke test.</p>
            <CommandBlock command={catalogSubmission} label="Copy catalog submission packet" />
          </article>
          <article className="quickstart-card">
            <span>Format</span>
            <h2>Bankr skill docs</h2>
            <p>The folder uses Bankr's portable skill format.</p>
            <CommandBlock command={bankrSkillDocs} label="Copy Bankr skill docs" />
          </article>
        </div>
      </section>

      <section className="registry-section" aria-labelledby="bankr-proof-title">
        <div className="section-head">
          <p className="eyebrow">Proof</p>
          <h2 id="bankr-proof-title">Agent proof workflow</h2>
          <p>
            A Bankr agent can now prove the full Nipmod path: read the skill, find a package, check trust, return an
            install plan and stop before any install, wallet action or workspace mutation.
          </p>
        </div>
        <div className="quickstart-grid">
          <article className="quickstart-card">
            <span>Prompt</span>
            <h2>Run with a Bankr agent</h2>
            <p>The prompt blocks wallet actions and asks for machine-readable proof output.</p>
            <CommandBlock command={bankrProofPrompt} label="Copy Bankr proof prompt" />
          </article>
          <article className="quickstart-card">
            <span>Manifest</span>
            <h2>Agent proof JSON</h2>
            <p>The manifest pins the package, expected trust result and safe workflow commands.</p>
            <CommandBlock command={agentProof} label="Copy agent proof manifest" />
          </article>
          <article className="quickstart-card">
            <span>Runtime</span>
            <h2>Bankr API smoke</h2>
            <p>Run this only with a Bankr API key that has Agent API access. The prompt forbids wallet actions.</p>
            <CommandBlock command={bankrRuntimeSmoke} label="Copy Bankr runtime smoke command" />
          </article>
          {proofSteps.map((step) => (
            <article className="quickstart-card" key={step.title}>
              <span>{step.label}</span>
              <h2>{step.title}</h2>
              <p>{step.text}</p>
              <CommandBlock command={step.command} label={`Copy ${step.title} command`} />
            </article>
          ))}
        </div>
      </section>

      <section className="registry-section" aria-labelledby="bankr-agent-host-title">
        <div className="section-head">
          <p className="eyebrow">Agent hosts</p>
          <h2 id="bankr-agent-host-title">Use Bankr proof from Codex or Claude Code</h2>
          <p>
            Bankr remains a workflow proof path. Codex and Claude Code can read the same Bankr skill files and the same
            Nipmod archive before any install, wallet or signing action.
          </p>
        </div>
        <div className="quickstart-grid">
          <article className="quickstart-card">
            <span>Setup</span>
            <h2>Connect agent host</h2>
            <p>Run the host setup first, then paste the safe Bankr prompt.</p>
            <CommandBlock command={"nipmod setup codex\nnipmod setup claude"} label="Copy Bankr host setup commands" />
          </article>
          <article className="quickstart-card">
            <span>Prompt</span>
            <h2>Safe workflow</h2>
            <p>The prompt keeps Bankr proof work away from wallet actions.</p>
            <CommandBlock command={bankrCodexPrompt} label="Copy Bankr safe agent prompt" />
          </article>
        </div>
      </section>

      <section className="registry-section" aria-labelledby="bankr-free-title">
        <div className="section-head">
          <p className="eyebrow">Services</p>
          <h2 id="bankr-free-title">Free services</h2>
          <p>
            Core Nipmod workflows stay free for Bankr agents. The $NPM Bankr coin remains an investor/community token link,
            not a required payment rail for package search, inspect, audit or install planning.
          </p>
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
            <span>Map</span>
            <h2>Free service map</h2>
            <p>Agents can read the machine map without authentication or payment.</p>
            <CommandBlock command={freeServiceMap} label="Copy free service map" />
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
            "Bankr is the wallet, agent and optional commerce surface.",
            "Gitlawb remains the source network for signed agent repos.",
            "Nipmod is the package, trust and install layer.",
            "Nipmod package search, inspect, audit and install planning stay free."
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
