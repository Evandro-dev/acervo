/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { removeArticlePdf } from "../../lib/article-pdf.js";
import { extractCatalogPdfLayoutMetadata } from "../../lib/article-pdf-metadata.js";
import { assertPdfBinary, readValidatedPdfUpload } from "../../lib/pdf-upload.js";
import {
  createEventCatalogReadStream,
  eventCatalogFileExists,
  getEventCatalogContentType,
  getEventCatalogFileSize,
  isSafeEventCatalogFileName,
  removeEventCatalogResource,
  saveEventCatalogImage,
  saveEventCatalogPdf,
} from "../../lib/event-catalog-files.js";
import {
  buildEventCoverImageUrl,
  createEventCoverImageReadStream,
  eventCoverImageExists,
  getEventCoverImageContentType,
  isSafeEventCoverImageFileName,
  isEventCoverImageUpload,
  removeEventCoverResource,
  removeSavedEventCoverImage,
  saveEventCoverImage,
} from "../../lib/event-cover-images.js";
import {
  eventCatalogSchema,
  eventCommitteeSchema,
  eventContactSchema,
  eventPreviousEditionsSchema,
  eventRulesSchema,
  eventTypeSchema,
} from "../../lib/contracts.js";
import {
  buildEventRuleFileUrl,
  createEventRuleReadStream,
  eventRuleFileExists,
  findReplacementEventRuleFile,
  getEventRuleResourceKey,
  isSafeEventRuleFileName,
  removeEventRuleDirectory,
  removeEventRuleResource,
  saveEventRuleFile,
} from "../../lib/event-rule-files.js";
import {
  getEventRuleDocumentContentType,
  readValidatedEventRuleDocumentUpload,
} from "../../lib/event-rule-documents.js";
import {
  getRemovedEventRuleResources,
  parseStoredEventRules,
} from "../../lib/event-rules.js";
import { requirePrivilegedUser } from "../../lib/permissions.js";
import { prisma } from "../../lib/prisma.js";
import { queryBooleanSchema } from "../../lib/query-boolean.js";
import { serializeEvent } from "../../lib/serializers.js";
import { slugify } from "../../lib/slug.js";
import { isSafeStorageResourceId } from "../../lib/storage-path.js";
import { resolveUpdatedEventCoverUrl } from "./event-cover.policy.js";

const eventPayloadSchema = z.object({
  slug: z.string().min(2).max(160).optional(),
  title: z.string().min(2).max(200),
  edition: z.string().max(120).default(""),
  year: z.coerce.number().int().min(1900).max(3000),
  date: z.string().min(2).max(120),
  area: z.string().min(1).max(120),
  type: eventTypeSchema,
  coverUrl: z.string().url().nullable().optional(),
  presentation: z.string().min(10),
  themes: z.array(z.string().min(1).max(120)).default([]),
  committee: eventCommitteeSchema.default([]),
  rules: eventRulesSchema.default([]),
  previousEditions: eventPreviousEditionsSchema.default([]),
  contact: eventContactSchema,
  catalog: eventCatalogSchema.default({}),
});

const eventQuerySchema = z.object({
  q: z.string().trim().optional(),
  year: z.coerce.number().int().optional(),
  type: eventTypeSchema.optional(),
  area: z.string().trim().optional(),
  includeArticles: z.enum(["published", "all", "none"]).default("published"),
});

const eventRuleFileQuerySchema = z.object({
  download: queryBooleanSchema,
});

const eventRuleUploadCleanupSchema = z.object({
  fileUrl: z.string().trim().min(1).max(1_000),
});

