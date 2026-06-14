import { createReadStream } from "node:fs";
import { access, mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { env } from "../env.js";
import { removePublicBlob, uploadPublicBlob } from "./public-blob-storage.js";
import { slugify } from "./slug.js";
import {
  assertSafeStorageResourceId,
  escapeRegExp,
  isSafeStorageFileName,
  truncateStorageFileSlug,
} from "./storage-path.js";
import { resolveUploadsDirectory } from "./uploads-directory.js";

const eventCatalogBaseDirectory = path.join(
  resolveUploadsDirectory(env.UPLOADS_DIRECTORY),
  "events",
);

const legacyEventCatalogDirectory = path.join(
  eventCatalogBaseDirectory,
  "catalog",
);

const allowedCatalogExtensions = new Set([".pdf", ".png"]);

type CatalogFileKind = "pdf" | "image";

type SavedEventCatalogFile = {
  fileName: string;
  fileUrl: string;
  blobUrl: string | null;
};

type EventCatalogReadStreamOptions = {
  start?: number;
  end?: number;
};

function getEventCatalogBlobPathPrefix(eventId: string) {
  assertSafeStorageResourceId(eventId);
  return `/acervo/events/${eventId}/catalog/`;
}

function getLegacyEventCatalogBlobPathPrefix() {
  return "/acervo/events/catalog/";
}

function getRequestHost(request: FastifyRequest) {
  const forwardedHost = request.headers["x-forwarded-host"];
  if (typeof forwardedHost === "string" && forwardedHost.trim()) return forwardedHost;
  if (Array.isArray(forwardedHost) && forwardedHost[0]?.trim()) return forwardedHost[0];

  const host = request.headers.host;
  if (typeof host === "string" && host.trim()) return host;

  return `localhost:${env.PORT}`;
}

function getRequestProtocol(request: FastifyRequest) {
  const forwardedProtocol = request.headers["x-forwarded-proto"];
  if (typeof forwardedProtocol === "string" && forwardedProtocol.trim()) {
    return forwardedProtocol.split(",")[0].trim();
  }

  if (Array.isArray(forwardedProtocol) && forwardedProtocol[0]?.trim()) {
    return forwardedProtocol[0].trim();
  }

  return request.protocol || "http";
}

function getEventCatalogDirectory(eventId: string) {
  assertSafeStorageResourceId(eventId);
  return path.join(eventCatalogBaseDirectory, eventId, "catalog");
}

function getEventCatalogFilePath(eventId: string, fileName: string) {
  return path.join(getEventCatalogDirectory(eventId), fileName);
}

function getLegacyEventCatalogFilePath(fileName: string) {
  return path.join(legacyEventCatalogDirectory, fileName);
}

function getCatalogExtension(kind: CatalogFileKind) {
  return kind === "pdf" ? ".pdf" : ".png";
}

function buildEventCatalogFileName(originalFileName: string, kind: CatalogFileKind) {
  const originalExtension = path.extname(originalFileName).toLowerCase();
  const extension =
    allowedCatalogExtensions.has(originalExtension) &&
    ((kind === "pdf" && originalExtension === ".pdf") ||
      (kind === "image" && originalExtension === ".png"))
      ? originalExtension
      : getCatalogExtension(kind);
  const basename = path.basename(originalFileName, originalExtension);
  const fallbackName = kind === "pdf" ? "ficha-catalografica" : "ficha-catalografica-imagem";
  const slug = truncateStorageFileSlug(slugify(basename)) || fallbackName;

  return `${Date.now()}-${slug}-${randomUUID().slice(0, 8)}${extension}`;
}

function toStorageBuffer(data: Uint8Array) {
  return Buffer.from(data);
}

function getCatalogFilePath(eventIdOrFileName: string, fileName?: string) {
  return fileName
    ? getEventCatalogFilePath(eventIdOrFileName, fileName)
    : getLegacyEventCatalogFilePath(eventIdOrFileName);
}

export function getEventCatalogContentType(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();

  switch (extension) {
    case ".pdf":
      return "application/pdf";
    case ".png":
      return "image/png";
    default:
      return "application/octet-stream";
  }
}

export function isSafeEventCatalogFileName(fileName: string) {
  return (
    fileName === path.basename(fileName) &&
    isSafeStorageFileName(fileName) &&
    allowedCatalogExtensions.has(path.extname(fileName).toLowerCase())
  );
}

export function buildEventCatalogFileUrl(request: FastifyRequest, eventId: string, fileName: string) {
  assertSafeStorageResourceId(eventId);
  const encodedFileName = encodeURIComponent(fileName);
  return `${getRequestProtocol(request)}://${getRequestHost(request)}/events/${eventId}/catalog/files/${encodedFileName}`;
}

async function saveEventCatalogFile(
  request: FastifyRequest,
  eventId: string,
  originalFileName: string,
  data: Uint8Array,
  kind: CatalogFileKind,
): Promise<SavedEventCatalogFile> {
  assertSafeStorageResourceId(eventId);

  const fileName = buildEventCatalogFileName(originalFileName, kind);
  const buffer = toStorageBuffer(data);
  const contentType = getEventCatalogContentType(fileName);

  if (buffer.byteLength <= 0) {
    throw new Error(
      `Arquivo da ficha catalográfica veio vazio antes de salvar: ${originalFileName}`,
    );
  }

  const blobUrl = await uploadPublicBlob(
    `acervo/events/${eventId}/catalog/${fileName}`,
    buffer,
    contentType,
  );

  if (blobUrl) {
    request.log.info(
      {
        eventId,
        fileName,
        kind,
        bytes: buffer.byteLength,
        blobUrl,
      },
      "Ficha catalográfica salva no Vercel Blob",
    );

    return {
      fileName,
      fileUrl: blobUrl,
      blobUrl,
    };
  }

  const targetDirectory = getEventCatalogDirectory(eventId);
  const filePath = getEventCatalogFilePath(eventId, fileName);

  await mkdir(targetDirectory, { recursive: true });
  await writeFile(filePath, buffer);

  const savedStats = await stat(filePath);

  request.log.info(
    {
      eventId,
      fileName,
      kind,
      expectedBytes: buffer.byteLength,
      savedBytes: savedStats.size,
    },
    "Ficha catalográfica salva em disco",
  );

  if (savedStats.size !== buffer.byteLength) {
    throw new Error(
      `Falha ao salvar ficha catalográfica: esperado ${buffer.byteLength} bytes, gravado ${savedStats.size} bytes.`,
    );
  }

  return {
    fileName,
    fileUrl: buildEventCatalogFileUrl(request, eventId, fileName),
    blobUrl: null,
  };
}

export async function saveEventCatalogPdf(
  request: FastifyRequest,
  eventId: string,
  originalFileName: string,
  data: Uint8Array,
) {
  return saveEventCatalogFile(request, eventId, originalFileName, data, "pdf");
}

export async function saveEventCatalogImage(
  request: FastifyRequest,
  eventId: string,
  originalFileName: string,
  data: Uint8Array,
) {
  return saveEventCatalogFile(request, eventId, originalFileName, data, "image");
}

export async function eventCatalogFileExists(eventId: string, fileName: string): Promise<boolean>;
export async function eventCatalogFileExists(fileName: string): Promise<boolean>;
export async function eventCatalogFileExists(eventIdOrFileName: string, fileName?: string) {
  try {
    await access(getCatalogFilePath(eventIdOrFileName, fileName));
    return true;
  } catch {
    return false;
  }
}

export async function getEventCatalogFileSize(eventId: string, fileName: string): Promise<number>;
export async function getEventCatalogFileSize(fileName: string): Promise<number>;
export async function getEventCatalogFileSize(eventIdOrFileName: string, fileName?: string) {
  const stats = await stat(getCatalogFilePath(eventIdOrFileName, fileName));
  return stats.size;
}

export function createEventCatalogReadStream(
  eventId: string,
  fileName: string,
  options?: EventCatalogReadStreamOptions,
): ReturnType<typeof createReadStream>;
export function createEventCatalogReadStream(
  fileName: string,
  options?: EventCatalogReadStreamOptions,
): ReturnType<typeof createReadStream>;
export function createEventCatalogReadStream(
  eventIdOrFileName: string,
  fileNameOrOptions?: string | EventCatalogReadStreamOptions,
  maybeOptions?: EventCatalogReadStreamOptions,
) {
  const hasEventId = typeof fileNameOrOptions === "string";
  const filePath = hasEventId
    ? getEventCatalogFilePath(eventIdOrFileName, fileNameOrOptions)
    : getLegacyEventCatalogFilePath(eventIdOrFileName);
  const options = hasEventId ? maybeOptions : fileNameOrOptions;

  return createReadStream(filePath, options);
}

export async function removeEventCatalogFile(eventId: string, fileName: string): Promise<void>;
export async function removeEventCatalogFile(fileName: string): Promise<void>;
export async function removeEventCatalogFile(eventIdOrFileName: string, fileName?: string) {
  try {
    await unlink(getCatalogFilePath(eventIdOrFileName, fileName));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
  }
}

function extractEventScopedLocalFileName(eventId: string, resourceUrl?: string | null) {
  if (!resourceUrl) return null;

  try {
    assertSafeStorageResourceId(eventId);

    const parsed =
      resourceUrl.startsWith("http://") || resourceUrl.startsWith("https://")
        ? new URL(resourceUrl)
        : new URL(resourceUrl, "http://local.acervo");

    const pathMatch = parsed.pathname.match(
      new RegExp(`^/events/${escapeRegExp(eventId)}/catalog/files/([^/]+)$`),
    );

    if (!pathMatch?.[1]) return null;

    const fileName = decodeURIComponent(pathMatch[1]);
    return isSafeEventCatalogFileName(fileName) ? fileName : null;
  } catch {
    return null;
  }
}

function extractLegacyLocalFileName(resourceUrl?: string | null) {
  if (!resourceUrl) return null;

  try {
    const parsed =
      resourceUrl.startsWith("http://") || resourceUrl.startsWith("https://")
        ? new URL(resourceUrl)
        : new URL(resourceUrl, "http://local.acervo");

    const pathMatch = parsed.pathname.match(
      new RegExp(`^/events/catalog/files/([^/]+)$`),
    );

    if (!pathMatch?.[1]) return null;

    const fileName = decodeURIComponent(pathMatch[1]);
    return isSafeEventCatalogFileName(fileName) ? fileName : null;
  } catch {
    return null;
  }
}

export async function removeEventCatalogResource(eventId: string, resourceUrl?: string | null): Promise<void>;
export async function removeEventCatalogResource(resourceUrl?: string | null): Promise<void>;
export async function removeEventCatalogResource(
  eventIdOrResourceUrl?: string | null,
  maybeResourceUrl?: string | null,
) {
  const hasEventId = maybeResourceUrl !== undefined;
  const eventId = hasEventId ? eventIdOrResourceUrl : null;
  const resourceUrl = hasEventId ? maybeResourceUrl : eventIdOrResourceUrl;

  if (eventId) {
    if (await removePublicBlob(resourceUrl, { pathnamePrefix: getEventCatalogBlobPathPrefix(eventId) })) return;

    const eventScopedFileName = extractEventScopedLocalFileName(eventId, resourceUrl);
    if (eventScopedFileName) {
      await removeEventCatalogFile(eventId, eventScopedFileName);
      return;
    }
  }

  if (await removePublicBlob(resourceUrl, { pathnamePrefix: getLegacyEventCatalogBlobPathPrefix() })) return;

  const legacyFileName = extractLegacyLocalFileName(resourceUrl);
  if (legacyFileName) await removeEventCatalogFile(legacyFileName);
}

export function extractLocalEventCatalogFileName(eventId: string, resourceUrl?: string | null): string | null;
export function extractLocalEventCatalogFileName(resourceUrl?: string | null): string | null;
export function extractLocalEventCatalogFileName(
  eventIdOrResourceUrl?: string | null,
  maybeResourceUrl?: string | null,
) {
  const hasEventId = maybeResourceUrl !== undefined;
  const eventId = hasEventId ? eventIdOrResourceUrl : null;
  const resourceUrl = hasEventId ? maybeResourceUrl : eventIdOrResourceUrl;

  if (eventId) {
    const eventScopedFileName = extractEventScopedLocalFileName(eventId, resourceUrl);
    if (eventScopedFileName) return eventScopedFileName;
  }

  return extractLegacyLocalFileName(resourceUrl);
}

export function isStoredEventCatalogFileUrl(eventId: string, resourceUrl?: string | null): boolean;
export function isStoredEventCatalogFileUrl(resourceUrl?: string | null): boolean;
export function isStoredEventCatalogFileUrl(
  eventIdOrResourceUrl?: string | null,
  maybeResourceUrl?: string | null,
) {
  const hasEventId = maybeResourceUrl !== undefined;
  const eventId = hasEventId ? eventIdOrResourceUrl : null;
  const resourceUrl = hasEventId ? maybeResourceUrl : eventIdOrResourceUrl;

  if (!resourceUrl) return false;

  if (eventId && extractEventScopedLocalFileName(eventId, resourceUrl)) return true;
  if (extractLegacyLocalFileName(resourceUrl)) return true;

  try {
    const parsed = new URL(resourceUrl);

    if (
      eventId &&
      new RegExp(`^${escapeRegExp(getEventCatalogBlobPathPrefix(eventId))}[^/]+$`).test(
        parsed.pathname,
      )
    ) {
      return true;
    }

    return new RegExp(`^${escapeRegExp(getLegacyEventCatalogBlobPathPrefix())}[^/]+$`).test(
      parsed.pathname,
    );
  } catch {
    return false;
  }
}
