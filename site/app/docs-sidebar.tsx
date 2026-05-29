"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DocsNavGroup } from "./docs-shell";

export function DocsSidebar({ nav }: { nav: DocsNavGroup[] }) {
  const pathname = usePathname();

  return (
    <aside className="docs-sidebar" aria-label="Documentation">
      <Link className="docs-sidebar-title" href="/docs">
        Nipmod docs
      </Link>
      <nav className="docs-sidebar-nav">
        {nav.map((group) => (
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
      </nav>
    </aside>
  );
}
