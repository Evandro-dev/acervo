import type { IncomingAuthorInput } from "../../lib/contracts.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { ensureArea, sanitizeAreaName } from "../areas/areas.service.js";
import { ensureAuthors } from "../authors/authors.service.js";
import {
  ensureCourses,
  normalizeCourseLookup,
  uniqueCourseNames,
} from "../courses/courses.service.js";

export const MAX_ARTICLE_IMPORT_ITEMS = 25;
export const ARTICLE_IMPORT_TRANSACTION_TIMEOUT_MS = 30_000;
export const ARTICLE_IMPORT_TRANSACTION_MAX_WAIT_MS = 10_000;

type ArticleImportItem = {
  title: string;
  abstract: string;
  area: string;
  courses: string[];
  authors: IncomingAuthorInput[];
  pages?: string;
  pdfUrl?: string;
  modality?: string;
  importedFrom?: string;
  externalId?: string;
  submittedAt?: Date;
  importedAt?: Date;
  publishedAt?: Date;
};

type ArticleImportOptions = {
  eventId: string;
  createdById: string;
  publishImmediately: boolean;
  items: ArticleImportItem[];
  include: Prisma.ArticleInclude;
};

type ResolvedAuthor = {
  id: string;
};

type ArticleImportDatabase = Parameters<typeof ensureCourses>[0] & {
  $transaction: (
    callback: (transaction: Parameters<typeof ensureCourses>[0]) => Promise<unknown[]>,
    options: { maxWait: number; timeout: number },
  ) => Promise<unknown[]>;
};

function normalizeAreaLookup(value: string) {
  return sanitizeAreaName(value).toLocaleLowerCase();
}

async function resolveAreas(database: ArticleImportDatabase, items: ArticleImportItem[]) {
  const areas = new Map<string, Awaited<ReturnType<typeof ensureArea>>>();

  for (const item of items) {
    const lookup = normalizeAreaLookup(item.area);
    if (!areas.has(lookup)) {
      areas.set(lookup, await ensureArea(database, item.area));
    }
  }

  return areas;
}

async function resolveCourses(database: ArticleImportDatabase, items: ArticleImportItem[]) {
  const courses = await ensureCourses(
    database,
    items.flatMap((item) => item.courses),
  );

  return new Map(courses.map((course) => [normalizeCourseLookup(course.name), course]));
}

export async function createImportedArticles(
  database: ArticleImportDatabase,
  options: ArticleImportOptions,
) {
  const now = new Date();
  const [areasByLookup, coursesByLookup] = await Promise.all([
    resolveAreas(database, options.items),
    resolveCourses(database, options.items),
  ]);
  const authorsByItem: ResolvedAuthor[][] = [];
  const status = options.publishImmediately ? ("PUBLISHED" as const) : ("DRAFT" as const);

  for (const item of options.items) {
    authorsByItem.push(await ensureAuthors(database, item.authors));
  }

  const articleCreates = options.items.map((item, itemIndex) => {
    const area = areasByLookup.get(normalizeAreaLookup(item.area));
    if (!area) throw new Error(`Area nao encontrada durante a importacao: ${item.area}`);

    const courses = uniqueCourseNames(item.courses).map((courseName) => {
      const course = coursesByLookup.get(normalizeCourseLookup(courseName));
      if (!course) throw new Error(`Curso nao encontrado durante a importacao: ${courseName}`);
      return course;
    });

    return {
      data: {
        title: item.title,
        abstract: item.abstract,
        area: sanitizeAreaName(area.name),
        areaId: area.id,
        pages: item.pages,
        pdfUrl: item.pdfUrl,
        eventId: options.eventId,
        modality: item.modality,
        importedFrom: item.importedFrom ?? "Importacao manual",
        externalId: item.externalId,
        status,
        submittedAt: item.submittedAt ?? now,
        importedAt: item.importedAt ?? now,
        publishedAt: options.publishImmediately ? item.publishedAt ?? now : item.publishedAt,
        createdById: options.createdById,
        authors: {
          create: authorsByItem[itemIndex].map((author, position) => ({
            authorId: author.id,
            position,
          })),
        },
        courses: {
          create: courses.map((course, position) => ({
            courseId: course.id,
            position,
          })),
        },
      },
      include: options.include,
    };
  });

  return database.$transaction(
    async (transaction) => {
      const articles = [];

      for (const create of articleCreates) {
        articles.push(await transaction.article.create(create));
      }

      return articles;
    },
    {
      maxWait: ARTICLE_IMPORT_TRANSACTION_MAX_WAIT_MS,
      timeout: ARTICLE_IMPORT_TRANSACTION_TIMEOUT_MS,
    },
  );
}
