import { extractAbstract, extractAbstractFromBody } from "./sections.js";
import { extractAuthors, extractEmails, findAuthorLines, selectTitle, sliceHeaderLines } from "./header.js";
import { extractPdfLines } from "./line-extractor.js";
import type { ExtractedArticlePdfMetadata, ExtractedLine } from "./types.js";
import { normalizeWhitespace } from "./text.js";

function getFirstPageHeaderLines(lines: ExtractedLine[]) {
  const firstPageLines = lines.filter((line) => line.page === 1);
  return sliceHeaderLines(firstPageLines);
}

function shouldContinueScanning(lines: ExtractedLine[]) {
  const headerLines = getFirstPageHeaderLines(lines);
  const title = selectTitle(headerLines);
  const emails = extractEmails(lines);
  const authors = extractAuthors(findAuthorLines(headerLines, title), emails.length);
  const abstract = extractAbstract(lines);

  return !(title.lines.length && authors.length && abstract);
}

export async function extractArticlePdfMetadata(data: Uint8Array): Promise<ExtractedArticlePdfMetadata> {
  const { lines, pageCount } = await extractPdfLines(data, { shouldContinueScanning });
  const emails = extractEmails(lines);
  const headerLines = getFirstPageHeaderLines(lines);
  const title = selectTitle(headerLines);
  const authors = extractAuthors(findAuthorLines(headerLines, title), emails.length);
  const firstPageLines = lines.filter((line) => line.page === 1);
  const firstBodyLine = firstPageLines[headerLines.length];
  const bodyStartIndex = firstBodyLine ? lines.indexOf(firstBodyLine) : -1;
  const abstract =
    extractAbstract(lines) ||
    (bodyStartIndex >= 0 ? extractAbstractFromBody(lines.slice(bodyStartIndex)) : undefined);
  const warnings: string[] = [];

  if (!title.lines.length) warnings.push("Nao foi possivel identificar o titulo automaticamente.");
  if (!authors.length) warnings.push("Nao foi possivel identificar os autores automaticamente.");
  if (!abstract) warnings.push("Nao foi possivel identificar o resumo automaticamente.");
  if (emails.length && authors.length && emails.length !== authors.length) {
    warnings.push("A quantidade de e-mails extraidos nao bate com a quantidade de autores. Revise antes de salvar.");
  }

  return {
    title: title.lines.length ? normalizeWhitespace(title.lines.map((line) => line.text).join(" ")) : undefined,
    authors,
    emails,
    abstract,
    pageCount,
    warnings,
  };
}
