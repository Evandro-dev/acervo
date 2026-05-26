import { createReadStream, createWriteStream } from "node:fs";
import { access, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { MultipartFile } from "@fastify/multipart";
import type { FastifyRequest } from "fastify";
import { env } from "../env.js";
import { slugify } from "./slug.js";

export const PDF_UPLOAD_LIMIT_BYTES = 25 * 1024 * 1024;

const articlePdfDirectory = path.resolve(process.cwd(), "uploads", "articles");

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

export async function saveArticlePdf(articleId: string, file: MultipartFile) {
  await mkdir(articlePdfDirectory, { recursive: true });
  await pipeline(file.file, createWriteStream(getArticlePdfPath(articleId)));
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

export function isPdfFileUpload(file: MultipartFile) {
  return file.mimetype === "application/pdf" || file.filename.toLowerCase().endsWith(".pdf");
}
