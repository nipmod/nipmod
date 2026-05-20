import registryData from "../../../registry-data.json";
import { findPackageByGitlawbPath, type RegistryIndex } from "../../../../lib/registry";

type BadgeRouteContext = {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
};

const registry = registryData as RegistryIndex;

export async function GET(_request: Request, context: BadgeRouteContext): Promise<Response> {
  const { owner, repo } = await context.params;
  if (!isOwnerSegment(owner) || !isRepoName(repo)) {
    return new Response("not found", { status: 404 });
  }

  const packageRecord = findPackageByGitlawbPath(registry.packages, owner, repo);
  const status = packageRecord ? "verified" : "not listed";
  const svg = renderBadge("Nipmod", status);

  return new Response(svg, {
    headers: {
      "cache-control": "public, max-age=300",
      "content-type": "image/svg+xml; charset=utf-8"
    }
  });
}

function renderBadge(label: string, status: string): string {
  const labelWidth = Math.max(62, label.length * 7 + 24);
  const statusWidth = Math.max(84, status.length * 7 + 28);
  const width = labelWidth + statusWidth;
  const escapedLabel = escapeSvg(label);
  const escapedStatus = escapeSvg(status);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="28" role="img" aria-label="${escapedLabel}: ${escapedStatus}">
  <linearGradient id="g" x2="0" y2="100%">
    <stop offset="0" stop-color="#232323"/>
    <stop offset="1" stop-color="#050505"/>
  </linearGradient>
  <clipPath id="r"><rect width="${width}" height="28" rx="8"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="28" fill="url(#g)"/>
    <rect x="${labelWidth}" width="${statusWidth}" height="28" fill="#f5f5f7"/>
  </g>
  <g font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="12" font-weight="650">
    <text x="12" y="18" fill="#f5f5f7">${escapedLabel}</text>
    <text x="${labelWidth + 14}" y="18" fill="#111111">${escapedStatus}</text>
  </g>
</svg>`;
}

function escapeSvg(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function isOwnerSegment(value: string): boolean {
  return /^z[A-Za-z0-9]+$/.test(value);
}

function isRepoName(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]*$/i.test(value);
}
