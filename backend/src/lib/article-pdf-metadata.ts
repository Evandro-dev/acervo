import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

export type ExtractedArticlePdfMetadata = {
  title?: string;
  authors: string[];
  emails: string[];
  abstract?: string;
  pageCount: number;
  warnings: string[];
};

type PdfTextItem = {
  str: string;
  transform: number[];
  width?: number;
};

type ExtractedLine = {
  page: number;
  y: number;
  text: string;
};

const MAX_PAGES_TO_SCAN = 2;
const LINE_GROUP_TOLERANCE = 6;
const ABSTRACT_HEADING_PATTERN = /^(resumo|abstract)\b/i;
const ABSTRACT_SECTION_START_PATTERN = /(?:^|\s)(?:resumo|abstract)\s*[:.-]?/i;
const INTRODUCTION_HEADING_PATTERN = /^(?:\d+(\.\d+)*\s+)?introdu[c\u00e7][a\u00e3]o\b/i;
const INTRODUCTION_SECTION_START_PATTERN =
  /(?:^|\s)(?:\d+(?:\.\d+)*\s+)?introdu[c\u00e7][a\u00e3]o\s*[:.-]?/i;
const ABSTRACT_STOP_PATTERNS = [
  /^palavras[-\s]?chave\b/i,
  /^keywords\b/i,
  /^introdu[cç][aã]o\b/i,
  /^\d+(\.\d+)*\s+(introdu[cç][aã]o|introduction)\b/i,
];
const ABSTRACT_INLINE_STOP_PATTERN =
  /(?:^|\s)(?:palavras[-\s]?chave|keywords|(?:\d+(?:\.\d+)*\s+)?(?:introdu[c\u00e7][a\u00e3]o|introduction|m[e\u00e9]todos?|methodology|metodologia|materiais\s+e\s+m[e\u00e9]todos|resultados(?:\s+e\s+discuss[a\u00e3]o)?|discuss[a\u00e3]o|considera[c\u00e7][o\u00f5]es\s+finais|conclus[a\u00e3]o|refer[e\u00ea]ncias|references))\s*[:.-]/i;
const INTRODUCTION_INLINE_STOP_PATTERN =
  /(?:^|\s)(?:palavras[-\s]?chave|keywords|(?:\d+(?:\.\d+)*\s+)?(?:m[e\u00e9]todos?|methodology|metodologia|materiais\s+e\s+m[e\u00e9]todos|resultados(?:\s+e\s+discuss[a\u00e3]o)?|discuss[a\u00e3]o|considera[c\u00e7][o\u00f5]es\s+finais|conclus[a\u00e3]o|refer[e\u00ea]ncias|references))\s*[:.-]/i;
const AFFILIATION_PATTERN =
  /@|universidade|faculdade|instituto|centro universitario|campus|departamento|gradua(?:nd[ao]|d[ao])|discente|docente|professor(?:a)?|mestrand[ao]?|doutorand[ao]?|pos-graduand[ao]?|\banima\b|\buna\b/i;
function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isPdfTextItem(item: unknown): item is PdfTextItem {
  if (!item || typeof item !== "object") return false;
  const candidate = item as Partial<PdfTextItem>;
  return typeof candidate.str === "string" && Array.isArray(candidate.transform);
}

function isStandaloneMarker(text: string) {
  return /^[0-9\u00B9\u00B2\u00B3\u2070-\u2079]+$/u.test(text);
}

function isAllCapsHeading(text: string) {
  const letters = text.replace(/[^A-Za-zÀ-ÿ]+/g, "");
  return Boolean(letters) && letters === letters.toUpperCase();
}

function looksLikeAffiliationLine(text: string) {
  return AFFILIATION_PATTERN.test(text);
}

function cleanAuthorName(text: string) {
  return normalizeWhitespace(
    text
      .replace(/[\u00B9\u00B2\u00B3\u2070-\u2079]/gu, "")
      .replace(/(?<=\p{L})\d+(?=\s*[,;]|$)/gu, "")
      .replace(/\b\d+\b/gu, " ")
      .replace(/^[,;.\s]+|[,;.\s]+$/g, ""),
  );
}

function looksLikeAuthorName(text: string) {
  const candidate = cleanAuthorName(text);
  if (!candidate || candidate.includes("@") || looksLikeAffiliationLine(candidate)) return false;

  const words = candidate.split(" ").filter(Boolean);
  if (words.length < 2 || words.length > 12) return false;
  if (isAllCapsHeading(candidate) && words.length >= 4) return false;

  const validWords = words.filter(
    (word) =>
      /^[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÿ'`-]*$/u.test(word) || /^(de|da|do|das|dos|e)$/i.test(word),
  );

  return validWords.length >= Math.max(2, words.length - 1);
}

function looksLikeAuthorLine(text: string) {
  if (looksLikeAffiliationLine(text)) return false;
  if (text.includes(";")) return true;
  if (text.includes("@")) return false;
  if (isAllCapsHeading(text) && text.split(" ").length >= 4) return false;
  return looksLikeAuthorName(text);
}

function dedupe(values: string[]) {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const value of values) {
    const key = value.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(value);
  }

  return items;
}

