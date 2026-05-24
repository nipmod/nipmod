"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DocsNavGroup } from "./docs-shell";

export function DocsSidebar({ nav }: { nav: DocsNavGroup[] }) {
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleNav = useMemo(
    () =>
      normalizedQuery
        ? nav
            .map((group) => ({
              ...group,
              items: group.items.filter((item) => `${group.title} ${item.label}`.toLowerCase().includes(normalizedQuery))
            }))
            .filter((group) => group.items.length > 0)
        : nav,
    [nav, normalizedQuery]
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <aside className="docs-sidebar" aria-label="Documentation">
      <Link className="docs-sidebar-title" href="/">
        Nipmod docs
      </Link>
      <label className="docs-search">
        <span className="sr-only">Search docs navigation</span>
        <input ref={inputRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search docs" />
        <kbd>Cmd K</kbd>
      </label>
      <nav className="docs-sidebar-nav">
        {visibleNav.map((group) => (
          <div className="docs-sidebar-group" key={group.title}>
            <p>{group.title}</p>
            <div>
              {group.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));

                return (
                  <Link aria-current={isActive ? "page" : undefined} className={isActive ? "docs-sidebar-active" : undefined} href={item.href} key={item.href} prefetch>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        {visibleNav.length === 0 ? <p className="docs-sidebar-empty">No docs page found.</p> : null}
      </nav>
    </aside>
  );
}
