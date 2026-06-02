const publicBlobHostSuffix = ".public.blob.vercel-storage.com";

export function isStoredEventRuleFileUrl(fileUrl: string) {
  const trimmed = fileUrl.trim();
  if (trimmed.startsWith("/events/") || /\/events\/[^/]+\/files\/[^/]+$/i.test(trimmed)) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.endsWith(publicBlobHostSuffix) &&
      /^\/acervo\/events\/[^/]+\/rules\/[^/]+$/i.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}
