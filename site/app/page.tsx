import { homeContent } from "./content";
import { AnimatedTerminal } from "./editorial-terminal";

export default function Home() {
  return (
    <main className="landing-shell" id="main">
      <section className="editorial-landing" aria-labelledby="hero-title">
        <div className="landing-copy">
          <h1 id="hero-title">
            Packages for every agent,
            <br />
            <em>everywhere</em>.
          </h1>
          <p className="landing-kicker">The package layer for AI-native agents.</p>
          <div className="landing-actions">
            <a className="landing-button landing-button-primary" href={homeContent.links.install}>
              Install Nipmod
            </a>
            <a className="landing-button landing-button-secondary" href="/packages">
              Browse packages
            </a>
          </div>
        </div>

        <AnimatedTerminal />
      </section>
    </main>
  );
}
