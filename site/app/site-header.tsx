import Link from "next/link";
import { type ReactNode } from "react";
import { homeContent } from "./content";
import { NipmodMark } from "./editorial-mark";

export function SiteHeader() {
  return (
    <header className="topbar" aria-label="Primary">
      <Link className="brand" href="/" aria-label="Nipmod home" prefetch>
        <NipmodMark size={54} />
        <span className="brand-word" aria-hidden="true">{homeContent.brand}</span>
      </Link>

      <div className="brand-socials" aria-label="Nipmod links">
        <SocialIcon href={homeContent.links.github} label="Open Nipmod GitHub repository in a new tab" title="GitHub">
          <img alt="" height="18" src="/github-logo.svg" width="18" />
        </SocialIcon>
        <SocialIcon href={homeContent.links.x} label="Open Nipmod on X in a new tab" title="X">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path
              d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.11l11.97 15.64Z"
              fill="currentColor"
            />
          </svg>
        </SocialIcon>
        <SocialIcon href={homeContent.links.telegram} label="Open Nipmod Telegram group in a new tab" title="Telegram">
          <img alt="" className="brand-telegram-icon" height="18" src="/telegram-logo.svg" width="18" />
        </SocialIcon>
        <SocialIcon href={homeContent.links.bankrCoin} label="Open Nipmod token page in a new tab" title="$NPM on Base">
          <img alt="" className="brand-base-icon" height="18" src="/base-logo.svg" width="18" />
        </SocialIcon>
      </div>
    </header>
  );
}

function SocialIcon({
  children,
  href,
  label,
  title
}: {
  children: ReactNode;
  href: string;
  label: string;
  title: string;
}) {
  return (
    <a className="brand-icon-button" href={href} aria-label={label} rel="noreferrer" target="_blank" title={title}>
      {children}
    </a>
  );
}
