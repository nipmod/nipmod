import { homeContent } from "./content";

export function SiteHeader() {
  return (
    <header className="topbar" aria-label="Primary">
      <a className="brand" href="/" aria-label="nipmod home">
        <span className="brand-mark" aria-hidden="true">
          <img alt="" height="26" src="/icon.svg" width="26" />
        </span>
        <span>{homeContent.brand}</span>
      </a>
      <nav className="nav-actions" aria-label="Site">
        <a className="nav-link nav-link-wide nav-primary" href="/quickstart">
          Start
        </a>
        <a className="nav-link nav-link-wide nav-primary nav-primary-optional" href="/#registry">
          Registry
        </a>
        <a className="nav-link nav-link-wide nav-secondary" href="/package">
          Package
        </a>
        <a className="nav-link nav-link-wide nav-primary" href="/trust">
          Trust
        </a>
        <a className="nav-link nav-link-wide nav-secondary" href="/security">
          Security
        </a>
        <a className="nav-link nav-link-wide nav-secondary" href="/launch">
          Launch
        </a>
        <a className="nav-link nav-link-wide nav-secondary" href="/proof">
          Proof
        </a>
        <a className="nav-link nav-link-wide nav-secondary" href="/mcp">
          MCP
        </a>
        <a
          className="nav-link nav-link-wide nav-secondary"
          href="https://gitlawb.com/z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R/nipmod"
          aria-label="Open nipmod source on Gitlawb in a new tab"
          rel="noreferrer"
          target="_blank"
        >
          Source
        </a>
        <a
          className="nav-link nav-secondary"
          href={homeContent.links.x}
          aria-label="Open nipmod on X in a new tab"
          rel="noreferrer"
          target="_blank"
        >
          X
        </a>
        <details className="more-menu">
          <summary className="nav-link">More</summary>
          <div className="more-menu-panel">
            <a href="/package">Package</a>
            <a href="/security">Security</a>
            <a href="/launch">Launch</a>
            <a href="/proof">Proof</a>
            <a href="/mcp">MCP</a>
            <a
              href="https://gitlawb.com/z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R/nipmod"
              aria-label="Open nipmod source on Gitlawb in a new tab"
              rel="noreferrer"
              target="_blank"
            >
              Source
            </a>
            <a href={homeContent.links.x} aria-label="Open nipmod on X in a new tab" rel="noreferrer" target="_blank">
              X
            </a>
          </div>
        </details>
      </nav>
    </header>
  );
}
