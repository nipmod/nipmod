import { ExternalPackageError, parseExternalSources, searchExternalPackages } from "../../../lib/external-packages";
import { checkRateLimit } from "../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const rateLimit = checkRateLimit(request, { limit: 120, name: "external-search", windowMs: 60_000 });
  if (!rateLimit.ok) {
    return rateLimit.response!;
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const limit = readLimit(url.searchParams.get("limit"));
  const sources = parseExternalSources(url.searchParams.get("sources"));

  try {
    const result = await searchExternalPackages(query, limit === undefined ? { sources } : { limit, sources });
    return json({
      ...result,
      archivePolicy: {
        externalRecords: "Stored as external_indexed records after confirmed use.",
        ownership: "Original package owners keep ownership. Nipmod adds source context, trust checks, install plans and receipts.",
        verifiedRecords: "Only claimed or directly published packages become verified_nipmod."
      }
    }, 200, rateLimit.headers);
  } catch (error) {
    return errorJson(error, rateLimit.headers);
  }
}

function readLimit(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function errorJson(error: unknown, headers: Record<string, string> = {}): Response {
  if (error instanceof ExternalPackageError) {
    return json({ error: error.message, type: "dev.nipmod.api-error.v1" }, error.status, headers);
  }
  return json({ error: error instanceof Error ? error.message : "external search failed", type: "dev.nipmod.api-error.v1" }, 500, headers);
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
