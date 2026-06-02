/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { removeArticlePdf } from "../../lib/article-pdf.js";
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
  isSafeEventRuleFileName,
  removeEventRuleDirectory,
  removeEventRuleResource,
  saveEventRuleFile,
} from "../../lib/event-rule-files.js";
import {
  getEventRuleDocumentContentType,
  readValidatedEventRuleDocumentUpload,
} from "../../lib/event-rule-documents.js";
import { requirePrivilegedUser } from "../../lib/permissions.js";
import { prisma } from "../../lib/prisma.js";
import { queryBooleanSchema } from "../../lib/query-boolean.js";
import { serializeEvent } from "../../lib/serializers.js";
import { slugify } from "../../lib/slug.js";
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

function toEventData(input: z.infer<typeof eventPayloadSchema> & { slug: string }) {
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
    publisher: input.catalog.publisher,
    address: input.catalog.address,
  };
}

function getEventInclude(includeArticles: "published" | "all" | "none") {
  if (includeArticles === "none") {
    return { _count: { select: { articles: true } } };
  }

  return {
    articles: {
      where: includeArticles === "published" ? { status: "PUBLISHED" as const } : undefined,
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
      orderBy: [{ publishedAt: "desc" as const }, { submittedAt: "desc" as const }],
    },
  };
}

function parseStoredRules(value: unknown) {
  const parsed = eventRulesSchema.safeParse(value ?? []);
  return parsed.success ? parsed.data : [];
}

function getRemovedRuleResources(currentRules: unknown, nextRules: unknown) {
  const nextFiles = new Set(parseStoredRules(nextRules).map((rule) => rule.file));

  return parseStoredRules(currentRules)
    .map((rule) => rule.file)
    .filter((file) => !nextFiles.has(file));
}

function getRemovedCoverResource(currentCoverUrl: string | null, nextCoverUrl?: string | null) {
  if (!currentCoverUrl || currentCoverUrl === nextCoverUrl) return null;
  return currentCoverUrl;
}

