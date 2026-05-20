import { homeContent } from "./content";

const terminalLines = [
  { tone: "command", text: "~ $ curl https://nipmod.com/i|bash" },
  { tone: "normal", text: "Installing nipmod 1.2.5" },
  { tone: "normal", text: "Package:   https://nipmod.com/releases/nipmod-1.2.5.tgz" },
  { tone: "normal", text: "Signature: https://nipmod.com/releases/nipmod-1.2.5.tgz.sig" },
  { tone: "normal", text: "Prefix:    ~/.nipmod" },
  { tone: "normal", text: "Binary:    ~/.local/bin/nipmod" },
  { tone: "muted", text: "up to date, audited 2 packages in 579ms" },
  { tone: "muted", text: "found 0 vulnerabilities" },
  { tone: "normal", text: "Setting up Gitlawb publish helper" },
  { tone: "muted", text: "git-remote-gitlawb already installed at ~/.local/bin/git-remote-gitlawb" },
  { tone: "success", text: "Installed nipmod" },
  { tone: "muted", text: "Next:" },
  { tone: "muted", text: "nipmod doctor --online" },
  { tone: "muted", text: "nipmod search gitlawb --online" }
] as const;

export default function Home() {
  return (
    <main className="landing-shell" id="main">
      <section className="editorial-landing" aria-labelledby="hero-title">
        <div className="landing-copy">
          <h1 id="hero-title">
            <span>Packages for</span>
            <span>every agent,</span>
            <em>everywhere.</em>
          </h1>
          <p className="landing-kicker">The package layer for AI-native agents.</p>
          <p className="landing-lead">
            Search the public archive. Read the publisher signature, the source commit, the witness threshold. Install
            only after the plan is approved.
          </p>
          <div className="landing-actions">
            <a className="landing-button landing-button-primary" href={homeContent.links.install}>
              Install Nipmod
            </a>
            <a className="landing-button landing-button-secondary" href="/packages">
              Browse packages
            </a>
          </div>
        </div>

        <div className="mac-window" aria-label="Nipmod install terminal">
          <div className="mac-titlebar">
            <span className="mac-controls" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>~ -- nipmod -- 80x24</span>
          </div>
          <pre className="landing-terminal">
            {terminalLines.map((line) => (
              <code className={`terminal-${line.tone}`} key={line.text}>
                {line.text}
              </code>
            ))}
          </pre>
        </div>
      </section>
    </main>
  );
}
