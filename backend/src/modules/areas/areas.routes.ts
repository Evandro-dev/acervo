import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { queryBooleanSchema } from "../../lib/query-boolean.js";

type AreaShape = {
  id: string;
  name: string;
};

const areaQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  includeEmpty: queryBooleanSchema,
});

export async function areaRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    const query = areaQuerySchema.parse(req.query ?? {});

    const areas: AreaShape[] = await prisma.area.findMany({
      where: {
        ...(query.q ? { name: { contains: query.q, mode: "insensitive" } } : {}),
      },
      orderBy: { name: "asc" },
    });

    const counts: Array<{ areaId: string | null; _count: { _all: number } }> =
      await prisma.article.groupBy({
        by: ["areaId"],
        where: {
          areaId: { not: null },
          status: "PUBLISHED",
        },
        _count: { _all: true },
      });

    const countByAreaId = new Map(
      counts
        .filter(
          (item): item is { areaId: string; _count: { _all: number } } =>
            typeof item.areaId === "string",
        )
        .map((item) => [item.areaId, item._count._all]),
    );

    return areas
      .map((area) => ({
        id: area.id,
        name: area.name,
        articleCount: countByAreaId.get(area.id) ?? 0,
      }))
      .filter((area) => query.includeEmpty || area.articleCount > 0)
      .sort(
        (left, right) =>
          right.articleCount - left.articleCount || left.name.localeCompare(right.name),
      );
  });
}
