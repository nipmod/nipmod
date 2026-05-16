import type { Metadata } from "next";
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
  title: "nipmod"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
