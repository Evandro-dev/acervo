import path from "node:path";
import type { MultipartFile } from "@fastify/multipart";
import { assertPdfBinary } from "./pdf-upload.js";

const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_FILE_HEADER_SIGNATURE = 0x02014b50;
const MINIMUM_END_OF_CENTRAL_DIRECTORY_SIZE = 22;
const MAXIMUM_ZIP_COMMENT_SIZE = 65_535;
const MAXIMUM_ZIP_ENTRY_COUNT = 4_096;

export type EventRuleDocumentExtension = ".pdf" | ".docx" | ".pptx";

export type EventRuleDocumentDescriptor = {
  contentType: string;
  extension: EventRuleDocumentExtension;
  label: "PDF" | "Word" | "PowerPoint";
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
    openXmlEntry: "word/document.xml",
  },
  ".pptx": {
    extension: ".pptx",
    contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    label: "PowerPoint",
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

function listZipEntryNames(data: Uint8Array) {
  const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const endOffset = findEndOfCentralDirectoryOffset(buffer);
  if (endOffset < 0) throw invalidDocument();

  const diskNumber = buffer.readUInt16LE(endOffset + 4);
  const centralDirectoryDiskNumber = buffer.readUInt16LE(endOffset + 6);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(endOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);

  if (
    diskNumber !== 0 ||
    centralDirectoryDiskNumber !== 0 ||
    entryCount === 0 ||
    entryCount > MAXIMUM_ZIP_ENTRY_COUNT ||
    centralDirectoryOffset + centralDirectorySize > endOffset
  ) {
    throw invalidDocument();
  }

  const entries = new Set<string>();
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > endOffset || buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_FILE_HEADER_SIGNATURE) {
      throw invalidDocument();
    }

    const generalPurposeFlags = buffer.readUInt16LE(offset + 8);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraFieldLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const nextOffset = offset + 46 + fileNameLength + extraFieldLength + commentLength;

    if ((generalPurposeFlags & 0x1) !== 0 || nextOffset > endOffset) {
      throw invalidDocument();
    }

    const fileName = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");
    if (!fileName || fileName.includes("../") || fileName.startsWith("/")) {
      throw invalidDocument();
    }

    entries.add(fileName.replaceAll("\\", "/").toLowerCase());
    offset = nextOffset;
  }

  if (offset !== centralDirectoryOffset + centralDirectorySize) throw invalidDocument();

  return entries;
}

function assertOpenXmlDocument(data: Uint8Array, descriptor: EventRuleDocumentDescriptor) {
  const entries = listZipEntryNames(data);

  if (
    !entries.has("[content_types].xml") ||
    !descriptor.openXmlEntry ||
    !entries.has(descriptor.openXmlEntry)
  ) {
    throw invalidDocument();
  }

  if ([...entries].some((entry) => /(^|\/)vbaproject\.bin$/i.test(entry))) {
    throw invalidDocument("Arquivos de normas com macros nao sao permitidos.");
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
