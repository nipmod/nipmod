import Link from "next/link";
import type { ReactNode } from "react";

export type DocsNavItem = {
  href: string;
  label: string;
};

export type DocsStat = {
  label: string;
  value: string;
};

export const docsNavItems: DocsNavItem[] = [
  { href: "/", label: "Overview" },
  { href: "/api-access", label: "API" },
  { href: "/sources", label: "Sources" },
  { href: "/packages", label: "Archive" },
  { href: "/trust", label: "Trust" },
  { href: "/security", label: "Security" },
  { href: "/examples", label: "Examples" },
  { href: "/status", label: "Status" }
];

export function DocsShell({
  children,
  description,
  eyebrow,
  nav = docsNavItems,
  stats = [],
  title
}: {
  children: ReactNode;
  description: string;
  eyebrow?: string;
  nav?: DocsNavItem[];
  stats?: DocsStat[];
  title: string;
}) {
  return (
    <main className="docs-shell" id="main">
      <aside className="docs-sidebar" aria-label="Documentation">
        <Link className="docs-sidebar-title" href="/">
          Nipmod docs
        </Link>
        <nav className="docs-sidebar-nav">
          {nav.map((item) => (
            <Link href={item.href} key={item.href} prefetch>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

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
  title
}: {
  children: ReactNode;
  eyebrow?: string;
  title: string;
}) {
  return (
    <section className="docs-section">
      <div className="docs-section-head">
        {eyebrow ? <p className="docs-eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
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
  return (
    <pre className="docs-code">
      <code>{children}</code>
    </pre>
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
