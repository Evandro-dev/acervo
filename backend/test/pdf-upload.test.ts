import assert from "node:assert/strict";
import test from "node:test";
import { createInvalidPdfBinaryError, mapPdfParserError, PdfProcessingError } from "../src/lib/pdf-processing-errors.js";
import { assertPdfBinary, looksLikePdfBinary } from "../src/lib/pdf-upload.js";
import { createPdfDocument } from "./helpers/create-pdf.js";

test("recognizes a real PDF signature from generated binary data", async () => {
  const pdf = await createPdfDocument([["Teste simples de assinatura PDF"]]);
  assert.equal(looksLikePdfBinary(pdf), true);
});

test("rejects binary content that does not look like a PDF", () => {
  assert.throws(
    () => assertPdfBinary(new Uint8Array(Buffer.from("arquivo de texto disfarçado"))),
    (error: unknown) =>
      error instanceof PdfProcessingError &&
      error.code === createInvalidPdfBinaryError().code &&
      /nao parece ser um PDF valido/i.test(error.message),
  );
});

test("maps password-protected parser failures to a friendly domain error", () => {
  const rawError = Object.assign(new Error("Password required"), { name: "PasswordException" });
  const mapped = mapPdfParserError(rawError);

  assert(mapped instanceof PdfProcessingError);
  assert.equal(mapped.code, "PDF_PASSWORD_REQUIRED");
  assert.equal(mapped.statusCode, 422);
});
