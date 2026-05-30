export function accountMutationRejection(request: Request): string | null {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") {
    return "cross-site account mutations are not allowed";
  }

  const origin = safeOrigin(request.headers.get("origin"));
  if (!origin) {
    return null;
  }

  const requestOrigin = safeOrigin(request.url);
  if (requestOrigin && origin !== requestOrigin) {
    return "account mutation origin does not match the request origin";
  }
  return null;
}

function safeOrigin(value: string | null): string | null {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}
