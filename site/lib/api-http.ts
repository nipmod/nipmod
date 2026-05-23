export const PUBLIC_READ_CACHE = "public, max-age=30, stale-while-revalidate=120";
export const NO_STORE = "no-store";

export interface ApiHttpContext {
  requestId: string;
  startedAt: number;
}

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
    headers?: Record<string, string>;
    status?: number;
  }
): Response {
  return Response.json(value, {
    headers: apiHeaders(options.context, options.headers, options.cacheControl ?? NO_STORE),
    status: options.status ?? 200
  });
}

export function apiOptions(context = createApiHttpContext()): Response {
  return new Response(null, {
    headers: apiHeaders(context, undefined, NO_STORE),
    status: 204
  });
}

export function apiHeaders(context: ApiHttpContext, headers: Record<string, string> = {}, cacheControl = NO_STORE): HeadersInit {
  const durationMs = Math.max(0, Date.now() - context.startedAt);
  return {
    ...headers,
    "access-control-allow-headers": "authorization, content-type, x-nipmod-api-key, x-nipmod-archive-token, x-request-id",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-origin": "*",
    "cache-control": cacheControl,
    "server-timing": `app;dur=${durationMs}`,
    "x-nipmod-api-version": "2026-05-23",
    "x-nipmod-request-id": context.requestId,
    "x-nipmod-response-time-ms": String(durationMs)
  };
}

function cleanHeaderValue(value: string | null | undefined): string | null {
  const cleaned = value?.replace(/[^\w.:/-]/g, "").slice(0, 120);
  return cleaned || null;
}
