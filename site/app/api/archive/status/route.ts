import { archiveStoreStatus } from "../../../../lib/package-intelligence-store";
import { apiOptions, createApiHttpContext } from "../../../../lib/api-http";
import { apiJsonWithUsage } from "../../../../lib/api-response";
import { usageStoreStatus } from "../../../../lib/api-usage";
import { checkApiRateLimit } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS(request: Request): Response {
  return apiOptions(createApiHttpContext(request));
}

export async function GET(request: Request = new Request("https://nipmod.com/api/archive/status")): Promise<Response> {
  const context = createApiHttpContext(request);
  const rateLimit = checkApiRateLimit(request, { limit: 240, name: "archive-status", windowMs: 60_000 }, context);
  if (!rateLimit.ok) {
    return rateLimit.response!;
  }

  const store = archiveStoreStatus();
  const usage = usageStoreStatus();
  return apiJsonWithUsage(
    request,
    {
      configured: store.configured,
      driver: store.driver,
      missing: store.missing,
      mode: store.configured ? "durable-archive-enabled" : "resolver-only-safe-mode",
      type: "dev.nipmod.archive-status.v1",
      usage: {
        configured: usage.configured,
        driver: usage.driver
      },
      writeBoundary: "Durable package intelligence writes require the configured server-side archive store and an authorized server writer."
    },
    {
      access: rateLimit.access,
      context,
      headers: rateLimit.headers
    }
  );
}
