const SHA256_INTEGRITY_PATTERN = /^sha256-([a-f0-9]{64})$/;

export function digestFromIntegrity(integrity: string): string {
  const match = SHA256_INTEGRITY_PATTERN.exec(integrity);
  if (!match) {
    throw new Error("integrity must use sha256-<64 hex chars>");
  }

  const digest = match[1];
  if (!digest) {
    throw new Error("integrity must include a sha256 digest");
  }

  return digest;
}

export function integrityFromDigest(digest: string): string {
  if (!/^[a-f0-9]{64}$/.test(digest)) {
    throw new Error("digest must be 64 lowercase hex chars");
  }

  return `sha256-${digest}`;
}
