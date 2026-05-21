import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256Hex } from "./verifier.js";

export interface InstallReceiptInput {
  action: "add" | "install" | "mcp-install";
  graphPackageCount?: number;
  integrity: string;
  lockfileChanged: boolean;
  package: {
    canonical: string;
    name: string;
    type?: string;
    version: string;
  };
  projectDir: string;
  registryUrl?: string;
  resolved?: string;
}

export interface InstallReceiptResult {
  path: string;
  receipt: {
    action: InstallReceiptInput["action"];
    graphPackageCount: number;
    installedAt: string;
    integrity: string;
    lockfileChanged: boolean;
    package: {
      canonical: string;
      name: string;
      type?: string;
      version: string;
    };
    registryUrl?: string;
    resolved?: string;
    type: "dev.nipmod.install-receipt.v1";
  };
}

export async function writeInstallReceipt(input: InstallReceiptInput): Promise<InstallReceiptResult> {
  const receipt: InstallReceiptResult["receipt"] = {
    type: "dev.nipmod.install-receipt.v1",
    action: input.action,
    graphPackageCount: input.graphPackageCount ?? 1,
    installedAt: new Date().toISOString(),
    integrity: input.integrity,
    lockfileChanged: input.lockfileChanged,
    package: input.package,
    ...(input.registryUrl ? { registryUrl: input.registryUrl } : {}),
    ...(input.resolved ? { resolved: input.resolved } : {})
  };
  const dir = join(input.projectDir, ".nipmod", "receipts");
  const path = join(dir, `${safeFilePart(input.package.name)}-${input.package.version}-${sha256Hex(input.package.canonical).slice(0, 12)}.json`);
  await mkdir(dir, { recursive: true });
  await writeFile(path, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });

  return { path, receipt };
}

function safeFilePart(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/^@/, "")
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "package"
  );
}
