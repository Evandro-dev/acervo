import { createReadStream } from "node:fs";
import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FastifyRequest } from "fastify";
import { env } from "../env.js";
import { slugify } from "./slug.js";
import { resolveUploadsDirectory } from "./uploads-directory.js";

const articlePdfDirectory = path.join(resolveUploadsDirectory(env.UPLOADS_DIRECTORY), "articles");

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

export function buildArticlePdfUrl(request: FastifyRequest, articleId: string) {
  return `${getRequestProtocol(request)}://${getRequestHost(request)}/articles/${articleId}/pdf`;
}

export function getArticlePdfPath(articleId: string) {
  return path.join(articlePdfDirectory, `${articleId}.pdf`);
}

export async function saveArticlePdf(articleId: string, data: Uint8Array) {
  await mkdir(articlePdfDirectory, { recursive: true });
  await writeFile(getArticlePdfPath(articleId), data);
}

export async function articlePdfExists(articleId: string) {
  try {
    await access(getArticlePdfPath(articleId));
    return true;
  } catch {
    return false;
  }
}

export async function removeArticlePdf(articleId: string) {
  try {
    await unlink(getArticlePdfPath(articleId));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
  }
}

export function createArticlePdfReadStream(articleId: string) {
  return createReadStream(getArticlePdfPath(articleId));
}

export function buildArticlePdfFileName(title: string) {
  return `${slugify(title) || "artigo"}.pdf`;
}
