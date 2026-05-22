import type { Metadata } from "next";
import { homeContent } from "../content";
import { previewImage, previewImageUrl, siteName } from "../metadata";

const tokenUrl = "https://token.nipmod.com";
const tokenAddress = "0x5155Eaa3B5784B829DeAD78189Eb4Bf69359dbA3";

export const metadata: Metadata = {
  alternates: {
    canonical: tokenUrl
  },
  description: "$NPM is the Nipmod token on Base. Product first, token second.",
  openGraph: {
    description: "$NPM is the Nipmod token on Base. Product first, token second.",
    images: [previewImage],
    siteName,
    title: "$NPM on Base",
    type: "website",
    url: tokenUrl
  },
  title: siteName,
  twitter: {
    card: "summary_large_image",
    creator: "@Nipmod",
    description: "$NPM is the Nipmod token on Base. Product first, token second.",
    images: [previewImageUrl],
    site: "@Nipmod",
    title: "$NPM on Base"
  }
};

const details = [
  {
    label: "Network",
    value: "Base"
  },
  {
    label: "Symbol",
    value: "$NPM"
  },
  {
    label: "Contract",
    value: tokenAddress
  }
] as const;

export default function TokenPage() {
  return (
    <main className="page-shell token-page-shell" id="main">
      <section className="quickstart-hero token-hero" aria-labelledby="token-title">
        <div>
          <p className="eyebrow">$NPM on Base</p>
          <h1 id="token-title">Product first. Token second.</h1>
          <p className="lead">
            $NPM is the Nipmod token on Base. Nipmod is building the package intelligence API agents can use before
            choosing packages, checking trust and planning installs.
          </p>
          <div className="actions">
            <a className="button button-primary button-with-icon" href={homeContent.links.bankrCoinExternal} rel="noreferrer" target="_blank">
              <img alt="" className="brand-base-icon" height="18" src="/base-logo.svg" width="18" />
              Open on Bankr
            </a>
            <a className="button button-ghost" href="/api-access">
              View API
            </a>
          </div>
        </div>
        <div className="api-status-panel token-status-panel" aria-label="$NPM token status">
          <span>Official token page</span>
          <strong>$NPM</strong>
          <p>No price promises. No market guarantees. This page exists to route users through a Nipmod-controlled link.</p>
        </div>
      </section>

      <section className="api-section" aria-labelledby="token-details-title">
        <div className="archive-section-head">
          <div>
            <p className="eyebrow">Token</p>
            <h2 id="token-details-title">Public details</h2>
          </div>
          <span>Base</span>
        </div>
        <div className="endpoint-list token-detail-list">
          {details.map((detail) => (
            <article className="endpoint-row token-detail-row" key={detail.label}>
              <div>
                <span>{detail.label}</span>
                <code>{detail.value}</code>
              </div>
              <p>{detail.label === "Contract" ? "Always verify the address before interacting." : "Official public token metadata."}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="api-section" aria-labelledby="token-boundary-title">
        <div className="archive-section-head">
          <div>
            <p className="eyebrow">Boundary</p>
            <h2 id="token-boundary-title">What this page is for</h2>
          </div>
          <span>Clean routing</span>
        </div>
        <div className="source-boundary-grid">
          <article>
            <h3>Owned link</h3>
            <p>Use this URL in bios and posts instead of sending people directly to a third-party launch page.</p>
          </article>
          <article>
            <h3>Clear context</h3>
            <p>The token is connected to the Nipmod ecosystem, but the product remains the package API for agents.</p>
          </article>
          <article>
            <h3>No guarantees</h3>
            <p>Nipmod does not make price, return, buyback or market-performance promises on this page.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
