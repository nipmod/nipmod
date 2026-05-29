import Link from "next/link";
import { type ReactNode } from "react";
import { AccountLink } from "./account/account-link";
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
        <AccountLink />
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
        <SocialIcon href={homeContent.links.email} label="Email Nipmod" title="Email">
          <svg aria-hidden="true" className="brand-email-icon" viewBox="0 0 24 24">
            <path
              d="M4.75 6.5h14.5c.69 0 1.25.56 1.25 1.25v8.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-8.5c0-.69.56-1.25 1.25-1.25Zm.62 1.5L12 12.64 18.63 8H5.37Zm-.37 1.43v6.57h14V9.43l-6.57 4.6a.75.75 0 0 1-.86 0L5 9.43Z"
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
    <a
      className="brand-icon-button"
      href={href}
      aria-label={label}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
      target={href.startsWith("http") ? "_blank" : undefined}
      title={title}
    >
      {children}
    </a>
  );
}
