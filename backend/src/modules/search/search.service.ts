/* eslint-disable @typescript-eslint/no-explicit-any */
import { normalizeCourseLookup } from "../courses/courses.service.js";
import { serializeArticle, serializeAuthorSummary, serializeEvent } from "../../lib/serializers.js";

export type GlobalSearchType = "article" | "event" | "author" | "area" | "course";

export type GlobalSearchResult = {
  id: string;
  type: GlobalSearchType;
  title: string;
  subtitle?: string;
  description?: string;
  href: string;
  matchedFields: string[];
};

export type GlobalSearchResponse = {
  query: string;
  total: number;
  groups: Record<GlobalSearchType, GlobalSearchResult[]>;
};

type SearchDatabase = {
  article: {
    findMany: (args: any) => Promise<any[]>;
  };
  event: {
    findMany: (args: any) => Promise<any[]>;
  };
  author: {
    findMany: (args: any) => Promise<any[]>;
  };
  area: {
    findMany: (args: any) => Promise<any[]>;
  };
  course: {
    findMany: (args: any) => Promise<any[]>;
  };
};

const RESULT_TYPES: GlobalSearchType[] = ["article", "event", "author", "area", "course"];
const DEFAULT_LIMIT_PER_TYPE = 5;
const MAX_LIMIT_PER_TYPE = 8;
const MIN_NORMALIZED_FALLBACK_TAKE = 40;
const MAX_NORMALIZED_FALLBACK_TAKE = 120;

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();
}

function includesNormalized(value: unknown, normalizedQuery: string) {
  if (typeof value !== "string") return false;
  return normalizeSearchText(value).includes(normalizedQuery);
}

function includesAnyNormalized(values: unknown[], normalizedQuery: string) {
  return values.some((value) => includesNormalized(value, normalizedQuery));
}

function compactMatchedFields(fields: Array<[string, unknown]>, normalizedQuery: string) {
  return fields
    .filter(([, value]) => includesNormalized(value, normalizedQuery))
    .map(([field]) => field)
    .slice(0, 4);
}

function rankResult(title: string, fields: unknown[], normalizedQuery: string) {
  const normalizedTitle = normalizeSearchText(title);
  if (normalizedTitle === normalizedQuery) return 0;
  if (normalizedTitle.startsWith(normalizedQuery)) return 1;
  if (normalizedTitle.includes(normalizedQuery)) return 2;
  return fields.some((field) => includesNormalized(field, normalizedQuery)) ? 3 : 4;
}

function sortByRelevance<T>(items: T[], getTitle: (item: T) => string, getFields: (item: T) => unknown[], query: string) {
  const normalizedQuery = normalizeSearchText(query);

  return [...items].sort((left, right) => {
    const leftRank = rankResult(getTitle(left), getFields(left), normalizedQuery);
    const rightRank = rankResult(getTitle(right), getFields(right), normalizedQuery);
    if (leftRank !== rightRank) return leftRank - rightRank;
    return getTitle(left).localeCompare(getTitle(right));
  });
}

function createEmptyGroups(): Record<GlobalSearchType, GlobalSearchResult[]> {
  return {
    article: [],
    event: [],
    author: [],
    area: [],
    course: [],
  };
}

function getNormalizedFallbackTake(limitPerType: number) {
  return Math.min(Math.max(limitPerType * 16, MIN_NORMALIZED_FALLBACK_TAKE), MAX_NORMALIZED_FALLBACK_TAKE);
}

function mergeUniqueById<T extends { id: string }>(primary: T[], fallback: T[]) {
  const seen = new Set<string>();
  const merged: T[] = [];

  for (const item of [...primary, ...fallback]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }

  return merged;
}

function getArticleHref(article: any) {
  const eventSlug = article.event?.slug ?? article.eventSlug ?? article.eventId;
  return eventSlug ? `/eventos/${eventSlug}/artigos/${article.id}` : `/publicacoes`;
}

function getArticleSearchFields(article: any) {
  return [
    article.title,
    article.abstract,
    article.area,
    article.externalId,
    article.event?.title,
    article.authors.map((item: any) => item.author.name).join(" "),
    article.courses.map((item: any) => item.course.name).join(" "),
  ];
}

function getEventSearchFields(event: any) {
  return [event.title, event.area, event.type, event.presentation, event.themes.join(" ")];
}

function getAuthorSearchFields(author: any) {
  return [author.name, author.articles.map((item: any) => item.article.area).join(" ")];
}

function mapArticleResult(article: any, query: string): GlobalSearchResult {
  const serialized = serializeArticle(article);
  const normalizedQuery = normalizeSearchText(query);
  const authors = serialized.authors.join(", ");
  const courses = serialized.courses.join(", ");

  return {
    id: serialized.id,
    type: "article",
    title: serialized.title,
    subtitle: [serialized.eventTitle, authors].filter(Boolean).join(" · "),
    description: serialized.abstract,
    href: getArticleHref(article),
    matchedFields: compactMatchedFields(
      [
        ["Título", serialized.title],
        ["Resumo", serialized.abstract],
        ["Autor", authors],
        ["Área", serialized.area],
        ["Curso", courses],
        ["Evento", serialized.eventTitle],
      ],
      normalizedQuery,
    ),
  };
}

