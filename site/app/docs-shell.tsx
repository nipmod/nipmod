import type { ReactNode } from "react";
import { CommandBlock } from "./command-block";
import { DocsSidebar } from "./docs-sidebar";

export type DocsNavItem = {
  href: string;
  label: string;
};

export type DocsNavGroup = {
  items: DocsNavItem[];
  title: string;
};

export type DocsStat = {
  label: string;
  value: string;
};

export const docsNavGroups: DocsNavGroup[] = [
  {
    items: [
      { href: "/", label: "Home" },
      { href: "/quickstart", label: "Quickstart" },
      { href: "/architecture", label: "Architecture" },
      { href: "/api-access", label: "API reference" }
    ],
    title: "Start"
  },
  {
    items: [
      { href: "/sources", label: "Sources" },
      { href: "/trust", label: "Trust and safety" },
      { href: "/mcp", label: "MCP" },
      { href: "/examples", label: "Examples" }
    ],
    title: "Build"
  },
  {
    items: [
      { href: "/packages", label: "Archive" },
      { href: "/security", label: "Security" },
      { href: "/status", label: "Status" }
    ],
    title: "Reference"
  }
];

export const docsNavItems: DocsNavItem[] = docsNavGroups.flatMap((group) => group.items);

export function DocsShell({
  children,
  description,
  eyebrow,
  nav = docsNavGroups,
  stats = [],
  title
}: {
  children: ReactNode;
  description: string;
  eyebrow?: string;
  nav?: DocsNavGroup[];
  stats?: DocsStat[];
  title: string;
}) {
  return (
    <main className="docs-shell" id="main">
      <DocsSidebar nav={nav} />

      <article className="docs-main">
        <header className="docs-hero">
          {eyebrow ? <p className="docs-eyebrow">{eyebrow}</p> : null}
          <h1>{title}</h1>
          <p>{description}</p>
          {stats.length > 0 ? (
            <dl className="docs-stat-strip">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <dt>{stat.label}</dt>
                  <dd>{stat.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </header>
        <div className="docs-content">{children}</div>
      </article>
    </main>
  );
}

export function DocsSection({
  children,
  eyebrow,
  id,
  title
}: {
  children: ReactNode;
  eyebrow?: string;
  id?: string;
  title: string;
}) {
  return (
    <section className="docs-section" id={id ?? toAnchorId(title)}>
      <div className="docs-section-head">
        {eyebrow ? <p className="docs-eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function toAnchorId(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function DocsGrid({ children }: { children: ReactNode }) {
  return <div className="docs-grid">{children}</div>;
}

export function DocsProse({ children }: { children: ReactNode }) {
  return <div className="docs-prose">{children}</div>;
}

export function DocsSequence({
  items
}: {
  items: Array<{
    body: ReactNode;
    label: string;
    title: string;
  }>;
}) {
  return (
    <ol className="docs-sequence">
      {items.map((item) => (
        <li key={item.label}>
          <span>{item.label}</span>
          <div>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function DocsCard({
  children,
  label,
  title
}: {
  children: ReactNode;
  label?: string;
  title: string;
}) {
  return (
    <article className="docs-card">
      {label ? <span>{label}</span> : null}
      <h3>{title}</h3>
      {children}
    </article>
  );
}

export function DocsCode({ children }: { children: string }) {
  return <CommandBlock command={children} label="Copy" variant="compact" />;
}

export function ArchitectureDiagram() {
  const sources = ["npm", "PyPI", "GitHub", "Hugging Face", "MCP"];

  return (
    <div
      className="docs-architecture"
      aria-label="Nipmod architecture flow: agent asks Nipmod for a package, Nipmod searches existing sources, normalizes results, checks trust, creates a safe install plan, waits for user approval before workspace writes, and saves confirmed useful package intelligence for future reuse."
    >
      <svg className="architecture-lines" viewBox="0 0 1000 560" aria-hidden="true" preserveAspectRatio="none">
        <defs>
          <marker id="architecture-arrow" markerHeight="10" markerWidth="10" orient="auto" refX="8" refY="5">
            <path d="M 0 0 L 10 5 L 0 10 z" />
          </marker>
          <marker id="architecture-arrow-start" markerHeight="10" markerWidth="10" orient="auto-start-reverse" refX="2" refY="5">
            <path d="M 10 0 L 0 5 L 10 10 z" />
          </marker>
        </defs>
        <path d="M 230 198 H 390" markerEnd="url(#architecture-arrow)" />
        <path d="M 390 286 H 230" markerEnd="url(#architecture-arrow)" />
        <path d="M 680 248 H 730" markerStart="url(#architecture-arrow-start)" markerEnd="url(#architecture-arrow)" />
        <path d="M 420 342 V 386 H 260 V 415" markerEnd="url(#architecture-arrow)" />
        <path d="M 535 342 V 415" markerEnd="url(#architecture-arrow)" />
      </svg>

      <div className="architecture-card architecture-agent">
        <strong>Agent</strong>
      </div>

      <p className="architecture-label architecture-label-request">asks Nipmod for a package</p>
      <p className="architecture-label architecture-label-response">receives package, risks and install plan</p>

      <div className="architecture-card architecture-api">
        <strong>Nipmod API</strong>
        <span>searches existing sources</span>
        <span>normalizes results</span>
        <span>checks trust</span>
        <span>creates safe install plan</span>
      </div>

      <div className="architecture-card architecture-sources">
        <strong>Sources</strong>
        <div>
          {sources.map((source) => (
            <span key={source}>{source}</span>
          ))}
        </div>
      </div>

      <div className="architecture-card architecture-approval">
        <strong>User approval</strong>
      </div>
      <p className="architecture-caption architecture-caption-approval">required before workspace writes</p>

      <div className="architecture-card architecture-archive">
        <strong>Nipmod Archive</strong>
      </div>
      <p className="architecture-caption architecture-caption-archive">saves confirmed useful package intelligence for future reuse</p>
    </div>
  );
}

export function DocsTable({
  rows
}: {
  rows: Array<
    | {
        first: string;
        second: ReactNode;
        third?: ReactNode;
      }
    | [string, ReactNode, ReactNode?]
  >;
}) {
  return (
    <div className="docs-table" role="table">
      {rows.map((row) => {
        const first = Array.isArray(row) ? row[0] : row.first;
        const second = Array.isArray(row) ? row[1] : row.second;
        const third = Array.isArray(row) ? row[2] : row.third;

        return (
          <div className={third ? "docs-table-row" : "docs-table-row docs-table-row-two"} key={first} role="row">
            <strong role="cell">{first}</strong>
            <div role="cell">{second}</div>
            {third ? <div role="cell">{third}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
