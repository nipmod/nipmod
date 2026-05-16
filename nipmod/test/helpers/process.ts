import { spawn } from "node:child_process";
import { join } from "node:path";

export async function execaNode(
  args: string[],
  options: { env?: Record<string, string | undefined> } = {}
): Promise<{ stdout: string; stderr: string }> {
  const root = join(import.meta.dirname, "..", "..");
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

  const code = await new Promise<number | null>((resolve) => {
    child.on("close", resolve);
  });

  if (code !== 0) {
    throw new Error(`command failed (${code}): pnpm exec tsx ${args.join(" ")}\n${stdout}\n${stderr}`);
  }

  return { stdout, stderr };
}
