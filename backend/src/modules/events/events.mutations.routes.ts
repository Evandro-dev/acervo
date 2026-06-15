/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FastifyInstance } from "fastify";
import { removeArticlePdf } from "../../lib/article-pdf.js";
import { extractCatalogPdfLayoutMetadata } from "../../lib/article-pdf-metadata.js";
import { readValidatedPdfUpload } from "../../lib/pdf-upload.js";
import {
  removeEventCatalogResource,
  saveEventCatalogImage,
  saveEventCatalogPdf,
} from "../../lib/event-catalog-files.js";
import {
  buildEventCoverImageUrl,
  isEventCoverImageUpload,
  removeEventCoverResource,
  removeSavedEventCoverImage,
  saveEventCoverImage,
} from "../../lib/event-cover-images.js";
import {
  buildEventRuleFileUrl,
  getEventRuleResourceKey,
  removeEventRuleDirectory,
  removeEventRuleResource,
  saveEventRuleFile,
} from "../../lib/event-rule-files.js";
import {
  readValidatedEventRuleDocumentUpload,
} from "../../lib/event-rule-documents.js";
import {
  getRemovedEventRuleResources,
  parseStoredEventRules,
} from "../../lib/event-rules.js";
import { prisma } from "../../lib/prisma.js";
import { serializeEvent } from "../../lib/serializers.js";
import { isSafeStorageResourceId } from "../../lib/storage-path.js";
import { resolveUpdatedEventCoverUrl } from "./event-cover.policy.js";
import { getEventInclude } from "./event-list.service.js";
import {
  eventPayloadSchema,
  eventRuleUploadCleanupSchema,
} from "./events.schemas.js";
import {
  getRemovedCoverResource,
  getRemovedOptionalResource,
  readCatalogUploadParts,
  removeResourcesBestEffort,
  resolveUniqueEventSlug,
  toEventData,
} from "./events.service.js";

export async function eventMutationRoutes(app: FastifyInstance) {
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
          id,
          uploadParts.pdfFileName,
          uploadParts.pdfData,
        );
        savedImage = await saveEventCatalogImage(
          req,
          id,
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
            ? [removeEventCatalogResource(id, event.catalogPdfUrl)]
            : []),
          ...(event.catalogImageUrl && event.catalogImageUrl !== catalogImageUrl
            ? [removeEventCatalogResource(id, event.catalogImageUrl)]
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
            ...(savedPdf ? [removeEventCatalogResource(id, savedPdf.fileUrl)] : []),
            ...(savedImage
              ? [removeEventCatalogResource(id, savedImage.fileUrl)]
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
          ? [removeEventCatalogResource(current.id, removedCatalogPdfResource)]
          : []),
        ...(removedCatalogImageResource
          ? [removeEventCatalogResource(current.id, removedCatalogImageResource)]
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
        removeEventCatalogResource(id, event.catalogPdfUrl),
        removeEventCatalogResource(id, event.catalogImageUrl),
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