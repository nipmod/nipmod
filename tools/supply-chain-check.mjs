#!/usr/bin/env node
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const workspaces = [
  { name: "site", dir: join(root, "site") },
  { name: "nipmod", dir: join(root, "nipmod") }
];

const checks = [];

for (const workspace of workspaces) {
  await checkWorkspace(workspace);
}

const fail = checks.filter((check) => check.status === "fail").length;
const result = {
  checkedAt: new Date().toISOString(),
  checks,
  formatVersion: 1,
  ok: fail === 0,
  summary: {
    fail,
    pass: checks.length - fail,
    total: checks.length
  },
  type: "dev.nipmod.supply-chain-check.v1"
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) {
  process.exitCode = 1;
}

async function checkWorkspace(workspace) {
  await runCheck(`${workspace.name}_lockfile_present`, async () => {
    const lockfile = join(workspace.dir, "pnpm-lock.yaml");
    if (!existsSync(lockfile)) {
      throw new Error("pnpm-lock.yaml missing");
    }
    return { lockfile };
  });

  await runCheck(`${workspace.name}_package_manager`, async () => {
    const packageJson = JSON.parse(await readFile(join(workspace.dir, "package.json"), "utf8"));
    if (packageJson.type !== "module") {
      throw new Error("workspace must use ESM module type");
    }
    return {
      dependencies: Object.keys(packageJson.dependencies ?? {}).length,
      devDependencies: Object.keys(packageJson.devDependencies ?? {}).length
    };
  });

  await runCheck(`${workspace.name}_high_audit`, async () => run("pnpm", ["--dir", workspace.dir, "audit", "--audit-level", "high"]));
}

async function runCheck(name, fn) {
  const startedAt = Date.now();
  try {
    const data = await fn();
    checks.push({ data, durationMs: Date.now() - startedAt, name, status: "pass" });
  } catch (error) {
    checks.push({
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
      name,
      status: "fail"
    });
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ command: [command, ...args].join(" ") });
      } else {
        reject(new Error(stderr.trim() || `${command} ${args.join(" ")} failed with ${code}`));
      }
    });
  });
}
