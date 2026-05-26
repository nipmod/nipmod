import type { Metadata } from "next";
import { brandVersion, previewImage, previewImageUrl, siteDescription, siteName, siteUrl } from "./metadata";
import { SiteHeader } from "./site-header";
import "./globals.css";

export const metadata: Metadata = {
  alternates: {
    canonical: siteUrl
  },
  description: siteDescription,
  icons: {
    apple: [{ sizes: "1254x1254", type: "image/png", url: `/icon.png?v=${brandVersion}` }],
    icon: [{ sizes: "1254x1254", type: "image/png", url: `/icon.png?v=${brandVersion}` }]
  },
  metadataBase: new URL(siteUrl),
  openGraph: {
    description: siteDescription,
    images: [previewImage],
    siteName,
    title: siteName,
    type: "website",
    url: siteUrl
  },
  title: {
    default: siteName,
    template: siteName
  },
  twitter: {
    card: "summary_large_image",
    creator: "@Nipmod",
    description: siteDescription,
    images: [previewImageUrl],
    site: "@Nipmod",
    title: siteName
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="en">
      <head>
        <meta content="6a15cf215ef08857424491fe" name="base:app_id" />
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
