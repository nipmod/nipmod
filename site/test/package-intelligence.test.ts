import { describe, expect, test, vi } from "vitest";
import { POST as confirmPost } from "../app/api/archive/confirm/route";
import { POST as preparePost } from "../app/api/archive/prepare/route";
import { GET as archiveSearchGet } from "../app/api/archive/search/route";
import { GET as archiveStatusGet } from "../app/api/archive/status/route";
import { confirmPackageIntelligenceRecord, createPackageIntelligenceRecord, validatePackageIntelligenceRecord } from "../lib/package-intelligence";
import {
  archiveStoreStatus,
  searchPackageIntelligenceArchive,
  upsertPackageIntelligenceRecord
} from "../lib/package-intelligence-store";
import type { ExternalPackageRecord } from "../lib/external-packages";

describe("package intelligence archive", () => {
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
    expect(prepared.store.configured).toBe(false);

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
    expect(confirmed.stored).toBe(false);
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
        authorization: "Bearer publishable-key",
        "x-nipmod-archive-token": "write-token"
      });
      if (url.includes("package_intelligence_records?on_conflict=id")) {
        return new Response(null, { status: 204 });
      }
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
    risk: "low",
    score: 100,
    signals: ["Resolved from npm registry search.", "Repository link is present."],
    warnings: []
  },
  type: "dev.nipmod.external-package.v1",
  updatedAt: "2026-05-21T00:00:00.000Z",
  version: "0.67.0"
};
