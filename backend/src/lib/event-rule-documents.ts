import path from "node:path";
import { inflateRawSync } from "node:zlib";
import type { MultipartFile } from "@fastify/multipart";
import { SaxesParser } from "saxes";
import { assertPdfBinary } from "./pdf-upload.js";

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_FILE_HEADER_SIGNATURE = 0x02014b50;
const MINIMUM_END_OF_CENTRAL_DIRECTORY_SIZE = 22;
const MAXIMUM_ZIP_COMMENT_SIZE = 65_535;
const MAXIMUM_ZIP_ENTRY_COUNT = 4_096;
const MAXIMUM_CONTENT_TYPES_BYTES = 1024 * 1024;
const MAXIMUM_OPEN_XML_ENTRY_BYTES = 50 * 1024 * 1024;
const MAXIMUM_OPEN_XML_EXPANDED_BYTES = 100 * 1024 * 1024;
const MAXIMUM_COMPRESSION_RATIO = 200;
const SUPPORTED_COMPRESSION_METHODS = new Set([0, 8]);
const BLOCKED_OPEN_XML_ENTRY_PATTERN = /(^|\/)(activex|embeddings)(\/|$)|(^|\/)vbaproject(?:signature)?\.bin$/i;

export type EventRuleDocumentExtension = ".pdf" | ".docx" | ".pptx";

export type EventRuleDocumentDescriptor = {
  contentType: string;
  extension: EventRuleDocumentExtension;
  label: "PDF" | "Word" | "PowerPoint";
  openXmlContentType?: string;
  openXmlEntry?: string;
};

export type ValidatedEventRuleDocument = {
  data: Uint8Array;
  descriptor: EventRuleDocumentDescriptor;
};

const documentDescriptors: Record<EventRuleDocumentExtension, EventRuleDocumentDescriptor> = {
  ".pdf": {
    extension: ".pdf",
    contentType: "application/pdf",
    label: "PDF",
  },
  ".docx": {
    extension: ".docx",
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    label: "Word",
    openXmlContentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
    openXmlEntry: "word/document.xml",
  },
  ".pptx": {
    extension: ".pptx",
    contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    label: "PowerPoint",
    openXmlContentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
    openXmlEntry: "ppt/presentation.xml",
  },
};

export class EventRuleDocumentError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "EventRuleDocumentError";
  }
}

function invalidDocument(message = "O arquivo enviado nao corresponde a um PDF, DOCX ou PPTX valido.") {
  return new EventRuleDocumentError(message);
}

export function getEventRuleDocumentDescriptor(fileName: string) {
  return documentDescriptors[path.extname(fileName).toLowerCase() as EventRuleDocumentExtension];
}

export function getEventRuleDocumentContentType(fileName: string) {
  return getEventRuleDocumentDescriptor(fileName)?.contentType ?? "application/octet-stream";
}

export function isEventRuleDocumentExtensionSupported(fileName: string) {
  return Boolean(getEventRuleDocumentDescriptor(fileName));
}

function findEndOfCentralDirectoryOffset(data: Buffer) {
  const minimumOffset = Math.max(
    0,
    data.length - MINIMUM_END_OF_CENTRAL_DIRECTORY_SIZE - MAXIMUM_ZIP_COMMENT_SIZE,
  );

  for (let offset = data.length - MINIMUM_END_OF_CENTRAL_DIRECTORY_SIZE; offset >= minimumOffset; offset -= 1) {
    if (data.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) return offset;
  }

  return -1;
}

type ZipEntry = {
  compressedSize: number;
  compressionMethod: number;
  localHeaderOffset: number;
  name: string;
  uncompressedSize: number;
};

function normalizeZipEntryName(fileName: string) {
  const normalized = fileName.replaceAll("\\", "/");
  const segments = normalized.split("/");

  if (
    !normalized ||
    normalized.startsWith("/") ||
    /^[a-z]:/i.test(normalized) ||
    /[\u0000-\u001f\u007f]/.test(normalized) ||
    segments.some((segment) => segment === "." || segment === "..")
  ) {
    throw invalidDocument();
  }

  return normalized.toLowerCase();
}

