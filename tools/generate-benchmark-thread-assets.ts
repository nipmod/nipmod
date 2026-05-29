#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

type Asset = {
  accent?: string;
  bullets?: string[];
  foot?: string;
  kicker: string;
  metric?: string;
  rows?: Array<{ label: string; value: string; width?: number }>;
  subtitle?: string;
  title: string;
};

const OUT_DIR = join(process.cwd(), "site/public/benchmark-thread");
const W = 1600;
const H = 1000;

const assets: Asset[] = [
  {
    kicker: "01 · Public benchmark",
    metric: "95/100",
    rows: [
      { label: "Live checks", value: "7/7", width: 100 },
      { label: "Install-plan evidence", value: "7/7", width: 100 },
      { label: "Hosted workspace writes", value: "0", width: 0 }
    ],
    subtitle: "What an agent knows before package, model, repository or MCP execution.",
    title: "Agent preflight benchmark"
  },
  {
    kicker: "02 · Scope",
    bullets: ["Not a generic company ranking", "Not a malware-free guarantee", "A narrow pre-execution API benchmark"],
    foot: "The comparison is strict because vague security charts are useless.",
    title: "One question only"
  },
  {
    kicker: "03 · Tracks",
    rows: [
      { label: "Nipmod", value: "agent preflight layer", width: 95 },
      { label: "Native registries", value: "source metadata", width: 22 },
      { label: "OSV", value: "vulnerability feed", width: 10 },
      { label: "deps.dev", value: "package evidence", width: 16 },
      { label: "Socket", value: "authenticated PURL lookup", width: 10 },
      { label: "Snyk API", value: "authenticated package API", width: 1 },
      { label: "OpenSSF Scorecard", value: "repository posture", width: 2 },
      { label: "Raw agent", value: "control baseline", width: 3 }
    ],
    title: "Who we measured"
  },
  {
    kicker: "04 · Market context",
    bullets: ["Socket: $60M Series C at $1B valuation, May 2026", "Snyk: reported $7.4B valuation after 2022 Series G", "OSV, deps.dev and Scorecard are serious open source security infrastructure"],
    foot: "Company size is context. It is not a scoring input.",
    title: "A serious comparison set"
  },
  {
    kicker: "05 · Scoring",
    rows: [
      { label: "Source resolution", value: "identity, version, metadata", width: 97 },
      { label: "Security evidence", value: "advisory, provenance, behavior", width: 83 },
      { label: "Execution preflight", value: "install plan, boundary, risk", width: 100 },
      { label: "Agent readiness", value: "action-ready JSON", width: 100 }
    ],
    title: "How the score is graded"
  },
  {
    kicker: "06 · Result",
    rows: [
      { label: "Nipmod", value: "95", width: 95 },
      { label: "Native registries", value: "22", width: 22 },
      { label: "deps.dev", value: "16", width: 16 },
      { label: "Socket", value: "10", width: 10 },
      { label: "OSV", value: "10", width: 10 },
      { label: "Raw agent", value: "3", width: 3 },
      { label: "OpenSSF Scorecard", value: "2", width: 2 },
      { label: "Snyk API", value: "1", width: 1 }
    ],
    title: "Current public run"
  },
  {
    kicker: "07 · Execution preflight",
    bullets: ["Resolved source", "Warnings", "What would run", "Where approval is required"],
    foot: "This is the dangerous transition: recommendation to execution.",
    title: "The agent needs more than a package name"
  },
  {
    kicker: "08 · Hosted boundary",
    metric: "0",
    rows: [
      { label: "Installs", value: "0", width: 0 },
      { label: "Repository clones", value: "0", width: 0 },
      { label: "Artifact unpacking", value: "0", width: 0 },
      { label: "Execution", value: "0", width: 0 },
      { label: "Workspace writes", value: "0", width: 0 }
    ],
    title: "Read only by design"
  },
  {
    kicker: "09 · Limits",
    bullets: ["No Snyk full-platform claim", "No Socket Firewall claim", "No local CLI or SCM integration claim", "No sandbox malware-detection claim"],
    foot: "The limits are public because hiding them would make the benchmark weaker.",
    title: "What we did not test"
  },
  {
    kicker: "10 · Architecture",
    bullets: ["Evidence feeds stay valuable", "Registries remain the source of truth", "Nipmod turns evidence into agent decisions"],
    foot: "Search, inspect, warnings and safe install plans in one API flow.",
    title: "Nipmod sits above the sources"
  },
  {
    kicker: "11 · Open challenge",
    bullets: ["Confusing package names", "Weak metadata", "Suspicious install behavior", "Model reuse risks", "MCP ambiguity"],
    foot: "If an agent might touch it, Nipmod should learn how to inspect it better.",
    title: "Send the hard cases"
  },
  {
    kicker: "12 · Links",
    bullets: ["Benchmark: nipmod.com/benchmark", "Raw JSON: nipmod.com/benchmark.json", "GitHub: github.com/nipmod/nipmod"],
    foot: "Nipmod is the package intelligence layer for AI agents.",
    title: "Keep proving it in public"
  }
];

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function textLines(value: string, x: number, y: number, opts: { cls: string; lineHeight: number; size: number; weight?: number | string; width?: number }): string {
  const maxChars = opts.width ?? 48;
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.map((line, index) => `<text x="${x}" y="${y + index * opts.lineHeight}" class="${opts.cls}" font-size="${opts.size}"${opts.weight ? ` font-weight="${opts.weight}"` : ""}>${escapeXml(line)}</text>`).join("\n");
}

