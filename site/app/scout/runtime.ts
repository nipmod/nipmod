export const SCOUT_RUNTIME_URL = process.env.NIPMOD_SCOUT_RUNTIME_URL ?? "https://nipmod-scout.fly.dev";

export async function scoutRuntimeJson(path: string): Promise<{ payload: unknown; status: number } | null> {
  const base = trimTrailingSlash(SCOUT_RUNTIME_URL);
  if (!base || base === "https://nipmod.com/scout") {
    return null;
  }

  try {
    const response = await fetch(`${base}${path}`, {
      cache: "no-store",
      headers: {
        accept: "application/json"
      }
    });
    if (!response.ok) {
      return null;
    }
    return {
      payload: await response.json(),
      status: response.status
    };
  } catch {
    return null;
  }
}

export function runtimePath(pathname: string, request?: Request): string {
  if (!request) {
    return pathname;
  }
  const url = new URL(request.url);
  return `${pathname}${url.search}`;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
