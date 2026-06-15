import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  createEventCatalogReadStream,
  eventCatalogFileExists,
  getEventCatalogContentType,
  getEventCatalogFileSize,
  isSafeEventCatalogFileName,
} from "../../lib/event-catalog-files.js";
import {
  createEventCoverImageReadStream,
  eventCoverImageExists,
  getEventCoverImageContentType,
  isSafeEventCoverImageFileName,
} from "../../lib/event-cover-images.js";
import {
  createEventRuleReadStream,
  eventRuleFileExists,
  findReplacementEventRuleFile,
  isSafeEventRuleFileName,
} from "../../lib/event-rule-files.js";
import { getEventRuleDocumentContentType } from "../../lib/event-rule-documents.js";
import { queryBooleanSchema } from "../../lib/query-boolean.js";
import { isSafeStorageResourceId } from "../../lib/storage-path.js";

const eventRuleFileQuerySchema = z.object({
  download: queryBooleanSchema,
});

type ParsedByteRange = { start: number; end: number } | "invalid" | null;

function decodeRouteFileName(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

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

function setCatalogFileHeaders(
  reply: FastifyReply,
  fileName: string,
  fileSize: number,
) {
  const contentType = getEventCatalogContentType(fileName);

  reply.header("Content-Type", contentType);
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("Cache-Control", "public, max-age=31536000, immutable");
  reply.header("Content-Disposition", buildInlineContentDisposition(fileName));

  if (contentType === "application/pdf") {
    reply.header("Accept-Ranges", "bytes");
  }

  reply.header("Content-Length", String(fileSize));
}

export async function eventFilesRoutes(app: FastifyInstance) {
  app.get("/:id/catalog/files/:fileName", async (req, reply) => {
    const { id, fileName } = req.params as { id: string; fileName: string };
    const decodedFileName = decodeRouteFileName(fileName);

    if (
      !isSafeStorageResourceId(id) ||
      !decodedFileName ||
      !isSafeEventCatalogFileName(decodedFileName)
    ) {
      return reply.status(400).send({ error: "Nome de arquivo inválido" });
    }

    if (!(await eventCatalogFileExists(id, decodedFileName))) {
      return reply.status(404).send({ error: "Arquivo não encontrado" });
    }

    const fileSize = await getEventCatalogFileSize(id, decodedFileName);
    const byteRange = parseByteRange(req.headers.range, fileSize);

    setCatalogFileHeaders(reply, decodedFileName, fileSize);

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
        .send(createEventCatalogReadStream(id, decodedFileName, byteRange));
    }

    return reply.send(createEventCatalogReadStream(id, decodedFileName));
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

    const fileSize = await getEventCatalogFileSize(decodedFileName);
    const byteRange = parseByteRange(req.headers.range, fileSize);

    setCatalogFileHeaders(reply, decodedFileName, fileSize);

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
}
