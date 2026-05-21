import type { Metadata } from "next";
import { homeContent } from "../content";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com/bankr"
  },
  description: "Bankr review track for Nipmod. Not a ready native Bankr integration.",
  openGraph: {
    description: "Bankr is a review track for Nipmod, not a ready native integration.",
    title: "Nipmod Bankr review",
    url: "https://nipmod.com/bankr"
  },
  robots: {
    follow: false,
    index: false
  },
  title: "Nipmod Bankr review"
};

export default function BankrPage() {
  return (
    <main className="page-shell" id="main">
      <section className="quickstart-hero" aria-labelledby="bankr-title">
        <p className="eyebrow">Bankr</p>
        <h1 id="bankr-title">Bankr review track</h1>
        <p className="lead">
          Bankr is not listed as a ready Nipmod agent host yet. The review work exists, but native Bankr support still
          needs Bankr approval before we present it as usable by normal users.
        </p>
        <div className="actions" aria-label="Bankr actions">
          <a
            className="button button-primary"
            href={homeContent.links.bankrCoin}
            aria-label="Open Nipmod coin on Bankr in a new tab"
            rel="noreferrer"
            target="_blank"
          >
            Bankr coin
          </a>
          <a className="button button-ghost" href="/platforms">
            Ready platforms
          </a>
        </div>
      </section>

      <section className="trust-section setup-section" aria-labelledby="bankr-state-title">
        <div>
          <p className="eyebrow">Status</p>
          <h2 id="bankr-state-title">What is true today</h2>
        </div>
        <div className="check-list">
          <article className="check-row">
            <span className="check-dot check-ok" aria-hidden="true" />
            <div>
              <h3>Prepared for review</h3>
              <p>
                Nipmod has internal review material for Bankr package discovery, trust inspection and install planning.
              </p>
            </div>
          </article>
          <article className="check-row">
            <span className="check-dot check-warn" aria-hidden="true" />
            <div>
              <h3>Not a ready user path</h3>
              <p>
                Bankr has not accepted a native Nipmod skill or catalog entry. We should not tell users to install a
                Bankr skill as if it is finished.
              </p>
            </div>
          </article>
          <article className="check-row">
            <span className="check-dot check-ok" aria-hidden="true" />
            <div>
              <h3>Token link stays separate</h3>
              <p>
                The $NPM Bankr coin link remains a public token/community link. It is not required for free package
                search, inspection or install planning.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className="host-section setup-section" aria-labelledby="bankr-boundary-title">
        <div className="registry-head">
          <div>
            <p className="eyebrow">Claim boundary</p>
            <h2 id="bankr-boundary-title">Safe wording</h2>
          </div>
        </div>
        <div className="check-list">
          <article className="check-row">
            <span className="check-dot check-ok" aria-hidden="true" />
            <div>
              <h3>Accurate</h3>
              <p>Bankr is a prepared review track for a future Nipmod agent workflow.</p>
            </div>
          </article>
          <article className="check-row">
            <span className="check-dot check-warn" aria-hidden="true" />
            <div>
              <h3>Not claimed</h3>
              <p>Bankr is not an official, native or ready Nipmod host until Bankr reviews and accepts the integration.</p>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