async function removeResourcesBestEffort(req: FastifyRequest, context: string, tasks: Array<Promise<unknown>>) {
  const results = await Promise.allSettled(tasks);

  for (const result of results) {
    if (result.status === "rejected") {
      req.log.error({ err: result.reason, context }, "Falha ao remover arquivo antigo");
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
        ...(query.area ? { OR: [{ area: query.area }, { themes: { has: query.area } }] } : {}),
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
      serializeEvent(event, { includeArticles: query.includeArticles !== "none" }),
    );
  });

  app.get("/:id/cover/:fileName", async (req, reply) => {
    const { id, fileName } = req.params as { id: string; fileName: string };
    const decodedFileName = decodeURIComponent(fileName);

    if (!isSafeEventCoverImageFileName(decodedFileName)) {
      return reply.status(400).send({ error: "Nome de imagem inválido" });
    }

    if (!(await eventCoverImageExists(id, decodedFileName))) {
      return reply.status(404).send({ error: "Imagem não encontrada" });
    }

    reply.header("Content-Type", getEventCoverImageContentType(decodedFileName));
    reply.header("Cache-Control", "public, max-age=31536000, immutable");

    return reply.send(createEventCoverImageReadStream(id, decodedFileName));
  });

  app.get("/:id/files/:fileName", async (req, reply) => {
    const { id, fileName } = req.params as { id: string; fileName: string };
    const { download } = eventRuleFileQuerySchema.parse(req.query ?? {});
    const decodedFileName = decodeURIComponent(fileName);
    let readableFileName = decodedFileName;

    if (!isSafeEventRuleFileName(decodedFileName)) {
      return reply.status(400).send({ error: "Nome de arquivo inválido" });
    }

    if (!(await eventRuleFileExists(id, readableFileName))) {
      const replacementFileName = await findReplacementEventRuleFile(id, decodedFileName);

      if (!replacementFileName) {
        return reply.status(404).send({ error: "Arquivo não encontrado" });
      }

      readableFileName = replacementFileName;
    }

    const contentType = getEventRuleDocumentContentType(readableFileName);
    reply.header("Content-Type", contentType);
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

    if (!event) return reply.status(404).send({ error: "Evento não encontrado" });

    await prisma.event.update({
      where: { id },
      data: {
        viewCount: { increment: 1 },
      },
    });

    return reply.status(204).send();
  });

  app.get("/:idOrSlug", async (req, reply) => {
    const { idOrSlug } = req.params as { idOrSlug: string };
    const query = z
      .object({ includeArticles: z.enum(["published", "all"]).default("published") })
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

    if (!event) return reply.status(404).send({ error: "Evento não encontrado" });
    return serializeEvent(event);
  });

  app.post("/", { preHandler: [app.requireRole("ADMIN", "COORDENADOR")] }, async (req, reply) => {
    const payload = eventPayloadSchema.parse(req.body);
    const slug = await resolveUniqueEventSlug(payload.slug ?? `${payload.title}-${payload.year}`);

    const event = await prisma.event.create({
      data: toEventData({ ...payload, slug }),
      include: getEventInclude("all"),
    });

    return reply.status(201).send(serializeEvent(event));
  });

  app.post("/:id/cover/upload", { preHandler: [app.requireRole("ADMIN", "COORDENADOR")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const event = await prisma.event.findUnique({ where: { id }, select: { id: true, coverUrl: true } });
    if (!event) return reply.status(404).send({ error: "Evento não encontrado" });

    const file = await req.file();
    if (!file) return reply.status(400).send({ error: "Envie uma imagem no campo 'file'" });

    if (!isEventCoverImageUpload(file)) {
      return reply.status(400).send({ error: "Apenas imagens JPG, PNG, WEBP ou GIF são permitidas" });
    }

    let upload: Awaited<ReturnType<typeof saveEventCoverImage>> | null = null;
    try {
      upload = await saveEventCoverImage(id, file);
      const coverUrl = upload.blobUrl ?? buildEventCoverImageUrl(req, id, upload.fileName);

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
        await removeResourcesBestEffort(req, "desfazer upload de capa sem registro", [
          removeSavedEventCoverImage(id, upload),
        ]);
      }
      throw error;
    }
  });

  app.post("/:id/rules/upload", { preHandler: [app.requireRole("ADMIN", "COORDENADOR")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const event = await prisma.event.findUnique({ where: { id }, select: { id: true } });
    if (!event) return reply.status(404).send({ error: "Evento não encontrado" });

    const file = await req.file();
    if (!file) return reply.status(400).send({ error: "Envie um arquivo PDF, DOCX ou PPTX no campo 'file'" });

    const upload = await saveEventRuleFile(id, file.filename, await readValidatedEventRuleDocumentUpload(file));
    return reply.status(201).send({
      fileUrl: upload.blobUrl ?? buildEventRuleFileUrl(req, id, upload.fileName),
    });
  });

  app.put("/:id", { preHandler: [app.requireRole("ADMIN", "COORDENADOR")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = eventPayloadSchema.partial().parse(req.body);

    const current = await prisma.event.findUnique({ where: { id } });
    if (!current) return reply.status(404).send({ error: "Evento não encontrado" });

    const slug = payload.slug
      ? await resolveUniqueEventSlug(payload.slug, current.id)
      : current.slug;

    const merged = eventPayloadSchema.parse({
      slug,
      title: payload.title ?? current.title,
      edition: payload.edition ?? current.edition,
      year: payload.year ?? current.year,
      date: payload.date ?? current.date,
      area: payload.area ?? current.area,
      type: payload.type ?? current.type,
      coverUrl: resolveUpdatedEventCoverUrl(current.coverUrl, payload.coverUrl),
      presentation: payload.presentation ?? current.presentation,
      themes: payload.themes ?? current.themes,
      committee: payload.committee ?? current.committee ?? [],
      rules: payload.rules ?? current.rules ?? [],
      previousEditions: payload.previousEditions ?? current.previousEditions ?? [],
      contact: {
        email: payload.contact?.email ?? current.contactEmail,
        phone: payload.contact?.phone ?? current.contactPhone ?? undefined,
      },
      catalog: {
        isbn: payload.catalog?.isbn ?? current.isbn ?? undefined,
        doi: payload.catalog?.doi ?? current.doi ?? undefined,
        publisher: payload.catalog?.publisher ?? current.publisher ?? undefined,
        address: payload.catalog?.address ?? current.address ?? undefined,
      },
    });

    const removedRuleResources = getRemovedRuleResources(current.rules, merged.rules);
    const removedCoverResource = getRemovedCoverResource(current.coverUrl, merged.coverUrl);

    const event = await prisma.event.update({
      where: { id },
      data: toEventData({ ...merged, slug }),
      include: getEventInclude("all"),
    });

    await removeResourcesBestEffort(req, "atualizar arquivos do evento", [
      ...removedRuleResources.map((resourceUrl) => removeEventRuleResource(current.id, resourceUrl)),
      ...(removedCoverResource ? [removeEventCoverResource(current.id, removedCoverResource)] : []),
    ]);

    return serializeEvent(event);
  });

  app.delete("/:id", { preHandler: [app.requireRole("ADMIN")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const event = await prisma.event.findUnique({
      where: { id },
      select: {
        id: true,
        coverUrl: true,
        rules: true,
        articles: {
          select: { id: true, pdfUrl: true },
        },
      },
    });

    if (!event) return reply.status(404).send({ error: "Evento não encontrado" });

    await prisma.event.delete({ where: { id } });
    await removeResourcesBestEffort(req, "excluir arquivos do evento", [
      removeEventCoverResource(id, event.coverUrl),
      ...parseStoredRules(event.rules).map((rule) => removeEventRuleResource(id, rule.file)),
      ...event.articles.map((article: { id: string; pdfUrl: string | null }) =>
        removeArticlePdf(article.id, article.pdfUrl),
      ),
      removeEventRuleDirectory(id),
    ]);

    return reply.status(204).send();
  });
}
