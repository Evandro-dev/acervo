/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  articlePdfExists,
  buildArticlePdfFileName,
  buildArticlePdfUrl,
  createArticlePdfReadStream,
  removeArticlePdf,
  saveArticlePdf,
} from "../../lib/article-pdf.js";
import { extractArticlePdfMetadataAnalysis } from "../../lib/article-pdf-metadata.js";
import { authorPayloadSchema, normalizeAuthorPayload } from "../../lib/contracts.js";
import { canManageArticle, getOptionalUser, isPrivilegedRole, requirePrivilegedUser } from "../../lib/permissions.js";
import { readValidatedPdfUpload } from "../../lib/pdf-upload.js";
import { prisma } from "../../lib/prisma.js";
import { isPrismaTransactionExpiredError } from "../../lib/prisma-errors.js";
import { queryBooleanSchema } from "../../lib/query-boolean.js";
import { serializeArticle } from "../../lib/serializers.js";
import { suggestAreaFromArticleText } from "../areas/area-suggestion.service.js";
import { ensureArea, sanitizeAreaName } from "../areas/areas.service.js";
import { ensureAuthors } from "../authors/authors.service.js";
import { ensureCourses, normalizeCourseLookup } from "../courses/courses.service.js";
import { suggestCoursesFromArticleText } from "../courses/course-suggestion.service.js";
import {
  createImportedArticles,
  MAX_ARTICLE_IMPORT_ITEMS,
} from "./article-import.service.js";

const articleStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);
const articleStatusQuerySchema = z.enum(["published", "draft", "archived", "all"]);
const articlePdfQuerySchema = z.object({
  download: queryBooleanSchema,
});
const articleMetadataQuerySchema = z.object({
  eventId: z.string().optional(),
});

const articlePayloadSchema = z.object({
  title: z.string().min(3).max(220),
  abstract: z.string().max(10000).default(""),
  area: z.string().min(1).max(120),
  courses: z.array(z.string().trim().min(2).max(160)).max(20).default([]),
  pages: z.string().max(40).optional(),
  pdfUrl: z.string().url().optional(),
  eventId: z.string(),
  authors: z.array(authorPayloadSchema).min(1),
  modality: z.string().max(120).optional(),
  importedFrom: z.string().max(120).optional(),
  externalId: z.string().max(120).optional(),
  status: articleStatusSchema.default("DRAFT"),
  submittedAt: z.coerce.date().optional(),
  importedAt: z.coerce.date().optional(),
  publishedAt: z.coerce.date().optional(),
});

const articleQuerySchema = z.object({
  status: articleStatusQuerySchema.default("published"),
  area: z.string().trim().optional(),
  course: z.string().trim().optional(),
  q: z.string().trim().optional(),
  eventId: z.string().optional(),
  author: z.string().trim().optional(),
});

function normalizeStatusQuery(status: z.infer<typeof articleStatusQuerySchema>) {
  switch (status) {
    case "draft":
      return "DRAFT" as const;
    case "archived":
      return "ARCHIVED" as const;
    case "published":
      return "PUBLISHED" as const;
    default:
      return undefined;
  }
}

function getArticleInclude() {
  return {
    event: {
      select: { id: true, slug: true, title: true, year: true },
    },
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
  };
}

async function resolveArticleArea(tx: any, area: string) {
  const areaRecord = await ensureArea(tx, area);

  return {
    area: sanitizeAreaName(areaRecord.name),
    areaId: areaRecord.id,
  };
}

async function removeArticlePdfBestEffort(req: FastifyRequest, articleId: string, resourceUrl?: string | null) {
  try {
    await removeArticlePdf(articleId, resourceUrl);
  } catch (error) {
    req.log.error({ err: error, articleId }, "Falha ao remover PDF antigo do trabalho");
  }
}

