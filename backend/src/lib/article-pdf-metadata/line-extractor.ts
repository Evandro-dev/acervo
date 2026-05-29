import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { LINE_GROUP_TOLERANCE, MAX_PAGES_TO_SCAN } from "./constants.js";
import type { ExtractedLine, PdfTextItem } from "./types.js";
import { normalizeWhitespace } from "./text.js";
import { mapPdfParserError } from "../pdf-processing-errors.js";

type ExtractPdfLinesOptions = {
  shouldContinueScanning?: (lines: ExtractedLine[]) => boolean;
};

const require = createRequire(import.meta.url);
const pdfjsPackagePath = require.resolve("pdfjs-dist/package.json");
const standardFontDataUrl = `${pathToFileURL(path.join(path.dirname(pdfjsPackagePath), "standard_fonts")).href}/`;

function isPdfTextItem(item: unknown): item is PdfTextItem {
  if (!item || typeof item !== "object") return false;
  const candidate = item as Partial<PdfTextItem>;
  return typeof candidate.str === "string" && Array.isArray(candidate.transform);
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
      const shouldInsertSpace = gap > 1.5 && !/[(/-]$/.test(previousChunk) && !/^[,.;:)\]]/.test(chunk);

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

async function extractPageLines(document: pdfjs.PDFDocumentProxy, pageNumber: number) {
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

  return groups
    .sort((left, right) => right.y - left.y)
    .map((group) => ({
      page: pageNumber,
      y: group.y,
      text: joinLineItems(group.items),
    }))
    .filter((line) => line.text);
}

export async function extractPdfLines(data: Uint8Array, options: ExtractPdfLinesOptions = {}) {
  const task = pdfjs.getDocument({ data, standardFontDataUrl });

  try {
    const document = await task.promise;

    try {
      const lines: ExtractedLine[] = [];
      const pageCount = document.numPages;

      for (let pageNumber = 1; pageNumber <= Math.min(pageCount, MAX_PAGES_TO_SCAN); pageNumber += 1) {
        lines.push(...(await extractPageLines(document, pageNumber)));

        if (options.shouldContinueScanning && !options.shouldContinueScanning(lines)) {
          break;
        }
      }

      return { lines, pageCount };
    } finally {
      await document.destroy();
    }
  } catch (error) {
    throw mapPdfParserError(error);
  }
}