function bars(rows: NonNullable<Asset["rows"]>, x: number, y: number, w: number, compact = false): string {
  const rowH = compact ? 48 : 72;
  const barX = compact ? x + 390 : x + 430;
  const barW = compact ? w - 520 : w - 560;
  return rows.map((row, i) => {
    const yy = y + i * rowH;
    const width = Math.max(7, Math.round(barW * Math.min(100, Math.max(0, row.width ?? 0)) / 100));
    const isPrimary = i === 0 || row.label === "Nipmod";
    const fill = isPrimary ? "url(#gold)" : "url(#muted)";
    return `
      <text x="${x}" y="${yy + 22}" class="${isPrimary ? "white" : "mutedText"} sans" font-size="${compact ? 20 : 24}" font-weight="${isPrimary ? 820 : 720}">${escapeXml(row.label)}</text>
      <rect x="${barX}" y="${yy + 3}" width="${width}" height="${compact ? 20 : 24}" rx="${compact ? 10 : 12}" fill="${fill}"/>
      <text x="${x + w - 10}" y="${yy + 23}" class="${isPrimary ? "white" : "mutedText"} sans" font-size="${compact ? 18 : 22}" font-weight="850" text-anchor="end">${escapeXml(row.value)}</text>
    `;
  }).join("\n");
}

function bullets(items: string[], x: number, y: number): string {
  const rowH = items.length > 4 ? 62 : 82;
  return items.map((item, i) => {
    const yy = y + i * rowH;
    return `
      <circle cx="${x + 10}" cy="${yy - 9}" r="5" fill="#d8b56d"/>
      ${textLines(item, x + 34, yy, { cls: "white serif", lineHeight: 34, size: 30, width: 52 })}
    `;
  }).join("\n");
}

function svg(asset: Asset, index: number): string {
  const hasRows = Boolean(asset.rows?.length);
  const hasBullets = Boolean(asset.bullets?.length);
  const metric = asset.metric ? `
    <g transform="translate(1130 126)">
      <circle cx="120" cy="120" r="116" fill="rgba(255,255,255,0.028)" stroke="rgba(245,241,234,0.16)"/>
      <text x="120" y="146" class="serif white" font-size="${asset.metric.length > 2 ? 78 : 132}" text-anchor="middle" font-weight="500">${escapeXml(asset.metric)}</text>
    </g>
  ` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(asset.title)}</title>
  <desc id="desc">${escapeXml(asset.kicker)}</desc>
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#131514"/>
      <stop offset="0.55" stop-color="#22211f"/>
      <stop offset="1" stop-color="#101111"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#8fbf9a"/>
      <stop offset="1" stop-color="#d8b56d"/>
    </linearGradient>
    <linearGradient id="muted" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#6f746f"/>
      <stop offset="1" stop-color="#a8916d"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000" flood-opacity="0.32"/>
    </filter>
    <style>
      .serif { font-family: Georgia, "Times New Roman", serif; }
      .sans { font-family: Inter, Arial, sans-serif; }
      .white { fill: #f5f1ea; }
      .mutedText { fill: #b9b2a8; opacity: 0.78; }
      .faintText { fill: #b9b2a8; opacity: 0.55; }
    </style>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="58" y="58" width="1484" height="884" rx="18" fill="rgba(255,255,255,0.018)" stroke="rgba(245,241,234,0.16)"/>

  <g transform="translate(96 86)">
    <rect x="0" y="0" width="44" height="44" rx="10" fill="${asset.accent ?? "#ef7c62"}"/>
    <text x="62" y="30" class="sans white" font-size="24" font-weight="750">Nipmod</text>
    <text x="0" y="104" class="sans faintText" font-size="16" font-weight="820">${escapeXml(asset.kicker.toUpperCase())}</text>
    ${textLines(asset.title, 0, 170, { cls: "serif white", lineHeight: 72, size: 64, width: asset.title.length > 34 ? 32 : 48 })}
    ${asset.subtitle ? textLines(asset.subtitle, 0, 292, { cls: "serif mutedText", lineHeight: 35, size: 25, width: 66 }) : ""}
  </g>
  ${metric}

  <g transform="translate(96 380)" filter="url(#shadow)">
    <rect x="0" y="0" width="1408" height="440" rx="14" fill="rgba(255,255,255,0.034)" stroke="rgba(245,241,234,0.17)"/>
    ${hasRows ? bars(asset.rows!, 54, asset.rows!.length > 5 ? 58 : 78, 1280, asset.rows!.length > 5) : ""}
    ${hasBullets ? bullets(asset.bullets!, 62, 88) : ""}
    ${asset.foot ? textLines(asset.foot, 62, 382, { cls: "serif mutedText", lineHeight: 28, size: 22, width: 92 }) : ""}
  </g>

  <text x="96" y="884" class="sans faintText" font-size="15" font-weight="780">NIPMOD.COM/BENCHMARK · RAW JSON: NIPMOD.COM/BENCHMARK.JSON · ${String(index + 1).padStart(2, "0")}/12</text>
</svg>`;
}

await mkdir(OUT_DIR, { recursive: true });
await Promise.all(assets.map((asset, index) => writeFile(join(OUT_DIR, `post-${String(index + 1).padStart(2, "0")}.svg`), svg(asset, index))));
console.log(`generated ${assets.length} benchmark thread SVG assets in ${OUT_DIR}`);
