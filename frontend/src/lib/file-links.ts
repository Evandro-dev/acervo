const PLACEHOLDER_HOSTS = new Set(["acervo.local"]);

function hasSupportedProtocol(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}

export function isUsableResourceUrl(value?: string) {
  if (!value) return false;

  const trimmed = value.trim();
  if (!trimmed) return false;

  if (trimmed.startsWith("/")) return true;
  if (!hasSupportedProtocol(trimmed)) return false;

  try {
    const parsed = new URL(trimmed);
    return !PLACEHOLDER_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}
