type RegistryPackage = {
  canonical?: string;
  description?: string;
  name?: string;
  permissions?: unknown;
  trust?: { score?: number };
  version?: string;
};

const canonicalPackagePattern = /^pkg:did:key:z[1-9A-HJ-NP-Za-km-z]+\/[A-Za-z0-9._-]+$/;
const packageVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "10") || 10, 1), 20);

  if (!query) {
    return Response.json({ error: "q is required" }, { status: 400 });
  }

  const registry = await fetchJson<{ packages: RegistryPackage[] }>("https://nipmod.com/registry/packages.json");
  const packages = registry.packages
    .filter((pkg) => {
      const haystack = [pkg.name, pkg.description, pkg.canonical].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(query);
    })
    .slice(0, limit)
    .map((pkg) => {
      const ref = pinnedPackageRef(pkg);

      return {
        canonical: pkg.canonical,
        commandArgs: ref
          ? {
              inspect: ["nipmod", "inspect", ref, "--json"],
              install: ["nipmod", "install", ref]
            }
          : undefined,
        description: pkg.description,
        install: ref ? `nipmod install ${ref}` : undefined,
        inspect: ref ? `nipmod inspect ${ref} --json` : undefined,
        name: pkg.name,
        trustScore: pkg.trust?.score ?? 0,
        version: pkg.version
      };
    });

  return {
    count: packages.length,
    packages,
    query,
    source: "https://nipmod.com/registry/packages.json"
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Nipmod request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

function pinnedPackageRef(pkg: RegistryPackage) {
  if (!pkg.canonical || !pkg.version) {
    return undefined;
  }
  if (!canonicalPackagePattern.test(pkg.canonical) || !packageVersionPattern.test(pkg.version)) {
    return undefined;
  }
  return `${pkg.canonical}@${pkg.version}`;
}
