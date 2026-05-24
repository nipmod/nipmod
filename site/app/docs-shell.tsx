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
      { href: "/", label: "Overview" },
      { href: "/quickstart", label: "Quickstart" },
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
  toc?: DocsNavItem[];
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
          <div className="docs-table-row" key={first} role="row">
            <strong role="cell">{first}</strong>
            <div role="cell">{second}</div>
            {third ? <div role="cell">{third}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