function joinLineItems(items: PdfTextItem[]) {
  let text = "";
  let previousEnd: number | null = null;
  let previousChunk = "";

  for (const item of items.sort((left, right) => left.transform[4] - right.transform[4])) {
    const chunk = normalizeWhitespace(item.str);
    if (!chunk) continue;

    if (text && previousEnd !== null) {
      const gap = item.transform[4] - previousEnd;
      const shouldInsertSpace =
        gap > 1.5 && !/[(/-]$/.test(previousChunk) && !/^[,.;:)\]]/.test(chunk);

      if (shouldInsertSpace) {
        text += " ";
      }
    }

    text += chunk;
    previousEnd = item.transform[4] + (item.width ?? 0);
    previousChunk = chunk;
  }

  return normalizeWhitespace(text);
}

function extractEmails(lines: ExtractedLine[]) {
  const matches = lines.flatMap((line) => line.text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []);
  return dedupe(matches.map((email) => email.toLocaleLowerCase()));
}

function selectTitleLines(lines: ExtractedLine[]) {
  const meaningfulLines = lines.filter((line) => !isStandaloneMarker(line.text));
  if (!meaningfulLines.length) return [];

  const titleLines = [meaningfulLines[0].text];

  for (let index = 1; index < Math.min(meaningfulLines.length, 4); index += 1) {
    const previous = meaningfulLines[index - 1];
    const current = meaningfulLines[index];
    const gap = previous.y - current.y;

    if (gap >= 18) break;
    if (looksLikeAuthorLine(current.text) || looksLikeAffiliationLine(current.text)) break;

    titleLines.push(current.text);
  }

  return titleLines;
}

function extractAuthors(lines: ExtractedLine[], expectedCount?: number) {
  const authorBlock = normalizeWhitespace(
    lines
      .filter((line) => !isStandaloneMarker(line.text))
      .map((line) => line.text)
      .join(" "),
  )
    .replace(/(?<=\p{L})[0-9\u00B9\u00B2\u00B3\u2070-\u2079]+(?=\s*[;,])/gu, "")
    .replace(/(?<=\p{L})[0-9\u00B9\u00B2\u00B3\u2070-\u2079]+(?=\s+[A-ZÀ-ÖØ-Þ])/gu, "; ")
    .replace(/\s+/g, " ")
    .trim();

  if (!authorBlock) return [];

  const primarySegments = authorBlock
    .split(/\s*;\s*/g)
    .map((segment) => cleanAuthorName(segment))
    .filter(Boolean);

  const authors = primarySegments.flatMap((segment) => {
    const commaSegments =
      expectedCount && primarySegments.length < expectedCount
        ? segment.split(/\s*,\s*(?=[A-ZÀ-ÖØ-Þ][^,;@]{3,})/u)
        : [segment];

    return commaSegments
      .map((candidate) => cleanAuthorName(candidate))
      .filter((candidate) => looksLikeAuthorName(candidate));
  });

  const normalizedAuthors = dedupe(authors);
  const shouldTryCommaFallback =
    !normalizedAuthors.length || (expectedCount ? normalizedAuthors.length < Math.ceil(expectedCount / 2) : false);

  if (!shouldTryCommaFallback) {
    return normalizedAuthors;
  }

  const commaFallback = dedupe(
    authorBlock
      .split(/\s*,\s*(?=[A-ZÀ-ÖØ-Þ])/u)
      .map((candidate) => cleanAuthorName(candidate))
      .filter((candidate) => looksLikeAuthorName(candidate)),
  );

  return commaFallback.length > normalizedAuthors.length ? commaFallback : normalizedAuthors;
}

function shouldStopAbstract(text: string, hasContent: boolean) {
  if (!hasContent) return false;
  if (ABSTRACT_STOP_PATTERNS.some((pattern) => pattern.test(text))) return true;
  return text.length <= 80 && isAllCapsHeading(text) && !looksLikeAffiliationLine(text) && !text.includes(";");
}

function buildSectionSearchText(lines: ExtractedLine[]) {
  return normalizeWhitespace(
    lines
      .filter((line) => !isStandaloneMarker(line.text))
      .map((line) => line.text)
      .join(" "),
  );
}

function extractInlineSection(text: string, startPattern: RegExp, stopPattern: RegExp) {
  const startMatch = startPattern.exec(text);
  if (!startMatch || startMatch.index === undefined) return undefined;

  const sectionStart = startMatch.index + startMatch[0].length;
  const afterHeading = text.slice(sectionStart).replace(/^\s*[:.-]\s*/, "").trim();
  const stopMatch = stopPattern.exec(afterHeading);
  const section = stopMatch?.index !== undefined ? afterHeading.slice(0, stopMatch.index) : afterHeading;
  const normalized = normalizeWhitespace(section);

  return normalized.length >= 20 ? normalized : undefined;
}

