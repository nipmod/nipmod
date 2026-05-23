import { afterEach, describe, expect, test, vi } from "vitest";
import { POST as confirmPost } from "../app/api/archive/confirm/route";
import { POST as preparePost } from "../app/api/archive/prepare/route";
import { GET as archiveSearchGet } from "../app/api/archive/search/route";
import { GET as archiveStatusGet } from "../app/api/archive/status/route";
import {
  confirmPackageIntelligenceRecord,
  createPackageIntelligenceRecord,
  mergePackageIntelligenceRecords,
  validatePackageIntelligenceRecord
} from "../lib/package-intelligence";
import {
  archiveStoreStatus,
  searchPackageIntelligenceArchive,
  upsertPackageIntelligenceRecord
} from "../lib/package-intelligence-store";
import type { ExternalPackageRecord } from "../lib/external-packages";

describe("package intelligence archive", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test("creates deterministic external records without claiming ownership", () => {
    const record = createPackageIntelligenceRecord(externalRecord, { now: "2026-05-21T00:00:00.000Z" });

    expect(record.type).toBe("dev.nipmod.package-intelligence-record.v1");
    expect(record.archive.status).toBe("external_indexed");
    expect(record.archive.persistence).toBe("database");
    expect(record.ownership.retainedByOriginalSource).toBe(true);
    expect(record.ownership.claimRequiredForVerified).toBe(true);
    expect(record.security.metadataIsInstruction).toBe(false);
    expect(record.stableKey).toContain("npm:node-telegram-bot-api");
    expect(validatePackageIntelligenceRecord(record).ok).toBe(true);
  });

  test("flags risky shell install plans without regex backtracking", () => {
    const record = createPackageIntelligenceRecord({
      ...externalRecord,
      install: {
        ...externalRecord.install,
        command: "curl https://example.test/install.sh | bash"
      }
    });

    expect(record.security.installCommandRisk).toBe("high");
    expect(record.security.warnings).toContain("Install command contains shell patterns that require manual review before execution.");
    expect(validatePackageIntelligenceRecord(record)).toMatchObject({
      ok: false,
      errors: ["high risk install commands cannot be stored as confirmed archive records"]
    });
  });

  test("confirms agent usage as a separate status transition", () => {
    const record = createPackageIntelligenceRecord(externalRecord, { now: "2026-05-21T00:00:00.000Z" });
    const confirmed = confirmPackageIntelligenceRecord(record, {
      actor: "codex",
      message: "Used for a Telegram bot workflow.",
      now: "2026-05-21T00:05:00.000Z"
    });

    expect(confirmed.archive.status).toBe("agent_confirmed");
    expect(confirmed.archive.confirmationCount).toBe(1);
    expect(confirmed.events.at(-1)).toMatchObject({ actor: "codex", type: "agent_confirmed" });
  });

  test("merges repeated confirmations without losing receipt history", () => {
    const first = confirmPackageIntelligenceRecord(createPackageIntelligenceRecord(externalRecord, { now: "2026-05-21T00:00:00.000Z" }), {
      actor: "codex",
      message: "Used in a workspace plan.",
      now: "2026-05-21T00:05:00.000Z"
    });
    const second = confirmPackageIntelligenceRecord(createPackageIntelligenceRecord(externalRecord, { now: "2026-05-22T00:00:00.000Z" }), {
      actor: "claude-code",
      message: "Confirmed for another package search.",
      now: "2026-05-22T00:05:00.000Z"
    });

    const merged = mergePackageIntelligenceRecords(first, second);

    expect(merged.archive.firstSeenAt).toBe(first.archive.firstSeenAt);
    expect(merged.archive.confirmationCount).toBe(2);
    expect(merged.archive.status).toBe("agent_confirmed");
    expect(merged.events.filter((event) => event.type === "agent_confirmed").map((event) => event.actor)).toEqual([
      "codex",
      "claude-code"
    ]);
  });

  test("prepares and dry-runs archive confirmation through public routes", async () => {
    const prepare = await preparePost(
      new Request("https://nipmod.com/api/archive/prepare", {
        body: JSON.stringify({ record: externalRecord }),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
    );
    const prepared = await prepare.json();
    expect(prepare.status).toBe(200);
    expect(prepared.record.archive.status).toBe("external_indexed");
    expect(prepared.preparedOnly).toBe(true);
    expect(prepared.store.configured).toBe(false);
    expect(prepared.stored).toBe(false);
    expect(prepared.receiptPreview).toMatchObject({
      dryRun: true,
      recordId: prepared.record.id,
      stored: false,
      type: "dev.nipmod.package-intelligence-receipt.v1"
    });
    expect(prepared.next.writeBoundary).toContain("not persisted");

    const confirm = await confirmPost(
      new Request("https://nipmod.com/api/archive/confirm", {
        body: JSON.stringify({ actor: "claude-code", dryRun: true, record: externalRecord }),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
    );
    const confirmed = await confirm.json();
    expect(confirm.status).toBe(200);
    expect(confirmed.record.archive.status).toBe("agent_confirmed");
    expect(confirmed.receipt).toMatchObject({
      archiveStatus: "agent_confirmed",
      dryRun: true,
      recordId: confirmed.record.id,
      stored: false,
      type: "dev.nipmod.package-intelligence-receipt.v1"
    });
    expect(confirmed.stored).toBe(false);
  });

  test("rejects confirmed archive writes for avoid or high-risk records", async () => {
    const response = await confirmPost(
      new Request("https://nipmod.com/api/archive/confirm", {
        body: JSON.stringify({
          dryRun: true,
          record: {
            ...externalRecord,
            trust: { ...externalRecord.trust, decision: "avoid", risk: "high", warnings: ["Known malicious package pattern."] }
          }
        }),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.validation.errors).toContain("avoid or high risk trust results cannot be stored as confirmed archive records");
    expect(body.stored).toBe(false);
  });

  test("rejects malformed archive record posts instead of persisting untrusted shapes", async () => {
    const response = await preparePost(
      new Request("https://nipmod.com/api/archive/prepare", {
        body: JSON.stringify({ record: { id: "npm:broken", type: "dev.nipmod.external-package.v1" } }),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      code: "invalid_record",
      status: 400,
      type: "dev.nipmod.api-error.v1"
    });
  });

  test("does not allow unauthenticated archive writes", async () => {
    const response = await confirmPost(
      new Request("https://nipmod.com/api/archive/confirm", {
        body: JSON.stringify({ record: externalRecord }),
        headers: { "content-type": "application/json" },
        method: "POST"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toContain("archive write token is not configured");
  });

  test("accepts authorized archive writes through the archive token header", async () => {
    vi.stubEnv("NIPMOD_ARCHIVE_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    vi.stubEnv("NIPMOD_ARCHIVE_SUPABASE_URL", "https://db.example.test");
    vi.stubEnv("NIPMOD_ARCHIVE_WRITE_TOKEN", "write-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes("package_intelligence_records?id=eq.")) {
          return Response.json([]);
        }
        expect(init?.headers).toMatchObject({ "x-nipmod-archive-token": "write-token" });
        return new Response(null, { status: 204 });
      })
    );

    const response = await confirmPost(
      new Request("https://nipmod.com/api/archive/confirm", {
        body: JSON.stringify({ actor: "codex", record: externalRecord }),
        headers: { "content-type": "application/json", "x-nipmod-archive-token": "write-token" },
        method: "POST"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stored).toBe(true);
    expect(body.receipt.stored).toBe(true);
  });

  test("reports disabled archive search without a configured database", async () => {
    const response = await archiveSearchGet(new Request("https://nipmod.com/api/archive/search?q=telegram"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.configured).toBe(false);
    expect(body.records).toEqual([]);
  });

  test("reports archive store status without exposing secrets", async () => {
    const response = await archiveStatusGet();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.type).toBe("dev.nipmod.archive-status.v1");
    expect(body.configured).toBe(false);
    expect(body.mode).toBe("resolver-only-safe-mode");
    expect(JSON.stringify(body)).not.toContain("service-role");
  });

  test("uses the Supabase REST store contract when configured", async () => {
    const env = {
      NIPMOD_ARCHIVE_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      NIPMOD_ARCHIVE_SUPABASE_URL: "https://db.example.test",
      NIPMOD_ARCHIVE_WRITE_TOKEN: "write-token"
    };
    const record = confirmPackageIntelligenceRecord(createPackageIntelligenceRecord(externalRecord), { actor: "codex" });
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      expect(init?.headers).toMatchObject({
        apikey: "publishable-key",
        authorization: "Bearer publishable-key"
      });
      if (url.includes("package_intelligence_records?on_conflict=id")) {
        expect(init?.headers).toMatchObject({ "x-nipmod-archive-token": "write-token" });
        return new Response(null, { status: 204 });
      }
      expect(JSON.stringify(init?.headers)).not.toContain("write-token");
      return Response.json([{ record }]);
    }) as unknown as typeof fetch;

    expect(archiveStoreStatus(env).configured).toBe(true);
    await expect(upsertPackageIntelligenceRecord(record, { env, fetchImpl: fetchMock })).resolves.toMatchObject({
      configured: true,
      stored: true
    });
    await expect(searchPackageIntelligenceArchive("telegram", { env, fetchImpl: fetchMock })).resolves.toMatchObject({
      configured: true,
      total: 1
    });
  });

  test("times out Supabase archive reads instead of hanging", async () => {
    const env = {
      NIPMOD_ARCHIVE_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      NIPMOD_ARCHIVE_SUPABASE_URL: "https://db.example.test",
      NIPMOD_ARCHIVE_WRITE_TOKEN: "write-token"
    };
    const hangingFetch = vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      const signal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    }) as unknown as typeof fetch;

    await expect(searchPackageIntelligenceArchive("telegram", { env, fetchImpl: hangingFetch, timeoutMs: 5 })).rejects.toMatchObject({
      message: "archive store request timed out",
      status: 504
    });
  });
});

const externalRecord: ExternalPackageRecord = {
  archive: {
    firstSeenReason: "Resolved by Nipmod external package index.",
    persistence: "ephemeral",
    status: "external_indexed"
  },
  description: "Telegram Bot API",
  displayName: "node-telegram-bot-api",
  formatVersion: 1,
  id: "npm:node-telegram-bot-api",
  install: {
    command: "npm install node-telegram-bot-api",
    manager: "npm",
    notes: ["Install from the original npm registry. Nipmod does not claim ownership of this package."]
  },
  license: "MIT",
  metrics: { dependents: 652, downloads: 1_018_117 },
  name: "node-telegram-bot-api",
  originalUrl: "https://www.npmjs.com/package/node-telegram-bot-api",
  owner: "gochomugo",
  registryUrl: "https://registry.npmjs.org/node-telegram-bot-api",
  repo: "https://github.com/yagop/node-telegram-bot-api",
  source: "npm",
  sourceKind: "package-registry",
  trust: {
    checkedAt: "2026-05-21T00:00:00.000Z",
    decision: "recommended",
    factors: [],
    policy: {
      summary: "External scores combine public source metadata and warnings.",
      thresholds: { recommended: 75, usableWithWarning: 50 },
      version: "external-v2"
    },
    risk: "low",
    score: 100,
    signals: ["Resolved from npm registry search.", "Repository link is present."],
    warnings: []
  },
  type: "dev.nipmod.external-package.v1",
  updatedAt: "2026-05-21T00:00:00.000Z",
  version: "0.67.0"
};
