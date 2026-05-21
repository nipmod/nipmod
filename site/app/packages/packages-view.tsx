"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import registryData from "../registry-data.json";
import { type RegistryIndex, type RegistryPackage } from "../../lib/registry";
import { packagePageHref } from "./content";

const registry = registryData as RegistryIndex;

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

export function PackagesView() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "verified" | "candidate">("all");
  const filterRef = useRef<HTMLDivElement | null>(null);
  const filterMountedRef = useRef(false);
  const [filterBar, setFilterBar] = useState({ left: 0, width: 0, opacity: 0, animated: false });

  useEffect(() => {
    const measure = () => {
      const el = filterRef.current;
      if (!el) return;
      const active = el.querySelector<HTMLElement>('[data-filter-active="true"]');
      if (active) {
        setFilterBar({
          left: active.offsetLeft,
          width: active.offsetWidth,
          opacity: 1,
          animated: filterMountedRef.current
        });
        filterMountedRef.current = true;
      } else {
        setFilterBar((b) => ({ ...b, opacity: 0 }));
      }
    };
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [filter]);

  const filtered = useMemo(() => {
    return registry.packages.filter((pkg) => {
      const trust = pkg.trust.level === "verified" ? "verified" : "candidate";
      if (filter !== "all" && trust !== filter) return false;
      if (query === "") return true;
      const q = query.toLowerCase();
      return pkg.name.toLowerCase().includes(q) || pkg.description.toLowerCase().includes(q);
    });
  }, [query, filter]);

  const total = registry.packages.length;
  const verified = registry.packages.filter((p) => p.trust.level === "verified").length;
  const candidate = total - verified;

  return (
    <main
      style={{
        maxWidth: 1320,
        margin: "0 auto",
        padding: "40px clamp(18px, 5vw, 72px) 80px",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        gap: 24,
        minHeight: "calc(100vh - 90px)"
      }}
    >
      <section
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          paddingBottom: 28,
          borderBottom: `1px solid ${tokens.border}`,
          gap: 32,
          flexWrap: "wrap"
        }}
      >
        <div>
          <RegistryCount value={total} />
          <div
            style={{
              display: "flex",
              gap: 24,
              marginTop: 18,
              fontFamily: tokens.mono,
              fontSize: 12,
              color: tokens.muted,
              letterSpacing: 0.4,
              flexWrap: "wrap"
            }}
          >
            <span>
              <span style={{ color: tokens.ok, marginRight: 6 }}>{"\u25CF"}</span>
              {verified.toLocaleString()} verified
            </span>
            <span>
              <span style={{ color: tokens.accent, marginRight: 6 }}>{"\u25CF"}</span>
              {candidate.toLocaleString()} candidate
            </span>
            <span>registry updated {formatRegistryDate(registry.generatedAt)}</span>
          </div>
        </div>
        <div ref={filterRef} style={{ position: "relative", display: "flex", gap: 28, fontSize: 14 }}>
          {(["all", "verified", "candidate"] as const).map((f) => (
            <button
              key={f}
              data-filter-active={filter === f}
              onClick={() => setFilter(f)}
              style={
                {
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 0 8px",
                  color: filter === f ? tokens.ink : tokens.muted,
                  fontSize: 14,
                  fontWeight: 500,
                  fontFamily: "inherit",
                  textTransform: "capitalize",
                  letterSpacing: 0.2,
                  transition: "color 220ms cubic-bezier(0.22,1,0.36,1)"
                } satisfies CSSProperties
              }
            >
              {f}
            </button>
          ))}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: filterBar.left,
              width: filterBar.width,
              height: 1,
              background: tokens.ink,
              opacity: filterBar.opacity,
              transition: filterBar.animated
                ? "left 420ms cubic-bezier(0.7, 0, 0.2, 1), width 420ms cubic-bezier(0.7, 0, 0.2, 1), opacity 280ms"
                : "opacity 280ms",
              pointerEvents: "none"
            }}
          />
        </div>
      </section>

      <section style={{ position: "relative", flexShrink: 0 }}>
        <span
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            color: tokens.muted
          }}
        >
          <svg width={18} height={18} viewBox="0 0 16 16" fill="none">
            <circle cx={7} cy={7} r={4.5} stroke="currentColor" strokeWidth={1.4} />
            <path d="M10.5 10.5L13 13" stroke="currentColor" strokeLinecap="round" strokeWidth={1.4} />
          </svg>
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the archive"
          style={{
            width: "100%",
            padding: "12px 0 12px 32px",
            border: "none",
            borderBottom: `1px solid ${tokens.border}`,
            background: "transparent",
            fontSize: 20,
            color: tokens.text,
            outline: "none",
            fontFamily: tokens.serif,
            fontStyle: "italic",
            transition: "border-color 320ms cubic-bezier(0.22,1,0.36,1)"
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderBottomColor = tokens.ink;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderBottomColor = tokens.border;
          }}
        />
      </section>

      <section style={{ flex: 1 }}>
        {filtered.map((pkg, i) => (
          <PackageRow key={`${pkg.canonical}@${pkg.version}`} pkg={pkg} index={i + 1} />
        ))}
        {filtered.length === 0 && (
          <p
            style={{
              fontFamily: tokens.serif,
              fontStyle: "italic",
              fontSize: 22,
              color: tokens.muted,
              padding: "60px 0",
              textAlign: "center"
            }}
          >
            No packages match.
          </p>
        )}
      </section>
    </main>
  );
}

