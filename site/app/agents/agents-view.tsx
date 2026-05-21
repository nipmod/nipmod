"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";

const tokens = {
  ink: "#fafafa",
  text: "#ededef",
  muted: "rgba(237,237,239,0.58)",
  quiet: "rgba(237,237,239,0.38)",
  border: "rgba(255,255,255,0.12)",
  borderSoft: "rgba(255,255,255,0.06)",
  surface: "#18181a",
  serif: 'Fraunces, "Instrument Serif", Georgia, serif',
  mono: '"JetBrains Mono", "SF Mono", ui-monospace, monospace'
};

const agents = [
  { id: "codex", name: "Codex", logo: "/agents/codex.png" },
  { id: "claude", name: "Claude Code", logo: "/agents/claude.png" },
  { id: "cursor", name: "Cursor", logo: "/agents/cursor.png" },
  { id: "opencode", name: "OpenCode", logo: "/agents/opencode.png" },
  { id: "hermes", name: "Hermes", logo: "/agents/hermes.png" }
];

export function AgentsView() {
  return (
    <main
      style={{
        maxWidth: 1180,
        margin: "0 auto",
        padding: "40px clamp(18px, 5vw, 72px) 80px",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        gap: 32,
        minHeight: "calc(100vh - 90px)"
      }}
    >
      <section style={{ paddingBottom: 24, borderBottom: `1px solid ${tokens.border}` }}>
        <h1
          style={{
            fontFamily: tokens.serif,
            fontSize: "clamp(48px, 13vw, 64px)",
            fontWeight: 400,
            letterSpacing: "-0.028em",
            lineHeight: 1.0,
            margin: "0 0 10px",
            color: tokens.ink
          }}
        >
          Every agent shares the <em style={{ fontStyle: "italic" }}>same archive.</em>
        </h1>
        <p
          style={{
            fontFamily: tokens.serif,
            fontStyle: "italic",
            fontSize: 16,
            color: tokens.muted,
            margin: 0
          }}
        >
          Pick an agent to start the setup.
        </p>
      </section>
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          gap: 12,
          paddingBottom: 32
        }}
      >
        {agents.map((a) => (
          <AgentCard key={a.id} agent={a} />
        ))}
      </section>
    </main>
  );
}

function AgentCard({ agent }: { agent: { id: string; name: string; logo?: string } }) {
  const [hover, setHover] = useState(false);
  const style: CSSProperties = {
    background: hover ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
    border: `1px solid ${hover ? "rgba(255,255,255,0.2)" : tokens.borderSoft}`,
    padding: "16px 20px",
    display: "flex",
    alignItems: "center",
    gap: 14,
    textDecoration: "none",
    color: "inherit",
    fontFamily: "inherit",
    transition: "background 240ms cubic-bezier(0.22,1,0.36,1), border-color 240ms cubic-bezier(0.22,1,0.36,1), transform 220ms cubic-bezier(0.22,1,0.36,1)",
    transform: hover ? "translateY(-1px)" : "translateY(0)",
    position: "relative",
    overflow: "hidden"
  };
  return (
    <Link
      href={`/setup?agent=${agent.id}`}
      style={style}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span
        style={{
          alignItems: "center",
          display: "inline-flex",
          flex: "0 0 34px",
          height: 34,
          justifyContent: "center",
          opacity: agent.logo ? 1 : 0.28,
          width: 34
        }}
        aria-hidden="true"
      >
        {agent.logo ? (
          <img
            alt=""
            decoding="async"
            height={30}
            loading="eager"
            src={agent.logo}
            style={{
              display: "block",
              height: "30px",
              objectFit: "contain",
              width: "30px"
            }}
            width={30}
          />
        ) : null}
      </span>
      <span
        style={{
          fontFamily: tokens.serif,
          fontSize: 22,
          fontWeight: 400,
          color: tokens.ink,
          letterSpacing: "-0.016em",
          lineHeight: 1,
          flex: 1
        }}
      >
        {agent.name}
      </span>
      <span
        style={{
          fontFamily: tokens.serif,
          fontStyle: "italic",
          fontSize: 13,
          color: hover ? tokens.ink : tokens.quiet,
          transition: "color 200ms, transform 200ms, opacity 200ms",
          transform: hover ? "translateX(2px)" : "translateX(-4px)",
          opacity: hover ? 1 : 0
        }}
      >
        →
      </span>
    </Link>
  );
}
