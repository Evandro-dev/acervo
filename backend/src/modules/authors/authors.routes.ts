/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { serializeArticle, serializeAuthorSummary } from "../../lib/serializers.js";

export async function authorRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    const q = typeof (req.query as { q?: string } | undefined)?.q === "string"
      ? (req.query as { q?: string }).q?.trim()
      : undefined;

    const authors = await prisma.author.findMany({
      where: {
        articles: { some: { article: { status: "PUBLISHED" } } },
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
      include: {
        articles: {
          where: { article: { status: "PUBLISHED" } },
          include: {
            article: {
              select: {
                area: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return authors.map((author: any) => {
      const areas = Array.from(new Set(author.articles.map((item: any) => item.article.area))).sort();
      return {
        ...serializeAuthorSummary(author),
        articleCount: author.articles.length,
        areas,
      };
    });
  });

  app.get("/:idOrSlug", async (req, reply) => {
    const { idOrSlug } = req.params as { idOrSlug: string };
    const author = await prisma.author.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        articles: {
          where: { article: { status: "PUBLISHED" } },
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
              },
            },
          },
        },
      },
    });

    if (!author) return reply.status(404).send({ error: "Autor não encontrado" });

    const works = author.articles
      .map((item: any) => item.article)
      .sort((left: any, right: any) => {
        const rightDate = right.publishedAt?.getTime() ?? 0;
        const leftDate = left.publishedAt?.getTime() ?? 0;
        return rightDate - leftDate;
      })
      .map((article: any) => serializeArticle(article));

    return {
      ...serializeAuthorSummary(author),
      articleCount: works.length,
      areas: Array.from(new Set(works.map((work: any) => work.area))).sort(),
      works,
    };
  });
}
