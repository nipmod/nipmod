import { archiveStoreStatus } from "../../../../lib/package-intelligence-store";
import { checkRateLimit } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request = new Request("https://nipmod.com/api/archive/status")): Promise<Response> {
  const rateLimit = checkRateLimit(request, { limit: 240, name: "archive-status", windowMs: 60_000 });
  if (!rateLimit.ok) {
    return rateLimit.response!;
  }

  const store = archiveStoreStatus();
  return Response.json(
    {
      configured: store.configured,
      driver: store.driver,
      missing: store.missing,
      mode: store.configured ? "durable-archive-enabled" : "resolver-only-safe-mode",
      type: "dev.nipmod.archive-status.v1",
      writeBoundary: "Durable package intelligence writes require the configured server-side archive store and an authorized server writer."
    },
    {
      headers: {
        ...rateLimit.headers,
        "cache-control": "no-store"
      }
    }
  );
}