function mapEventResult(event: any, query: string): GlobalSearchResult {
  const serialized = serializeEvent(event, { includeArticles: false });
  const normalizedQuery = normalizeSearchText(query);

  return {
    id: serialized.id,
    type: "event",
    title: serialized.title,
    subtitle: [serialized.date, serialized.type].filter(Boolean).join(" · "),
    description: serialized.presentation,
    href: `/eventos/${serialized.slug}`,
    matchedFields: compactMatchedFields(
      [
        ["Título", serialized.title],
        ["Apresentação", serialized.presentation],
        ["Área", serialized.area],
        ["Tema", serialized.themes.join(" ")],
        ["Tipo", serialized.type],
      ],
      normalizedQuery,
    ),
  };
}

function mapAuthorResult(author: any, query: string): GlobalSearchResult {
  const serialized = serializeAuthorSummary(author);
  const normalizedQuery = normalizeSearchText(query);
  const areas = Array.from(new Set(author.articles.map((item: any) => item.article.area))).sort().join(", ");
  const articleCount = author.articles.length;

  return {
    id: serialized.id,
    type: "author",
    title: serialized.name,
    subtitle: `${articleCount} ${articleCount === 1 ? "publicação" : "publicações"}`,
    description: areas,
    href: `/autores/${serialized.slug}`,
    matchedFields: compactMatchedFields(
      [
        ["Autor", serialized.name],
        ["Área", areas],
      ],
      normalizedQuery,
    ),
  };
}

function mapAreaResult(area: any, query: string): GlobalSearchResult {
  const normalizedQuery = normalizeSearchText(query);
  const articleCount = area._count?.articles ?? 0;

  return {
    id: area.id,
    type: "area",
    title: area.name,
    subtitle: `${articleCount} ${articleCount === 1 ? "publicação" : "publicações"}`,
    href: `/publicacoes?area=${encodeURIComponent(area.name)}`,
    matchedFields: compactMatchedFields([["Área", area.name]], normalizedQuery),
  };
}

function mapCourseResult(course: any, query: string): GlobalSearchResult {
  const normalizedQuery = normalizeSearchText(query);
  const articleCount = course._count?.articles ?? 0;

  return {
    id: course.id,
    type: "course",
    title: course.name,
    subtitle: `${articleCount} ${articleCount === 1 ? "publicação" : "publicações"}`,
    href: `/publicacoes?course=${encodeURIComponent(course.name)}`,
    matchedFields: compactMatchedFields([["Curso", course.name]], normalizedQuery),
  };
}

