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
    description: "Install Gitlawb packages with source, signature, digest and proof visible first.",
    images: [{ height: 400, type: "image/jpeg", url: "/nipmod-logo.jpg", width: 400 }],
    siteName: "nipmod",
    title: "nipmod",
    type: "website",
    url: "https://nipmod.com"
  },
  title: "nipmod",
  twitter: {
    card: "summary",
    creator: "@Nipmod",
    description: "Install Gitlawb packages with source, signature, digest and proof visible first.",
    images: ["/nipmod-logo.jpg"],
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
