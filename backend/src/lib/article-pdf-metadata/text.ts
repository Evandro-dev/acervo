import { CONNECTOR_WORDS } from "./constants.js";

const SUPERSCRIPT_PATTERN = /[\u00B9\u00B2\u00B3\u2070-\u2079]/gu;
const ORCID_PATTERN =
  /\(?\s*orcid\s*:?\s*(?:https?:\/\/orcid\.org\/)?\d{4}-\d{4}-\d{4}-\d{3}[0-9x]\s*\)?/giu;

export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/\p{M}+/gu, "");
}

export function normalizeForSearch(value: string) {
  return normalizeWhitespace(stripDiacritics(value).toLowerCase());
}

export function removeOrcidData(value: string) {
  return normalizeWhitespace(value.replace(ORCID_PATTERN, " "));
}

export function removeFootnoteMarkers(value: string) {
  return normalizeWhitespace(
    value
      .replace(SUPERSCRIPT_PATTERN, "")
      .replace(/(?<=\p{L})\d+(?=\s*[,;.)]|$)/gu, "")
      .replace(/\(\s*\d+\s*\)/g, " "),
  );
}

export function stripEmails(value: string) {
  return normalizeWhitespace(value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " "));
}

export function cleanAuthorCandidate(value: string) {
  return normalizeWhitespace(
    stripEmails(removeFootnoteMarkers(removeOrcidData(value)))
      .replace(/\b\d+\b/gu, " ")
      .replace(/^[,;.\-:/\s]+|[,;.\-:/\s]+$/g, ""),
  );
}

export function isStandaloneMarker(text: string) {
  return /^[0-9\u00B9\u00B2\u00B3\u2070-\u2079]+$/u.test(text);
}

export function isAllCapsText(text: string) {
  const letters = text.replace(/[^A-Za-z\u00C0-\u00FF]+/g, "");
  return Boolean(letters) && letters === letters.toUpperCase();
}

export function looksLikePersonWord(word: string) {
  if (!word) return false;

  const normalizedWord = normalizeForSearch(word);
  if (CONNECTOR_WORDS.has(normalizedWord)) return true;

  return (
    /^[A-Z\u00C0-\u00D6\u00D8-\u00DE][A-Za-z\u00C0-\u00FF'`-]*$/u.test(word) ||
    /^[A-Z\u00C0-\u00D6\u00D8-\u00DE]{2,}$/u.test(word)
  );
}
