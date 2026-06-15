import type { FastifyInstance } from "fastify";
import type { Prisma } from "../../generated/prisma/client.js";
import { z } from "zod";
import {
  createPaginatedResponse,
  createPaginationQuerySchema,
  getPaginationParams,
} from "../../lib/pagination.js";
import { prisma } from "../../lib/prisma.js";
import {
  normalizeQueryStringArray,
  uniqueQueryValues,
} from "../../lib/query-array.js";
import {
  serializeArticle,
  serializeAuthorSummary,
} from "../../lib/serializers.js";

const authorPaginationQuerySchema = createPaginationQuerySchema({
  defaultPageSize: 20,
});

const authorAreaFilterSchema = z.preprocess(
  normalizeQueryStringArray,
  z.array(z.string().trim().min(1).max(120)),
);

const authorQuerySchema = z
  .object({
    q: z.string().trim().optional(),
    area: authorAreaFilterSchema.default([]),
    "area[]": authorAreaFilterSchema.default([]),
  })
  .extend(authorPaginationQuerySchema.shape)
  .transform(({ "area[]": bracketAreas, ...query }) => ({
    ...query,
    area: uniqueQueryValues([...query.area, ...bracketAreas]),
  }));

type AuthorListQuery = z.infer<typeof authorQuerySchema>;

const publishedAuthorArticlesWhere = {
  article: { status: "PUBLISHED" as const },
} satisfies Prisma.ArticleAuthorWhereInput;

const authorListOrderBy: Prisma.AuthorOrderByWithRelationInput[] = [
  { name: "asc" },
  { id: "asc" },
];

const authorListSelect = {
  id: true,
  slug: true,
  name: true,
  bio: true,
  area: true,
  avatarUrl: true,
  articles: {
    where: publishedAuthorArticlesWhere,
    select: {
      article: {
        select: {
          area: true,
        },
      },
    },
  },
} satisfies Prisma.AuthorSelect;

const authorDetailInclude = {
  articles: {
    where: publishedAuthorArticlesWhere,
    include: {
      article: {
        include: {
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
        },
      },
    },
  },
} satisfies Prisma.AuthorInclude;

type AuthorListItem = Prisma.AuthorGetPayload<{
  select: typeof authorListSelect;
}>;

type AuthorDetail = Prisma.AuthorGetPayload<{
  include: typeof authorDetailInclude;
}>;

type AuthorArticleRelation = AuthorDetail["articles"][number];
type AuthorWork = AuthorArticleRelation["article"];

function buildAuthorWhere(query: AuthorListQuery): Prisma.AuthorWhereInput {
  const search = query.q?.trim();
  const conditions: Prisma.AuthorWhereInput[] = [
    { articles: { some: publishedAuthorArticlesWhere } },
  ];

  if (search) {
    conditions.push({
      name: {
        contains: search,
        mode: "insensitive",
      },
    });
  }

  if (query.area.length > 0) {
    conditions.push({
      articles: {
        some: {
          article: {
            status: "PUBLISHED",
            area: {
              in: query.area,
            },
          },
        },
      },
    });
  }

  return { AND: conditions };
}

function getUniqueSortedAreas(areas: Array<string | null | undefined>) {
  return Array.from(new Set(areas.filter(Boolean) as string[])).sort(
    (left, right) => left.localeCompare(right),
  );
}

function serializeAuthorListItem(author: AuthorListItem) {
  return {
    ...serializeAuthorSummary(author),
    articleCount: author.articles.length,
    areas: getUniqueSortedAreas(
      author.articles.map((item) => item.article.area),
    ),
  };
}

export async function authorRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    const query = authorQuerySchema.parse(req.query ?? {});
    const pagination = getPaginationParams(query);
    const where = buildAuthorWhere(query);

    const [total, authors] = (await prisma.$transaction([
      prisma.author.count({ where }),
      prisma.author.findMany({
        where,
        select: authorListSelect,
        orderBy: authorListOrderBy,
        skip: pagination.skip,
        take: pagination.take,
      }),
    ])) as [number, AuthorListItem[]];

    return createPaginatedResponse(
      authors.map((author: AuthorListItem) => serializeAuthorListItem(author)),
      total,
      pagination,
    );
  });

  app.get("/:idOrSlug", async (req, reply) => {
    const { idOrSlug } = req.params as { idOrSlug: string };
    const author = (await prisma.author.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: authorDetailInclude,
    })) as AuthorDetail | null;

    if (!author) {
      return reply.status(404).send({ error: "Autor não encontrado" });
    }

    const works = author.articles
      .map((item: AuthorArticleRelation) => item.article)
      .sort((left: AuthorWork, right: AuthorWork) => {
        const rightDate = right.publishedAt?.getTime() ?? 0;
        const leftDate = left.publishedAt?.getTime() ?? 0;

        if (rightDate !== leftDate) return rightDate - leftDate;

        return left.title.localeCompare(right.title);
      })
      .map((article: AuthorWork) => serializeArticle(article));

    return {
      ...serializeAuthorSummary(author),
      articleCount: works.length,
      areas: getUniqueSortedAreas(
        works.map((work: { area?: string | null }) => work.area),
      ),
      works,
    };
  });
}
