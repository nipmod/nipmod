import type { Metadata } from "next";
import { SiteHeader } from "./site-header";
import "./globals.css";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://nipmod.com"
  },
  description: "Packages agents can trust.",
  icons: {
    apple: [{ sizes: "400x400", type: "image/jpeg", url: "/nipmod-logo.jpg" }],
    icon: [{ sizes: "400x400", type: "image/jpeg", url: "/nipmod-logo.jpg" }]
  },
  metadataBase: new URL("https://nipmod.com"),
  openGraph: {
    description: "Install Gitlawb packages from the terminal. Search, inspect and pin the tools agents use.",
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
    description: "Install Gitlawb packages from the terminal. Search, inspect and pin the tools agents use.",
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
