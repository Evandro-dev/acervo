function normalizeLookup(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function splitCommaSeparatedValues(value: string) {
  const values = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return Array.from(new Map(values.map((item) => [normalizeLookup(item), item])).values());
}

export function joinCommaSeparatedValues(values: string[]) {
  return splitCommaSeparatedValues(values.join(",")).join(", ");
}

export function addCommaSeparatedValue(value: string, nextValue: string) {
  return joinCommaSeparatedValues([...splitCommaSeparatedValues(value), nextValue]);
}

export function removeCommaSeparatedValue(value: string, removedValue: string) {
  const normalizedRemovedValue = normalizeLookup(removedValue);

  return joinCommaSeparatedValues(
    splitCommaSeparatedValues(value).filter((item) => normalizeLookup(item) !== normalizedRemovedValue),
  );
}
