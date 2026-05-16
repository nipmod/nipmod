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
        <a className="nav-link nav-link-wide" href="/quickstart">
          Start
        </a>
        <a className="nav-link nav-link-wide" href="/#registry">
          Registry
        </a>
        <a className="nav-link nav-link-wide" href="/package">
          Package
        </a>
        <a className="nav-link nav-link-wide" href="/trust">
          Trust
        </a>
        <a className="nav-link nav-link-wide" href="/security">
          Security
        </a>
        <a className="nav-link nav-link-wide" href="/proof">
          Proof
        </a>
        <a className="nav-link nav-link-wide" href="/mcp">
          MCP
        </a>
        <a className="nav-link nav-link-wide" href="https://gitlawb.com/z6MkwbuduCUUwy8fp78CZ2pnhLyRSibkSjcCGexT355xNw5R/nipmod" rel="noreferrer" target="_blank">
          Source
        </a>
        <a className="nav-link" href={homeContent.links.x} rel="noreferrer" target="_blank">
          X
        </a>
      </nav>
    </header>
  );
}
