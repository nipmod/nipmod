import { ArchiveStoreError, archiveStoreStatus, searchPackageIntelligenceArchive } from "../../../../lib/package-intelligence-store";
import { checkRateLimit } from "../../../../lib/rate-limit";
import { readLimit } from "../shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const rateLimit = checkRateLimit(request, { limit: 120, name: "archive-search", windowMs: 60_000 });
  if (!rateLimit.ok) {
    return rateLimit.response!;
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const limit = readLimit(url.searchParams.get("limit"));

  try {
    const options = limit === undefined ? {} : { limit };
    const result = await searchPackageIntelligenceArchive(query, options);
    return json({
      ...result,
      store: archiveStoreStatus()
    }, 200, rateLimit.headers);
  } catch (error) {
    return errorJson(error, rateLimit.headers);
  }
}

function errorJson(error: unknown, headers: Record<string, string> = {}): Response {
  if (error instanceof ArchiveStoreError) {
    return json({ error: error.message, type: "dev.nipmod.api-error.v1" }, error.status, headers);
  }
  return json({ error: error instanceof Error ? error.message : "archive search failed", type: "dev.nipmod.api-error.v1" }, 500, headers);
}

function json(value: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(value, {
    headers: {
      ...headers,
      "cache-control": "no-store"
    },
    status
  });
}
