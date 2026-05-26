import { apiOptions, createApiHttpContext } from "../../../../lib/api-http";
import { apiJsonWithUsage } from "../../../../lib/api-response";
import { apiKeyStoreStatus } from "../../../../lib/api-auth";
import { usageStoreStatus } from "../../../../lib/api-usage";
import {
  EXTERNAL_PACKAGE_SOURCES,
  externalSourceCapabilities,
  externalSourceRequestHeaders,
  mcpBootstrapSourceProbe,
  type ExternalPackageSource
} from "../../../../lib/external-packages";
import { archiveStoreStatus } from "../../../../lib/package-intelligence-store";
import { checkApiRateLimitAsync, rateLimitStoreStatus } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function OPTIONS(request: Request): Response {
  return apiOptions(createApiHttpContext(request));
}

export async function GET(request: Request): Promise<Response> {
  const context = createApiHttpContext(request);
  const rateLimit = await checkApiRateLimitAsync(request, { limit: 240, name: "source-health", windowMs: 60_000 }, context, {
    requireApiKey: true
  });
  if (!rateLimit.ok) {
    return rateLimit.response!;
  }

  const url = new URL(request.url);
  const shouldProbe = url.searchParams.get("probe") === "live";
  const archive = archiveStoreStatus();
  const apiKeys = apiKeyStoreStatus();
  const usage = usageStoreStatus();
  const rateLimitStore = rateLimitStoreStatus();
  const activeRateLimitStore = rateLimit.headers["x-ratelimit-store"] ?? "unknown";
  const sources = externalSourceCapabilities();
  const live = shouldProbe ? await probeExternalSources() : null;
  return apiJsonWithUsage(
    request,
    {
      apiAccess: {
        authorizationHeaderSupported: true,
        keyRegistry: {
          configured: apiKeys.configured,
          driver: apiKeys.driver,
          envKeysConfigured: apiKeys.envKeysConfigured,
          hashingConfigured: apiKeys.hashingConfigured,
          registryConfigured: apiKeys.registryConfigured,
          missing: apiKeys.missing,
          privacy: apiKeys.privacy
        },
        keyHeaders: ["x-nipmod-api-key"],
        keyRequired: true,
        publicBeta: false,
        tiers: apiKeys.tiers
      },
      archive: {
        configured: archive.configured,
        driver: archive.driver,
        mode: archive.configured ? "durable-archive-enabled" : "resolver-only-safe-mode"
      },
      generatedAt: new Date().toISOString(),
      probe: {
        cacheTtlMs: SOURCE_PROBE_CACHE_TTL_MS,
        mode: shouldProbe ? "live" : "capability",
        timeoutMs: SOURCE_PROBE_TIMEOUT_MS,
        timeoutMsBySource: {
          mcp: SLOW_SOURCE_PROBE_TIMEOUT_MS
        }
      },
      rateLimit: {
        activeStore: activeRateLimitStore,
        configured: rateLimitStore.configured,
        distributedActive: activeRateLimitStore === "supabase",
        driver: rateLimitStore.driver,
        fallbackReason: rateLimit.fallbackReason ?? null,
        fallback: rateLimitStore.fallback,
        missing: rateLimitStore.missing
      },
      sources: sources.map((source) => ({
        ...source,
        ...(live ? { live: live[source.source] } : {})
      })),
      summary: {
        available: sources.length,
        liveCached: live ? Object.values(live).filter((item) => item.cached).length : null,
        liveFailed: live ? Object.values(live).filter((item) => item.status === "failed").length : null,
        liveOk: live ? Object.values(live).filter((item) => item.status === "ok").length : null,
        optionalAuthConfigured: sources.filter((source) => source.authConfigured).length,
        requested: sources.length,
        workspaceWritesFromHostedApi: false
      },
      usage: {
        configured: usage.configured,
        driver: usage.driver,
        privacy: "hashed client, query and package identifiers only"
      },
      type: "dev.nipmod.source-health.v1"
    },
    {
      access: rateLimit.access,
      context,
      headers: rateLimit.headers
    }
  );
}

const SOURCE_PROBE_TIMEOUT_MS = 1_800;
const SLOW_SOURCE_PROBE_TIMEOUT_MS = 3_000;
const SOURCE_PROBE_CACHE_TTL_MS = 30_000;

interface SourceLiveProbe {
  cached: boolean;
  checkedAt: string;
  degraded: boolean;
  durationMs: number;
  endpointHost: string;
  fallback: SourceLiveProbeFallback | null;
  probePath: "upstream-live" | "resolver-fallback";
  retryable: boolean;
  status: "ok" | "failed";
  statusCode: number | null;
}