function validateLocalZipEntry(data: Buffer, entry: ZipEntry, centralDirectoryOffset: number) {
  const offset = entry.localHeaderOffset;
  if (offset + 30 > centralDirectoryOffset || data.readUInt32LE(offset) !== LOCAL_FILE_HEADER_SIGNATURE) {
    throw invalidDocument();
  }

  const generalPurposeFlags = data.readUInt16LE(offset + 6);
  const compressionMethod = data.readUInt16LE(offset + 8);
  const fileNameLength = data.readUInt16LE(offset + 26);
  const extraFieldLength = data.readUInt16LE(offset + 28);
  const payloadOffset = offset + 30 + fileNameLength + extraFieldLength;
  const payloadEndOffset = payloadOffset + entry.compressedSize;

  if (
    (generalPurposeFlags & 0x1) !== 0 ||
    compressionMethod !== entry.compressionMethod ||
    payloadEndOffset > centralDirectoryOffset
  ) {
    throw invalidDocument();
  }

  const localFileName = data.subarray(offset + 30, offset + 30 + fileNameLength).toString("utf8");
  if (normalizeZipEntryName(localFileName) !== entry.name) throw invalidDocument();
}

function listZipEntryNames(data: Uint8Array) {
  const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const endOffset = findEndOfCentralDirectoryOffset(buffer);
  if (endOffset < 0) throw invalidDocument();

  const diskNumber = buffer.readUInt16LE(endOffset + 4);
  const centralDirectoryDiskNumber = buffer.readUInt16LE(endOffset + 6);
  const diskEntryCount = buffer.readUInt16LE(endOffset + 8);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(endOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);
  const commentLength = buffer.readUInt16LE(endOffset + 20);

  if (
    diskNumber !== 0 ||
    centralDirectoryDiskNumber !== 0 ||
    diskEntryCount !== entryCount ||
    entryCount === 0 ||
    entryCount > MAXIMUM_ZIP_ENTRY_COUNT ||
    centralDirectoryOffset + centralDirectorySize !== endOffset ||
    endOffset + MINIMUM_END_OF_CENTRAL_DIRECTORY_SIZE + commentLength !== buffer.length
  ) {
    throw invalidDocument();
  }

  const entries = new Map<string, ZipEntry>();
  let offset = centralDirectoryOffset;
  let expandedBytes = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > endOffset || buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_FILE_HEADER_SIGNATURE) {
      throw invalidDocument();
    }

    const generalPurposeFlags = buffer.readUInt16LE(offset + 8);
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraFieldLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const nextOffset = offset + 46 + fileNameLength + extraFieldLength + commentLength;

    if (
      (generalPurposeFlags & 0x1) !== 0 ||
      !SUPPORTED_COMPRESSION_METHODS.has(compressionMethod) ||
      uncompressedSize > MAXIMUM_OPEN_XML_ENTRY_BYTES ||
      (compressedSize === 0 ? uncompressedSize > 0 : uncompressedSize / compressedSize > MAXIMUM_COMPRESSION_RATIO) ||
      nextOffset > endOffset
    ) {
      throw invalidDocument();
    }

    expandedBytes += uncompressedSize;
    if (expandedBytes > MAXIMUM_OPEN_XML_EXPANDED_BYTES) throw invalidDocument();

    const rawFileName = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");
    const name = normalizeZipEntryName(rawFileName);
    if (entries.has(name)) throw invalidDocument();

    const entry = { compressedSize, compressionMethod, localHeaderOffset, name, uncompressedSize };
    validateLocalZipEntry(buffer, entry, centralDirectoryOffset);
    entries.set(name, entry);
    offset = nextOffset;
  }

  if (offset !== centralDirectoryOffset + centralDirectorySize) throw invalidDocument();

  for (const entry of entries.values()) {
    readZipEntry(data, entry);
  }

  return entries;
}

