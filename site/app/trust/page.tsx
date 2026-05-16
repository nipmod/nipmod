import registryData from "../registry-data.json";
import { SiteHeader } from "../site-header";
import { registryTrustSummary, shortDid, type RegistryIndex } from "../../lib/registry";

const registry = registryData as RegistryIndex;
const summary = registryTrustSummary(registry);
const treeHead = registry.transparencyLog?.treeHead;
const witness = registry.transparencyLog?.witnesses?.[0]?.witness ?? "missing";
const installerHash = "f0adffc43c905c0d44c804822cf1e1b26c41d2b27d08d36f58e857f7cc7a32d1";
const releaseKey = "49de8ed6bb670abcefc579534811a1f48c0e478f8427479e0ea05f839f96964e";
const discoveryManifest = "https://nipmod.com/.well-known/nipmod.json";
const advisories = "https://nipmod.com/advisories.json";

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
          <div>
            <dt>Log</dt>
            <dd>{treeHead?.logId ?? "missing"}</dd>
          </div>
          <div>
            <dt>Witness</dt>
            <dd>{shortDid(witness)}</dd>
          </div>
          <div>
            <dt>Checkpoint</dt>
            <dd>{treeHead?.rootHash ?? "missing"}</dd>
          </div>
          <div>
            <dt>Installer</dt>
            <dd>{installerHash}</dd>
          </div>
          <div>
            <dt>Release key</dt>
            <dd>{releaseKey}</dd>
          </div>
          <div>
            <dt>Discovery</dt>
            <dd>{discoveryManifest}</dd>
          </div>
          <div>
            <dt>Advisories</dt>
            <dd>{advisories}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
