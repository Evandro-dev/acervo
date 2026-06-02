const INTERNAL_RESOURCE_REFERENCE_PATTERN = /^\/(?!\/)[^\s\\]*$/;

export function isSafeResourceReference(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;

  if (trimmed.startsWith("/")) return INTERNAL_RESOURCE_REFERENCE_PATTERN.test(trimmed);

  try {
    const parsed = new URL(trimmed);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}
