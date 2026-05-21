import discoveryData from "../../public/.well-known/nipmod.json";
import registryData from "../registry-data.json";
import { registryTrustSummary, shortDid, type RegistryIndex, type RegistryPackage } from "../../lib/registry";
import { packagePageSlug } from "../packages/content";

type DiscoveryManifest = typeof discoveryData;

const registry = registryData as RegistryIndex;
const discovery = discoveryData as DiscoveryManifest;
const summary = registryTrustSummary(registry);
const treeHead = registry.transparencyLog?.treeHead;
const witness = registry.transparencyLog?.witnesses?.[0];

export function EvidenceView({ selectedPackage }: { selectedPackage: RegistryPackage | null }) {
  const artifacts = evidenceArtifacts(selectedPackage);

  return (
    <main className="page-shell" id="main">
      <section className="trust-hero" aria-labelledby="evidence-title">
        <p className="eyebrow">Evidence</p>
        <h1 id="evidence-title">Proof humans can read.</h1>
        <p className="lead">
          The registry still publishes raw JSON for agents. The website now explains each proof first, then exposes the
          machine file as an explicit verification link.
        </p>
        <div className={`status-pill ${summary.ready ? "status-ok" : "status-review"}`}>
          {summary.ready ? "Verified registry" : registry.packages.length === 0 ? "Awaiting first package" : "Review required"}
        </div>
      </section>

      <section className="trust-grid" aria-label="Evidence summary">
        {summary.cards.map((card) => (
          <article className="stat-tile" key={card.label}>
            <span>{card.value}</span>
            <p>{card.label}</p>
          </article>
        ))}
      </section>

      {selectedPackage ? <PackageEvidence pkg={selectedPackage} /> : null}

      <section className="trust-section" aria-labelledby="artifact-title">
        <div>
          <p className="eyebrow">Artifacts</p>
          <h2 id="artifact-title">What each proof means</h2>
        </div>
        <div className="check-list">
          {artifacts.map((artifact) => (
            <article className="check-row evidence-row" id={artifact.id} key={artifact.id}>
              <span className="check-dot check-ok" aria-hidden="true" />
              <div>
                <h3>{artifact.label}</h3>
                <p>{artifact.text}</p>
                <a className="data-link" href={artifact.href} aria-label={`Open ${artifact.label} machine file`}>
                  Machine file
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="trust-section" aria-labelledby="roots-title">
        <div>
          <p className="eyebrow">Roots</p>
          <h2 id="roots-title">Current pinned values</h2>
        </div>
        <dl className="pin-list">
          {[
            { label: "Log", value: treeHead?.logId ?? "missing" },
            { label: "Witness", value: witness?.witness ? shortDid(witness.witness) : "missing" },
            { label: "Checkpoint", value: treeHead?.rootHash ?? "missing" },
            { label: "Tree size", value: String(treeHead?.treeSize ?? 0) },
            { label: "Generated", value: treeHead?.generatedAt ?? "missing" },
            { label: "Registry", value: discovery.registry.url },
            { label: "Advisories", value: discovery.advisories }
          ].map((pin) => (
            <div key={pin.label}>
              <dt>{pin.label}</dt>
              <dd>{pin.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}

export function evidencePackageParams(): Array<{ packageName: string }> {
  return registry.packages.map((pkg) => ({ packageName: packagePageSlug(pkg) }));
}

export function findEvidencePackage(value: string): RegistryPackage | null {
  const normalized = decodeURIComponent(value).trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const canonicalMatch = registry.packages.find(
    (pkg) =>
      packagePageSlug(pkg).toLowerCase() === normalized ||
      pkg.canonical.toLowerCase() === normalized ||
      `${pkg.canonical.toLowerCase()}@${pkg.version}` === normalized
  );
  if (canonicalMatch) {
    return canonicalMatch;
  }

  const nameMatches = registry.packages.filter((pkg) => pkg.name.toLowerCase() === normalized);
  return nameMatches.length === 1 ? nameMatches[0] ?? null : null;
}

function PackageEvidence({ pkg }: { pkg: RegistryPackage }) {
  const receipts = pkg.compatibilityReceipts ?? [];

  return (
    <section className="proof-section" aria-labelledby="package-evidence-title" id="package-proof">
      <div>
        <p className="eyebrow">Package</p>
        <h2 id="package-evidence-title">{pkg.name}</h2>
      </div>
      <div className="proof-panel">
        <p className="panel-copy">{pkg.description}</p>
        <dl className="proof-facts">
          {[
            { label: "Canonical", value: `${pkg.canonical}@${pkg.version}` },
            { label: "Digest", value: pkg.digest },
            { label: "Publisher", value: pkg.publisher },
            { label: "Source", value: pkg.sourceCommit ?? "missing" },
            { label: "Trust", value: `${pkg.trust.level}/${pkg.trust.score}` }
          ].map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
        {receipts.length > 0 ? (
          <div className="evidence-receipts" id="compatibility">
            {receipts.map((receipt) => (
              <a
                className="data-link"
                href={receipt.receiptUrl}
                key={receipt.id}
                aria-label={`Open ${receipt.label} machine receipt`}
              >
                {receipt.label} machine receipt
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function evidenceArtifacts(pkg: RegistryPackage | null): Array<{ id: string; href: string; label: string; text: string }> {
  const artifacts = [
    {
      href: "/.well-known/nipmod.json",
      id: "discovery",
      label: "Discovery",
      text: "The manifest agents use to find the registry, installer, advisory feed, transparency log and witness."
    },
    {
      href: "/registry/packages.json",
      id: "registry",
      label: "Registry",
      text: "The package index carrying signed package evidence, digests, source commits, compatibility receipts and warnings."
    },
    ...(treeHead
      ? [
          {
            href: "/transparency/checkpoint.json",
            id: "checkpoint",
            label: "Checkpoint",
            text: "The current transparency tree head. It pins root hash, tree size, timestamp and log identity."
          }
        ]
      : []),
    {
      href: "/advisories.json",
      id: "advisories",
      label: "Advisories",
      text: "The signed safety feed used to warn or block risky package versions without deleting Gitlawb content."
    },
    {
      href: "/.well-known/security.txt",
      id: "security",
      label: "Security policy",
      text: "The public reporting route for vulnerabilities, package incidents and registry trust failures."
    },
    {
      href: "/proof/transcript.json",
      id: "transcript",
      label: "Proof transcript",
      text: "A machine readable record of the demo path: inspect, install, audit and blocked unsafe manifests."
    },
    {
      href: "/review/packet.json",
      id: "review-packet",
      label: "Review packet",
      text: "The machine readable audit handoff with targets, commands, claim boundaries and sign off fields."
    },
    {
      href: "/review/evidence-manifest.json",
      id: "review-evidence",
      label: "Evidence manifest",
      text: "The index of public review artifacts, live health endpoints and proof files reviewers can reproduce."
    },
    {
      href: "/review/evidence-ledger.json",
      id: "evidence-ledger",
      label: "Evidence ledger",
      text: "The adoption and review receipt ledger. It stays at zero until external redacted evidence exists."
    },
    {
      href: "/review/evidence-manifest.json",
      id: "synthetic-monitor",
      label: "Synthetic monitor",
      text: "The reproducible monitor command for site, registry, advisories, witness, node and Gitlawb receive pack probes."
    }
  ];

  if (!pkg?.proof) {
    return artifacts;
  }

  return [
    ...artifacts,
    {
      href: pkg.proof.proofUrl,
      id: "package-proof-data",
      label: "Package proof",
      text: `Merkle proof for ${pkg.name}, bound to leaf ${pkg.proof.leafHash}.`
    },
    ...(pkg.proof.witnessUrls?.[0]
      ? [
          {
            href: pkg.proof.witnessUrls[0],
            id: "package-witness",
            label: "Package witness",
            text: `Witness statement for ${pkg.name}, signed outside the registry log identity.`
          }
        ]
      : [])
  ];
}
