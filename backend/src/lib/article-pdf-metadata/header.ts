import {
  AFFILIATION_KEYWORDS,
  AUTHOR_LINE_GAP_LIMIT,
  EMAIL_PATTERN,
  MAX_TITLE_LINES,
  METADATA_NOISE_KEYWORDS,
  TITLE_LINE_GAP_LIMIT,
  TITLE_SEARCH_WINDOW,
} from "./constants.js";
import type { ExtractedLine, TitleSelection } from "./types.js";
import {
  cleanAuthorCandidate,
  isAllCapsText,
  isStandaloneMarker,
  looksLikePersonWord,
  normalizeForSearch,
  normalizeWhitespace,
  removeOrcidData,
} from "./text.js";

function hasAnyKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    return new RegExp(`(?:^|\\b)${escaped}(?:\\b|$)`, "i").test(text);
  });
}

export function looksLikeAffiliationLine(text: string) {
  const normalized = normalizeForSearch(text);
  if (normalized.includes("@")) return true;
  if (isAllCapsText(text)) return false;
  return hasAnyKeyword(normalized, AFFILIATION_KEYWORDS);
}

function looksLikeMetadataNoiseLine(text: string) {
  const normalized = normalizeForSearch(text);
  if (!normalized) return true;
  if (/^(pagina|page)\s+\d+$/i.test(normalized)) return true;
  return hasAnyKeyword(normalized, METADATA_NOISE_KEYWORDS);
}

function looksLikeSectionHeadingLine(text: string) {
  const normalized = normalizeForSearch(text);
  return /^(?:\d+(?:\.\d+)*\s+)?(?:resumo(?: expandido)?|abstract|summary|resumen|introducao|introduction)\b/.test(
    normalized,
  );
}

function looksLikeHeaderStopLine(text: string) {
  const normalized = normalizeForSearch(text);
  return /^(?:palavras[- ]chave|keywords|referencias|references|metodologia|metodos|results|resultados)\b/.test(
    normalized,
  );
}

