import type { MultipartFile } from "@fastify/multipart";
import { createInvalidPdfBinaryError, createInvalidPdfUploadError } from "./pdf-processing-errors.js";

export const PDF_UPLOAD_LIMIT_BYTES = 25 * 1024 * 1024;

const PDF_SIGNATURE = "%PDF-";
const PDF_SIGNATURE_SCAN_LIMIT = 1024;

export function isPdfFileUpload(file: Pick<MultipartFile, "mimetype" | "filename">) {
  return file.mimetype === "application/pdf" || file.filename.toLowerCase().endsWith(".pdf");
}

export function looksLikePdfBinary(data: Uint8Array) {
  if (!data.length) return false;

  const sample = data.subarray(0, Math.min(data.length, PDF_SIGNATURE_SCAN_LIMIT));
  const decoded = new TextDecoder("latin1").decode(sample);
  return decoded.includes(PDF_SIGNATURE);
}

export function assertPdfBinary(data: Uint8Array) {
  if (!looksLikePdfBinary(data)) {
    throw createInvalidPdfBinaryError();
  }
}

export async function readValidatedPdfUpload(file: MultipartFile) {
  if (!isPdfFileUpload(file)) {
    file.file.resume();
    throw createInvalidPdfUploadError("Apenas arquivos PDF sao permitidos.");
  }

  const data = new Uint8Array(await file.toBuffer());
  assertPdfBinary(data);
  return data;
}
