import type { Prisma } from "../../generated/prisma/client.js";
import { z } from "zod";
import { eventTypeSchema } from "../../lib/contracts.js";
import { createPaginationQuerySchema } from "../../lib/pagination.js";
import { prisma } from "../../lib/prisma.js";
import {
  normalizeQueryStringArray,
  uniqueQueryValues,
} from "../../lib/query-array.js";

function normalizeOptionalSearch(value: unknown) {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();

  return trimmed || undefined;
}

const eventSearchQuerySchema = z.preprocess(
  normalizeOptionalSearch,
  z.string().min(1).max(200).optional(),
);

const eventYearQuerySchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.coerce.number().int().min(1900).max(3000).optional(),
);

const eventTypeFilterSchema = z.preprocess(
  normalizeQueryStringArray,
  z.array(eventTypeSchema),
);

const eventAreaFilterSchema = z.preprocess(
  normalizeQueryStringArray,
  z.array(z.string().trim().min(1).max(120)),
);

export const eventQuerySchema = z
  .object({
    q: eventSearchQuerySchema,
    year: eventYearQuerySchema,
    type: eventTypeFilterSchema.default([]),
    "type[]": eventTypeFilterSchema.default([]),
    area: eventAreaFilterSchema.default([]),
    "area[]": eventAreaFilterSchema.default([]),
    includeArticles: z.enum(["published", "all", "none"]).default("published"),
  })
  .extend(createPaginationQuerySchema({ defaultPageSize: 12 }).shape)
  .transform(({ "type[]": bracketTypes, "area[]": bracketAreas, ...query }) => ({
    ...query,
    type: uniqueQueryValues([...query.type, ...bracketTypes]),
    area: uniqueQueryValues([...query.area, ...bracketAreas]),
  }));

export type EventListQuery = z.infer<typeof eventQuerySchema>;

export const eventListOrderBy: Prisma.EventOrderByWithRelationInput[] = [
  { year: "desc" },
  { title: "asc" },
  { id: "asc" },
];

export function getEventInclude(includeArticles: "published" | "all" | "none") {
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
        { id: "asc" as const },
      ],
    },
  };
}

export function buildEventWhere(query: EventListQuery): Prisma.EventWhereInput {
  const conditions: Prisma.EventWhereInput[] = [];

  if (query.year) {
    conditions.push({ year: query.year });
  }

  if (query.type.length > 0) {
    conditions.push({
      type: {
        in: query.type,
      },
    });
  }

  if (query.area.length > 0) {
    conditions.push({
      OR: [
        {
          area: {
            in: query.area,
          },
        },
        {
          themes: {
            hasSome: query.area,
          },
        },
      ],
    });
  }

  if (query.q) {
    conditions.push({
      OR: [
        { title: { contains: query.q, mode: "insensitive" } },
        { area: { contains: query.q, mode: "insensitive" } },
        { type: { contains: query.q, mode: "insensitive" } },
        { presentation: { contains: query.q, mode: "insensitive" } },
        { themes: { has: query.q } },
      ],
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

export async function getEventDashboardSummary() {
  const [eventCount, articleStatusCounts] = await prisma.$transaction([
    prisma.event.count(),
    prisma.article.groupBy({
      by: ["status"],
      _count: {
        id: true,
      },
    }),
  ]);

  type ArticleStatusCount = {
    status: "PUBLISHED" | "DRAFT" | "ARCHIVED";
    _count: {
      id: number;
    };
  };

  const getArticleCount = (status: ArticleStatusCount["status"]) =>
    articleStatusCounts.find(
      (item: ArticleStatusCount) => item.status === status,
    )?._count.id ?? 0;

  return {
    eventCount,
    publishedCount: getArticleCount("PUBLISHED"),
    draftCount: getArticleCount("DRAFT"),
    archivedCount: getArticleCount("ARCHIVED"),
  };
}

export async function listEventOptions() {
  return prisma.event.findMany({
    orderBy: eventListOrderBy,
    select: {
      id: true,
      title: true,
      year: true,
      themes: true,
    },
  });
}
