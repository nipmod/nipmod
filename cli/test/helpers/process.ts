import { spawn } from "node:child_process";
import { join } from "node:path";

export async function execaNode(
  args: string[],
  options: { env?: Record<string, string | undefined>; timeoutMs?: number } = {}
): Promise<{ stdout: string; stderr: string }> {
  const root = join(import.meta.dirname, "..", "..");
  const timeoutMs = options.timeoutMs ?? 60_000;
  const child = spawn("pnpm", ["exec", "tsx", ...args], {
    cwd: root,
    env: { ...process.env, ...options.env, FORCE_COLOR: "0" },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
    setTimeout(() => child.kill("SIGKILL"), 1_000).unref();
  }, timeoutMs);
  timeout.unref();

  const code = await new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  clearTimeout(timeout);

  if (timedOut) {
    throw new Error(
      `command timed out after ${timeoutMs}ms: pnpm exec tsx ${args.join(" ")}\n${stdout}\n${stderr}`
    );
  }

  if (code !== 0) {
    throw new Error(`command failed (${code}): pnpm exec tsx ${args.join(" ")}\n${stdout}\n${stderr}`);
  }

  return { stdout, stderr };
}
