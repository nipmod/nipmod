import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface CloudflareCredentials {
  apiToken: string;
  zoneName: string;
  accountId?: string;
}

export interface CloudflareValidationResult {
  tokenId: string;
  zoneName: string;
  zoneId: string;
  accountId?: string;
}

export interface SaveCloudflareEnvInput {
  apiToken: string;
  zoneName: string;
  zoneId?: string;
  accountId?: string;
}

export interface CloudflareValidationOptions {
  fetch?: typeof fetch;
}

interface CloudflareTokenResponse {
  success: boolean;
  result?: {
    id?: string;
    status?: string;
  };
  errors?: CloudflareApiError[];
}

interface CloudflareZonesResponse {
  success: boolean;
  result?: CloudflareZone[];
  errors?: CloudflareApiError[];
}

interface CloudflareZone {
  id?: string;
  name?: string;
  account?: {
    id?: string;
  };
}

interface CloudflareApiError {
  code?: number;
  message?: string;
}

export function maskToken(token: string): string {
  const normalized = normalizeCloudflareToken(token);
  if (normalized.length <= 8) {
    return "********";
  }

  return `********${normalized.slice(-4)}`;
}

export function normalizeCloudflareToken(token: string): string {
  let normalized = token.trim();
  normalized = normalized.replace(/^CLOUDFLARE_API_TOKEN\s*=\s*/i, "").trim();
  normalized = normalized.replace(/^Authorization\s*:\s*/i, "").trim();
  normalized = normalized.replace(/^Bearer\s+/i, "").trim();
  normalized = normalized.replace(/^["'`]|["'`]$/g, "").trim();
  return normalized;
}

export async function validateCloudflareToken(
  credentials: CloudflareCredentials,
  options: CloudflareValidationOptions = {}
): Promise<CloudflareValidationResult> {
  const fetchImpl = options.fetch ?? fetch;
  const apiToken = normalizeCloudflareToken(credentials.apiToken);
  const zoneName = credentials.zoneName.trim().toLowerCase();

  if (!apiToken) {
    throw new Error("Cloudflare API token is required");
  }

  assertCloudflareTokenFormat(apiToken);

  if (!zoneName) {
    throw new Error("Cloudflare zone name is required");
  }

  const tokenResponse = await fetchJson<CloudflareTokenResponse>(
    "https://api.cloudflare.com/client/v4/user/tokens/verify",
    apiToken,
    fetchImpl
  );
  if (!tokenResponse.success || tokenResponse.result?.status !== "active" || !tokenResponse.result.id) {
    throw new Error(`Cloudflare token verification failed${formatErrors(tokenResponse.errors)}`);
  }

  const zonesUrl = new URL("https://api.cloudflare.com/client/v4/zones");
  zonesUrl.searchParams.set("name", zoneName);
  zonesUrl.searchParams.set("per_page", "1");
  const zonesResponse = await fetchJson<CloudflareZonesResponse>(zonesUrl.toString(), apiToken, fetchImpl);
  if (!zonesResponse.success) {
    throw new Error(`Cloudflare zone lookup failed${formatErrors(zonesResponse.errors)}`);
  }

  const zone = zonesResponse.result?.[0];
  if (!zone?.id || zone.name !== zoneName) {
    throw new Error(`Cloudflare zone not found: ${zoneName}`);
  }

  const result: CloudflareValidationResult = {
    tokenId: tokenResponse.result.id,
    zoneId: zone.id,
    zoneName
  };
  const accountId = credentials.accountId?.trim() || zone.account?.id;
  if (accountId) {
    result.accountId = accountId;
  }

  return result;
}

export async function saveCloudflareEnv(path: string, input: SaveCloudflareEnvInput): Promise<void> {
  const current = await readOptionalFile(path);
  const apiToken = normalizeCloudflareToken(input.apiToken);
  assertCloudflareTokenFormat(apiToken);
  const updates: Record<string, string> = {
    CLOUDFLARE_API_TOKEN: apiToken,
    CLOUDFLARE_ZONE_NAME: input.zoneName
  };

  if (input.zoneId) {
    updates.CLOUDFLARE_ZONE_ID = input.zoneId;
  }

  if (input.accountId) {
    updates.CLOUDFLARE_ACCOUNT_ID = input.accountId;
  }

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, upsertEnvVars(current ?? "", updates), { mode: 0o600 });
  await chmod(path, 0o600);
}

function assertCloudflareTokenFormat(token: string): void {
  if (/\s/.test(token)) {
    throw new Error("Cloudflare API token cannot contain whitespace; paste the raw API token only");
  }
}

export function upsertEnvVars(content: string, updates: Record<string, string>): string {
  const updateKeys = new Set(Object.keys(updates));
  const seen = new Set<string>();
  const lines = content.split(/\r?\n/).filter((line, index, allLines) => index < allLines.length - 1 || line !== "");
  const nextLines = lines.map((line) => {
    const match = /^([A-Z0-9_]+)=/.exec(line);
    if (!match || !updateKeys.has(match[1] ?? "")) {
      return line;
    }

    const key = match[1];
    if (!key) {
      return line;
    }

    seen.add(key);
    return `${key}=${updates[key] ?? ""}`;
  });

  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) {
      nextLines.push(`${key}=${value}`);
    }
  }

  return `${nextLines.join("\n")}\n`;
}

async function fetchJson<T>(url: string, token: string, fetchImpl: typeof fetch): Promise<T> {
  const response = await fetchImpl(url, {
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    method: "GET"
  });
  const body = (await response.json()) as T;
  if (!response.ok) {
    throw new Error(`Cloudflare API returned ${response.status}${formatErrors(extractErrors(body))}`);
  }

  return body;
}

function extractErrors(body: unknown): CloudflareApiError[] | undefined {
  if (!body || typeof body !== "object" || !("errors" in body)) {
    return undefined;
  }

  const errors = (body as { errors?: unknown }).errors;
  if (!Array.isArray(errors)) {
    return undefined;
  }

  return errors.filter((error): error is CloudflareApiError => typeof error === "object" && error !== null);
}

function formatErrors(errors: CloudflareApiError[] | undefined): string {
  if (!errors || errors.length === 0) {
    return "";
  }

  return `: ${errors.map((error) => error.message ?? error.code ?? "unknown").join(", ")}`;
}

async function readOptionalFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}
