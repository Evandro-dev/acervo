export function normalizeQueryStringArray(value: unknown) {
  if (value === undefined || value === null) return [];

  const values = Array.isArray(value) ? value : [value];

  return values
    .flatMap((item) => (typeof item === "string" ? item.split(",") : []))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function uniqueQueryValues<T extends string | number>(values: T[]) {
  return Array.from(new Set(values));
}
