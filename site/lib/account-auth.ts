import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

type AccountAuthEnv = Record<string, string | undefined>;

const SUPABASE_URL_ENV = "NIPMOD_ARCHIVE_SUPABASE_URL";
const SUPABASE_PUBLISHABLE_KEY_ENV = "NIPMOD_ARCHIVE_SUPABASE_PUBLISHABLE_KEY";

export type AccountUser = {
  avatarUrl: string | null;
  email: string | null;
  id: string;
  name: string | null;
  provider: string | null;
};

export function accountAuthConfig(env: AccountAuthEnv = process.env): {
  configured: boolean;
  missing: string[];
  publishableKey: string | null;
  url: string | null;
} {
  const url = readEnv(env, SUPABASE_URL_ENV);
  const publishableKey = readEnv(env, SUPABASE_PUBLISHABLE_KEY_ENV);
  const missing = [
    ...(url ? [] : [SUPABASE_URL_ENV]),
    ...(publishableKey ? [] : [SUPABASE_PUBLISHABLE_KEY_ENV])
  ];
  return {
    configured: missing.length === 0,
    missing,
    publishableKey,
    url
  };
}

export async function createAccountSupabaseServerClient(env: AccountAuthEnv = process.env) {
  const config = accountAuthConfig(env);
  if (!config.configured || !config.url || !config.publishableKey) {
    return null;
  }

  const cookieStore = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; options: CookieOptions; value: string }>) {
        try {
          cookiesToSet.forEach(({ name, options, value }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot set cookies. Route handlers and proxy can.
        }
      }
    }
  });
}

export async function getCurrentAccountUser(env: AccountAuthEnv = process.env): Promise<AccountUser | null> {
  const supabase = await createAccountSupabaseServerClient(env);
  if (!supabase) {
    return null;
  }
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();
  if (error || !user) {
    return null;
  }
  return accountUserFromSupabaseUser(user);
}

export function accountUserFromSupabaseUser(user: User): AccountUser {
  const metadata = user.user_metadata as Record<string, unknown>;
  return {
    avatarUrl: readMetadataString(metadata, ["avatar_url", "picture"]),
    email: user.email ?? null,
    id: user.id,
    name: readMetadataString(metadata, ["name", "full_name", "user_name", "preferred_username"]),
    provider: user.app_metadata.provider ?? null
  };
}

export function safeAccountNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/account";
  }
  if (value.startsWith("/auth/")) {
    return "/account";
  }
  return value.slice(0, 180);
}

export function normalizeAccountEmail(value: FormDataEntryValue | string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const email = value.trim().toLowerCase();
  if (email.length < 6 || email.length > 254) {
    return null;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }
  return email;
}

function readEnv(env: AccountAuthEnv, key: string): string | null {
  const value = env[key]?.trim();
  return value ? value : null;
}

function readMetadataString(metadata: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim().slice(0, 160);
    }
  }
  return null;
}
