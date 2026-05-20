import { homeContent } from "./content";

export function SiteHeader() {
  return (
    <header className="topbar" aria-label="Primary">
      <div className="brand-cluster">
        <a className="brand" href="/" aria-label="Nipmod home">
          <span className="brand-mark" aria-hidden="true">
            <img alt="" height="26" src="/nipmod-logo-transparent.png" width="26" />
          </span>
          <span>{homeContent.brand}</span>
        </a>
        <div className="brand-socials" aria-label="Nipmod links">
          <a
            className="brand-icon-button"
            href={homeContent.links.gitlawbProfile}
            aria-label="Open Nipmod Gitlawb profile in a new tab"
            rel="noreferrer"
            target="_blank"
            title="Gitlawb"
          >
            <img alt="" className="brand-gitlawb-icon" height="24" src="/gitlawb-logo.png" width="24" />
          </a>
          <a
            className="brand-icon-button"
            href={homeContent.links.x}
            aria-label="Open Nipmod on X in a new tab"
            rel="noreferrer"
            target="_blank"
            title="X"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path
                d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.11l11.97 15.64Z"
                fill="currentColor"
              />
            </svg>
          </a>
          <a
            className="brand-icon-button"
            href={homeContent.links.telegram}
            aria-label="Open Nipmod Telegram group in a new tab"
            rel="noreferrer"
            target="_blank"
            title="Telegram"
          >
            <img alt="" height="18" src="/telegram-logo.svg" width="18" />
          </a>
          <a
            className="brand-icon-button"
            href={homeContent.links.github}
            aria-label="Open Nipmod GitHub repository in a new tab"
            rel="noreferrer"
            target="_blank"
            title="GitHub"
          >
            <img alt="" height="18" src="/github-logo.svg" width="18" />
          </a>
          <a
            className="brand-icon-button"
            href={homeContent.links.bankrCoin}
            aria-label="Open Nipmod Bankr coin in a new tab"
            rel="noreferrer"
            target="_blank"
            title="Bankr coin"
          >
            <img alt="" height="18" src="/bankr-logo.svg" width="18" />
          </a>
        </div>
      </div>
      <nav className="nav-actions" aria-label="Site">
        <a className="nav-link nav-link-wide nav-primary" href="/packages">
          Packages
        </a>
        <a className="nav-link nav-link-wide nav-primary nav-primary-optional" href={homeContent.links.docs}>
          Docs
        </a>
        <a className="nav-link nav-link-wide nav-install" href={homeContent.links.install}>
          Setup
        </a>
        <details className="more-menu">
          <summary className="nav-more-button">More</summary>
          <div className="more-menu-panel">
            <a href={homeContent.links.docs}>Docs</a>
            <a href="/setup">Setup</a>
            <a href="/agents">Agents</a>
            <a href="/agents/codex-claude">Codex and Claude</a>
            <a href="/demo">Demo</a>
            <a href="/status">Status</a>
            <a href="/examples">Examples</a>
            <a href="/audit">Audit</a>
            <a href="/package">Create</a>
            <a href="/launch">Launch</a>
            <a href="/launch-kit">Launch kit</a>
            <a href="/trust">Trust</a>
            <a href="/security">Security</a>
            <a href="/mcp">MCP</a>
            <a href="/bankr">Bankr agents</a>
            <a href="/platforms">Platforms</a>
            <a
              href={homeContent.links.gitlawbProfile}
              aria-label="Open Nipmod Gitlawb profile in a new tab"
              rel="noreferrer"
              target="_blank"
            >
              Gitlawb
            </a>
            <a href={homeContent.links.x} aria-label="Open Nipmod on X in a new tab" rel="noreferrer" target="_blank">
              X
            </a>
            <a
              href={homeContent.links.telegram}
              aria-label="Open Nipmod Telegram group in a new tab"
              rel="noreferrer"
              target="_blank"
            >
              Telegram
            </a>
            <a
              href={homeContent.links.github}
              aria-label="Open Nipmod GitHub repository in a new tab"
              rel="noreferrer"
              target="_blank"
            >
              GitHub
            </a>
            <a
              href={homeContent.links.bankrCoin}
              aria-label="Open Nipmod Bankr coin in a new tab"
              rel="noreferrer"
              target="_blank"
            >
              Bankr coin
            </a>
            <a
              href={homeContent.links.gitlawbSource}
              aria-label="Open Nipmod source on Gitlawb in a new tab"
              rel="noreferrer"
              target="_blank"
            >
              Source
            </a>
          </div>
        </details>
      </nav>
    </header>
  );
}
