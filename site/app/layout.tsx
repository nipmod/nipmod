import type { Metadata } from "next";
import { SiteHeader } from "./site-header";
import "./globals.css";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com"
  },
  description: "Package layer for agent built software.",
  icons: {
    apple: [{ sizes: "400x400", type: "image/jpeg", url: "/nipmod-logo.jpg" }],
    icon: [{ sizes: "400x400", type: "image/jpeg", url: "/nipmod-logo.jpg" }]
  },
  metadataBase: new URL("https://nipmod.com"),
  openGraph: {
    description: "Nipmod makes agent code installable, verifiable and reusable.",
    images: [{ height: 400, type: "image/jpeg", url: "/nipmod-logo.jpg", width: 400 }],
    siteName: "Nipmod",
    title: "Nipmod",
    type: "website",
    url: "https://nipmod.com"
  },
  title: "Nipmod",
  twitter: {
    card: "summary",
    creator: "@Nipmod",
    description: "Nipmod makes agent code installable, verifiable and reusable.",
    images: ["/nipmod-logo.jpg"],
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
