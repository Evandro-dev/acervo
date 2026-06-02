import { createReadStream } from "node:fs";
import { access, mkdir, readdir, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { env } from "../env.js";
import { removePublicBlob, uploadPublicBlob } from "./public-blob-storage.js";
import { slugify } from "./slug.js";
import { resolveUploadsDirectory } from "./uploads-directory.js";

const eventRuleDirectory = path.join(resolveUploadsDirectory(env.UPLOADS_DIRECTORY), "events");

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
  return path.join(eventRuleDirectory, eventId);
}

export function getEventRuleFilePath(eventId: string, fileName: string) {
  return path.join(getEventRuleEventDirectory(eventId), fileName);
}

export function isSafeEventRuleFileName(fileName: string) {
  return fileName === path.basename(fileName) && !fileName.includes("..");
}

function getComparableEventRuleFileKey(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  if (extension !== ".pdf") return "";

  return path
    .basename(fileName, extension)
    .replace(/^\d+-/, "")
    .replace(/-[0-9a-f]{8}$/i, "");
}

function buildEventRuleFileName(originalFileName: string) {
  const extension = path.extname(originalFileName).toLowerCase() || ".pdf";
  const basename = path.basename(originalFileName, extension);
  const slug = slugify(basename) || "norma";
  return `${Date.now()}-${slug}-${randomUUID().slice(0, 8)}${extension === ".pdf" ? ".pdf" : extension}`;
}

export function buildEventRuleFileUrl(request: FastifyRequest, eventId: string, fileName: string) {
  const encodedFileName = encodeURIComponent(fileName);
  return `${getRequestProtocol(request)}://${getRequestHost(request)}/events/${eventId}/files/${encodedFileName}`;
}

export async function saveEventRuleFile(eventId: string, originalFileName: string, data: Uint8Array) {
  const fileName = buildEventRuleFileName(originalFileName);
  const blobUrl = await uploadPublicBlob(
    `acervo/events/${eventId}/rules/${fileName}`,
    Buffer.from(data),
    "application/pdf",
  );
  if (blobUrl) return { fileName, blobUrl };

  const targetDirectory = getEventRuleEventDirectory(eventId);

  await mkdir(targetDirectory, { recursive: true });
  await writeFile(getEventRuleFilePath(eventId, fileName), data);

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
  if (await removePublicBlob(resourceUrl)) return;

  const fileName = extractLocalEventRuleFileName(eventId, resourceUrl);
  if (fileName) await removeEventRuleFile(eventId, fileName);
}

export async function removeEventRuleDirectory(eventId: string) {
  await rm(getEventRuleEventDirectory(eventId), { recursive: true, force: true });
}

export function extractLocalEventRuleFileName(eventId: string, resourceUrl: string) {
  if (!resourceUrl) return null;

  try {
    const parsed = resourceUrl.startsWith("http://") || resourceUrl.startsWith("https://")
      ? new URL(resourceUrl)
      : new URL(resourceUrl, "http://local.acervo");
    const pathMatch = parsed.pathname.match(new RegExp(`^/events/${eventId}/files/([^/]+)$`));
    if (!pathMatch?.[1]) return null;
    return decodeURIComponent(pathMatch[1]);
  } catch {
    return null;
  }
}