export async function articleRoutes(app: FastifyInstance) {
  app.get("/", async (req, reply) => {
    const query = articleQuerySchema.parse(req.query ?? {});
    const status = normalizeStatusQuery(query.status);

    if (query.status !== "published") {
      const user = await requirePrivilegedUser(req, reply);
      if (!user) return;
    }

    const articles = await prisma.article.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(query.area ? { area: query.area } : {}),
        ...(query.course
          ? {
              courses: {
                some: {
                  course: {
                    normalizedName: normalizeCourseLookup(query.course),
                  },
                },
              },
            }
          : {}),
        ...(query.eventId ? { eventId: query.eventId } : {}),
        ...(query.author
          ? {
              authors: {
                some: {
                  author: {
                    name: { contains: query.author, mode: "insensitive" },
                  },
                },
              },
            }
          : {}),
        ...(query.q
          ? {
              OR: [
                { title: { contains: query.q, mode: "insensitive" } },
                { abstract: { contains: query.q, mode: "insensitive" } },
                { externalId: { contains: query.q, mode: "insensitive" } },
                {
                  authors: {
                    some: {
                      author: {
                        name: { contains: query.q, mode: "insensitive" },
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: getArticleInclude(),
      orderBy: [{ publishedAt: "desc" }, { submittedAt: "desc" }],
    });

    return articles.map((article: any) => serializeArticle(article));
  });

  app.post(
    "/extract-metadata",
    { preHandler: [app.requireRole("ADMIN", "COORDENADOR")] },
    async (req, reply) => {
      const query = articleMetadataQuerySchema.parse(req.query ?? {});
      const file = await req.file();
      if (!file) return reply.status(400).send({ error: "Envie um arquivo PDF no campo 'file'" });

      const { metadata, suggestionText } = await extractArticlePdfMetadataAnalysis(
        await readValidatedPdfUpload(file),
      );
      const [areaSuggestion, courseSuggestion] = await Promise.all([
        suggestAreaFromArticleText({
          title: metadata.title,
          abstract: metadata.abstract,
          eventId: query.eventId,
        }),
        suggestCoursesFromArticleText({
          title: metadata.title,
          abstract: metadata.abstract,
          extractedText: suggestionText,
        }),
      ]);

      return reply.send({
        ...metadata,
        suggestedArea: areaSuggestion.suggestedArea,
        areaSuggestions: areaSuggestion.areaSuggestions,
        areaSuggestionConfidence: areaSuggestion.areaSuggestionConfidence,
        suggestedCourses: courseSuggestion.suggestedCourses,
        courseSuggestions: courseSuggestion.courseSuggestions,
        courseSuggestionConfidence: courseSuggestion.courseSuggestionConfidence,
        warnings: [
          ...metadata.warnings,
          ...areaSuggestion.warnings,
          ...courseSuggestion.warnings,
        ],
      });
    },
  );

  app.post("/:id/view", async (req, reply) => {
    const { id } = req.params as { id: string };
    const article = await prisma.article.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
      },
    });

    if (!article) return reply.status(404).send({ error: "Artigo não encontrado" });
    if (article.status === "DRAFT") {
      return reply.status(403).send({ error: "Visualização indisponível para rascunhos" });
    }

    await prisma.article.update({
      where: { id },
      data: {
        viewCount: { increment: 1 },
      },
    });

    return reply.status(204).send();
  });

  app.get("/:id/pdf", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { download } = articlePdfQuerySchema.parse(req.query ?? {});
    const article = await prisma.article.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        status: true,
        createdById: true,
        pdfUrl: true,
        downloadCount: true,
      },
    });

    if (!article?.pdfUrl) return reply.status(404).send({ error: "PDF não encontrado" });

    const user = await getOptionalUser(req);
    if (article.status !== "PUBLISHED" && !canManageArticle(user, article.createdById)) {
      return reply.status(403).send({ error: "Acesso negado" });
    }

    const isLocalPdf = article.pdfUrl.includes(`/articles/${article.id}/pdf`);

    if (isLocalPdf && (await articlePdfExists(article.id))) {
      if (download) {
        await prisma.article.update({
          where: { id: article.id },
          data: {
            downloadCount: { increment: 1 },
          },
        });
      }

      reply.header("Content-Type", "application/pdf");
      reply.header("X-Content-Type-Options", "nosniff");
      reply.header(
        "Content-Disposition",
        `${download ? "attachment" : "inline"}; filename="${buildArticlePdfFileName(article.title)}"`,
      );
      return reply.send(createArticlePdfReadStream(article.id));
    }

    if (isLocalPdf) {
      return reply.status(404).send({ error: "Arquivo PDF não foi encontrado no servidor" });
    }

    if (download) {
      await prisma.article.update({
        where: { id: article.id },
        data: {
          downloadCount: { increment: 1 },
        },
      });
    }

    return reply.redirect(article.pdfUrl);
  });

  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const article = await prisma.article.findUnique({
      where: { id },
      include: getArticleInclude(),
    });

    if (!article) return reply.status(404).send({ error: "Artigo não encontrado" });

    const user = await getOptionalUser(req);
    if (article.status !== "PUBLISHED" && !canManageArticle(user, article.createdById)) {
      return reply.status(403).send({ error: "Acesso negado" });
    }

    return serializeArticle(article);
  });

  app.post("/:id/pdf", { preHandler: [app.requireRole("ADMIN", "COORDENADOR")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const current = await prisma.article.findUnique({
      where: { id },
      include: getArticleInclude(),
    });

    if (!current) return reply.status(404).send({ error: "Artigo não encontrado" });

    const file = await req.file();
    if (!file) return reply.status(400).send({ error: "Envie um arquivo PDF no campo 'file'" });

    const uploadedBlobUrl = await saveArticlePdf(id, await readValidatedPdfUpload(file));
    const uploadedPdfUrl = uploadedBlobUrl ?? buildArticlePdfUrl(req, id);
    let updated;

    try {
      updated = await prisma.article.update({
        where: { id },
        data: {
          pdfUrl: uploadedPdfUrl,
        },
        include: getArticleInclude(),
      });
    } catch (error) {
      if (uploadedBlobUrl) await removeArticlePdfBestEffort(req, id, uploadedBlobUrl);
      throw error;
    }

    if (current.pdfUrl && current.pdfUrl !== uploadedPdfUrl) {
      await removeArticlePdfBestEffort(req, id, current.pdfUrl);
    }

    return reply.send(serializeArticle(updated));
  });

  app.post("/", { preHandler: [app.authenticate] }, async (req, reply) => {
    const payload = articlePayloadSchema.parse(req.body);
    const allowedStatus = isPrivilegedRole(req.user.role) ? payload.status : "DRAFT";

    const created = await prisma.$transaction(async (tx: any) => {
      const authors = await ensureAuthors(
        tx,
        payload.authors.map((author) => normalizeAuthorPayload(author)),
      );
      const area = await resolveArticleArea(tx, payload.area);
      const courses = await ensureCourses(tx, payload.courses);

      return tx.article.create({
        data: {
          title: payload.title,
          abstract: payload.abstract,
          area: area.area,
          areaId: area.areaId,
          pages: payload.pages,
          pdfUrl: payload.pdfUrl,
          eventId: payload.eventId,
          modality: payload.modality,
          importedFrom: payload.importedFrom,
          externalId: payload.externalId,
          status: allowedStatus,
          submittedAt: payload.submittedAt ?? new Date(),
          importedAt: payload.importedAt ?? (payload.importedFrom ? new Date() : null),
          publishedAt:
            allowedStatus === "PUBLISHED" ? payload.publishedAt ?? new Date() : payload.publishedAt,
          createdById: req.user.sub,
          authors: {
            create: authors.map((author, position) => ({
              authorId: author.id,
              position,
            })),
          },
          courses: {
            create: courses.map((course, position) => ({
              courseId: course.id,
              position,
            })),
          },
        },
        include: getArticleInclude(),
      });
    });

    return reply.status(201).send(serializeArticle(created));
  });

  app.put("/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = articlePayloadSchema.partial().parse(req.body);

    const current = await prisma.article.findUnique({
      where: { id },
      include: getArticleInclude(),
    });

    if (!current) return reply.status(404).send({ error: "Artigo não encontrado" });
    if (!canManageArticle(req.user, current.createdById)) {
      return reply.status(403).send({ error: "Acesso negado" });
    }

    if (payload.status && payload.status !== current.status && !isPrivilegedRole(req.user.role)) {
      return reply.status(403).send({ error: "Somente coordenação pode alterar o status" });
    }

    const nextStatus = payload.status ?? current.status;

    const updated = await prisma.$transaction(async (tx: any) => {
      const authors = payload.authors
        ? await ensureAuthors(
            tx,
            payload.authors.map((author) => normalizeAuthorPayload(author)),
          )
        : null;
      const area = payload.area ? await resolveArticleArea(tx, payload.area) : null;
      const courses = payload.courses ? await ensureCourses(tx, payload.courses) : null;

      return tx.article.update({
        where: { id },
        data: {
          title: payload.title,
          abstract: payload.abstract,
          area: area?.area,
          areaId: area?.areaId,
          pages: payload.pages,
          pdfUrl: payload.pdfUrl,
          eventId: payload.eventId,
          modality: payload.modality,
          importedFrom: payload.importedFrom,
          externalId: payload.externalId,
          submittedAt: payload.submittedAt,
          importedAt: payload.importedAt,
          status: nextStatus,
          publishedAt:
            nextStatus === "PUBLISHED"
              ? payload.publishedAt ?? current.publishedAt ?? new Date()
              : payload.publishedAt ?? current.publishedAt,
          ...(authors
            ? {
                authors: {
                  deleteMany: {},
                  create: authors.map((author, position) => ({
                    authorId: author.id,
                    position,
                  })),
                },
              }
            : {}),
          ...(courses
            ? {
                courses: {
                  deleteMany: {},
                  create: courses.map((course, position) => ({
                    courseId: course.id,
                    position,
                  })),
                },
              }
            : {}),
        },
        include: getArticleInclude(),
      });
    });

    return serializeArticle(updated);
  });

  app.patch("/:id/status", { preHandler: [app.requireRole("ADMIN", "COORDENADOR")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status } = z.object({ status: articleStatusSchema }).parse(req.body);

    const current = await prisma.article.findUnique({ where: { id } });
    if (!current) return reply.status(404).send({ error: "Artigo não encontrado" });

    const updated = await prisma.article.update({
      where: { id },
      data: {
        status,
        publishedAt: status === "PUBLISHED" ? current.publishedAt ?? new Date() : current.publishedAt,
      },
      include: getArticleInclude(),
    });

    return serializeArticle(updated);
  });

  app.delete("/:id", { preHandler: [app.requireRole("ADMIN", "COORDENADOR")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const article = await prisma.article.findUnique({ where: { id }, select: { id: true, pdfUrl: true } });
    if (!article) return reply.status(404).send({ error: "Artigo não encontrado" });

    await prisma.article.delete({ where: { id } });
    await removeArticlePdfBestEffort(req, id, article.pdfUrl);
    return reply.status(204).send();
  });

  app.post("/import", { preHandler: [app.requireRole("ADMIN", "COORDENADOR")] }, async (req, reply) => {
    const payload = z
      .object({
        eventId: z.string(),
        publishImmediately: z.boolean().default(false),
        items: z
          .array(articlePayloadSchema.omit({ eventId: true }))
          .min(1)
          .max(MAX_ARTICLE_IMPORT_ITEMS, `Envie no maximo ${MAX_ARTICLE_IMPORT_ITEMS} trabalhos por lote.`),
      })
      .parse(req.body);

    const event = await prisma.event.findUnique({
      where: { id: payload.eventId },
      select: { id: true },
    });
    if (!event) return reply.status(404).send({ error: "Evento não encontrado" });

    let created;
    try {
      created = await createImportedArticles(prisma, {
        eventId: payload.eventId,
        createdById: req.user.sub,
        publishImmediately: payload.publishImmediately,
        items: payload.items.map((item) => ({
          ...item,
          authors: item.authors.map((author) => normalizeAuthorPayload(author)),
        })),
        include: getArticleInclude(),
      });
    } catch (error) {
      if (isPrismaTransactionExpiredError(error)) {
        return reply.status(503).send({
          code: "ARTICLE_IMPORT_TIMEOUT",
          error: "A importacao demorou alem do esperado. Tente novamente com um lote menor.",
        });
      }

      throw error;
    }

    return reply.status(201).send({
      count: created.length,
      items: created.map((article: any) => serializeArticle(article)),
    });
  });
}
