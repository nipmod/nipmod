import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { scanFiles, scanTextForSecrets, shouldSkipPath } from "./secret-scan.mjs";

describe("secret scanner", () => {
  test("detects deploy tokens and private keys", () => {
    const findings = scanTextForSecrets(
      "fixture.env",
      [
        `CLOUDFLARE_API_TOKEN=${"abcdefghijklmnopqrstuvwxyz123456"}`,
        `FLY_API_TOKEN=${"FlyV1"} ${"abcdefghijklmnopqrstuvwxyz123456"}`,
        `-----BEGIN ${"PRIVATE KEY"}-----`,
        `NPM_TOKEN=${"npm_"}${"a".repeat(36)}`,
        `GITHUB_TOKEN=${"ghp_"}${"a".repeat(36)}`,
        `Authorization: Bearer ${"a".repeat(36)}`,
        `SIGNING_PRIVATE_KEY=${"a".repeat(36)}`
      ].join("\n")
    );

    expect(findings.map((finding) => finding.type)).toEqual([
      "cloudflare-token",
      "fly-token",
      "private-key",
      "npm-token",
      "generic-secret-assignment",
      "github-token",
      "generic-secret-assignment",
      "bearer-token",
      "generic-secret-assignment"
    ]);
  });

  test("skips local-only secret storage and generated dependency output", () => {
    expect(shouldSkipPath("nipmod/.env")).toBe(false);
    expect(shouldSkipPath("nipmod/.env.production")).toBe(false);
    expect(shouldSkipPath("nipmod/.env.local")).toBe(true);
    expect(shouldSkipPath("nipmod/.env.development.local")).toBe(true);
    expect(shouldSkipPath(".nipmod/transparency-log-identity.json")).toBe(true);
    expect(shouldSkipPath("packages/first-party/pkg/.nipmod/identity.json")).toBe(false);
    expect(shouldSkipPath("site/public/releases/nipmod-0.1.9.tgz")).toBe(false);
    expect(shouldSkipPath("site/node_modules/pkg/index.js")).toBe(true);
    expect(shouldSkipPath("site/app/page.tsx")).toBe(false);
  });

  test("scans text entries inside release tarballs", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nipmod-secret-scan-"));
    const packageDir = join(dir, "package");
    await mkdir(packageDir);
    await writeFile(
      join(packageDir, "config.json"),
      JSON.stringify({ token: `${"npm_"}${"b".repeat(36)}` })
    );

    const archivePath = join(dir, "release.tgz");
    const tar = spawnSync("tar", ["-czf", archivePath, "-C", dir, "package"], {
      encoding: "utf8"
    });
    expect(tar.status).toBe(0);

    const findings = await scanFiles([archivePath], { root: dir });

    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: "release.tgz!package/config.json",
        type: "npm-token"
      })
    ]));
  });
});
