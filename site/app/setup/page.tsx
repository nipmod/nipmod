import { createPageMetadata } from "../metadata";
import { Suspense } from "react";
import { SetupView } from "./setup-view";

export const metadata = createPageMetadata({
  description: "Set up Nipmod locally when an agent needs controlled workspace writes after an install plan.",
  path: "/setup",
  title: "Nipmod setup"
});

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