function extractLineSection(lines: ExtractedLine[], headingIndex: number) {
  const headingLine = lines[headingIndex]?.text ?? "";
  const headingInlineContent = headingLine.replace(ABSTRACT_HEADING_PATTERN, "").replace(/^\s*[:.-]\s*/, "");
  const parts = headingInlineContent.trim() ? [headingInlineContent] : [];

  for (const line of lines.slice(headingIndex + 1)) {
    const text = line.text;
    if (!text || isStandaloneMarker(text)) continue;
    if (shouldStopAbstract(text, parts.length > 0)) break;
    parts.push(text);
  }

  return parts.length ? normalizeWhitespace(parts.join(" ")) : undefined;
}

function extractAbstract(lines: ExtractedLine[]) {
  const searchText = buildSectionSearchText(lines);
  const abstract = extractInlineSection(searchText, ABSTRACT_SECTION_START_PATTERN, ABSTRACT_INLINE_STOP_PATTERN);
  if (abstract) return abstract;

  const headingIndex = lines.findIndex((line) => ABSTRACT_HEADING_PATTERN.test(line.text));
  if (headingIndex !== -1) {
    const lineSection = extractLineSection(lines, headingIndex);
    if (lineSection) return lineSection;
  }

  return extractInlineSection(searchText, INTRODUCTION_SECTION_START_PATTERN, INTRODUCTION_INLINE_STOP_PATTERN);
}

function findFirstContentSectionIndex(lines: ExtractedLine[]) {
  return lines.findIndex(
    (line) => ABSTRACT_HEADING_PATTERN.test(line.text) || INTRODUCTION_HEADING_PATTERN.test(line.text),
  );
}

function findAuthorLines(lines: ExtractedLine[], titleLines: string[]) {
  const meaningfulLines = lines.filter((line) => !isStandaloneMarker(line.text));
  const authorCandidates = meaningfulLines.slice(titleLines.length);
  if (!authorCandidates.length) return [];

  const firstAffiliationIndex = authorCandidates.findIndex((line) => looksLikeAffiliationLine(line.text));
  if (firstAffiliationIndex !== -1) {
    return authorCandidates.slice(0, firstAffiliationIndex);
  }

  const firstLargeGapIndex = authorCandidates.findIndex((line, index) => {
    if (index === 0) return false;
    return authorCandidates[index - 1].y - line.y >= 24;
  });

  return firstLargeGapIndex === -1 ? authorCandidates : authorCandidates.slice(0, firstLargeGapIndex);
}

async function extractLines(data: Uint8Array) {
  const task = pdfjs.getDocument({ data });
  const document = await task.promise;
  const lines: ExtractedLine[] = [];
  const pageCount = document.numPages;

  for (let pageNumber = 1; pageNumber <= Math.min(pageCount, MAX_PAGES_TO_SCAN); pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const groups: Array<{ y: number; items: PdfTextItem[] }> = [];

    for (const item of content.items) {
      if (!isPdfTextItem(item)) continue;
      const text = normalizeWhitespace(item.str);
      if (!text) continue;

      const y = item.transform[5];
      let closestGroup: { y: number; items: PdfTextItem[] } | undefined;
      let closestDistance = Number.POSITIVE_INFINITY;

      for (const group of groups) {
        const distance = Math.abs(group.y - y);
        if (distance <= LINE_GROUP_TOLERANCE && distance < closestDistance) {
          closestGroup = group;
          closestDistance = distance;
        }
      }

      if (!closestGroup) {
        closestGroup = { y, items: [] };
        groups.push(closestGroup);
      }

      closestGroup.items.push(item);
    }

    lines.push(
      ...groups
        .sort((left, right) => right.y - left.y)
        .map((group) => ({
          page: pageNumber,
          y: group.y,
          text: joinLineItems(group.items),
        }))
        .filter((line) => line.text),
    );
  }

  return {
    lines,
    pageCount,
  };
}

export async function extractArticlePdfMetadata(data: Uint8Array): Promise<ExtractedArticlePdfMetadata> {
  const { lines, pageCount } = await extractLines(data);
  const emails = extractEmails(lines);
  const contentSectionIndex = findFirstContentSectionIndex(lines);
  const headerLines = (contentSectionIndex === -1 ? lines : lines.slice(0, contentSectionIndex)).filter(
    (line) => line.page === 1,
  );
  const titleLines = selectTitleLines(headerLines);
  const authorLines = findAuthorLines(headerLines, titleLines);
  const authors = extractAuthors(authorLines, emails.length);
  const abstract = extractAbstract(lines);
  const warnings: string[] = [];

  if (!titleLines.length) warnings.push("Não foi possível identificar o título automaticamente.");
  if (!authors.length) warnings.push("Não foi possível identificar os autores automaticamente.");
  if (!abstract) warnings.push("Não foi possível identificar o resumo automaticamente.");
  if (emails.length && authors.length && emails.length !== authors.length) {
    warnings.push("A quantidade de e-mails extraídos não bate com a quantidade de autores. Revise antes de salvar.");
  }

  return {
    title: titleLines.length ? normalizeWhitespace(titleLines.join(" ")) : undefined,
    authors,
    emails,
    abstract,
    pageCount,
    warnings,
  };
}
