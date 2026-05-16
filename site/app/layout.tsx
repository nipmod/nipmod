import type { Metadata } from "next";
import { SiteHeader } from "./site-header";
import "./globals.css";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com"
  },
  description: "Verifiable packages for agents.",
  metadataBase: new URL("https://nipmod.com"),
  openGraph: {
    description: "Built on Gitlawb. Used from terminal, Codex, or any agent runtime.",
    siteName: "nipmod",
    title: "nipmod",
    type: "website",
    url: "https://nipmod.com"
  },
  title: "nipmod",
  twitter: {
    card: "summary",
    creator: "@Nipmod",
    description: "Built on Gitlawb. Used from terminal, Codex, or any agent runtime.",
    site: "@Nipmod",
    title: "nipmod"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