function decodeRouteFileName(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

type ParsedByteRange = { start: number; end: number } | "invalid" | null;

function getFirstHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildInlineContentDisposition(fileName: string) {
  const fallbackFileName = fileName.replace(/[\\"]/g, "_");

  return `inline; filename="${fallbackFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function parseByteRange(
  rangeHeader: string | string[] | undefined,
  fileSize: number,
): ParsedByteRange {
  const header = getFirstHeaderValue(rangeHeader);
  if (!header?.startsWith("bytes=")) return null;

  const [rawRange] = header.slice("bytes=".length).split(",");
  if (!rawRange) return null;

  const [startRaw = "", endRaw = ""] = rawRange.trim().split("-");
  if (!startRaw && !endRaw) return "invalid";

  let start: number;
  let end: number;

  if (!startRaw) {
    const suffixLength = Number(endRaw);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return "invalid";

    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  } else {
    start = Number(startRaw);
    end = endRaw ? Number(endRaw) : fileSize - 1;

    if (!Number.isInteger(start) || !Number.isInteger(end)) return "invalid";
  }

  if (start < 0 || end < start || start >= fileSize) return "invalid";

  return {
    start,
    end: Math.min(end, fileSize - 1),
  };
}

async function resolveUniqueEventSlug(seed: string, currentId?: string) {
  const base = slugify(seed);
  const existing = await prisma.event.findMany({
    where: {
      slug: { startsWith: base },
      ...(currentId ? { NOT: { id: currentId } } : {}),
    },
    select: { slug: true },
  });

  const used = new Set(existing.map((item: any) => item.slug));
  if (!used.has(base)) return base;

  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) {
    suffix += 1;
  }

  return `${base}-${suffix}`;
}

function toEventData(
  input: z.infer<typeof eventPayloadSchema> & { slug: string },
) {
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

function getEventInclude(includeArticles: "published" | "all" | "none") {
  if (includeArticles === "none") {
    return { _count: { select: { articles: true } } };
  }

  return {
    articles: {
      where:
        includeArticles === "published"
          ? { status: "PUBLISHED" as const }
          : undefined,
      include: {
        authors: {
          include: {
            author: true,
          },
        },
        courses: {
          include: {
            course: true,
          },
        },
      },
      orderBy: [
        { publishedAt: "desc" as const },
        { submittedAt: "desc" as const },
      ],
    },
  };
}

function getRemovedCoverResource(
  currentCoverUrl: string | null,
  nextCoverUrl?: string | null,
) {
  if (!currentCoverUrl || currentCoverUrl === nextCoverUrl) return null;
  return currentCoverUrl;
}

function getRemovedOptionalResource(
  currentUrl: string | null,
  nextUrl?: string | null,
) {
  if (!currentUrl || currentUrl === nextUrl) return null;
  return currentUrl;
}

function buildCatalogImageFileName(fileName: string) {
  const baseName = fileName.replace(/\.pdf$/i, "").trim();

  return `${baseName || "ficha-catalografica"}.png`;
}

type CatalogPreviewImage = {
  data: Uint8Array;
  mimeType: string;
} | null | undefined;

function buildCatalogImagePreviewDataUrl(image: CatalogPreviewImage) {
  if (!image?.data) return undefined;

  return `data:${image.mimeType};base64,${Buffer.from(image.data).toString(
    "base64",
  )}`;
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
    throw new Error("A ficha catalográfica precisa ser um PDF.");
  }

  const chunks: Buffer[] = [];
  let totalSize = 0;

  for await (const chunk of file.file) {
    const buffer = Buffer.from(chunk);
    totalSize += buffer.length;

    if (totalSize > MAX_CATALOG_PDF_SIZE_BYTES) {
      throw new Error("O PDF da ficha catalográfica excede 40 MB.");
    }

    chunks.push(buffer);
  }

  const data = Buffer.concat(chunks);

  if (!data.length) {
    throw new Error("O PDF da ficha catalográfica está vazio.");
  }

  assertPdfBinary(data);

  return new Uint8Array(data);
}

async function readValidatedCatalogImageUpload(file: MultipartFilePart) {
  if (!isCatalogImageUpload(file)) {
    throw new Error("A imagem da ficha catalográfica precisa ser PNG.");
  }

  const chunks: Buffer[] = [];
  let totalSize = 0;

  for await (const chunk of file.file) {
    const buffer = Buffer.from(chunk);
    totalSize += buffer.length;

    if (totalSize > MAX_CATALOG_IMAGE_SIZE_BYTES) {
      throw new Error("A imagem da ficha catalográfica excede 12 MB.");
    }

    chunks.push(buffer);
  }

  const data = Buffer.concat(chunks);

  if (!data.length) {
    throw new Error("A imagem da ficha catalográfica está vazia.");
  }

  return new Uint8Array(data);
}

async function readCatalogUploadParts(req: FastifyRequest) {
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

async function removeResourcesBestEffort(
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

export async function eventRoutes(app: FastifyInstance) {
  app.get("/", async (req, reply) => {
    const query = eventQuerySchema.parse(req.query ?? {});

    if (query.includeArticles === "all") {
      const user = await requirePrivilegedUser(req, reply);
      if (!user) return;
    }

    const events = await prisma.event.findMany({
      where: {
        ...(query.year ? { year: query.year } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.area
          ? { OR: [{ area: query.area }, { themes: { has: query.area } }] }
          : {}),
      },
      orderBy: [{ year: "desc" }, { title: "asc" }],
      include: getEventInclude(query.includeArticles),
    });

    const filtered = query.q
      ? events.filter((event: any) =>
          `${event.title} ${event.area} ${event.presentation} ${event.themes.join(" ")}`
            .toLowerCase()
            .includes(query.q!.toLowerCase()),
        )
      : events;

    return filtered.map((event: any) =>
      serializeEvent(event, {
        includeArticles: query.includeArticles !== "none",
      }),
    );
  });

  app.get("/catalog/files/:fileName", async (req, reply) => {
    const { fileName } = req.params as { fileName: string };
    const decodedFileName = decodeRouteFileName(fileName);

    if (!decodedFileName || !isSafeEventCatalogFileName(decodedFileName)) {
      return reply.status(400).send({ error: "Nome de arquivo inválido" });
    }

    if (!(await eventCatalogFileExists(decodedFileName))) {
      return reply.status(404).send({ error: "Arquivo não encontrado" });
    }

    const contentType = getEventCatalogContentType(decodedFileName);
    const fileSize = await getEventCatalogFileSize(decodedFileName);
    const byteRange = parseByteRange(req.headers.range, fileSize);

    reply.header("Content-Type", contentType);
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Cache-Control", "public, max-age=31536000, immutable");

    if (contentType === "application/pdf") {
      reply.header("Content-Disposition", buildInlineContentDisposition(decodedFileName));
      reply.header("Accept-Ranges", "bytes");
    } else {
      reply.header("Content-Disposition", `attachment; filename="${decodedFileName}"`);
    }

    if (byteRange === "invalid") {
      return reply
        .status(416)
        .header("Content-Range", `bytes */${fileSize}`)
        .send();
    }

    if (byteRange) {
      const contentLength = byteRange.end - byteRange.start + 1;

      return reply
        .status(206)
        .header(
          "Content-Range",
          `bytes ${byteRange.start}-${byteRange.end}/${fileSize}`,
        )
        .header("Content-Length", String(contentLength))
        .send(createEventCatalogReadStream(decodedFileName, byteRange));
    }

    reply.header("Content-Length", String(fileSize));

    return reply.send(createEventCatalogReadStream(decodedFileName));
  });

  app.get("/:id/cover/:fileName", async (req, reply) => {
    const { id, fileName } = req.params as { id: string; fileName: string };
    const decodedFileName = decodeRouteFileName(fileName);

    if (
      !decodedFileName ||
      !isSafeStorageResourceId(id) ||
      !isSafeEventCoverImageFileName(decodedFileName)
    ) {
      return reply.status(400).send({ error: "Nome de imagem inválido" });
    }

    if (!(await eventCoverImageExists(id, decodedFileName))) {
      return reply.status(404).send({ error: "Imagem não encontrada" });
    }

    reply.header(
      "Content-Type",
      getEventCoverImageContentType(decodedFileName),
    );
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Cache-Control", "public, max-age=31536000, immutable");

    return reply.send(createEventCoverImageReadStream(id, decodedFileName));
  });

  app.get("/:id/files/:fileName", async (req, reply) => {
    const { id, fileName } = req.params as { id: string; fileName: string };
    const { download } = eventRuleFileQuerySchema.parse(req.query ?? {});
    const decodedFileName = decodeRouteFileName(fileName);
    if (!decodedFileName) {
      return reply.status(400).send({ error: "Nome de arquivo inválido" });
    }

    let readableFileName = decodedFileName;

    if (
      !isSafeStorageResourceId(id) ||
      !isSafeEventRuleFileName(decodedFileName)
    ) {
      return reply.status(400).send({ error: "Nome de arquivo inválido" });
    }

    if (!(await eventRuleFileExists(id, readableFileName))) {
      const replacementFileName = await findReplacementEventRuleFile(
        id,
        decodedFileName,
      );

      if (!replacementFileName) {
        return reply.status(404).send({ error: "Arquivo não encontrado" });
      }

      readableFileName = replacementFileName;
    }

    const contentType = getEventRuleDocumentContentType(readableFileName);
    reply.header("Content-Type", contentType);
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Cache-Control", "public, max-age=31536000, immutable");
    reply.header(
      "Content-Disposition",
      `${download || contentType !== "application/pdf" ? "attachment" : "inline"}; filename="${readableFileName}"`,
    );

    return reply.send(createEventRuleReadStream(id, readableFileName));
  });

  app.post("/:id/view", async (req, reply) => {
    const { id } = req.params as { id: string };
    const event = await prisma.event.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!event)
      return reply.status(404).send({ error: "Evento não encontrado" });

    await prisma.event.update({
      where: { id },
      data: {
        viewCount: { increment: 1 },
      },
    });

    return reply.status(204).send();
  });
  
  app.post(
    "/catalog/pdf-metadata",
    { preHandler: [app.requireRole("ADMIN", "COORDENADOR")] },
    async (req, reply) => {
      const file = await req.file();

      if (!file) {
        return reply.status(400).send({
          error: "Envie um arquivo PDF no campo 'file'",
        });
      }

      const pdfData = await readValidatedPdfUpload(file);
      const result = await extractCatalogPdfLayoutMetadata(pdfData);

      return reply.send({
        text: result.text,
        isbn: result.isbn,
        pageCount: result.pageCount,
        warnings: result.warnings,
      });
    },
  );

  app.get("/:idOrSlug", async (req, reply) => {
    const { idOrSlug } = req.params as { idOrSlug: string };
    const query = z
      .object({
        includeArticles: z.enum(["published", "all"]).default("published"),
      })
      .parse(req.query ?? {});

    if (query.includeArticles === "all") {
      const user = await requirePrivilegedUser(req, reply);
      if (!user) return;
    }

    const event = await prisma.event.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: getEventInclude(query.includeArticles),
    });

    if (!event)
      return reply.status(404).send({ error: "Evento não encontrado" });
    return serializeEvent(event);
  });

  app.post(
    "/",
    { preHandler: [app.requireRole("ADMIN", "COORDENADOR")] },
    async (req, reply) => {
      const payload = eventPayloadSchema.parse(req.body);
      const slug = await resolveUniqueEventSlug(
        payload.slug ?? `${payload.title}-${payload.year}`,
      );

      const event = await prisma.event.create({
        data: toEventData({ ...payload, slug }),
        include: getEventInclude("all"),
      });

      return reply.status(201).send(serializeEvent(event));
    },
  );

  app.post(
    "/:id/cover/upload",
    { preHandler: [app.requireRole("ADMIN", "COORDENADOR")] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const event = await prisma.event.findUnique({
        where: { id },
        select: { id: true, coverUrl: true },
      });
      if (!event)
        return reply.status(404).send({ error: "Evento não encontrado" });

      const file = await req.file();
      if (!file)
        return reply
          .status(400)
          .send({ error: "Envie uma imagem no campo 'file'" });

      if (!isEventCoverImageUpload(file)) {
        return reply
          .status(400)
          .send({
            error: "Apenas imagens JPG, PNG, WEBP ou GIF são permitidas",
          });
      }

      let upload: Awaited<ReturnType<typeof saveEventCoverImage>> | null = null;
      try {
        upload = await saveEventCoverImage(id, file);
        const coverUrl =
          upload.blobUrl ?? buildEventCoverImageUrl(req, id, upload.fileName);

        await prisma.event.update({
          where: { id },
          data: { coverUrl },
        });

        if (event.coverUrl && event.coverUrl !== coverUrl) {
          await removeResourcesBestEffort(req, "substituir capa do evento", [
            removeEventCoverResource(id, event.coverUrl),
          ]);
        }

        return reply.status(201).send({ coverUrl });
      } catch (error) {
        if (upload) {
          await removeResourcesBestEffort(
            req,
            "desfazer upload de capa sem registro",
            [removeSavedEventCoverImage(id, upload)],
          );
        }
        throw error;
      }
    },
  );

  app.post(
    "/:id/catalog/upload",
    { preHandler: [app.requireRole("ADMIN", "COORDENADOR")] },
    async (req, reply) => {
      const { id } = req.params as { id: string };

      if (!isSafeStorageResourceId(id)) {
        return reply
          .status(400)
          .send({ error: "Identificador de evento inválido" });
      }

      const event = await prisma.event.findUnique({
        where: { id },
        select: {
          id: true,
          catalogPdfUrl: true,
          catalogImageUrl: true,
        },
      });

      if (!event) {
        return reply.status(404).send({ error: "Evento não encontrado" });
      }

      let uploadParts: Awaited<ReturnType<typeof readCatalogUploadParts>>;

      try {
        uploadParts = await readCatalogUploadParts(req);
      } catch (error) {
        return reply.status(400).send({
          error:
            error instanceof Error
              ? error.message
              : "Não foi possível ler os arquivos da ficha catalográfica.",
        });
      }

      const result = await extractCatalogPdfLayoutMetadata(uploadParts.pdfData);
      let savedPdf: Awaited<ReturnType<typeof saveEventCatalogPdf>> | null =
        null;
      let savedImage: Awaited<ReturnType<typeof saveEventCatalogImage>> | null =
        null;

      try {
        savedPdf = await saveEventCatalogPdf(
          req,
          uploadParts.pdfFileName,
          uploadParts.pdfData,
        );
        savedImage = await saveEventCatalogImage(
          req,
          uploadParts.imageFileName,
          uploadParts.imageData,
        );

        const catalogPdfUrl = savedPdf.fileUrl;
        const catalogImageUrl = savedImage.fileUrl;

        await prisma.event.update({
          where: { id },
          data: {
            catalogPdfUrl,
            catalogImageUrl,
          },
        });

        await removeResourcesBestEffort(req, "substituir ficha catalografica", [
          ...(event.catalogPdfUrl && event.catalogPdfUrl !== catalogPdfUrl
            ? [removeEventCatalogResource(event.catalogPdfUrl)]
            : []),
          ...(event.catalogImageUrl && event.catalogImageUrl !== catalogImageUrl
            ? [removeEventCatalogResource(event.catalogImageUrl)]
            : []),
        ]);

        return reply.status(201).send({
          catalogPdfUrl,
          catalogImageUrl,
          text: result.text,
          isbn: result.isbn,
          pageCount: result.pageCount,
          warnings: result.warnings,
        });
      } catch (error) {
        await removeResourcesBestEffort(
          req,
          "desfazer upload de ficha catalografica sem registro",
          [
            ...(savedPdf ? [removeEventCatalogResource(savedPdf.fileUrl)] : []),
            ...(savedImage
              ? [removeEventCatalogResource(savedImage.fileUrl)]
              : []),
          ],
        );

        throw error;
      }
    },
  );

  app.post(
    "/:id/rules/upload",
    { preHandler: [app.requireRole("ADMIN", "COORDENADOR")] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const event = await prisma.event.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!event)
        return reply.status(404).send({ error: "Evento não encontrado" });

      const file = await req.file();
      if (!file)
        return reply
          .status(400)
          .send({
            error: "Envie um arquivo PDF, DOCX ou PPTX no campo 'file'",
          });

      const upload = await saveEventRuleFile(
        id,
        file.filename,
        await readValidatedEventRuleDocumentUpload(file),
      );
      return reply.status(201).send({
        fileUrl:
          upload.blobUrl ?? buildEventRuleFileUrl(req, id, upload.fileName),
      });
    },
  );

  app.delete(
    "/:id/rules/upload",
    { preHandler: [app.requireRole("ADMIN", "COORDENADOR")] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const { fileUrl } = eventRuleUploadCleanupSchema.parse(req.body);
      if (!isSafeStorageResourceId(id))
        return reply
          .status(400)
          .send({ error: "Identificador de evento inválido" });

      const event = await prisma.event.findUnique({
        where: { id },
        select: { id: true, rules: true },
      });
      if (!event)
        return reply.status(404).send({ error: "Evento não encontrado" });

      const resourceKey = getEventRuleResourceKey(id, fileUrl);
      if (!resourceKey)
        return reply.status(400).send({ error: "Arquivo de norma inválido" });

      const isAttached = parseStoredEventRules(event.rules).some(
        (rule) => getEventRuleResourceKey(id, rule.file) === resourceKey,
      );
      if (isAttached)
        return reply
          .status(409)
          .send({ error: "A norma já está vinculada ao evento" });

      await removeEventRuleResource(id, fileUrl);
      return reply.status(204).send();
    },
  );

  app.put(
    "/:id",
    { preHandler: [app.requireRole("ADMIN", "COORDENADOR")] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const payload = eventPayloadSchema.partial().parse(req.body);

      const current = await prisma.event.findUnique({ where: { id } });
      if (!current)
        return reply.status(404).send({ error: "Evento não encontrado" });

      const slug = payload.slug
        ? await resolveUniqueEventSlug(payload.slug, current.id)
        : current.slug;

      const incomingCatalog = payload.catalog ?? {};
      const hasIncomingCatalogPdfUrl = Object.prototype.hasOwnProperty.call(
        incomingCatalog,
        "pdfUrl",
      );
      const hasIncomingCatalogImageUrl = Object.prototype.hasOwnProperty.call(
        incomingCatalog,
        "imageUrl",
      );

      const merged = eventPayloadSchema.parse({
        slug,
        title: payload.title ?? current.title,
        edition: payload.edition ?? current.edition,
        year: payload.year ?? current.year,
        date: payload.date ?? current.date,
        area: payload.area ?? current.area,
        type: payload.type ?? current.type,
        coverUrl: resolveUpdatedEventCoverUrl(
          current.coverUrl,
          payload.coverUrl,
        ),
        presentation: payload.presentation ?? current.presentation,
        themes: payload.themes ?? current.themes,
        committee: payload.committee ?? current.committee ?? [],
        rules: payload.rules ?? parseStoredEventRules(current.rules),
        previousEditions:
          payload.previousEditions ?? current.previousEditions ?? [],
        contact: {
          email: payload.contact?.email ?? current.contactEmail,
          phone: payload.contact?.phone ?? current.contactPhone ?? undefined,
        },
        catalog: {
          isbn: payload.catalog?.isbn ?? current.isbn ?? undefined,
          doi: payload.catalog?.doi ?? current.doi ?? undefined,
          text: payload.catalog?.text ?? current.catalogText ?? undefined,
          pdfUrl: hasIncomingCatalogPdfUrl
            ? incomingCatalog.pdfUrl
            : current.catalogPdfUrl ?? undefined,
          imageUrl: hasIncomingCatalogImageUrl
            ? incomingCatalog.imageUrl
            : current.catalogImageUrl ?? undefined,
        },
      });

      const removedRuleResources = getRemovedEventRuleResources(
        current.rules,
        merged.rules,
        (resourceUrl) => getEventRuleResourceKey(current.id, resourceUrl),
      );
      const removedCoverResource = getRemovedCoverResource(
        current.coverUrl,
        merged.coverUrl,
      );
      const removedCatalogPdfResource = getRemovedOptionalResource(
        current.catalogPdfUrl,
        merged.catalog.pdfUrl,
      );
      const removedCatalogImageResource = getRemovedOptionalResource(
        current.catalogImageUrl,
        merged.catalog.imageUrl,
      );

      const event = await prisma.event.update({
        where: { id },
        data: toEventData({ ...merged, slug }),
        include: getEventInclude("all"),
      });

      await removeResourcesBestEffort(req, "atualizar arquivos do evento", [
        ...removedRuleResources.map((resourceUrl) =>
          removeEventRuleResource(current.id, resourceUrl),
        ),
        ...(removedCoverResource
          ? [removeEventCoverResource(current.id, removedCoverResource)]
          : []),
        ...(removedCatalogPdfResource
          ? [removeEventCatalogResource(removedCatalogPdfResource)]
          : []),
        ...(removedCatalogImageResource
          ? [removeEventCatalogResource(removedCatalogImageResource)]
          : []),
      ]);

      return serializeEvent(event);
    },
  );

  app.delete(
    "/:id",
    { preHandler: [app.requireRole("ADMIN")] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const event = await prisma.event.findUnique({
        where: { id },
        select: {
          id: true,
          coverUrl: true,
          catalogPdfUrl: true,
          catalogImageUrl: true,
          rules: true,
          articles: {
            select: { id: true, pdfUrl: true },
          },
        },
      });

      if (!event)
        return reply.status(404).send({ error: "Evento não encontrado" });

      await prisma.event.delete({ where: { id } });
      await removeResourcesBestEffort(req, "excluir arquivos do evento", [
        removeEventCoverResource(id, event.coverUrl),
        removeEventCatalogResource(event.catalogPdfUrl),
        removeEventCatalogResource(event.catalogImageUrl),
        ...parseStoredEventRules(event.rules).map((rule) =>
          removeEventRuleResource(id, rule.file),
        ),
        ...event.articles.map(
          (article: { id: string; pdfUrl: string | null }) =>
            removeArticlePdf(article.id, article.pdfUrl),
        ),
        removeEventRuleDirectory(id),
      ]);

      return reply.status(204).send();
    },
  );
}
