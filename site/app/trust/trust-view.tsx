"use client";

import { useState, type ReactNode } from "react";

const tokens = {
  ink: "#fafafa",
  text: "#ededef",
  muted: "rgba(237,237,239,0.58)",
  quiet: "rgba(237,237,239,0.38)",
  border: "rgba(255,255,255,0.12)",
  borderSoft: "rgba(255,255,255,0.06)",
  bgSoft: "#141416",
  accent: "#c97a5a",
  serif: 'Fraunces, "Instrument Serif", Georgia, serif',
  mono: '"JetBrains Mono", "SF Mono", ui-monospace, monospace'
};

type StepId = "source" | "publisher" | "digest" | "witness" | "audit";

const steps: Array<{
  id: StepId;
  t: string;
  sub: string;
  icon: ReactNode;
  body: string[];
}> = [
  {
    id: "source",
    t: "Source",
    sub: "gitlawb://repos/...",
    icon: <Glyph d="M2 3h12v10H2z" />,
    body: [
      "A Nipmod package starts with a source reference, not with an anonymous upload. The package record keeps the owner, repository, commit and release context visible so an agent can trace what it is about to use before anything is installed.",
      "The registry is therefore not treated as the only source of truth. It indexes and verifies package evidence while preserving the original source trail, which makes mirrors, republished bundles and renamed packages easier to reason about."
    ]
  },
  {
    id: "publisher",
    t: "Publisher",
    sub: "did:key:z6Mkq...",
    icon: <Glyph d="M3 7v6h10V7M5 7V5a3 3 0 016 0v2" />,
    body: [
      "Publisher identity is bound to a cryptographic DID key. A package is not trusted just because a username, display name or profile link looks familiar; the release claim has to be signed by the expected publishing identity.",
      "This gives agents a machine-readable way to separate ownership from appearance. If attribution, source identity or release authority cannot be verified, the package can be downgraded, flagged or held for review instead of being treated as ready."
    ]
  },
  {
    id: "digest",
    t: "Digest",
    sub: "sha256:7c2a9f...",
    icon: <Glyph d="M8 2 14 5 8 8 2 5z M2 8l6 3 6-3 M2 11l6 3 6-3" />,
    body: [
      "Every release is pinned to the exact bytes of the artifact through a SHA-256 digest. The name and version help humans find the package, but the digest is what lets an agent verify that the downloaded file is the same artifact that was reviewed.",
      "Install plans carry that expected digest forward. If the artifact changes, the check fails instead of silently accepting different code under the same name. This is the core guardrail against swapped bundles, mutable releases and accidental drift."
    ]
  },
  {
    id: "witness",
    t: "Witness",
    sub: "2 of 3 threshold",
    icon: <Glyph d="M2 10v4h2v-4M6 7v7h2V7M10 4v10h2V4" />,
    body: [
      "Witnesses add an external check around the release record. Instead of relying on a single registry process, independent verification runners can observe the package evidence and co-sign the checkpoint for the same source and digest.",
      "The threshold matters because it reduces single-point trust. A package only reaches the stronger state when enough witnesses agree on the same evidence, making unauthorized rewrites, partial failures and private registry mistakes easier to detect."
    ]
  },
  {
    id: "audit",
    t: "Audit",
    sub: "transparency log",
    icon: <Glyph d="M8 2l5 2v4.2c0 2.8-2.2 5-5 6-2.8-1-5-3.2-5-6V4z" />,
    body: [
      "Trust is checked again at use time. Advisories, quarantine status, witness checkpoints, permission claims and release receipts are part of the install decision, not just static text on a package page.",
      "That keeps the workflow responsive when risk changes after publication. If a package is yanked, warned, quarantined or no longer matches its expected evidence, agents can stop before writing files or running code in the workspace."
    ]
  }
];

