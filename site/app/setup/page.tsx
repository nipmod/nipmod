// Drop this file at: nipmod/site/app/setup/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { SetupView } from "./setup-view";

export const metadata: Metadata = {
  alternates: { canonical: "https://nipmod.com/setup" },
  description: "Set up Nipmod for Codex, Claude Code, Cursor, OpenCode and Hermes.",
  openGraph: {
    description: "Install Nipmod once, connect your agent and use the package archive from agent chat.",
    title: "Nipmod setup",
    url: "https://nipmod.com/setup"
  },
  title: "Setup Nipmod"
};

export default function SetupPage() {
  return (
    <Suspense fallback={<SetupFallback />}>
      <SetupView />
    </Suspense>
  );
}

function SetupFallback() {
  return (
    <main className="page-shell" id="main">
      <section className="quickstart-hero" aria-labelledby="setup-fallback-title">
        <p className="eyebrow">Setup</p>
        <h1 id="setup-fallback-title">Pick your agent.</h1>
        <p className="lead">Install Nipmod locally only when an agent needs controlled workspace writes.</p>
        <pre>
          <code>curl https://nipmod.com/i|bash</code>
        </pre>
      </section>
    </main>
  );
}
