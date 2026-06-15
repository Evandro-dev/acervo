import type { FastifyRequest } from "fastify";
import { assertPngBinary } from "../../lib/image-upload.js";
import { assertPdfBinary } from "../../lib/pdf-upload.js";
import { prisma } from "../../lib/prisma.js";
import { slugify } from "../../lib/slug.js";
import type { EventPayload } from "./events.schemas.js";

export async function resolveUniqueEventSlug(seed: string, currentId?: string) {
  const base = slugify(seed);
  const existing = await prisma.event.findMany({
    where: {
      slug: { startsWith: base },
      ...(currentId ? { NOT: { id: currentId } } : {}),
    },
    select: { slug: true },
  });

  const used = new Set(existing.map((item: { slug: string }) => item.slug));
  if (!used.has(base)) return base;

  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) {
    suffix += 1;
  }

  return `${base}-${suffix}`;
}

export function toEventData(input: EventPayload & { slug: string }) {
  return {
    slug: input.slug,
    title: input.title,
    edition: input.edition,
    year: input.year,
    date: input.date,
    area: input.area,
    type: input.type,
    coverUrl: input.coverUrl,
    presentation: input.presentation,
    themes: input.themes,
    committee: input.committee,
    rules: input.rules,
    previousEditions: input.previousEditions,
    contactEmail: input.contact.email,
    contactPhone: input.contact.phone,
    isbn: input.catalog.isbn,
    doi: input.catalog.doi,
    catalogText: input.catalog.text,
    catalogPdfUrl: input.catalog.pdfUrl,
    catalogImageUrl: input.catalog.imageUrl,
  };
}

export function getRemovedCoverResource(
  currentCoverUrl: string | null,
  nextCoverUrl?: string | null,
) {
  if (!currentCoverUrl || currentCoverUrl === nextCoverUrl) return null;
  return currentCoverUrl;
}

export function getRemovedOptionalResource(
  currentUrl: string | null,
  nextUrl?: string | null,
) {
  if (!currentUrl || currentUrl === nextUrl) return null;
  return currentUrl;
}

const MAX_CATALOG_PDF_SIZE_BYTES = 40 * 1024 * 1024;
const MAX_CATALOG_IMAGE_SIZE_BYTES = 12 * 1024 * 1024;
const CATALOG_IMAGE_MIME_TYPES = new Set(["image/png"]);

type MultipartFilePart = {
  type?: string;
  fieldname: string;
  filename: string;
  mimetype: string;
  file: AsyncIterable<Buffer | Uint8Array>;
};

type MultipartRequest = FastifyRequest & {
  parts: () => AsyncIterable<MultipartFilePart | Record<string, unknown>>;
};

function isMultipartFilePart(part: unknown): part is MultipartFilePart {
  const candidate = part as Partial<MultipartFilePart>;

  return (
    Boolean(candidate) &&
    candidate.type === "file" &&
    typeof candidate.fieldname === "string" &&
    typeof candidate.filename === "string" &&
    typeof candidate.mimetype === "string" &&
    Boolean(candidate.file)
  );
}

function isCatalogImageUpload(file: MultipartFilePart) {
  return (
    CATALOG_IMAGE_MIME_TYPES.has(file.mimetype) ||
    file.filename.toLowerCase().endsWith(".png")
  );
}

async function drainMultipartFile(file: MultipartFilePart) {
  for await (const _chunk of file.file) {
    // Descarta campos de arquivo que nao serao usados.
  }
}

function isCatalogPdfUpload(file: MultipartFilePart) {
  return (
    file.mimetype === "application/pdf" ||
    file.filename.toLowerCase().endsWith(".pdf")
  );
}

async function readValidatedCatalogPdfUpload(file: MultipartFilePart) {
  if (!isCatalogPdfUpload(file)) {
    throw new Error("A ficha catalografica precisa ser um PDF.");
  }

  const chunks: Buffer[] = [];
  let totalSize = 0;

  for await (const chunk of file.file) {
    const buffer = Buffer.from(chunk);
    totalSize += buffer.length;

    if (totalSize > MAX_CATALOG_PDF_SIZE_BYTES) {
      throw new Error("O PDF da ficha catalografica excede 40 MB.");
    }

    chunks.push(buffer);
  }

  const data = Buffer.concat(chunks);

  if (!data.length) {
    throw new Error("O PDF da ficha catalografica esta vazio.");
  }

  assertPdfBinary(data);

  return new Uint8Array(data);
}

async function readValidatedCatalogImageUpload(file: MultipartFilePart) {
  if (!isCatalogImageUpload(file)) {
    throw new Error("A imagem da ficha catalografica precisa ser PNG.");
  }

  const chunks: Buffer[] = [];
  let totalSize = 0;

  for await (const chunk of file.file) {
    const buffer = Buffer.from(chunk);
    totalSize += buffer.length;

    if (totalSize > MAX_CATALOG_IMAGE_SIZE_BYTES) {
      throw new Error("A imagem da ficha catalografica excede 12 MB.");
    }

    chunks.push(buffer);
  }

  const data = Buffer.concat(chunks);

  if (!data.length) {
    throw new Error("A imagem da ficha catalografica esta vazia.");
  }

  assertPngBinary(
    data,
    "A imagem da ficha catalografica precisa ser um PNG valido.",
  );

  return new Uint8Array(data);
}

export async function readCatalogUploadParts(req: FastifyRequest) {
  let pdfFileName = "";
  let imageFileName = "";
  let pdfData: Uint8Array | null = null;
  let imageData: Uint8Array | null = null;

  for await (const part of (req as MultipartRequest).parts()) {
    if (!isMultipartFilePart(part)) continue;

    if ((part.fieldname === "pdf" || part.fieldname === "file") && !pdfData) {
      pdfFileName = part.filename;
      pdfData = await readValidatedCatalogPdfUpload(part);
      continue;
    }

    if (part.fieldname === "image" && !imageData) {
      imageFileName = part.filename;
      imageData = await readValidatedCatalogImageUpload(part);
      continue;
    }

    await drainMultipartFile(part);
  }

  if (!pdfData) {
    throw new Error("Envie o PDF da ficha no campo 'pdf'.");
  }

  if (!imageData) {
    throw new Error("Envie a imagem PNG da ficha no campo 'image'.");
  }

  return {
    pdfFileName: pdfFileName || "ficha-catalografica.pdf",
    imageFileName: imageFileName || "ficha-catalografica.png",
    pdfData,
    imageData,
  };
}

export async function removeResourcesBestEffort(
  req: FastifyRequest,
  context: string,
  tasks: Array<Promise<unknown>>,
) {
  const results = await Promise.allSettled(tasks);

  for (const result of results) {
    if (result.status === "rejected") {
      req.log.error(
        { err: result.reason, context },
        "Falha ao remover arquivo antigo",
      );
    }
  }
}
