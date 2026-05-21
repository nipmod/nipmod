import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import registryData from "../app/registry-data.json";
import publicRegistryData from "../public/registry/packages.json";

const packagesViewSource = readFileSync(join(process.cwd(), "app/packages/packages-view.tsx"), "utf8");
const appRegistry = registryData as { packages: Array<{ canonical: string }> };
const publicRegistry = publicRegistryData as { packages: Array<{ canonical: string }> };

describe("packages page data", () => {
  test("uses the same real registry package list as the public archive", () => {
    expect(appRegistry.packages.map((pkg) => pkg.canonical)).toEqual(
      publicRegistry.packages.map((pkg) => pkg.canonical)
    );
    expect(appRegistry.packages).toHaveLength(publicRegistry.packages.length);
  });

  test("does not fake package count or publish freshness", () => {
    expect(packagesViewSource).not.toContain("Math.random");
    expect(packagesViewSource).not.toContain("12 min ago");
    expect(packagesViewSource).toContain("registry.generatedAt");
  });
});
