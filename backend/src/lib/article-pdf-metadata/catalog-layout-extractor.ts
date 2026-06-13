// catalog-layout-extractor.ts
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { mapPdfParserError } from "../pdf-processing-errors.js";

type PdfTextItem = {
  str: string;
  transform: number[];
  width?: number;
  height?: number;
};

type LayoutTextItem = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type LineGroup = {
  y: number;
  items: LayoutTextItem[];
};

export type ExtractedCatalogLayoutPage = {
  page: number;
  text: string;
};

export type ExtractedCatalogLayout = {
  text: string;
  isbn?: string;
  pageCount: number;
  pages: ExtractedCatalogLayoutPage[];
  warnings: string[];
};

export type ExtractCatalogLayoutOptions = {
  maxPages?: number;
  yTolerance?: number;
  pageSeparator?: string;
  maxSpacesBetweenChunks?: number;
};

const DEFAULT_Y_TOLERANCE = 6;
const DEFAULT_PAGE_SEPARATOR = "\n\n";
const DEFAULT_MAX_SPACES_BETWEEN_CHUNKS = 90;
const FALLBACK_CHARACTER_WIDTH = 4;

const require = createRequire(import.meta.url);
const pdfjsPackagePath = require.resolve("pdfjs-dist/package.json");
const standardFontDataUrl = `${pathToFileURL(
  path.join(path.dirname(pdfjsPackagePath), "standard_fonts"),
).href}/`;

function isPdfTextItem(item: unknown): item is PdfTextItem {
  if (!item || typeof item !== "object") return false;

  const candidate = item as Partial<PdfTextItem>;

  return (
    typeof candidate.str === "string" &&
    Array.isArray(candidate.transform) &&
    typeof candidate.transform[4] === "number" &&
    typeof candidate.transform[5] === "number"
  );
}

function cleanPdfTextChunk(value: string) {
  return value
    .replace(/\u00A0/g, " ")
    .replace(/\u0000/g, "")
    .replace(/[\r\n]+/g, " ");
}

function countLeadingSpaces(value: string) {
  return value.match(/^[ \t]+/)?.[0].length ?? 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function median(values: number[]) {
  if (!values.length) return undefined;

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function estimateCharacterWidth(items: LayoutTextItem[]) {
  const widths = items
    .map((item) => {
      const visibleText = item.text.trim();
      if (!visibleText || item.width <= 0) return undefined;

      return item.width / Array.from(visibleText).length;
    })
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    )
    .filter((value) => value >= 1.5 && value <= 18);

  return median(widths) ?? FALLBACK_CHARACTER_WIDTH;
}

function estimateLineGapByY(lines: Array<{ y: number }>) {
  const gaps: number[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const gap = Math.abs(lines[index - 1].y - lines[index].y);

    if (gap >= 3 && gap <= 80) {
      gaps.push(gap);
    }
  }

  return median(gaps) ?? 12;
}

function groupItemsIntoLines(
  items: LayoutTextItem[],
  yTolerance: number,
): LineGroup[] {
  const groups: LineGroup[] = [];

  for (const item of items) {
    let closestGroup: LineGroup | undefined;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const group of groups) {
      const distance = Math.abs(group.y - item.y);

      if (distance <= yTolerance && distance < closestDistance) {
        closestGroup = group;
        closestDistance = distance;
      }
    }

    if (!closestGroup) {
      closestGroup = { y: item.y, items: [] };
      groups.push(closestGroup);
    }

    closestGroup.items.push(item);
  }

  return groups.sort((left, right) => right.y - left.y);
}

function getPageLeftEdge(groups: LineGroup[]) {
  const xValues = groups
    .flatMap((group) => group.items)
    .filter((item) => item.text.trim())
    .map((item) => item.x);

  return xValues.length ? Math.min(...xValues) : 0;
}

function renderLine(
  group: LineGroup,
  leftEdge: number,
  characterWidth: number,
  maxSpacesBetweenChunks: number,
) {
  const items = [...group.items].sort((left, right) => left.x - right.x);
  if (!items.length) return "";

  const firstItem = items[0];
  const leadingSpaces = clamp(
    Math.round((firstItem.x - leftEdge) / characterWidth),
    0,
    120,
  );

  let text = " ".repeat(leadingSpaces);
  let previousEnd: number | null = null;

  for (const [index, item] of items.entries()) {
    let chunk = item.text;

    if (!chunk) continue;

    if (previousEnd !== null) {
      const gap = item.x - previousEnd;

      if (gap > characterWidth * 0.6) {
        const expectedSpaces = clamp(
          Math.round(gap / characterWidth),
          0,
          maxSpacesBetweenChunks,
        );

        const explicitLeadingSpaces = countLeadingSpaces(chunk);
        const missingSpaces = Math.max(
          0,
          expectedSpaces - explicitLeadingSpaces,
        );

        text += " ".repeat(missingSpaces);
      }

      chunk = chunk.replace(/^[ \t]+/, "");
    } else if (index > 0) {
      chunk = chunk.replace(/^[ \t]+/, "");
    }

    text += chunk;
    previousEnd = Math.max(previousEnd ?? item.x, item.x + item.width);
  }

  return text.replace(/[ \t]+$/g, "");
}

