import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { queryBooleanSchema } from "../../lib/query-boolean.js";

const courseQuerySchema = z.object({
  q: z.string().trim().max(160).optional(),
  includeEmpty: queryBooleanSchema,
});

export async function courseRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    const query = courseQuerySchema.parse(req.query ?? {});
    const courses = await prisma.course.findMany({
      where: {
        ...(query.q ? { name: { contains: query.q, mode: "insensitive" } } : {}),
      },
      orderBy: { name: "asc" },
    });
    const counts: Array<{ courseId: string; _count: { _all: number } }> = await prisma.articleCourse.groupBy({
      by: ["courseId"],
      where: {
        article: { status: "PUBLISHED" },
      },
      _count: { _all: true },
    });
    const countByCourseId = new Map(counts.map((item) => [item.courseId, item._count._all]));

    return courses
      .map((course: { id: string; name: string }) => ({
        id: course.id,
        name: course.name,
        articleCount: countByCourseId.get(course.id) ?? 0,
      }))
      .filter((course: { articleCount: number }) => query.includeEmpty || course.articleCount > 0)
      .sort(
        (left: { articleCount: number; name: string }, right: { articleCount: number; name: string }) =>
          right.articleCount - left.articleCount || left.name.localeCompare(right.name),
      );
  });
}