function PackageRow({ pkg, index }: { pkg: RegistryPackage; index: number }) {
  const trust = pkg.trust.level === "verified" ? "verified" : "candidate";
  const trustColor = trust === "verified" ? tokens.ok : tokens.accent;
  return (
    <a
      href={packagePageHref(pkg)}
      style={{
        display: "grid",
        gridTemplateColumns: "44px minmax(92px, 2.2fr) minmax(0, 4fr) 64px 72px",
        gap: "clamp(10px, 2vw, 28px)",
        alignItems: "baseline",
        padding: "18px 0",
        borderBottom: `1px solid ${tokens.borderSoft}`,
        textDecoration: "none",
        color: "inherit",
        transition: "background 160ms cubic-bezier(0.22,1,0.36,1)"
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = tokens.surface)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ fontFamily: tokens.serif, fontStyle: "italic", fontSize: 18, color: tokens.quiet }}>
        {String(index).padStart(2, "0")}
      </span>
      <span
        style={{
          fontFamily: tokens.mono,
          fontSize: 14.5,
          fontWeight: 500,
          color: tokens.ink,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }}
      >
        {pkg.name}
      </span>
      <span
        style={{
          fontSize: 14,
          color: tokens.muted,
          lineHeight: 1.5,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }}
      >
        {pkg.description}
      </span>
      <span style={{ fontFamily: tokens.mono, fontSize: 12, color: tokens.muted }}>v{pkg.version}</span>
      <span style={{ fontSize: 12, color: trustColor, fontWeight: 500, justifySelf: "end", whiteSpace: "nowrap" }}>
        {trust}
      </span>
    </a>
  );
}

function RegistryCount({ value }: { value: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 18 }}>
      <span
        style={{
          fontFamily: tokens.serif,
          fontSize: 96,
          fontWeight: 400,
          lineHeight: 0.95,
          color: tokens.ink,
          letterSpacing: "-0.034em",
          fontVariantNumeric: "tabular-nums"
        }}
      >
        {value.toLocaleString()}
      </span>
      <span
        style={{
          fontFamily: tokens.serif,
          fontStyle: "italic",
          fontSize: 30,
          color: tokens.muted,
          letterSpacing: "-0.005em"
        }}
      >
        packages
      </span>
    </span>
  );
}

function formatRegistryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
    year: "numeric"
  }).format(date);
}
