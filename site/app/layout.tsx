import type { Metadata } from "next";
import { SiteHeader } from "./site-header";
import "./globals.css";

const previewImage = "https://nipmod.com/nipmod-logo.png?v=20260522-cube";
const previewImageAlt = "Nipmod cube mark";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com"
  },
  description: "One package API for agents.",
  icons: {
    apple: [{ sizes: "1254x1254", type: "image/png", url: "/icon.png?v=20260522-cube" }],
    icon: [{ sizes: "1254x1254", type: "image/png", url: "/icon.png?v=20260522-cube" }]
  },
  metadataBase: new URL("https://nipmod.com"),
  openGraph: {
    description: "Search package sources, inspect trust and create safe install plans through one hosted API.",
    images: [{ alt: previewImageAlt, height: 1254, type: "image/png", url: previewImage, width: 1254 }],
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
    card: "summary_large_image",
    creator: "@Nipmod",
    description: "Search package sources, inspect trust and create safe install plans through one hosted API.",
    images: [previewImage],
    site: "@Nipmod",
    title: "Nipmod"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="en">
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
