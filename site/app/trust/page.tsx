import type { Metadata } from "next";
import discoveryData from "../../public/.well-known/nipmod.json";
import registryData from "../registry-data.json";
import { SiteHeader } from "../site-header";
import { registryTrustSummary, shortDid, type RegistryIndex } from "../../lib/registry";

type DiscoveryManifest = typeof discoveryData;

const registry = registryData as RegistryIndex;
const discovery = discoveryData as DiscoveryManifest;
const summary = registryTrustSummary(registry);
const treeHead = registry.transparencyLog?.treeHead;
const witness = registry.transparencyLog?.witnesses?.[0]?.witness ?? "missing";
const installerHash = discovery.install.scriptSha256;
const releaseKey = discovery.install.release.publicKey.spkiSha256;

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/trust"
  },
  description: "Verify nipmod registry trust roots, transparency, witness, advisories and release pins.",
  openGraph: {
    description: "Public trust roots for nipmod packages, releases, advisories, transparency and witness state.",
    title: "nipmod trust",
    url: "https://nipmod.com/trust"
  },
  title: "nipmod trust"
};

export default function TrustPage() {
  return (
    <main className="page-shell">
      <SiteHeader />

      <section className="trust-hero" aria-labelledby="trust-title">
        <p className="eyebrow">Trust</p>
        <h1 id="trust-title">Small surface. Hard proof.</h1>
        <p className="lead">
          nipmod verifies packages by digest, signature, source tag, transparency log and external witness before they
          appear as verified.
        </p>
        <div className={`status-pill ${summary.ready ? "status-ok" : "status-review"}`}>
          {summary.ready ? "Verified registry" : "Review required"}
        </div>
        <div className="actions" aria-label="Machine discovery">
          <a className="button button-primary" href="/evidence#discovery">
            Discovery
          </a>
          <a className="button button-ghost" href="/evidence#registry">
            Registry
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
            { label: "Installer", value: installerHash, href: discovery.install.script },
            { label: "Release key", value: releaseKey, href: discovery.install.release.artifact },
            { label: "Discovery", value: discovery.homepage + "/.well-known/nipmod.json", href: "/.well-known/nipmod.json" },
            { label: "Advisories", value: discovery.advisories, href: "/advisories.json" },
            { label: "Security", value: "https://nipmod.com/security", href: "/security" },
            { label: "Security metadata", value: "https://nipmod.com/.well-known/security.txt", href: "/.well-known/security.txt" }
          ].map((pin) => (
            <div key={pin.label}>
              <dt>{pin.label}</dt>
              <dd>
                <span>{pin.value}</span>
                <a
                  className="data-link"
                  href={pin.href}
                  rel={pin.href.startsWith("http") ? "noreferrer" : undefined}
                  target={pin.href.startsWith("http") ? "_blank" : undefined}
                >
                  Raw data
                </a>
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