export function extractEmails(lines: ExtractedLine[]) {
  const matches = lines.flatMap((line) => line.text.match(EMAIL_PATTERN) ?? []);
  const seen = new Set<string>();
  const emails: string[] = [];

  for (const email of matches.map((item) => item.toLowerCase())) {
    if (seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }

  return emails;
}

export function looksLikeAuthorLine(text: string) {
  if (looksLikeAffiliationLine(text)) return false;
  if (looksLikeMetadataNoiseLine(text)) return false;
  if (text.includes("@")) return false;

  const candidate = cleanAuthorCandidate(text);
  if (!candidate) return false;
  const delimitedSegments = candidate
    .split(/[;,]/)
    .map((segment) => cleanAuthorCandidate(segment))
    .filter(Boolean);

  if (delimitedSegments.length >= 2) {
    const validDelimitedSegments = delimitedSegments.filter(looksLikeAuthorName).length;
    return validDelimitedSegments >= 2 && validDelimitedSegments >= Math.ceil(delimitedSegments.length / 2);
  }

  if (isAllCapsText(candidate)) return false;
  return looksLikeAuthorName(candidate);
}

function looksLikeBodyParagraphLine(text: string) {
  if (looksLikeAffiliationLine(text)) return false;
  if (looksLikeAuthorLine(text)) return false;
  if (looksLikeSectionHeadingLine(text)) return false;
  if (looksLikeHeaderStopLine(text)) return false;
  if (looksLikeMetadataNoiseLine(text)) return false;

  const normalized = normalizeWhitespace(text);
  if (normalized.length < 50) return false;

  const lowercaseCount = normalized.replace(/[^a-zà-ÿ]/gi, "").split("").filter((char) => char === char.toLowerCase()).length;
  return lowercaseCount >= 12;
}

function scoreTitleLine(text: string, index: number) {
  if (isStandaloneMarker(text)) return Number.NEGATIVE_INFINITY;
  if (looksLikeAffiliationLine(text)) return Number.NEGATIVE_INFINITY;
  if (looksLikeAuthorLine(text)) return Number.NEGATIVE_INFINITY;
  if (looksLikeSectionHeadingLine(text)) return Number.NEGATIVE_INFINITY;
  if (looksLikeMetadataNoiseLine(text)) return Number.NEGATIVE_INFINITY;
  if (text.includes("@")) return Number.NEGATIVE_INFINITY;

  const normalized = normalizeWhitespace(text);
  const wordCount = normalized.split(" ").filter(Boolean).length;
  if (normalized.length < 12 || wordCount < 2) return Number.NEGATIVE_INFINITY;

  let score = 0;
  score += Math.max(0, 5 - index);
  score += normalized.length >= 24 ? 4 : 2;
  score += wordCount >= 4 ? 3 : 1;

  if (normalized.length > 160) score -= 2;
  if (wordCount > 22) score -= 2;
  if (isAllCapsText(normalized)) score += 1;
  if (normalizeForSearch(normalized).includes("anais")) score -= 1;

  return score;
}

function canContinueTitleLine(text: string, hasExistingTitle: boolean) {
  if (looksLikeAuthorLine(text)) return false;
  if (looksLikeAffiliationLine(text) || looksLikeSectionHeadingLine(text)) return false;
  if (looksLikeMetadataNoiseLine(text)) return false;

  const normalized = normalizeWhitespace(text);
  const wordCount = normalized.split(" ").filter(Boolean).length;
  if (wordCount >= 2) return true;

  return hasExistingTitle && isAllCapsText(text) && normalized.length >= 3;
}

export function selectTitle(headerLines: ExtractedLine[]): TitleSelection {
  const lines = headerLines.filter((line) => !isStandaloneMarker(line.text));
  if (!lines.length) {
    return { lines: [], endIndex: -1 };
  }

  let bestIndex = -1;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < Math.min(lines.length, TITLE_SEARCH_WINDOW); index += 1) {
    const score = scoreTitleLine(lines[index].text, index);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  if (bestIndex === -1 || !Number.isFinite(bestScore)) {
    return { lines: [], endIndex: -1 };
  }

  const titleLines = [lines[bestIndex]];
  let endIndex = bestIndex;

  for (let index = bestIndex - 1; index >= 0; index -= 1) {
    const next = lines[index + 1];
    const current = lines[index];
    const gap = current.y - next.y;

    if (gap > TITLE_LINE_GAP_LIMIT) break;
    if (!canContinueTitleLine(current.text, true)) break;

    titleLines.unshift(current);
  }

  for (
    let index = bestIndex + 1;
    index < Math.min(lines.length, bestIndex + MAX_TITLE_LINES);
    index += 1
  ) {
    const previous = lines[index - 1];
    const current = lines[index];
    const gap = previous.y - current.y;

    if (gap > TITLE_LINE_GAP_LIMIT) break;
    if (!canContinueTitleLine(current.text, titleLines.length > 0)) break;

    titleLines.push(current);
    endIndex = index;
  }

  return {
    lines: titleLines,
    endIndex,
  };
}

export function looksLikeAuthorName(text: string) {
  const candidate = cleanAuthorCandidate(text);
  if (!candidate) return false;
  if (candidate.includes("@")) return false;
  if (candidate.includes(":")) return false;
  if (looksLikeAffiliationLine(candidate)) return false;
  if (looksLikeSectionHeadingLine(candidate)) return false;
  if (looksLikeMetadataNoiseLine(candidate)) return false;
  if (candidate.length > 80) return false;

  const words = candidate.split(" ").filter(Boolean);
  if (words.length < 2 || words.length > 12) return false;
  if (isAllCapsText(candidate) && (words.length >= 5 || /\s-\s/.test(candidate))) return false;

  const validWords = words.filter(looksLikePersonWord);
  return validWords.length >= Math.max(2, words.length - 1);
}

export function findAuthorLines(headerLines: ExtractedLine[], title: TitleSelection) {
  if (title.endIndex === -1) return [];

  const candidateLines = headerLines.slice(title.endIndex + 1).filter((line) => !isStandaloneMarker(line.text));
  if (!candidateLines.length) return [];

  const authorLines: ExtractedLine[] = [];

  for (const [index, line] of candidateLines.entries()) {
    if (!line.text) continue;
    if (looksLikeAffiliationLine(line.text)) break;
    if (looksLikeSectionHeadingLine(line.text)) break;
    if (looksLikeMetadataNoiseLine(line.text)) continue;

    if (index > 0) {
      const gap = candidateLines[index - 1].y - line.y;
      if (gap > AUTHOR_LINE_GAP_LIMIT) break;
    }

    authorLines.push(line);
  }

  return authorLines;
}

export function sliceHeaderLines(firstPageLines: ExtractedLine[]) {
  const lines = firstPageLines.filter((line) => !isStandaloneMarker(line.text));
  const headerLines: ExtractedLine[] = [];
  let sawAuthorOrAffiliation = false;

  for (const line of lines) {
    if (looksLikeSectionHeadingLine(line.text) || looksLikeHeaderStopLine(line.text)) break;
    if (headerLines.length > 0 && sawAuthorOrAffiliation && looksLikeBodyParagraphLine(line.text)) break;

    headerLines.push(line);
    if (looksLikeAuthorLine(line.text) || looksLikeAffiliationLine(line.text)) {
      sawAuthorOrAffiliation = true;
    }
  }

  return headerLines;
}

function dedupeCaseInsensitive(values: string[]) {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const value of values) {
    const key = normalizeForSearch(value);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(value);
  }

  return items;
}