export async function searchAcervo(
  database: SearchDatabase,
  query: string,
  options?: { limitPerType?: number },
): Promise<GlobalSearchResponse> {
  const cleanedQuery = query.trim();
  const normalizedQuery = normalizeSearchText(cleanedQuery);
  const groups = createEmptyGroups();
  const limitPerType = Math.min(Math.max(options?.limitPerType ?? DEFAULT_LIMIT_PER_TYPE, 1), MAX_LIMIT_PER_TYPE);
  const fallbackTake = getNormalizedFallbackTake(limitPerType);

  if (normalizedQuery.length < 2) {
    return { query: cleanedQuery, total: 0, groups };
  }

  const articleInclude = {
    event: { select: { id: true, slug: true, title: true, year: true } },
    authors: { include: { author: true } },
    courses: { include: { course: true } },
  };
  const articleOrderBy = [{ publishedAt: "desc" as const }, { submittedAt: "desc" as const }];
  const eventInclude = { _count: { select: { articles: true } } };
  const eventOrderBy = [{ year: "desc" as const }, { title: "asc" as const }];
  const authorInclude = {
    articles: {
      where: { article: { status: "PUBLISHED" as const } },
      include: { article: { select: { area: true } } },
    },
  };
  const areaInclude = { _count: { select: { articles: { where: { status: "PUBLISHED" as const } } } } };
  const courseInclude = {
    _count: { select: { articles: { where: { article: { status: "PUBLISHED" as const } } } } },
  };

  let [articles, events, authors, areas, courses] = await Promise.all([
    database.article.findMany({
      where: {
        status: "PUBLISHED",
        OR: [
          { title: { contains: cleanedQuery, mode: "insensitive" } },
          { abstract: { contains: cleanedQuery, mode: "insensitive" } },
          { area: { contains: cleanedQuery, mode: "insensitive" } },
          { externalId: { contains: cleanedQuery, mode: "insensitive" } },
          { authors: { some: { author: { name: { contains: cleanedQuery, mode: "insensitive" } } } } },
          { courses: { some: { course: { name: { contains: cleanedQuery, mode: "insensitive" } } } } },
          { event: { title: { contains: cleanedQuery, mode: "insensitive" } } },
        ],
      },
      include: articleInclude,
      orderBy: articleOrderBy,
      take: limitPerType * 3,
    }),
    database.event.findMany({
      where: {
        OR: [
          { title: { contains: cleanedQuery, mode: "insensitive" } },
          { area: { contains: cleanedQuery, mode: "insensitive" } },
          { type: { contains: cleanedQuery, mode: "insensitive" } },
          { presentation: { contains: cleanedQuery, mode: "insensitive" } },
          { themes: { has: cleanedQuery } },
        ],
      },
      include: eventInclude,
      orderBy: eventOrderBy,
      take: limitPerType * 3,
    }),
    database.author.findMany({
      where: {
        articles: { some: { article: { status: "PUBLISHED" } } },
        name: { contains: cleanedQuery, mode: "insensitive" },
      },
      include: authorInclude,
      orderBy: { name: "asc" },
      take: limitPerType * 3,
    }),
    database.area.findMany({
      where: {
        name: { contains: query, mode: "insensitive" },
        articles: { some: { status: "PUBLISHED" } },
      },
      include: areaInclude,
      orderBy: { name: "asc" },
      take: limitPerType * 3,
    }),
    database.course.findMany({
      where: {
        OR: [
          { name: { contains: cleanedQuery, mode: "insensitive" } },
          { normalizedName: { contains: normalizeCourseLookup(cleanedQuery) } },
        ],
        articles: { some: { article: { status: "PUBLISHED" } } },
      },
      include: courseInclude,
      orderBy: { name: "asc" },
      take: limitPerType * 3,
    }),
  ]);

  const [articleFallback, eventFallback, authorFallback, areaFallback, courseFallback] = await Promise.all([
    articles.length >= limitPerType
      ? Promise.resolve([])
      : database.article.findMany({
          where: { status: "PUBLISHED" },
          include: articleInclude,
          orderBy: articleOrderBy,
          take: fallbackTake,
        }),
    events.length >= limitPerType
      ? Promise.resolve([])
      : database.event.findMany({
          include: eventInclude,
          orderBy: eventOrderBy,
          take: fallbackTake,
        }),
    authors.length >= limitPerType
      ? Promise.resolve([])
      : database.author.findMany({
          where: { articles: { some: { article: { status: "PUBLISHED" } } } },
          include: authorInclude,
          orderBy: { name: "asc" },
          take: fallbackTake,
        }),
    areas.length >= limitPerType
      ? Promise.resolve([])
      : database.area.findMany({
          where: { articles: { some: { status: "PUBLISHED" } } },
          include: areaInclude,
          orderBy: { name: "asc" },
          take: fallbackTake,
        }),
    courses.length >= limitPerType
      ? Promise.resolve([])
      : database.course.findMany({
          where: { articles: { some: { article: { status: "PUBLISHED" } } } },
          include: courseInclude,
          orderBy: { name: "asc" },
          take: fallbackTake,
        }),
  ]);

  articles = mergeUniqueById(
    articles,
    articleFallback.filter((article) => includesAnyNormalized(getArticleSearchFields(article), normalizedQuery)),
  );
  events = mergeUniqueById(
    events,
    eventFallback.filter((event) => includesAnyNormalized(getEventSearchFields(event), normalizedQuery)),
  );
  authors = mergeUniqueById(
    authors,
    authorFallback.filter((author) => includesAnyNormalized(getAuthorSearchFields(author), normalizedQuery)),
  );
  areas = mergeUniqueById(
    areas,
    areaFallback.filter((area) => includesAnyNormalized([area.name, area.normalizedName], normalizedQuery)),
  );
  courses = mergeUniqueById(
    courses,
    courseFallback.filter((course) => includesAnyNormalized([course.name, course.normalizedName], normalizedQuery)),
  );

  groups.article = sortByRelevance(
    articles,
    (article) => article.title,
    getArticleSearchFields,
    cleanedQuery,
  )
    .slice(0, limitPerType)
    .map((article) => mapArticleResult(article, cleanedQuery));
  groups.event = sortByRelevance(events, (event) => event.title, getEventSearchFields, cleanedQuery)
    .slice(0, limitPerType)
    .map((event) => mapEventResult(event, cleanedQuery));
  groups.author = sortByRelevance(authors, (author) => author.name, getAuthorSearchFields, cleanedQuery)
    .slice(0, limitPerType)
    .map((author) => mapAuthorResult(author, cleanedQuery));
  groups.area = sortByRelevance(areas, (area) => area.name, (area) => [area.normalizedName], cleanedQuery)
    .slice(0, limitPerType)
    .map((area) => mapAreaResult(area, cleanedQuery));
  groups.course = sortByRelevance(courses, (course) => course.name, (course) => [course.normalizedName], cleanedQuery)
    .slice(0, limitPerType)
    .map((course) => mapCourseResult(course, cleanedQuery));

  const total = RESULT_TYPES.reduce((sum, type) => sum + groups[type].length, 0);
  return { query: cleanedQuery, total, groups };
}
