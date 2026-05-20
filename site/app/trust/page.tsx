import type { Metadata } from "next";
import discoveryData from "../../public/.well-known/nipmod.json";
import registryData from "../registry-data.json";
import { registryTrustSummary, shortDid, type RegistryIndex } from "../../lib/registry";

type DiscoveryManifest = typeof discoveryData;

const registry = registryData as RegistryIndex;
const discovery = discoveryData as DiscoveryManifest;
const summary = registryTrustSummary(registry);
const treeHead = registry.transparencyLog?.treeHead;
const witness = registry.transparencyLog?.witnesses?.[0]?.witness ?? "missing";
const installerHash = discovery.install.scriptSha256;
const releaseKey = discovery.install.release.publicKey.spkiSha256;
const trustContract = [
  {
    label: "Registry",
    text: "The public package archive. Agents read package ids, versions, digests, source refs, trust evidence and warnings here.",
    href: "/registry/packages.json"
  },
  {
    label: "Quorum",
    text: "Release and security approval receipts bind the exact package digest and source tuple before the public registry marks it quorum passed.",
    href: "/quorum/receipts.json"
  },
  {
    label: "Transparency",
    text: "The append only log and checkpoint pin the current registry state so package evidence can be audited.",
    href: "/transparency/checkpoint.json"
  },
  {
    label: "Witness",
    text: "The external witness signs the checkpoint so the registry is not the only trust root.",
    href: discovery.witness.statements
  },
  {
    label: "Advisories",
    text: "The signed advisory feed can warn or block risky versions without deleting source content.",
    href: "/advisories.json"
  },
  {
    label: "Discovery",
    text: "The well known file tells agents where the registry, installer, releases, advisories and proof files live.",
    href: "/.well-known/nipmod.json"
  }
] as const;

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/trust"
  },
  description: "Verify Nipmod registry trust roots, transparency, witness, advisories and release pins.",
  openGraph: {
    description: "Public trust roots for Nipmod packages, releases, advisories, transparency and witness state.",
    title: "Nipmod trust",
    url: "https://nipmod.com/trust"
  },
  title: "Nipmod trust"
};

export default function TrustPage() {
  return (
    <main className="page-shell" id="main">
      <section className="trust-hero" aria-labelledby="trust-title">
        <p className="eyebrow">Trust</p>
        <h1 id="trust-title">Verify the registry.</h1>
        <p className="lead">
          Nipmod verifies packages by digest, signature, source tag, quorum approvals, transparency log and external
          witness before they appear as verified.
        </p>
        <div className={`status-pill ${summary.ready ? "status-ok" : "status-review"}`}>
          {summary.ready ? "Verified registry" : "Review required"}
        </div>
        <div className="actions" aria-label="Machine discovery">
          <a className="button button-primary" href="/evidence#discovery">
            View public proof
          </a>
          <a className="button button-ghost" href="/evidence#registry">
            Registry evidence
          </a>
          <a className="button button-ghost" href="/evidence#checkpoint">
            Checkpoint
          </a>
        </div>
      </section>

      <section className="trust-grid" aria-label="Trust summary">
        {summary.cards.map((card) => (
          <article className="stat-tile" key={card.label}>
            <span>{card.value}</span>
            <p>{card.label}</p>
          </article>
        ))}
      </section>

      <section className="trust-section" aria-labelledby="contract-title">
        <div>
          <p className="eyebrow">Contract</p>
          <h2 id="contract-title">The public trust layer agents can check</h2>
          <p className="panel-copy">
            These files are the archive contract. The website explains them, but agents can verify the raw files
            directly.
          </p>
        </div>
        <div className="check-list">
          {trustContract.map((item) => (
            <article className="check-row" key={item.label}>
              <span className="check-dot check-ok" aria-hidden="true" />
              <div>
                <h3>{item.label}</h3>
                <p>{item.text}</p>
                <a className="data-link" href={item.href} aria-label={`Open ${item.label} machine file`}>
                  Machine file
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="trust-section" aria-labelledby="chain-title">
        <div>
          <p className="eyebrow">Chain</p>
          <h2 id="chain-title">What must pass</h2>
        </div>
        <div className="check-list">
          {summary.checks.map((check) => (
            <article className="check-row" key={check.label}>
              <span className={check.ok ? "check-dot check-ok" : "check-dot check-warn"} aria-hidden="true" />
              <div>
                <h3>{check.label}</h3>
                <p>{check.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="trust-section" aria-labelledby="pins-title">
        <div>
          <p className="eyebrow">Pins</p>
          <h2 id="pins-title">Current public roots</h2>
        </div>
        <dl className="pin-list">
          {[
            { label: "Log", value: treeHead?.logId ?? "missing", href: discovery.transparency.log },
            { label: "Witness", value: shortDid(witness), href: discovery.witness.statements },
            { label: "Checkpoint", value: treeHead?.rootHash ?? "missing", href: discovery.transparency.checkpoint },
            {
              label: "Quorum policy",
              value: registry.quorumPolicy?.id ?? "missing",
              href: registry.quorumPolicy?.receipts ?? "/quorum/receipts.json"
            },
            { label: "Installer", value: installerHash, href: discovery.install.script },
            { label: "Release key", value: releaseKey, href: "/.well-known/nipmod.json", action: "Machine file" },
            {
              label: "Release artifact",
              value: `nipmod-${discovery.install.release.version}.tgz`,
              href: discovery.install.release.artifact,
              action: "Download artifact"
            },
            {
              label: "Release signature",
              value: `nipmod-${discovery.install.release.version}.tgz.sig`,
              href: discovery.install.release.signature,
              action: "Machine signature"
            },
            { label: "Discovery", value: discovery.homepage + "/.well-known/nipmod.json", href: "/.well-known/nipmod.json" },
            { label: "Advisories", value: discovery.advisories, href: "/advisories.json" },
            { label: "Security", value: "https://nipmod.com/security", href: "/security", action: "Security page" },
            { label: "Security metadata", value: "https://nipmod.com/.well-known/security.txt", href: "/.well-known/security.txt" }
          ].map((pin) => {
            const action = "action" in pin ? pin.action : "Machine file";
            const opensNewTab = pin.href.startsWith("http");
            return (
              <div key={pin.label}>
                <dt>{pin.label}</dt>
                <dd>
                  <span>{pin.value}</span>
                  <a
                    className="data-link"
                    href={pin.href}
                    aria-label={`Open ${pin.label} ${action.toLowerCase()}${opensNewTab ? " in a new tab" : ""}`}
                    rel={opensNewTab ? "noreferrer" : undefined}
                    target={opensNewTab ? "_blank" : undefined}
                  >
                    {action}
                  </a>
                </dd>
              </div>
            );
          })}
        </dl>
      </section>
    </main>
  );
}