type SourceLiveProbeMeasurement = Omit<SourceLiveProbe, "cached" | "checkedAt">;

interface SourceLiveProbeFallback {
  recordCount: number;
  snapshot: string;
  type: "pinned-public-registry-snapshot";
}

const sourceProbeCache = new Map<ExternalPackageSource, { expiresAt: number; probe: SourceLiveProbe }>();
const sourceProbeInflight = new Map<ExternalPackageSource, Promise<SourceLiveProbe>>();

export function resetSourceHealthProbeCacheForTests(): void {
  sourceProbeCache.clear();
  sourceProbeInflight.clear();
}

async function probeExternalSources(): Promise<Record<ExternalPackageSource, SourceLiveProbe>> {
  const entries = await Promise.all(EXTERNAL_PACKAGE_SOURCES.map(async (source) => [source, await probeSourceCached(source)] as const));
  return Object.fromEntries(entries) as Record<ExternalPackageSource, SourceLiveProbe>;
}

async function probeSourceCached(source: ExternalPackageSource): Promise<SourceLiveProbe> {
  const now = Date.now();
  const cached = sourceProbeCache.get(source);
  if (cached && cached.expiresAt > now) {
    return {
      ...cached.probe,
      cached: true
    };
  }

  const inflight = sourceProbeInflight.get(source);
  if (inflight) {
    return inflight;
  }

  const promise = probeSource(source)
    .then((measurement) => {
      const probe = {
        ...measurement,
        cached: false,
        checkedAt: new Date().toISOString()
      };
      sourceProbeCache.set(source, {
        expiresAt: Date.now() + SOURCE_PROBE_CACHE_TTL_MS,
        probe
      });
      return probe;
    })
    .finally(() => {
      sourceProbeInflight.delete(source);
    });
  sourceProbeInflight.set(source, promise);
  return promise;
}

async function probeSource(source: ExternalPackageSource): Promise<SourceLiveProbeMeasurement> {
  const endpoint = probeEndpoint(source);
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), sourceProbeTimeoutMs(source));
  try {
    const response = await fetch(endpoint, {
      headers: externalSourceRequestHeaders(endpoint),
      signal: controller.signal
    });
    const retryable = response.status === 429 || response.status >= 500;
    if (source === "mcp" && !response.ok && retryable) {
      return mcpResolverFallbackProbe(endpoint, startedAt);
    }
    return {
      degraded: !response.ok,
      durationMs: Date.now() - startedAt,
      endpointHost: new URL(endpoint).host,
      fallback: null,
      probePath: "upstream-live",
      retryable,
      status: response.ok ? "ok" : "failed",
      statusCode: response.status
    };
  } catch {
    if (source === "mcp") {
      return mcpResolverFallbackProbe(endpoint, startedAt);
    }
    return {
      degraded: true,
      durationMs: Date.now() - startedAt,
      endpointHost: new URL(endpoint).host,
      fallback: null,
      probePath: "upstream-live",
      retryable: true,
      status: "failed",
      statusCode: null
    };
  } finally {
    clearTimeout(timeout);
  }
}

function mcpResolverFallbackProbe(endpoint: string, startedAt: number): SourceLiveProbeMeasurement {
  const fallback = mcpBootstrapSourceProbe();
  return {
    degraded: false,
    durationMs: Date.now() - startedAt,
    endpointHost: new URL(endpoint).host,
    fallback: {
      recordCount: fallback.recordCount,
      snapshot: fallback.snapshot,
      type: "pinned-public-registry-snapshot"
    },
    probePath: "resolver-fallback",
    retryable: false,
    status: "ok",
    statusCode: null
  };
}

function sourceProbeTimeoutMs(source: ExternalPackageSource): number {
  return source === "mcp" ? SLOW_SOURCE_PROBE_TIMEOUT_MS : SOURCE_PROBE_TIMEOUT_MS;
}

function probeEndpoint(source: ExternalPackageSource): string {
  switch (source) {
    case "npm":
      return "https://registry.npmjs.org/-/ping";
    case "pypi":
      return "https://pypi.org/pypi/pip/json";
    case "github":
      return "https://api.github.com/rate_limit";
    case "huggingface-model":
      return "https://huggingface.co/api/models?search=bert&limit=1";
    case "huggingface-dataset":
      return "https://huggingface.co/api/datasets?search=imdb&limit=1";
    case "mcp":
      return "https://registry.modelcontextprotocol.io/v0.1/servers?limit=1";
  }
}
