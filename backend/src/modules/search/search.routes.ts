import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { searchAcervo } from "./search.service.js";

const globalSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
  limit: z.coerce.number().int().min(1).max(8).default(5),
});

export async function searchRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    const query = globalSearchQuerySchema.parse(req.query ?? {});

    return searchAcervo(prisma, query.q, { limitPerType: query.limit });
  });
}
