import { createReadStream } from "node:fs";
import { access, mkdir, readdir, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { env } from "../env.js";
import {
  isEventRuleDocumentExtensionSupported,
  type EventRuleDocumentExtension,
  type ValidatedEventRuleDocument,
} from "./event-rule-documents.js";
import { isManagedPublicBlobUrl, removePublicBlob, uploadPublicBlob } from "./public-blob-storage.js";
import { slugify } from "./slug.js";
import {
  assertSafeStorageResourceId,
  escapeRegExp,
  isSafeStorageFileName,
  truncateStorageFileSlug,
} from "./storage-path.js";
import { resolveUploadsDirectory } from "./uploads-directory.js";

const eventRuleDirectory = path.join(resolveUploadsDirectory(env.UPLOADS_DIRECTORY), "events");

function getEventRuleBlobPathPrefix(eventId: string) {
  assertSafeStorageResourceId(eventId);
  return `/acervo/events/${eventId}/rules/`;
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

function getEventRuleEventDirectory(eventId: string) {
  assertSafeStorageResourceId(eventId);
  return path.join(eventRuleDirectory, eventId);
}

export function getEventRuleFilePath(eventId: string, fileName: string) {
  return path.join(getEventRuleEventDirectory(eventId), fileName);
}

export function isSafeEventRuleFileName(fileName: string) {
  return (
    fileName === path.basename(fileName) &&
    isSafeStorageFileName(fileName) &&
    isEventRuleDocumentExtensionSupported(fileName)
  );
}

function getComparableEventRuleFileKey(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  if (!isEventRuleDocumentExtensionSupported(fileName)) return "";

  return path
    .basename(fileName, extension)
    .replace(/^\d+-/, "")
    .replace(/-[0-9a-f]{8}$/i, "");
}

function buildEventRuleFileName(originalFileName: string, validatedExtension: EventRuleDocumentExtension) {
  const originalExtension = path.extname(originalFileName);
  const basename = path.basename(originalFileName, originalExtension);
  const slug = truncateStorageFileSlug(slugify(basename)) || "norma";
  return `${Date.now()}-${slug}-${randomUUID().slice(0, 8)}${validatedExtension}`;
}

export function buildEventRuleFileUrl(request: FastifyRequest, eventId: string, fileName: string) {
  assertSafeStorageResourceId(eventId);
  const encodedFileName = encodeURIComponent(fileName);
  return `${getRequestProtocol(request)}://${getRequestHost(request)}/events/${eventId}/files/${encodedFileName}`;
}

export async function saveEventRuleFile(
  eventId: string,
  originalFileName: string,
  document: ValidatedEventRuleDocument,
) {
  assertSafeStorageResourceId(eventId);
  const fileName = buildEventRuleFileName(originalFileName, document.descriptor.extension);
  const blobUrl = await uploadPublicBlob(
    `acervo/events/${eventId}/rules/${fileName}`,
    Buffer.from(document.data),
    document.descriptor.contentType,
  );
  if (blobUrl) return { fileName, blobUrl };

  const targetDirectory = getEventRuleEventDirectory(eventId);

  await mkdir(targetDirectory, { recursive: true });
  try {
    await writeFile(getEventRuleFilePath(eventId, fileName), document.data);
  } catch (error) {
    await removeEventRuleFile(eventId, fileName).catch(() => undefined);
    throw error;
  }

  return { fileName, blobUrl: null };
}

export async function eventRuleFileExists(eventId: string, fileName: string) {
  try {
    await access(getEventRuleFilePath(eventId, fileName));
    return true;
  } catch {
    return false;
  }
}

export async function findReplacementEventRuleFile(eventId: string, fileName: string) {
  const targetKey = getComparableEventRuleFileKey(fileName);
  if (!targetKey) return null;

  try {
    const entries = await readdir(getEventRuleEventDirectory(eventId), { withFileTypes: true });
    const replacement = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => name !== fileName && getComparableEventRuleFileKey(name) === targetKey)
      .sort()
      .at(-1);

    return replacement ?? null;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    throw error;
  }
}

export function createEventRuleReadStream(eventId: string, fileName: string) {
  return createReadStream(getEventRuleFilePath(eventId, fileName));
}

export async function removeEventRuleFile(eventId: string, fileName: string) {
  try {
    await unlink(getEventRuleFilePath(eventId, fileName));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
  }
}

export async function removeEventRuleResource(eventId: string, resourceUrl: string) {
  if (await removePublicBlob(resourceUrl, { pathnamePrefix: getEventRuleBlobPathPrefix(eventId) })) return true;

  const fileName = extractLocalEventRuleFileName(eventId, resourceUrl);
  if (!fileName) return false;

  await removeEventRuleFile(eventId, fileName);
  return true;
}

export function getEventRuleResourceKey(eventId: string, resourceUrl: string) {
  const pathnamePrefix = getEventRuleBlobPathPrefix(eventId);
  if (isManagedPublicBlobUrl(resourceUrl, pathnamePrefix)) {
    return `blob:${new URL(resourceUrl).pathname}`;
  }

  const fileName = extractLocalEventRuleFileName(eventId, resourceUrl);
  return fileName ? `local:${fileName}` : null;
}

export async function removeEventRuleDirectory(eventId: string) {
  await rm(getEventRuleEventDirectory(eventId), { recursive: true, force: true });
}

export function extractLocalEventRuleFileName(eventId: string, resourceUrl: string) {
  if (!resourceUrl) return null;

  try {
    assertSafeStorageResourceId(eventId);
    const parsed = resourceUrl.startsWith("http://") || resourceUrl.startsWith("https://")
      ? new URL(resourceUrl)
      : new URL(resourceUrl, "http://local.acervo");
    const pathMatch = parsed.pathname.match(new RegExp(`^/events/${escapeRegExp(eventId)}/files/([^/]+)$`));
    if (!pathMatch?.[1]) return null;
    const fileName = decodeURIComponent(pathMatch[1]);
    return isSafeEventRuleFileName(fileName) ? fileName : null;
  } catch {
    return null;
  }
}
