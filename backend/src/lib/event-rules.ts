import { eventRuleSchema } from "./contracts.js";

export function parseStoredEventRules(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.flatMap((rule) => {
    const parsed = eventRuleSchema.safeParse(rule);
    return parsed.success ? [parsed.data] : [];
  });
}

export function getRemovedEventRuleResources(
  currentRules: unknown,
  nextRules: unknown,
  getResourceKey: (resourceUrl: string) => string | null = (resourceUrl) => resourceUrl,
) {
  const getComparableKey = (resourceUrl: string) => getResourceKey(resourceUrl) ?? `reference:${resourceUrl}`;
  const nextFiles = new Set(parseStoredEventRules(nextRules).map((rule) => getComparableKey(rule.file)));

  return parseStoredEventRules(currentRules)
    .map((rule) => rule.file)
    .filter((file) => !nextFiles.has(getComparableKey(file)));
}