function insertVerticalSpacing(lines: Array<{ y: number; text: string }>) {
  if (!lines.length) return [];

  const lineGap = estimateLineGapByY(lines);
  const output: string[] = [];

  for (const [index, line] of lines.entries()) {
    if (index > 0) {
      const previous = lines[index - 1];
      const gap = Math.abs(previous.y - line.y);

      if (gap > lineGap * 1.6) {
        const blankLines = clamp(Math.round(gap / lineGap) - 1, 1, 4);
        output.push(...Array.from({ length: blankLines }, () => ""));
      }
    }

    output.push(line.text);
  }

  return output;
}

function normalizeFinalCatalogText(value: string) {
  return value
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{5,}/g, "\n\n\n\n")
    .trim();
}

export function extractIsbnFromCatalogLayoutText(value: string) {
  const match = value.match(
    /ISBN\s*[:\-]?\s*((?:97[89][-\s]?)?\d[\d\s-]{8,20}[\dXx])/i,
  );

  if (!match) return undefined;

  return match[1].replace(/\s+/g, "-").replace(/-+/g, "-").trim();
}

async function extractPageLayoutText(
  document: pdfjs.PDFDocumentProxy,
  pageNumber: number,
  options: Required<
    Pick<
      ExtractCatalogLayoutOptions,
      "yTolerance" | "maxSpacesBetweenChunks"
    >
  >,
) {
  const page = await document.getPage(pageNumber);
  const content = await page.getTextContent();

  const items: LayoutTextItem[] = [];

  for (const rawItem of content.items) {
    if (!isPdfTextItem(rawItem)) continue;

    const text = cleanPdfTextChunk(rawItem.str);
    if (!text) continue;

    items.push({
      text,
      x: rawItem.transform[4],
      y: rawItem.transform[5],
      width: rawItem.width ?? 0,
      height: rawItem.height ?? Math.abs(rawItem.transform[3] ?? 0),
    });
  }

  if (!items.length) return "";

  const groups = groupItemsIntoLines(items, options.yTolerance);
  const leftEdge = getPageLeftEdge(groups);
  const characterWidth = estimateCharacterWidth(items);

  const renderedLines = groups.map((group) => ({
    y: group.y,
    text: renderLine(
      group,
      leftEdge,
      characterWidth,
      options.maxSpacesBetweenChunks,
    ),
  }));

  return normalizeFinalCatalogText(
    insertVerticalSpacing(renderedLines).join("\n"),
  );
}

export async function extractCatalogLayoutFromPdf(
  data: Uint8Array,
  options: ExtractCatalogLayoutOptions = {},
): Promise<ExtractedCatalogLayout> {
  const task = pdfjs.getDocument({ data, standardFontDataUrl });

  try {
    const document = await task.promise;

    try {
      const pageCount = document.numPages;
      const maxPages = options.maxPages ?? pageCount;
      const pageLimit = Math.min(pageCount, maxPages);
      const pageSeparator = options.pageSeparator ?? DEFAULT_PAGE_SEPARATOR;
      const warnings: string[] = [];
      const pages: ExtractedCatalogLayoutPage[] = [];

      for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
        const text = await extractPageLayoutText(document, pageNumber, {
          yTolerance: options.yTolerance ?? DEFAULT_Y_TOLERANCE,
          maxSpacesBetweenChunks:
            options.maxSpacesBetweenChunks ??
            DEFAULT_MAX_SPACES_BETWEEN_CHUNKS,
        });

        if (text) {
          pages.push({
            page: pageNumber,
            text,
          });
        }
      }

      const text = normalizeFinalCatalogText(
        pages.map((page) => page.text).join(pageSeparator),
      );

      if (!text) {
        warnings.push(
          "Nao foi possivel extrair texto selecionavel deste PDF. Verifique se a ficha nao esta como imagem.",
        );
      }

      if (pageLimit < pageCount) {
        warnings.push(
          `Apenas ${pageLimit} de ${pageCount} paginas foram analisadas.`,
        );
      }

      const isbn = extractIsbnFromCatalogLayoutText(text);

      if (!isbn) {
        warnings.push("Nao foi possivel identificar o ISBN automaticamente.");
      }

      return {
        text,
        isbn,
        pageCount,
        pages,
        warnings,
      };
    } finally {
      await task.destroy();
    }
  } catch (error) {
    throw mapPdfParserError(error);
  }
}