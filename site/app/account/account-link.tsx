"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SessionResponse = {
  authenticated?: boolean;
};

export function AccountLink() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/session", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: SessionResponse | null) => {
        if (!cancelled) {
          setAuthenticated(Boolean(data?.authenticated));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuthenticated(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Link className="brand-login-link" href="/account" prefetch>
      {authenticated ? "Account" : "Login"}
    </Link>
  );
}
