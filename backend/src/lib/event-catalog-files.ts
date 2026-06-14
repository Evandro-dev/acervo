import { createReadStream } from "node:fs";
import { access, mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { env } from "../env.js";
import { removePublicBlob } from "./public-blob-storage.js";
import { slugify } from "./slug.js";
import {
  escapeRegExp,
  isSafeStorageFileName,
  truncateStorageFileSlug,
} from "./storage-path.js";
import { resolveUploadsDirectory } from "./uploads-directory.js";

const eventCatalogDirectory = path.join(
  resolveUploadsDirectory(env.UPLOADS_DIRECTORY),
  "events",
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

function getEventCatalogBlobPathPrefix() {
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

function getEventCatalogFilePath(fileName: string) {
  return path.join(eventCatalogDirectory, fileName);
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

export function buildEventCatalogFileUrl(request: FastifyRequest, fileName: string) {
  const encodedFileName = encodeURIComponent(fileName);
  return `${getRequestProtocol(request)}://${getRequestHost(request)}/events/catalog/files/${encodedFileName}`;
}

async function saveEventCatalogFile(
  request: FastifyRequest,
  originalFileName: string,
  data: Uint8Array,
  kind: CatalogFileKind,
): Promise<SavedEventCatalogFile> {
  const fileName = buildEventCatalogFileName(originalFileName, kind);
  const buffer = toStorageBuffer(data);
  const filePath = getEventCatalogFilePath(fileName);

  if (buffer.byteLength <= 0) {
    throw new Error(
      `Arquivo da ficha catalográfica veio vazio antes de salvar: ${originalFileName}`,
    );
  }

  await mkdir(eventCatalogDirectory, { recursive: true });
  await writeFile(filePath, buffer);

  const savedStats = await stat(filePath);

  request.log.info(
    {
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
    fileUrl: buildEventCatalogFileUrl(request, fileName),
    blobUrl: null,
  };
}

export async function saveEventCatalogPdf(
  request: FastifyRequest,
  originalFileName: string,
  data: Uint8Array,
) {
  return saveEventCatalogFile(request, originalFileName, data, "pdf");
}

export async function saveEventCatalogImage(
  request: FastifyRequest,
  originalFileName: string,
  data: Uint8Array,
) {
  return saveEventCatalogFile(request, originalFileName, data, "image");
}

export async function eventCatalogFileExists(fileName: string) {
  try {
    await access(getEventCatalogFilePath(fileName));
    return true;
  } catch {
    return false;
  }
}

export async function getEventCatalogFileSize(fileName: string) {
  const stats = await stat(getEventCatalogFilePath(fileName));
  return stats.size;
}

export function createEventCatalogReadStream(
  fileName: string,
  options?: EventCatalogReadStreamOptions,
) {
  return createReadStream(getEventCatalogFilePath(fileName), options);
}

export async function removeEventCatalogFile(fileName: string) {
  try {
    await unlink(getEventCatalogFilePath(fileName));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
  }
}

export async function removeEventCatalogResource(resourceUrl?: string | null) {
  if (await removePublicBlob(resourceUrl, { pathnamePrefix: getEventCatalogBlobPathPrefix() })) return;

  const fileName = extractLocalEventCatalogFileName(resourceUrl);
  if (fileName) await removeEventCatalogFile(fileName);
}

export function extractLocalEventCatalogFileName(resourceUrl?: string | null) {
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

export function isStoredEventCatalogFileUrl(resourceUrl?: string | null) {
  if (!resourceUrl) return false;

  if (extractLocalEventCatalogFileName(resourceUrl)) return true;

  try {
    const parsed = new URL(resourceUrl);
    return new RegExp(`^${escapeRegExp(getEventCatalogBlobPathPrefix())}[^/]+$`).test(
      parsed.pathname,
    );
  } catch {
    return false;
  }
}
