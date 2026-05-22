import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { writeAuditSmokeLockfile } from "./live-audit-smoke.ts";

const owner = "did:key:z6MkgUBL9PzsqaEip6m4CcvD9HeN9Q3DVMRzCasHjwBDbKTK";
const canonical = `pkg:${owner}/source-bound-probe-1778883617`;
const digest = "e64a5932dc8dc43cff5fa66aab2817ceb8e159e231bea5d883ab0bba52d26e8e";

describe("live audit smoke lockfile", () => {
  test("writes a valid audit lockfile from the first verified registry package", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nipmod-live-audit-smoke-"));

    const subject = await writeAuditSmokeLockfile({
      appDir: dir,
      fetchFn: fakeFetch(registryFixture([{ trust: { level: "review", score: 50 } }, verifiedPackage()])),
      registryUrl: "https://nipmod.test/registry/packages.json"
    });

    const lockfile = JSON.parse(await readFile(join(dir, "nipmod.lock.json"), "utf8"));
    expect(subject).toBe(`${canonical}@0.1.0`);
    expect(lockfile.packages[subject]).toMatchObject({
      canonical,
      integrity: `sha256-${digest}`,
      name: "source-bound-probe-1778883617",
      publisher: owner,
      resolved: "https://node.nipmod.com/source-bound-probe-1778883617",
      version: "0.1.0"
    });
  });

  test("fails closed when no verified package exists", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nipmod-live-audit-smoke-empty-"));

    await expect(
      writeAuditSmokeLockfile({
        appDir: dir,
        fetchFn: fakeFetch(registryFixture([{ trust: { level: "signed", score: 90 } }])),
        registryUrl: "https://nipmod.test/registry/packages.json"
      })
    ).rejects.toThrow(/verified package/i);
  });
});

function registryFixture(packages) {
  return {
    formatVersion: 1,
    packages,
    source: "https://node.nipmod.com"
  };
}

function verifiedPackage() {
  return {
    canonical,
    digest,
    name: "source-bound-probe-1778883617",
    publisher: owner,
    resolved: "https://node.nipmod.com/source-bound-probe-1778883617",
    trust: {
      level: "verified",
      score: 100
    },
    version: "0.1.0"
  };
}

function fakeFetch(payload) {
  return async () => ({
    ok: true,
    status: 200,
    json: async () => payload
  });
}
