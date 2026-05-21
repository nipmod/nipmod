"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatedTerminal, type TerminalStep } from "../editorial-terminal";

const tokens = {
  ink: "#fafafa",
  text: "#ededef",
  muted: "rgba(237,237,239,0.58)",
  quiet: "rgba(237,237,239,0.38)",
  border: "rgba(255,255,255,0.12)",
  borderSoft: "rgba(255,255,255,0.06)",
  surface: "#18181a",
  ok: "#73b07b",
  accent: "#c97a5a",
  serif: 'Fraunces, "Instrument Serif", Georgia, serif',
  mono: '"JetBrains Mono", "SF Mono", ui-monospace, monospace'
};

type AgentId = "codex" | "claude" | "cursor" | "opencode" | "hermes";

const agents: Array<{ id: AgentId; name: string }> = [
  { id: "codex", name: "Codex" },
  { id: "claude", name: "Claude Code" },
  { id: "cursor", name: "Cursor" },
  { id: "opencode", name: "OpenCode" },
  { id: "hermes", name: "Hermes" }
];

export function SetupView() {
  const search = useSearchParams();
  const initial = (search?.get("agent") as AgentId) || "claude";
  const [active, setActive] = useState<AgentId>(agents.some((a) => a.id === initial) ? initial : "claude");
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(false);
  const [bar, setBar] = useState({ left: 0, width: 0, opacity: 0, animated: false });

  useEffect(() => {
    const measure = () => {
      const el = tabsRef.current;
      if (!el) return;
      const activeBtn = el.querySelector<HTMLElement>('[data-tab-active="true"]');
      if (activeBtn) {
        setBar({ left: activeBtn.offsetLeft, width: activeBtn.offsetWidth, opacity: 1, animated: mountedRef.current });
        mountedRef.current = true;
      }
    };
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [active]);

  const agentName = agents.find((a) => a.id === active)!.name;

  const script = useMemo<TerminalStep[]>(
    () => [
      {
        command: `nipmod setup ${active}`,
        output: [
          { kind: "muted", text: "Detecting agent host...", pause: 500 },
          { kind: "ok", text: `Found ${agentName}`, pause: 250 },
          { kind: "default", text: "Writing MCP config...", pause: 250 },
          { kind: "ok", text: `Done. Restart ${agentName}.`, pause: 1200 }
        ]
      },
      {
        command: "nipmod doctor --online",
        output: [
          { kind: "default", text: "Registry:   ok", pause: 80 },
          { kind: "default", text: "Witnesses:  3 of 3", pause: 80 },
          { kind: "default", text: "Identity:   loaded", pause: 80 },
          { kind: "ok", text: "All checks passed.", pause: 1400 }
        ]
      }
    ],
    [active, agentName]
  );

  return (
    <main
      style={{
        maxWidth: 1320,
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
            lineHeight: 1.02,
            margin: 0,
            color: tokens.ink
          }}
        >
          Pick your agent.
        </h1>
      </section>

      <section
        ref={tabsRef}
        style={{
          position: "relative",
          display: "flex",
          flexWrap: "wrap",
          borderBottom: `1px solid ${tokens.border}`
        }}
      >
        {agents.map((a) => (
          <button
            key={a.id}
            data-tab-active={active === a.id}
            onClick={() => setActive(a.id)}
            style={
              {
                padding: "16px 28px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 15,
                fontWeight: 500,
                color: active === a.id ? tokens.ink : tokens.muted,
                letterSpacing: 0.1,
                transition: "color 220ms cubic-bezier(0.22,1,0.36,1)"
              } satisfies CSSProperties
            }
          >
            {a.name}
          </button>
        ))}
        <div
          style={{
            position: "absolute",
            bottom: -1,
            left: bar.left,
            width: bar.width,
            height: 1,
            background: tokens.ink,
            opacity: bar.opacity,
            transition: bar.animated
              ? "left 420ms cubic-bezier(0.7, 0, 0.2, 1), width 420ms cubic-bezier(0.7, 0, 0.2, 1), opacity 280ms"
              : "opacity 280ms",
            pointerEvents: "none"
          }}
        />
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 430px), 1fr))",
          gap: "clamp(28px, 5vw, 56px)",
          alignItems: "stretch"
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
          {[
            { n: "I", t: "Install the CLI", cmd: "curl https://nipmod.com/i|bash" },
            { n: "II", t: `Register MCP for ${agentName}`, cmd: `nipmod setup ${active}` },
            { n: "III", t: "Confirm the agent connects", cmd: "nipmod doctor --online" }
          ].map((s, i, arr) => (
            <div
              key={s.n}
              style={{
                padding: "18px 0",
                borderBottom: i === arr.length - 1 ? "none" : `1px solid ${tokens.borderSoft}`
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 12 }}>
                <span
                  style={{
                    fontFamily: tokens.serif,
                    fontStyle: "italic",
                    fontSize: 26,
                    color: tokens.muted,
                    width: 32,
                    lineHeight: 1
                  }}
                >
                  {s.n}
                </span>
                <h3
                  style={{
                    fontFamily: tokens.serif,
                    fontSize: 22,
                    fontWeight: 400,
                    margin: 0,
                    letterSpacing: "-0.015em",
                    color: tokens.ink
                  }}
                >
                  {s.t}
                </h3>
              </div>
              <CopyCommand command={s.cmd} marginLeft={48} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <AnimatedTerminal key={active} script={script} title={`~ -- ${active} -- 80x24`} height={400} />
        </div>
      </section>
    </main>
  );
}

function CopyCommand({ command, marginLeft = 0 }: { command: string; marginLeft?: number }) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    try {
      navigator.clipboard?.writeText(command);
    } catch {
      /* ignore */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <div
      style={{
        background: "#0a0a0c",
        color: "#d4d4d6",
        border: `1px solid ${tokens.border}`,
        padding: "10px 12px 10px 16px",
        fontFamily: tokens.mono,
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        marginLeft: `min(${marginLeft}px, 8vw)`
      }}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        <span style={{ color: "rgba(212,212,214,0.4)", marginRight: 10 }}>~ $</span>
        {command}
      </span>
      <button
        type="button"
        onClick={onCopy}
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: copied ? tokens.ok : "rgba(212,212,214,0.7)",
          padding: "5px 9px",
          fontSize: 10.5,
          fontFamily: "inherit",
          cursor: "pointer",
          flexShrink: 0,
          letterSpacing: 0.3,
          transition: "color 200ms, background 200ms"
        }}
      >
        {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}
