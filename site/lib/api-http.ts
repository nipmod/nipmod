export const PUBLIC_READ_CACHE = "public, max-age=30, stale-while-revalidate=120";
export const NO_STORE = "no-store";

export interface ApiHttpContext {
  requestId: string;
  startedAt: number;
}

export interface ApiCorsPolicy {
  allowOrigin: string;
  varyOrigin?: boolean;
}

const PUBLIC_CORS_POLICY: ApiCorsPolicy = { allowOrigin: "*" };
const ADMIN_DEFAULT_ORIGIN = "https://nipmod.com";
const ADMIN_ALLOWED_HOSTS = new Set(["nipmod.com", "www.nipmod.com"]);

export function createApiHttpContext(request?: Request): ApiHttpContext {
  return {
    requestId: cleanHeaderValue(request?.headers.get("x-request-id")) ?? crypto.randomUUID(),
    startedAt: Date.now()
  };
}

export function apiJson(
  value: unknown,
  options: {
    cacheControl?: string | undefined;
    context: ApiHttpContext;
    corsPolicy?: ApiCorsPolicy | undefined;
    headers?: Record<string, string>;
    status?: number;
  }
): Response {
  return Response.json(value, {
    headers: apiHeaders(options.context, options.headers, options.cacheControl ?? NO_STORE, options.corsPolicy),
    status: options.status ?? 200
  });
}

export function apiOptions(context = createApiHttpContext(), options: { corsPolicy?: ApiCorsPolicy | undefined } = {}): Response {
  return new Response(null, {
    headers: apiHeaders(context, undefined, NO_STORE, options.corsPolicy),
    status: 204
  });
}

export function apiHeaders(
  context: ApiHttpContext,
  headers: Record<string, string> = {},
  cacheControl = NO_STORE,
  corsPolicy: ApiCorsPolicy | undefined = PUBLIC_CORS_POLICY
): HeadersInit {
  const durationMs = Math.max(0, Date.now() - context.startedAt);
  const cors = corsPolicy ?? PUBLIC_CORS_POLICY;
  const mergedHeaders: Record<string, string> = {
    ...headers,
    "access-control-allow-headers": "authorization, content-type, x-nipmod-api-key, x-nipmod-archive-token, x-request-id",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-origin": cors.allowOrigin,
    "cache-control": cacheControl,
    "server-timing": `app;dur=${durationMs}`,
    "x-nipmod-api-version": "2026-05-23",
    "x-nipmod-request-id": context.requestId,
    "x-nipmod-response-time-ms": String(durationMs)
  };
  if (cors.varyOrigin) {
    mergedHeaders.vary = mergeVaryHeader(headers.vary, "Origin");
  }
  return mergedHeaders;
}

export function adminCorsPolicy(request: Request): ApiCorsPolicy {
  const origin = cleanOrigin(request.headers.get("origin"));
  if (origin && isAllowedAdminOrigin(origin)) {
    return { allowOrigin: origin, varyOrigin: true };
  }
  return { allowOrigin: ADMIN_DEFAULT_ORIGIN, varyOrigin: true };
}

function isAllowedAdminOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    if (ADMIN_ALLOWED_HOSTS.has(parsed.hostname) && parsed.protocol === "https:") {
      return true;
    }
    if ((parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1") && /^https?:$/.test(parsed.protocol)) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function mergeVaryHeader(existing: string | undefined, value: string): string {
  const values = new Set(
    (existing ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
  values.add(value);
  return [...values].join(", ");
}

function cleanOrigin(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = new URL(value);
    return parsed.origin;
  } catch {
    return null;
  }
}

function cleanHeaderValue(value: string | null | undefined): string | null {
  const cleaned = value?.replace(/[^\w.:/-]/g, "").slice(0, 120);
  return cleaned || null;
}
