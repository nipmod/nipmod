#!/usr/bin/env node
import { fileURLToPath } from "node:url";

const DEFAULT_TARGETS = {
  home: "https://nipmod.com",
  nodeHealth: "https://node.nipmod.com/health",
  registry: "https://nipmod.com/registry/packages.json",
  security: "https://nipmod.com/security",
  trust: "https://nipmod.com/trust"
};
const PROFILES = {
  default: {
    concurrency: 12,
    iterations: 120,
    timeoutMs: 10_000
  },
  launch: {
    concurrency: 24,
    iterations: 360,
    timeoutMs: 10_000
  }
};
const DEFAULT_ITERATIONS = PROFILES.default.iterations;
const DEFAULT_CONCURRENCY = PROFILES.default.concurrency;
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_P95_MS = 2_500;

export async function runLoadSmoke({
  concurrency = DEFAULT_CONCURRENCY,
  fetchFn = fetch,
  iterations = DEFAULT_ITERATIONS,
  now = Date.now,
  targets = DEFAULT_TARGETS,
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  const timedFetch = createTimedFetch(fetchFn, timeoutMs);
  const checks = [];

  await runCheck(checks, "site_crawler", async () => {
    const home = await fetchText(targets.home, timedFetch);
    assertIncludes(home, "nipmod", "home page missing nipmod marker");
    const links = extractSameOriginLinks(home, targets.home);
    if (!links.includes(targets.trust)) {
      throw new Error("crawler did not discover trust page");
    }
    const trust = await fetchText(targets.trust, timedFetch);
    for (const marker of ["Verified registry", "Current public roots", "Release key"]) {
      assertIncludes(trust, marker, `trust page missing ${marker}`);
    }
    const security = await fetchText(targets.security, timedFetch);
    assertIncludes(security, "Report with proof", "security page missing report marker");
    return { discoveredLinks: links.length };
  });

  await runCheck(checks, "registry_load", async () => {
    const samples = await boundedRequests({
      concurrency,
      fetchFn: timedFetch,
      iterations,
      validate: async (response) => {
        if (!response.ok) {
          throw new Error(`registry returned ${response.status}`);
        }
        const payload = await response.json();
        if (!Array.isArray(payload.packages) || payload.packages.length === 0) {
          throw new Error("registry returned no packages");
        }
      },
      url: targets.registry
    });
    assertLatency(samples, "registry");
    return summarizeSamples(samples);
  });

  await runCheck(checks, "node_health_load", async () => {
    const samples = await boundedRequests({
      concurrency,
      fetchFn: timedFetch,
      iterations,
      validate: async (response) => {
        if (!response.ok) {
          throw new Error(`node health returned ${response.status}`);
        }
        const payload = await response.json();
        if (payload.status !== "ok") {
          throw new Error("node health status is not ok");
        }
      },
      url: targets.nodeHealth
    });
    assertLatency(samples, "node health");
    return summarizeSamples(samples);
  });

  await runCheck(checks, "trust_page_load", async () => {
    const samples = await boundedRequests({
      concurrency,
      fetchFn: timedFetch,
      iterations: Math.max(3, Math.ceil(iterations / 2)),
      validate: async (response) => {
        if (!response.ok) {
          throw new Error(`trust page returned ${response.status}`);
        }
        const text = await response.text();
        assertIncludes(text, "Verified registry", "trust page missing verified registry marker");
      },
      url: targets.trust
    });
    assertLatency(samples, "trust page");
    return summarizeSamples(samples);
  });

  const summary = {
    fail: checks.filter((check) => check.status === "fail").length,
    pass: checks.filter((check) => check.status === "pass").length,
    total: checks.length
  };

  return {
    checkedAt: new Date(now()).toISOString(),
    checks,
    config: {
      concurrency,
      iterations,
      profile: inferProfile({ concurrency, iterations, timeoutMs }),
      timeoutMs
    },
    formatVersion: 1,
    ok: summary.fail === 0,
    summary,
    type: "dev.nipmod.prod-load-smoke.v1"
  };
}

async function runCheck(checks, name, fn) {
  const startedAt = Date.now();
  try {
    checks.push({
      data: await fn(),
      durationMs: Date.now() - startedAt,
      name,
      status: "pass"
    });
  } catch (error) {
    checks.push({
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
      name,
      status: "fail"
    });
  }
}

async function boundedRequests({ concurrency, fetchFn, iterations, url, validate }) {
  let next = 0;
  const samples = [];
  const workers = Array.from({ length: Math.min(concurrency, iterations) }, async () => {
    while (next < iterations) {
      next += 1;
      const startedAt = Date.now();
      const response = await fetchFn(url);
      await validate(response);
      samples.push(Date.now() - startedAt);
    }
  });
  await Promise.all(workers);
  return samples;
}

function summarizeSamples(samples) {
  const sorted = samples.toSorted((a, b) => a - b);
  return {
    maxMs: sorted.at(-1) ?? 0,
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    requests: sorted.length
  };
}

function assertLatency(samples, label) {
  const p95 = percentile(samples.toSorted((a, b) => a - b), 0.95);
  if (p95 > MAX_P95_MS) {
    throw new Error(`${label} p95 latency too high: ${p95}ms`);
  }
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) {
    return 0;
  }
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1);
  return sorted[index];
}

async function fetchText(url, fetchFn) {
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.text();
}

function extractSameOriginLinks(html, baseUrl) {
  const base = new URL(baseUrl);
  const links = [];
  for (const match of html.matchAll(/href=["']([^"']+)["']/g)) {
    const url = new URL(match[1], base);
    if (url.origin === base.origin) {
      links.push(url.href);
    }
  }
  return [...new Set(links)];
}

function createTimedFetch(fetchFn, timeoutMs) {
  return (url, options = {}) =>
    fetchFn(url, {
      ...options,
      signal: options.signal ?? AbortSignal.timeout(timeoutMs)
    });
}

function assertIncludes(text, marker, message) {
  if (!text.includes(marker)) {
    throw new Error(message);
  }
}

function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function optionValue(name) {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }
  const index = process.argv.indexOf(name);
  if (index !== -1) {
    return process.argv[index + 1];
  }
  return undefined;
}

function configFromCli() {
  const profileName = optionValue("--profile") ?? process.env.NIPMOD_LOAD_PROFILE ?? "default";
  const profile = PROFILES[profileName];
  if (!profile) {
    throw new Error(`unknown load profile: ${profileName}`);
  }
  return {
    concurrency: numberFromEnv(optionValue("--concurrency") ?? process.env.NIPMOD_LOAD_CONCURRENCY, profile.concurrency),
    iterations: numberFromEnv(optionValue("--iterations") ?? process.env.NIPMOD_LOAD_ITERATIONS, profile.iterations),
    timeoutMs: numberFromEnv(optionValue("--timeout-ms") ?? process.env.NIPMOD_LOAD_TIMEOUT_MS, profile.timeoutMs)
  };
}

function inferProfile(config) {
  for (const [name, profile] of Object.entries(PROFILES)) {
    if (profile.concurrency === config.concurrency && profile.iterations === config.iterations && profile.timeoutMs === config.timeoutMs) {
      return name;
    }
  }
  return "custom";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await runLoadSmoke(configFromCli());
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
}
