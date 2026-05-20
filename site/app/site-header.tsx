import { homeContent } from "./content";

export function SiteHeader() {
  return (
    <header className="topbar" aria-label="Primary">
      <a className="brand" href="/" aria-label="Nipmod home">
        <span className="brand-mark" aria-hidden="true">
          <img alt="" height="56" src="/nipmod-logo-transparent.png" width="56" />
        </span>
        <span className="sr-only">{homeContent.brand}</span>
      </a>

      <nav className="nav-actions" aria-label="Site">
        <a className="nav-link nav-active" href="/">
          Index
        </a>
        <a className="nav-link" href="/packages">
          Packages
        </a>
        <a className="nav-link" href="/agents">
          Agents
        </a>
        <a className="nav-link" href={homeContent.links.install}>
          Setup
        </a>
        <a className="nav-link" href="/trust">
          Trust
        </a>
      </nav>

      <div className="brand-socials" aria-label="Nipmod links">
        <a
          className="brand-icon-button"
          href={homeContent.links.gitlawbProfile}
          aria-label="Open Nipmod Gitlawb profile in a new tab"
          rel="noreferrer"
          target="_blank"
          title="Gitlawb"
        >
          <img alt="" className="brand-gitlawb-icon" height="18" src="/gitlawb-logo.png" width="18" />
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
    </header>
  );
}
