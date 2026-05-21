"use client";

import { useEffect, useState, type CSSProperties } from "react";
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

type AgentConnection = {
  href: string;
  id: string;
  initials?: string;
  logo?: string;
  name: string;
  note: string;
};

const agents: AgentConnection[] = [
  {
    href: "/setup?agent=codex",
    id: "codex",
    logo: "/agents/codex.png",
    name: "Codex",
    note: "Local MCP setup"
  },
  {
    href: "/setup?agent=claude",
    id: "claude",
    logo: "/agents/claude.png",
    name: "Claude Code",
    note: "Local MCP setup"
  },
  {
    href: "/setup?agent=cursor",
    id: "cursor",
    logo: "/agents/cursor.png",
    name: "Cursor",
    note: "Rules and MCP setup"
  },
  {
    href: "/setup?agent=opencode",
    id: "opencode",
    logo: "/agents/opencode.png",
    name: "OpenCode",
    note: "Local MCP setup"
  },
  {
    href: "/setup?agent=hermes",
    id: "hermes",
    logo: "/agents/hermes.png",
    name: "Hermes",
    note: "Local MCP setup"
  }
];

export function AgentsView() {
  const [logosReady, setLogosReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const logoPaths = agents.flatMap((agent) => (agent.logo ? [agent.logo] : []));

    Promise.all(
      logoPaths.map(
        (logo) =>
          new Promise<void>((resolve) => {
            const image = new Image();
            image.onload = () => resolve();
            image.onerror = () => resolve();
            image.src = logo;

            if (image.complete) {
              resolve();
            }
          })
      )
    ).then(() => {
      if (!cancelled) {
        setLogosReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

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
          Pick the agent environment you want to connect.
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
          <AgentCard key={a.id} agent={a} logosReady={logosReady} />
        ))}
      </section>
    </main>
  );
}

function AgentCard({ agent, logosReady }: { agent: AgentConnection; logosReady: boolean }) {
  const [hover, setHover] = useState(false);
  const style: CSSProperties = {
    background: hover ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
    border: `1px solid ${hover ? "rgba(255,255,255,0.2)" : tokens.borderSoft}`,
    padding: "16px 18px",
    display: "flex",
    alignItems: "center",
    gap: 13,
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
      href={agent.href}
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
            decoding="sync"
            fetchPriority="high"
            height={30}
            loading="eager"
            src={agent.logo}
            style={{
              display: "block",
              height: "30px",
              objectFit: "contain",
              opacity: logosReady ? 1 : 0,
              transition: "opacity 120ms ease",
              width: "30px"
            }}
            width={30}
          />
        ) : (
          <span
            style={{
              alignItems: "center",
              background: hover ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)",
              border: `1px solid ${hover ? "rgba(255,255,255,0.22)" : tokens.border}`,
              color: tokens.ink,
              display: "inline-flex",
              fontFamily: tokens.mono,
              fontSize: 11,
              height: 30,
              justifyContent: "center",
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              transition: "background 200ms, border-color 200ms",
              width: 30
            }}
          >
            {agent.initials ?? agent.name.slice(0, 2)}
          </span>
        )}
      </span>
      <span
        style={{
          alignItems: "flex-start",
          display: "flex",
          flex: 1,
          flexDirection: "column",
          gap: 6,
          minWidth: 0
        }}
      >
        <span
          style={{
            color: tokens.ink,
            fontFamily: tokens.serif,
            fontSize: 22,
            fontWeight: 400,
            letterSpacing: "-0.016em",
            lineHeight: 1,
            maxWidth: "100%",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}
        >
          {agent.name}
        </span>
        <span
          style={{
            color: tokens.muted,
            fontFamily: tokens.mono,
            fontSize: 11,
            lineHeight: 1.3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            width: "100%"
          }}
        >
          {agent.note}
        </span>
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
