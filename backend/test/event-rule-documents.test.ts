import assert from "node:assert/strict";
import test from "node:test";
import {
  assertEventRuleDocumentBinary,
  EventRuleDocumentError,
  getEventRuleDocumentContentType,
} from "../src/lib/event-rule-documents.js";
import { createPdfDocument } from "./helpers/create-pdf.js";

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_FILE_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;

type ZipFixtureEntry = {
  data?: string;
  declaredUncompressedSize?: number;
};

const DOCX_CONTENT_TYPES = [
  "<Types>",
  '<Override PartName="/word/document.xml"',
  ' ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>',
  "</Types>",
].join("");

const PPTX_CONTENT_TYPES = [
  "<Types>",
  '<Override PartName="/ppt/presentation.xml"',
  ' ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>',
  "</Types>",
].join("");

function createZipArchive(entries: Record<string, ZipFixtureEntry | string>) {
  const localEntries: Buffer[] = [];
  const centralDirectoryEntries: Buffer[] = [];
  let localOffset = 0;

  for (const [entryName, rawEntry] of Object.entries(entries)) {
    const entry = typeof rawEntry === "string" ? { data: rawEntry } : rawEntry;
    const encodedName = Buffer.from(entryName);
    const data = Buffer.from(entry.data ?? "");
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(LOCAL_FILE_HEADER_SIGNATURE, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(encodedName.length, 26);
    localEntries.push(localHeader, encodedName, data);

    const centralDirectoryHeader = Buffer.alloc(46);
    centralDirectoryHeader.writeUInt32LE(CENTRAL_DIRECTORY_FILE_HEADER_SIGNATURE, 0);
    centralDirectoryHeader.writeUInt16LE(20, 4);
    centralDirectoryHeader.writeUInt16LE(20, 6);
    centralDirectoryHeader.writeUInt32LE(data.length, 20);
    centralDirectoryHeader.writeUInt32LE(entry.declaredUncompressedSize ?? data.length, 24);
    centralDirectoryHeader.writeUInt16LE(encodedName.length, 28);
    centralDirectoryHeader.writeUInt32LE(localOffset, 42);
    centralDirectoryEntries.push(centralDirectoryHeader, encodedName);

    localOffset += localHeader.length + encodedName.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralDirectoryEntries);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(END_OF_CENTRAL_DIRECTORY_SIGNATURE, 0);
  endOfCentralDirectory.writeUInt16LE(Object.keys(entries).length, 8);
  endOfCentralDirectory.writeUInt16LE(Object.keys(entries).length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(localOffset, 16);

  return new Uint8Array(Buffer.concat([...localEntries, centralDirectory, endOfCentralDirectory]));
}

test("accepts PDF, DOCX and PPTX rule documents with the expected content type", async () => {
  const pdf = await createPdfDocument([["Norma em PDF"]]);
  const docx = createZipArchive({
    "[Content_Types].xml": DOCX_CONTENT_TYPES,
    "_rels/.rels": "",
    "word/document.xml": "<document/>",
  });
  const pptx = createZipArchive({
    "[Content_Types].xml": PPTX_CONTENT_TYPES,
    "_rels/.rels": "",
    "ppt/presentation.xml": "<presentation/>",
  });

  assert.equal(assertEventRuleDocumentBinary("edital.pdf", pdf).label, "PDF");
  assert.equal(assertEventRuleDocumentBinary("regulamento.docx", docx).label, "Word");
  assert.equal(assertEventRuleDocumentBinary("template.pptx", pptx).label, "PowerPoint");
  assert.equal(
    getEventRuleDocumentContentType("template.pptx"),
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  );
});

test("rejects unsupported extensions and ZIP files disguised as Open XML documents", () => {
  const genericZip = createZipArchive({ "arquivo.txt": "conteudo" });

  assert.throws(
    () => assertEventRuleDocumentBinary("modelo.ppt", genericZip),
    (error: unknown) => error instanceof EventRuleDocumentError && /PDF, DOCX ou PPTX/i.test(error.message),
  );
  assert.throws(
    () => assertEventRuleDocumentBinary("modelo.pptx", genericZip),
    (error: unknown) => error instanceof EventRuleDocumentError && /nao corresponde/i.test(error.message),
  );
});

test("requires the expected Open XML main content type declaration", () => {
  const misleadingPackage = createZipArchive({
    "[Content_Types].xml": `<Types><!-- ${DOCX_CONTENT_TYPES} --></Types>`,
    "word/document.xml": "<document/>",
  });

  assert.throws(
    () => assertEventRuleDocumentBinary("regulamento.docx", misleadingPackage),
    (error: unknown) => error instanceof EventRuleDocumentError,
  );
});

test("rejects macro payloads disguised with an allowed Open XML extension", () => {
  const macroEnabledDocument = createZipArchive({
    "[Content_Types].xml": DOCX_CONTENT_TYPES,
    "word/document.xml": "<document/>",
    "word/vbaProject.bin": "macro",
  });

  assert.throws(
    () => assertEventRuleDocumentBinary("regulamento.docx", macroEnabledDocument),
    (error: unknown) => error instanceof EventRuleDocumentError && /macros, controles ativos/i.test(error.message),
  );
});

test("rejects forged local ZIP entries and suspicious expanded sizes", () => {
  const forgedPackage = Buffer.from(
    createZipArchive({
      "[Content_Types].xml": DOCX_CONTENT_TYPES,
      "word/document.xml": "<document/>",
    }),
  );
  forgedPackage.writeUInt32LE(0, 0);

  assert.throws(
    () => assertEventRuleDocumentBinary("regulamento.docx", forgedPackage),
    (error: unknown) => error instanceof EventRuleDocumentError,
  );

  const compressedBomb = createZipArchive({
    "[Content_Types].xml": DOCX_CONTENT_TYPES,
    "word/document.xml": { declaredUncompressedSize: 50 * 1024 * 1024 },
  });

  assert.throws(
    () => assertEventRuleDocumentBinary("regulamento.docx", compressedBomb),
    (error: unknown) => error instanceof EventRuleDocumentError,
  );
});

test("rejects Open XML packages with embedded active content", () => {
  const embeddedObject = createZipArchive({
    "[Content_Types].xml": PPTX_CONTENT_TYPES,
    "ppt/presentation.xml": "<presentation/>",
    "ppt/embeddings/planilha.xlsx": "arquivo incorporado",
  });

  assert.throws(
    () => assertEventRuleDocumentBinary("template.pptx", embeddedObject),
    (error: unknown) => error instanceof EventRuleDocumentError && /anexos incorporados/i.test(error.message),
  );
});
