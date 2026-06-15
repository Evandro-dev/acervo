import assert from "node:assert/strict";
import test from "node:test";
import type { FastifyRequest } from "fastify";

const validPdfData = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF");
const validPngData = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);

type FakeMultipartFile = {
  type: "file";
  fieldname: string;
  filename: string;
  mimetype: string;
  file: AsyncIterable<Buffer>;
};

function filePart(
  fieldname: string,
  filename: string,
  mimetype: string,
  data: Buffer,
): FakeMultipartFile {
  return {
    type: "file",
    fieldname,
    filename,
    mimetype,
    file: (async function* streamChunks() {
      yield data;
    })(),
  };
}

function multipartRequest(parts: FakeMultipartFile[]) {
  return {
    parts: async function* readParts() {
      yield* parts;
    },
  } as unknown as FastifyRequest;
}

async function getReadCatalogUploadParts() {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/acervo";

  const { readCatalogUploadParts } = await import(
    "../src/modules/events/events.service.js"
  );

  return readCatalogUploadParts;
}

test("reads validated catalog PDF and generated PNG image uploads", async () => {
  const readCatalogUploadParts = await getReadCatalogUploadParts();
  const result = await readCatalogUploadParts(
    multipartRequest([
      filePart("pdf", "ficha.pdf", "application/pdf", validPdfData),
      filePart("image", "ficha.png", "image/png", validPngData),
    ]),
  );

  assert.equal(result.pdfFileName, "ficha.pdf");
  assert.equal(result.imageFileName, "ficha.png");
  assert.deepEqual(Buffer.from(result.pdfData), validPdfData);
  assert.deepEqual(Buffer.from(result.imageData), validPngData);
});

test("rejects catalog image uploads that only pretend to be PNG files", async () => {
  const readCatalogUploadParts = await getReadCatalogUploadParts();

  await assert.rejects(
    readCatalogUploadParts(
      multipartRequest([
        filePart("pdf", "ficha.pdf", "application/pdf", validPdfData),
        filePart("image", "ficha.png", "image/png", Buffer.from("not a png")),
      ]),
    ),
    /imagem da ficha catalografica precisa ser um PNG valido/i,
  );
});
