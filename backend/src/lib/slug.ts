const NON_LATIN_REGEX = /[\u0300-\u036f]/g;
const NON_WORD_REGEX = /[^a-z0-9]+/g;

export function slugify(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(NON_LATIN_REGEX, "")
    .toLowerCase()
    .trim()
    .replace(NON_WORD_REGEX, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "item";
}
