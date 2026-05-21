import type { Metadata } from "next";
import { SiteHeader } from "./site-header";
import "./globals.css";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com"
  },
  description: "Verified package archive for agents.",
  icons: {
    apple: [{ sizes: "1024x1024", type: "image/png", url: "/icon.png?v=20260521" }],
    icon: [{ sizes: "1024x1024", type: "image/png", url: "/icon.png?v=20260521" }]
  },
  metadataBase: new URL("https://nipmod.com"),
  openGraph: {
    description: "Search, inspect and install verified agent packages.",
    images: [{ height: 1248, type: "image/png", url: "/nipmod-logo.png", width: 1248 }],
    siteName: "Nipmod",
    title: "Nipmod",
    type: "website",
    url: "https://nipmod.com"
  },
  title: {
    default: "Nipmod",
    template: "Nipmod"
  },
  twitter: {
    card: "summary",
    creator: "@Nipmod",
    description: "Search, inspect and install verified agent packages.",
    images: ["/nipmod-logo.png"],
    site: "@Nipmod",
    title: "Nipmod"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link href="/llms.txt" rel="alternate" title="Nipmod agent instructions" type="text/plain" />
        <link href="/.well-known/nipmod.json" rel="alternate" title="Nipmod machine discovery" type="application/json" />
      </head>
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
