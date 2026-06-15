type QueryParamPrimitive = string | number | boolean;
type QueryParamValue =
  | QueryParamPrimitive
  | readonly QueryParamPrimitive[]
  | null
  | undefined;

export function normalizeLookupValue(value?: string) {
  const trimmed = value?.trim();

  if (!trimmed || trimmed === "undefined" || trimmed === "null") {
    return undefined;
  }

  return trimmed;
}

export function normalizeFilterValues<T extends string>(value?: T | readonly T[]) {
  const values = Array.isArray(value) ? [...value] : value ? [value] : [];

  const normalized = values
    .map((item) => normalizeLookupValue(item))
    .filter((item): item is T => Boolean(item));

  const uniqueValues = Array.from(new Set(normalized)).sort((left, right) =>
    left.localeCompare(right),
  );

  return uniqueValues.length > 0 ? uniqueValues : undefined;
}

export function normalizeNumberFilterValues(value?: number | readonly number[]) {
  const values = Array.isArray(value) ? [...value] : value ? [value] : [];
  const normalized = values.filter((item) => Number.isFinite(item));
  const uniqueValues = Array.from(new Set(normalized)).sort((left, right) => left - right);

  return uniqueValues.length > 0 ? uniqueValues : undefined;
}

function appendQueryParam(
  searchParams: URLSearchParams,
  key: string,
  value: QueryParamValue,
) {
  if (value === undefined || value === null || value === "") return;

  if (Array.isArray(value)) {
    for (const item of value) {
      appendQueryParam(searchParams, key, item);
    }

    return;
  }

  searchParams.append(key, String(value));
}

export function createQueryParams(params: Record<string, QueryParamValue>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    appendQueryParam(searchParams, key, value);
  }

  return searchParams;
}

export function compactKey<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (Array.isArray(entry)) return entry.length > 0;

      return entry !== undefined && entry !== null && entry !== "";
    }),
  ) as Partial<T>;
}
