import { archiveStoreStatus } from "../../../../lib/package-intelligence-store";
import { apiJson, apiOptions, createApiHttpContext } from "../../../../lib/api-http";
import { checkRateLimit } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS(request: Request): Response {
  return apiOptions(createApiHttpContext(request));
}

export async function GET(request: Request = new Request("https://nipmod.com/api/archive/status")): Promise<Response> {
  const context = createApiHttpContext(request);
  const rateLimit = checkRateLimit(request, { limit: 240, name: "archive-status", windowMs: 60_000 }, context);
  if (!rateLimit.ok) {
    return rateLimit.response!;
  }

  const store = archiveStoreStatus();
  return apiJson(
    {
      configured: store.configured,
      driver: store.driver,
      missing: store.missing,
      mode: store.configured ? "durable-archive-enabled" : "resolver-only-safe-mode",
      type: "dev.nipmod.archive-status.v1",
      writeBoundary: "Durable package intelligence writes require the configured server-side archive store and an authorized server writer."
    },
    {
      context,
      headers: rateLimit.headers
    }
  );
}