function splitAuthorSegments(text: string) {
  const normalized = removeOrcidData(text)
    .replace(/(?<=\p{L})[\u00B9\u00B2\u00B3\u2070-\u2079]+(?=\s*[;,])/gu, "")
    .replace(/(?<=\p{L})\d+(?=\s*[;,])/gu, "")
    .replace(/(?<=\p{L})[\u00B9\u00B2\u00B3\u2070-\u2079]+(?=\s+[A-Z\u00C0-\u00D6\u00D8-\u00DE])/gu, "; ")
    .replace(/(?<=\p{L})\d+(?=\s+[A-Z\u00C0-\u00D6\u00D8-\u00DE])/gu, "; ")
    .replace(/\s+(?:\||•|-)\s+/g, "; ")
    .replace(/\s+/g, " ")
    .trim();

  const segments = normalized
    .split(/\s*[;,]\s*(?=[A-Z\u00C0-\u00D6\u00D8-\u00DE][^,;@]{2,})/u)
    .map((segment) => cleanAuthorCandidate(segment))
    .filter(Boolean);

  return segments.length ? segments : [cleanAuthorCandidate(normalized)].filter(Boolean);
}

function splitFallbackByComma(text: string) {
  return text
    .split(/\s*,\s*(?=[A-Z\u00C0-\u00D6\u00D8-\u00DE][^,;@]{3,})/u)
    .map((segment) => cleanAuthorCandidate(segment))
    .filter(Boolean);
}

export function extractAuthors(lines: ExtractedLine[], expectedCount?: number) {
  const joined = normalizeWhitespace(lines.map((line) => line.text).join(" "));
  if (!joined) return [];

  const primary = splitAuthorSegments(joined).filter(looksLikeAuthorName);
  const commaFallback = splitFallbackByComma(joined).filter(looksLikeAuthorName);

  const candidates = [dedupeCaseInsensitive(primary), dedupeCaseInsensitive(commaFallback)].filter(
    (items) => items.length > 0,
  );

  if (!candidates.length) return [];
  if (!expectedCount) {
    return candidates.sort((left, right) => right.length - left.length)[0];
  }

  return candidates.sort((left, right) => {
    const leftDistance = Math.abs(left.length - expectedCount);
    const rightDistance = Math.abs(right.length - expectedCount);
    if (leftDistance !== rightDistance) return leftDistance - rightDistance;
    return right.length - left.length;
  })[0];
}
