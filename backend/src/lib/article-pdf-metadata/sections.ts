import {
  ABSTRACT_HEADING_ALIASES,
  ABSTRACT_STOP_HEADING_ALIASES,
  INTRODUCTION_HEADING_ALIASES,
  MIN_SECTION_CONTENT_LENGTH,
} from "./constants.js";
import type { ExtractedLine } from "./types.js";
import { isStandaloneMarker, normalizeForSearch, normalizeWhitespace } from "./text.js";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildHeadingRegex(aliases: string[]) {
  return new RegExp(`^(?:\\d+(?:\\.\\d+)*\\s+)?(?:${aliases.map(escapeRegex).join("|")})\\b`, "i");
}

const abstractHeadingRegex = buildHeadingRegex(ABSTRACT_HEADING_ALIASES);
const introductionHeadingRegex = buildHeadingRegex(INTRODUCTION_HEADING_ALIASES);
const stopHeadingRegex = buildHeadingRegex(ABSTRACT_STOP_HEADING_ALIASES);
const abstractInlineStartRegex = new RegExp(
  `(?:^|\\s)(?:${ABSTRACT_HEADING_ALIASES.map(escapeRegex).join("|")})\\s*[:.-]\\s*`,
  "i",
);
const introductionInlineStartRegex = new RegExp(
  `(?:^|\\s)(?:${INTRODUCTION_HEADING_ALIASES.map(escapeRegex).join("|")})\\s*[:.-]\\s*`,
  "i",
);
const inlineStopRegex = new RegExp(
  `(?:^|\\s)(?:${ABSTRACT_STOP_HEADING_ALIASES.map(escapeRegex).join("|")})\\s*[:.-]?\\s*`,
  "i",
);

function isStopSectionHeading(text: string, hasContent: boolean) {
  if (!hasContent) return false;

  const normalized = normalizeForSearch(text);
  return stopHeadingRegex.test(normalized);
}

function extractInlineSection(searchText: string, startRegex: RegExp) {
  const startMatch = startRegex.exec(searchText);
  if (!startMatch || startMatch.index === undefined) return undefined;

  const afterHeading = searchText
    .slice(startMatch.index + startMatch[0].length)
    .replace(/^\s*[:.-]\s*/, "")
    .trim();
  const stopMatch = inlineStopRegex.exec(afterHeading);
  const section = stopMatch?.index !== undefined ? afterHeading.slice(0, stopMatch.index) : afterHeading;
  const normalized = normalizeWhitespace(section);

  return normalized.length >= MIN_SECTION_CONTENT_LENGTH ? normalized : undefined;
}

function extractLineSection(lines: ExtractedLine[], headingRegex: RegExp) {
  const headingIndex = lines.findIndex((line) => headingRegex.test(normalizeForSearch(line.text)));
  if (headingIndex === -1) return undefined;

  const parts: string[] = [];
  const inlineContent = lines[headingIndex].text.replace(/^[^:.-]+[:.-]?\s*/, "");
  if (inlineContent.trim()) {
    parts.push(inlineContent.trim());
  }

  for (const line of lines.slice(headingIndex + 1)) {
    if (!line.text || isStandaloneMarker(line.text)) continue;
    if (isStopSectionHeading(line.text, parts.length > 0)) break;
    parts.push(line.text);
  }

  const normalized = normalizeWhitespace(parts.join(" "));
  return normalized.length >= MIN_SECTION_CONTENT_LENGTH ? normalized : undefined;
}

export function findFirstContentSectionIndex(lines: ExtractedLine[]) {
  return lines.findIndex((line) => {
    const normalized = normalizeForSearch(line.text);
    return abstractHeadingRegex.test(normalized) || introductionHeadingRegex.test(normalized);
  });
}

export function extractAbstract(lines: ExtractedLine[]) {
  const searchText = normalizeWhitespace(
    lines
      .filter((line) => !isStandaloneMarker(line.text))
      .map((line) => line.text)
      .join(" "),
  );

  return (
    extractLineSection(lines, abstractHeadingRegex) ||
    extractInlineSection(searchText, abstractInlineStartRegex) ||
    extractLineSection(lines, introductionHeadingRegex) ||
    extractInlineSection(searchText, introductionInlineStartRegex)
  );
}

export function extractAbstractFromBody(lines: ExtractedLine[]) {
  const parts: string[] = [];

  for (const line of lines) {
    if (!line.text || isStandaloneMarker(line.text)) continue;
    if (isStopSectionHeading(line.text, parts.length > 0)) break;
    parts.push(line.text);
  }

  const normalized = normalizeWhitespace(parts.join(" "));
  return normalized.length >= MIN_SECTION_CONTENT_LENGTH ? normalized : undefined;
}
