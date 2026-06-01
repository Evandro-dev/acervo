import type { FastifyInstance } from "fastify";
import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { articleReportQuerySchema, buildArticleReportWhere } from "./article-report.filters.js";
import { exceedsArticleReportLimit, MAX_ARTICLE_REPORT_ITEMS } from "./article-report.policy.js";
import { buildArticleReportWorkbook } from "./article-report.workbook.js";

const articleReportInclude = {
  event: {
    select: { title: true, year: true },
  },
  authors: {
    include: {
      author: {
        select: { name: true },
      },
    },
  },
  courses: {
    include: {
      course: {
        select: { name: true },
      },
    },
  },
} satisfies Prisma.ArticleInclude;

type ArticleReportRecord = Prisma.ArticleGetPayload<{ include: typeof articleReportInclude }>;

export async function reportRoutes(app: FastifyInstance) {
  app.get("/articles.xlsx", { preHandler: [app.requireRole("ADMIN", "COORDENADOR")] }, async (req, reply) => {
    const filters = articleReportQuerySchema.parse(req.query ?? {});
    const [articles, selectedEvent] = await Promise.all([
      prisma.article.findMany({
        where: buildArticleReportWhere(filters),
        include: articleReportInclude,
        orderBy: [{ submittedAt: "desc" }, { title: "asc" }],
        take: MAX_ARTICLE_REPORT_ITEMS + 1,
      }),
      filters.eventId
        ? prisma.event.findUnique({
            where: { id: filters.eventId },
            select: { title: true },
          })
        : null,
    ]);

    if (exceedsArticleReportLimit(articles.length)) {
      return reply.status(422).send({
        code: "REPORT_TOO_LARGE",
        error: `O relatório excede ${MAX_ARTICLE_REPORT_ITEMS} trabalhos. Aplique filtros antes de exportar.`,
      });
    }

    const workbook = await buildArticleReportWorkbook({
      filters,
      filterLabels: {
        event: selectedEvent?.title,
      },
      items: articles.map((article: ArticleReportRecord) => ({
        title: article.title,
        authors: [...article.authors]
          .sort((left, right) => left.position - right.position)
          .map((item) => item.author.name),
        area: article.area,
        courses: [...article.courses]
          .sort((left, right) => left.position - right.position)
          .map((item) => item.course.name),
        eventTitle: article.event.title,
        eventYear: article.event.year,
        modality: article.modality,
        status: article.status,
        pages: article.pages,
        pdfUrl: article.pdfUrl,
        submittedAt: article.submittedAt,
        importedAt: article.importedAt,
        publishedAt: article.publishedAt,
      })),
    });

    reply.header("Cache-Control", "no-store");
    reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    reply.header("Content-Disposition", `attachment; filename="relatorio-acervo-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    return reply.send(workbook);
  });
}
