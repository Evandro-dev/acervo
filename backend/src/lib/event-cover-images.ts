import { createReadStream, createWriteStream } from "node:fs";
import { access, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import type { MultipartFile } from "@fastify/multipart";
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

const eventCoverDirectory = path.join(resolveUploadsDirectory(env.UPLOADS_DIRECTORY), "events");

const allowedImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const allowedImageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function getEventCoverBlobPathPrefix(eventId: string) {
  assertSafeStorageResourceId(eventId);
  return `/acervo/events/${eventId}/covers/`;
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

function getEventCoverDirectory(eventId: string) {
  assertSafeStorageResourceId(eventId);
  return path.join(eventCoverDirectory, eventId, "covers");
}

function getEventCoverImagePath(eventId: string, fileName: string) {
  return path.join(getEventCoverDirectory(eventId), fileName);
}

function getExtensionFromMimeType(mimetype: string) {
  switch (mimetype) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      return "";
  }
}

function buildEventCoverImageFileName(file: MultipartFile) {
  const originalExtension = path.extname(file.filename).toLowerCase();
  const extension = allowedImageExtensions.has(originalExtension)
    ? originalExtension
    : getExtensionFromMimeType(file.mimetype) || ".jpg";
  const basename = path.basename(file.filename, originalExtension);
  const slug = truncateStorageFileSlug(slugify(basename)) || "capa-evento";

  return `${Date.now()}-${slug}-${randomUUID().slice(0, 8)}${extension}`;
}

export function isEventCoverImageUpload(file: MultipartFile) {
  const extension = path.extname(file.filename).toLowerCase();
  return allowedImageMimeTypes.has(file.mimetype) && allowedImageExtensions.has(extension);
}

export function getEventCoverImageContentType(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();

  switch (extension) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

export function isSafeEventCoverImageFileName(fileName: string) {
  return (
    fileName === path.basename(fileName) &&
    isSafeStorageFileName(fileName) &&
    allowedImageExtensions.has(path.extname(fileName).toLowerCase())
  );
}

export function buildEventCoverImageUrl(request: FastifyRequest, eventId: string, fileName: string) {
  assertSafeStorageResourceId(eventId);
  const encodedFileName = encodeURIComponent(fileName);
  return `${getRequestProtocol(request)}://${getRequestHost(request)}/events/${eventId}/cover/${encodedFileName}`;
}

export async function saveEventCoverImage(eventId: string, file: MultipartFile) {
  assertSafeStorageResourceId(eventId);
  const fileName = buildEventCoverImageFileName(file);
  const blobUrl = await uploadPublicBlob(
    `acervo/events/${eventId}/covers/${fileName}`,
    file.file,
    file.mimetype,
  );
  if (blobUrl) return { fileName, blobUrl };

  const targetDirectory = getEventCoverDirectory(eventId);

  await mkdir(targetDirectory, { recursive: true });
  try {
    await pipeline(file.file, createWriteStream(getEventCoverImagePath(eventId, fileName)));
  } catch (error) {
    await removeEventCoverImage(eventId, fileName).catch(() => undefined);
    throw error;
  }

  return { fileName, blobUrl: null };
}

export async function eventCoverImageExists(eventId: string, fileName: string) {
  try {
    await access(getEventCoverImagePath(eventId, fileName));
    return true;
  } catch {
    return false;
  }
}

export function createEventCoverImageReadStream(eventId: string, fileName: string) {
  return createReadStream(getEventCoverImagePath(eventId, fileName));
}

export async function removeEventCoverImage(eventId: string, fileName: string) {
  try {
    await unlink(getEventCoverImagePath(eventId, fileName));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
  }
}

export async function removeEventCoverResource(eventId: string, resourceUrl?: string | null) {
  if (await removePublicBlob(resourceUrl, { pathnamePrefix: getEventCoverBlobPathPrefix(eventId) })) return;

  const fileName = extractLocalEventCoverFileName(eventId, resourceUrl);
  if (fileName) await removeEventCoverImage(eventId, fileName);
}

export async function removeSavedEventCoverImage(
  eventId: string,
  upload: { fileName: string; blobUrl: string | null },
) {
  if (upload.blobUrl) {
    await removePublicBlob(upload.blobUrl, { pathnamePrefix: getEventCoverBlobPathPrefix(eventId) });
    return;
  }

  await removeEventCoverImage(eventId, upload.fileName);
}

export function extractLocalEventCoverFileName(eventId: string, resourceUrl?: string | null) {
  if (!resourceUrl) return null;

  try {
    assertSafeStorageResourceId(eventId);
    const parsed = resourceUrl.startsWith("http://") || resourceUrl.startsWith("https://")
      ? new URL(resourceUrl)
      : new URL(resourceUrl, "http://local.acervo");
    const pathMatch = parsed.pathname.match(new RegExp(`^/events/${escapeRegExp(eventId)}/cover/([^/]+)$`));
    if (!pathMatch?.[1]) return null;
    const fileName = decodeURIComponent(pathMatch[1]);
    return isSafeEventCoverImageFileName(fileName) ? fileName : null;
  } catch {
    return null;
  }
}