function readZipEntry(data: Uint8Array, entry: ZipEntry) {
  const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const fileNameLength = buffer.readUInt16LE(entry.localHeaderOffset + 26);
  const extraFieldLength = buffer.readUInt16LE(entry.localHeaderOffset + 28);
  const payloadOffset = entry.localHeaderOffset + 30 + fileNameLength + extraFieldLength;
  const compressedData = buffer.subarray(payloadOffset, payloadOffset + entry.compressedSize);

  try {
    const expandedData = entry.compressionMethod === 0
      ? compressedData
      : inflateRawSync(compressedData, { maxOutputLength: MAXIMUM_OPEN_XML_ENTRY_BYTES });

    if (expandedData.length !== entry.uncompressedSize) throw invalidDocument();
    return expandedData;
  } catch (error) {
    if (error instanceof EventRuleDocumentError) throw error;
    throw invalidDocument();
  }
}

function inspectOpenXmlContentTypes(data: Buffer, descriptor: EventRuleDocumentDescriptor) {
  let hasBlockedContentType = false;
  let hasExpectedMainContentType = false;

  try {
    const parser = new SaxesParser();

    parser.on("doctype", () => {
      throw invalidDocument();
    });
    parser.on("opentag", (tag) => {
      const contentType = tag.attributes.ContentType;
      if (typeof contentType !== "string") return;

      if (contentType.toLowerCase().includes("macroenabled")) {
        hasBlockedContentType = true;
      }

      if (
        tag.name === "Override" &&
        tag.attributes.PartName === `/${descriptor.openXmlEntry}` &&
        contentType === descriptor.openXmlContentType
      ) {
        hasExpectedMainContentType = true;
      }
    });

    parser.write(data.toString("utf8")).close();
  } catch (error) {
    if (error instanceof EventRuleDocumentError) throw error;
    throw invalidDocument();
  }

  return { hasBlockedContentType, hasExpectedMainContentType };
}

function assertOpenXmlDocument(data: Uint8Array, descriptor: EventRuleDocumentDescriptor) {
  const entries = listZipEntryNames(data);
  const contentTypesEntry = entries.get("[content_types].xml");

  if (
    !contentTypesEntry ||
    contentTypesEntry.uncompressedSize > MAXIMUM_CONTENT_TYPES_BYTES ||
    !descriptor.openXmlContentType ||
    !descriptor.openXmlEntry ||
    !entries.has(descriptor.openXmlEntry)
  ) {
    throw invalidDocument();
  }

  const contentTypes = inspectOpenXmlContentTypes(readZipEntry(data, contentTypesEntry), descriptor);
  if (!contentTypes.hasExpectedMainContentType) throw invalidDocument();

  if (
    contentTypes.hasBlockedContentType ||
    [...entries.keys()].some((entry) => BLOCKED_OPEN_XML_ENTRY_PATTERN.test(entry))
  ) {
    throw invalidDocument("Arquivos de normas com macros, controles ativos ou anexos incorporados nao sao permitidos.");
  }
}

export function assertEventRuleDocumentBinary(fileName: string, data: Uint8Array) {
  const descriptor = getEventRuleDocumentDescriptor(fileName);
  if (!descriptor) {
    throw invalidDocument("Apenas arquivos PDF, DOCX ou PPTX sao permitidos para normas.");
  }

  if (descriptor.extension === ".pdf") {
    assertPdfBinary(data);
  } else {
    assertOpenXmlDocument(data, descriptor);
  }

  return descriptor;
}

export async function readValidatedEventRuleDocumentUpload(file: MultipartFile): Promise<ValidatedEventRuleDocument> {
  if (!isEventRuleDocumentExtensionSupported(file.filename)) {
    file.file.resume();
    throw invalidDocument("Apenas arquivos PDF, DOCX ou PPTX sao permitidos para normas.");
  }

  const data = new Uint8Array(await file.toBuffer());
  return {
    data,
    descriptor: assertEventRuleDocumentBinary(file.filename, data),
  };
}