function Glyph({ d }: { d: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 16 16" fill="none">
      <path d={d} stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TrustView() {
  const [active, setActive] = useState<StepId>("digest");
  const activeStep = steps.find((s) => s.id === active)!;
  const activeIndex = steps.findIndex((s) => s.id === active) + 1;

  return (
    <main
      style={{
        maxWidth: 1320,
        margin: "0 auto",
        padding: "40px clamp(18px, 5vw, 72px) 80px",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        gap: 36,
        minHeight: "calc(100vh - 90px)"
      }}
    >
      <section style={{ paddingBottom: 24, borderBottom: `1px solid ${tokens.border}` }}>
        <h1
          style={{
            fontFamily: tokens.serif,
            fontSize: "clamp(46px, 11vw, 64px)",
            fontWeight: 400,
            letterSpacing: "-0.028em",
            lineHeight: 1.02,
            margin: "0 0 12px",
            color: tokens.ink,
            maxWidth: 900
          }}
        >
          What makes a package <em style={{ fontStyle: "italic" }}>verifiable.</em>
        </h1>
        <p
          style={{
            fontFamily: tokens.serif,
            fontSize: 17,
            color: tokens.muted,
            margin: 0,
            maxWidth: 720,
            lineHeight: 1.45
          }}
        >
          Five anchors. Every install reads the whole chain before it touches a workspace.
        </p>
      </section>

      <section>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))",
            rowGap: 28,
            gap: 0,
            position: "relative"
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "10%",
              right: "10%",
              top: 26,
              height: 1,
              background: tokens.borderSoft
            }}
          />
          {steps.map((s) => {
            const isActive = active === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                onMouseEnter={() => setActive(s.id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0 8px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  fontFamily: "inherit",
                  position: "relative"
                }}
              >
                <span
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    background: isActive ? tokens.ink : tokens.bgSoft,
                    color: isActive ? "#0e0e10" : tokens.text,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: `1px solid ${isActive ? tokens.ink : tokens.border}`,
                    transition:
                      "background 260ms cubic-bezier(0.22,1,0.36,1), color 260ms, border-color 260ms, transform 220ms",
                    transform: isActive ? "scale(1.04)" : "scale(1)",
                    position: "relative",
                    zIndex: 1
                  }}
                >
                  {s.icon}
                </span>
                <span
                  style={{
                    fontFamily: tokens.serif,
                    fontSize: 18,
                    color: isActive ? tokens.ink : tokens.muted,
                    transition: "color 220ms",
                    letterSpacing: "-0.01em"
                  }}
                >
                  {s.t}
                </span>
                <span
                  style={{
                    fontFamily: tokens.mono,
                    fontSize: 11,
                    color: tokens.quiet,
                    letterSpacing: 0.4
                  }}
                >
                  {s.sub}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: "clamp(32px, 6vw, 64px)",
          alignItems: "center",
          paddingBottom: 24
        }}
      >
        <div>
          <div
            style={{
              fontFamily: tokens.mono,
              fontSize: 11,
              color: tokens.muted,
              letterSpacing: 0.8,
              marginBottom: 12
            }}
          >
            STEP {activeIndex} OF {steps.length}
          </div>
          <h2
            style={{
              fontFamily: tokens.serif,
              fontSize: "clamp(56px, 14vw, 72px)",
              fontWeight: 400,
              letterSpacing: "-0.03em",
              lineHeight: 0.96,
              margin: 0,
              color: tokens.ink
            }}
          >
            {activeStep.t}.
          </h2>
        </div>
        <div
          style={{
            fontFamily: tokens.serif,
            fontSize: "clamp(18px, 2vw, 20px)",
            color: tokens.text,
            margin: 0,
            lineHeight: 1.5,
            maxWidth: 700,
            display: "flex",
            flexDirection: "column",
            gap: 16
          }}
        >
          {activeStep.body.map((paragraph) => (
            <p key={paragraph} style={{ margin: 0 }}>
              {paragraph}
            </p>
          ))}
        </div>
      </section>
    </main>
  );
}
