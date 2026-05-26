export const PAUSED_API_KEY_LABEL_PREFIX = "paused/";

export function isPausedApiKeyLabel(label: string): boolean {
  return label.startsWith(PAUSED_API_KEY_LABEL_PREFIX);
}

export function visibleApiKeyLabel(label: string): string {
  return isPausedApiKeyLabel(label) ? label.slice(PAUSED_API_KEY_LABEL_PREFIX.length) || "api-key" : label;
}

export function pausedApiKeyLabel(label: string): string {
  return `${PAUSED_API_KEY_LABEL_PREFIX}${visibleApiKeyLabel(label)}`.slice(0, 80);
}
