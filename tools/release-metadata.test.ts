import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { collectReleaseInventory, RELEASE_PROVENANCE_TYPE, RELEASE_SBOM_TYPE, writeReleaseMetadata } from "./release-metadata.ts";

describe("release metadata", () => {
  test("collects deterministic release inventory", async () => {
    const stage = await mkdtemp(join(tmpdir(), "nipmod-release-inventory-"));
    await mkdir(join(stage, "dist"));
    await writeFile(join(stage, "package.json"), "{\"name\":\"nipmod\"}\n");
    await writeFile(join(stage, "dist", "cli.js"), "#!/usr/bin/env node\n");
    await chmod(join(stage, "dist", "cli.js"), 0o755);

    const inventory = await collectReleaseInventory(stage);

    expect(inventory.map((file) => file.path)).toEqual(["dist/cli.js", "package.json"]);
    expect(inventory[0]).toMatchObject({ executable: true, size: 20 });
    expect(inventory[1]).toMatchObject({ executable: false });
    expect(inventory.every((file) => /^[a-f0-9]{64}$/.test(file.sha256))).toBe(true);
  });

  test("writes SBOM and provenance sidecars for a release artifact", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nipmod-release-metadata-"));
    const stage = join(dir, "stage");
    await mkdir(join(stage, "dist"), { recursive: true });
    await writeFile(join(stage, "package.json"), "{\"name\":\"nipmod\",\"version\":\"9.9.9\"}\n");
    await writeFile(join(stage, "dist", "cli.js"), "console.log('nipmod')\n");
    const artifactPath = join(dir, "nipmod-9.9.9.tgz");
    await writeFile(artifactPath, "artifact");
    const artifactSha256 = sha256(Buffer.from("artifact"));

    const paths = await writeReleaseMetadata({
      artifactName: "nipmod-9.9.9.tgz",
      artifactPath,
      artifactSha256,
      generatedAt: "2026-05-23T00:00:00.000Z",
      publicKeyInfo: { publicKeySpkiSha256: "a".repeat(64) },
      rootDir: dir,
      stageDir: stage,
      version: "9.9.9"
    });

    const sbom = JSON.parse(await readFile(paths.sbomPath, "utf8"));
    const provenance = JSON.parse(await readFile(paths.provenancePath, "utf8"));
    expect(sbom).toMatchObject({
      artifact: { name: "nipmod-9.9.9.tgz", sha256: artifactSha256 },
      formatVersion: 1,
      package: { name: "nipmod", version: "9.9.9" },
      type: RELEASE_SBOM_TYPE
    });
    expect(sbom.components.map((component: { name: string }) => component.name)).toEqual(["dist/cli.js", "package.json"]);
    expect(provenance).toMatchObject({
      artifact: { name: "nipmod-9.9.9.tgz", sha256: artifactSha256 },
      formatVersion: 1,
      package: { name: "nipmod", version: "9.9.9" },
      signing: { publicKeySpkiSha256: "a".repeat(64) },
      type: RELEASE_PROVENANCE_TYPE
    });
    expect(provenance.materials.map((material: { path: string }) => material.path)).toEqual(["dist/cli.js", "package.json"]);
  });
});

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
