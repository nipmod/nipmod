import Link from "next/link";
import { homeContent } from "./content";
import { AnimatedTerminal } from "./editorial-terminal";

export default function Home() {
  return (
    <main className="landing-shell" id="main">
      <section className="editorial-landing" aria-labelledby="hero-title">
        <div className="landing-copy">
          <h1 id="hero-title">
            The package layer
            <br />
            <em>for AI agents</em>.
          </h1>
          <p className="landing-kicker">Tell your agent what you need. Nipmod returns package options and safe install plans.</p>
          <div className="landing-actions">
            <Link className="landing-button landing-button-primary" href={homeContent.links.api} prefetch>
              Get API access
            </Link>
            <Link className="landing-button landing-button-secondary" href={homeContent.links.sources} prefetch>
              View sources
            </Link>
          </div>
        </div>

        <AnimatedTerminal />
      </section>
    </main>
  );
}
