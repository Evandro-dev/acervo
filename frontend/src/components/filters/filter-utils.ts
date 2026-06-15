export function toggleFilterValue<T extends string>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export function toFilterId(prefix: string, value: string) {
  return `${prefix}-${encodeURIComponent(value)}`;
}
