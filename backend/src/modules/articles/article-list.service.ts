import type { Prisma } from "../../generated/prisma/client.js";
import { z } from "zod";
import {
  createPaginationQuerySchema,
} from "../../lib/pagination.js";
import { prisma } from "../../lib/prisma.js";
import {
  normalizeQueryStringArray,
  uniqueQueryValues,
} from "../../lib/query-array.js";
import { queryBooleanSchema } from "../../lib/query-boolean.js";
import { normalizeCourseLookup } from "../courses/courses.service.js";

const articleStatusQuerySchema = z.enum(["published", "draft", "archived", "all"]);
export const noModalityLabel = "Sem modalidade";

const articleSearchQuerySchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() || undefined : value),
  z.string().min(1).max(200).optional(),
);

const articleStringFilterSchema = z.preprocess(
  normalizeQueryStringArray,
  z.array(z.string().trim().min(1).max(200)),
);

const articleYearFilterSchema = z.preprocess(
  normalizeQueryStringArray,
  z.array(z.coerce.number().int().min(1900).max(3000)),
);

export const articleQuerySchema = z
  .object({
    status: articleStatusQuerySchema.default("published"),
    area: articleStringFilterSchema.default([]),
    "area[]": articleStringFilterSchema.default([]),
    course: articleStringFilterSchema.default([]),
    "course[]": articleStringFilterSchema.default([]),
    q: articleSearchQuerySchema,
    eventId: articleStringFilterSchema.default([]),
    "eventId[]": articleStringFilterSchema.default([]),
    eventYear: articleYearFilterSchema.default([]),
    "eventYear[]": articleYearFilterSchema.default([]),
    modality: articleStringFilterSchema.default([]),
    "modality[]": articleStringFilterSchema.default([]),
    hasPdf: queryBooleanSchema,
    author: z.string().trim().optional(),
  })
  .merge(createPaginationQuerySchema({ defaultPageSize: 12 }))
  .transform(
    ({
      "area[]": bracketAreas,
      "course[]": bracketCourses,
      "eventId[]": bracketEventIds,
      "eventYear[]": bracketEventYears,
      "modality[]": bracketModalities,
      ...query
    }) => ({
      ...query,
      area: uniqueQueryValues([...query.area, ...bracketAreas]),
      course: uniqueQueryValues([...query.course, ...bracketCourses]),
      eventId: uniqueQueryValues([...query.eventId, ...bracketEventIds]),
      eventYear: uniqueQueryValues([...query.eventYear, ...bracketEventYears]),
      modality: uniqueQueryValues([...query.modality, ...bracketModalities]),
    }),
  );

export type ArticleListQuery = z.infer<typeof articleQuerySchema>;

export const articleListOrderBy: Prisma.ArticleOrderByWithRelationInput[] = [
  { publishedAt: "desc" },
  { submittedAt: "desc" },
  { id: "asc" },
];

export function normalizeArticleStatusQuery(
  status: z.infer<typeof articleStatusQuerySchema>,
) {
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

export function getArticleInclude() {
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

export function buildArticleWhere(
  query: ArticleListQuery,
  status: ReturnType<typeof normalizeArticleStatusQuery>,
): Prisma.ArticleWhereInput {
  const conditions: Prisma.ArticleWhereInput[] = [];

  if (status) {
    conditions.push({ status });
  }

  if (query.area.length > 0) {
    conditions.push({ area: { in: query.area } });
  }

  if (query.course.length > 0) {
    conditions.push({
      courses: {
        some: {
          course: {
            normalizedName: {
              in: query.course.map((course) => normalizeCourseLookup(course)),
            },
          },
        },
      },
    });
  }

  if (query.eventId.length > 0) {
    conditions.push({ eventId: { in: query.eventId } });
  }

  if (query.eventYear.length > 0) {
    conditions.push({
      event: {
        year: {
          in: query.eventYear,
        },
      },
    });
  }

  if (query.modality.length > 0) {
    const modalityValues = query.modality.filter(
      (modality) => modality !== noModalityLabel,
    );
    const includesEmptyModality = query.modality.includes(noModalityLabel);
    const modalityConditions: Prisma.ArticleWhereInput[] = [
      ...(modalityValues.length > 0 ? [{ modality: { in: modalityValues } }] : []),
      ...(includesEmptyModality ? [{ modality: null }, { modality: "" }] : []),
    ];

    if (modalityConditions.length > 0) {
      conditions.push({ OR: modalityConditions });
    }
  }

  if (query.hasPdf) {
    conditions.push({
      pdfUrl: {
        not: null,
      },
    });
    conditions.push({
      NOT: {
        pdfUrl: "",
      },
    });
  }

  if (query.author) {
    conditions.push({
      authors: {
        some: {
          author: {
            name: { contains: query.author, mode: "insensitive" },
          },
        },
      },
    });
  }

  if (query.q) {
    conditions.push({
      OR: [
        { title: { contains: query.q, mode: "insensitive" } },
        { abstract: { contains: query.q, mode: "insensitive" } },
        { externalId: { contains: query.q, mode: "insensitive" } },
        { area: { contains: query.q, mode: "insensitive" } },
        { modality: { contains: query.q, mode: "insensitive" } },
        {
          event: {
            title: { contains: query.q, mode: "insensitive" },
          },
        },
        {
          courses: {
            some: {
              course: {
                name: { contains: query.q, mode: "insensitive" },
              },
            },
          },
        },
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
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

export async function listArticleOptions() {
  const [events, areas, modalities] = await prisma.$transaction([
    prisma.event.findMany({
      where: {
        articles: {
          some: {
            status: "PUBLISHED",
          },
        },
      },
      orderBy: [
        { year: "desc" },
        { title: "asc" },
        { id: "asc" },
      ],
      select: {
        id: true,
        title: true,
        year: true,
        themes: true,
      },
    }),
    prisma.article.findMany({
      where: {
        status: "PUBLISHED",
        area: {
          not: "",
        },
      },
      distinct: ["area"],
      orderBy: {
        area: "asc",
      },
      select: {
        area: true,
      },
    }),
    prisma.article.findMany({
      where: {
        status: "PUBLISHED",
      },
      distinct: ["modality"],
      select: {
        modality: true,
      },
    }),
  ]);

  return {
    events,
    areas: areas.map((item: { area: string }) => item.area),
    modalities: uniqueQueryValues<string>(
      modalities.map(
        (item: { modality: string | null }) =>
          item.modality?.trim() || noModalityLabel,
      ),
    ).sort((left, right) => left.localeCompare(right)),
    years: uniqueQueryValues<number>(
      events.map((event: { year: number }) => event.year),
    ).sort((left, right) => right - left),
  };
}
