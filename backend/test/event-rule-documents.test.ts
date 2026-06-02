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

function createZipArchive(entryNames: string[]) {
  const localEntries: Buffer[] = [];
  const centralDirectoryEntries: Buffer[] = [];
  let localOffset = 0;

  for (const entryName of entryNames) {
    const encodedName = Buffer.from(entryName);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(LOCAL_FILE_HEADER_SIGNATURE, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(encodedName.length, 26);
    localEntries.push(localHeader, encodedName);

    const centralDirectoryHeader = Buffer.alloc(46);
    centralDirectoryHeader.writeUInt32LE(CENTRAL_DIRECTORY_FILE_HEADER_SIGNATURE, 0);
    centralDirectoryHeader.writeUInt16LE(20, 4);
    centralDirectoryHeader.writeUInt16LE(20, 6);
    centralDirectoryHeader.writeUInt16LE(encodedName.length, 28);
    centralDirectoryHeader.writeUInt32LE(localOffset, 42);
    centralDirectoryEntries.push(centralDirectoryHeader, encodedName);

    localOffset += localHeader.length + encodedName.length;
  }

  const centralDirectory = Buffer.concat(centralDirectoryEntries);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(END_OF_CENTRAL_DIRECTORY_SIGNATURE, 0);
  endOfCentralDirectory.writeUInt16LE(entryNames.length, 8);
  endOfCentralDirectory.writeUInt16LE(entryNames.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(localOffset, 16);

  return new Uint8Array(Buffer.concat([...localEntries, centralDirectory, endOfCentralDirectory]));
}

test("accepts PDF, DOCX and PPTX rule documents with the expected content type", async () => {
  const pdf = await createPdfDocument([["Norma em PDF"]]);
  const docx = createZipArchive(["[Content_Types].xml", "_rels/.rels", "word/document.xml"]);
  const pptx = createZipArchive(["[Content_Types].xml", "_rels/.rels", "ppt/presentation.xml"]);

  assert.equal(assertEventRuleDocumentBinary("edital.pdf", pdf).label, "PDF");
  assert.equal(assertEventRuleDocumentBinary("regulamento.docx", docx).label, "Word");
  assert.equal(assertEventRuleDocumentBinary("template.pptx", pptx).label, "PowerPoint");
  assert.equal(
    getEventRuleDocumentContentType("template.pptx"),
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  );
});

test("rejects unsupported extensions and ZIP files disguised as Open XML documents", () => {
  const genericZip = createZipArchive(["arquivo.txt"]);

  assert.throws(
    () => assertEventRuleDocumentBinary("modelo.ppt", genericZip),
    (error: unknown) => error instanceof EventRuleDocumentError && /PDF, DOCX ou PPTX/i.test(error.message),
  );
  assert.throws(
    () => assertEventRuleDocumentBinary("modelo.pptx", genericZip),
    (error: unknown) => error instanceof EventRuleDocumentError && /nao corresponde/i.test(error.message),
  );
});

test("rejects macro payloads disguised with an allowed Open XML extension", () => {
  const macroEnabledDocument = createZipArchive([
    "[Content_Types].xml",
    "word/document.xml",
    "word/vbaProject.bin",
  ]);

  assert.throws(
    () => assertEventRuleDocumentBinary("regulamento.docx", macroEnabledDocument),
    (error: unknown) => error instanceof EventRuleDocumentError && /macros nao sao permitidos/i.test(error.message),
  );
});
