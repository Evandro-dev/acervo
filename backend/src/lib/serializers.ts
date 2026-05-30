import { z } from "zod";
import { eventCommitteeSchema, eventPreviousEditionsSchema, eventRulesSchema } from "./contracts.js";

type ArticleStatus = string;
type Role = string;

type AuthorShape = {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  area: string | null;
  avatarUrl: string | null;
};

type ArticleAuthorShape = {
  position: number;
  author: AuthorShape;
};

type EventSummaryShape = {
  id: string;
  slug: string;
  title: string;
  year: number;
};

type ArticleShape = {
  id: string;
  title: string;
  abstract: string;
  area: string;
  pages: string | null;
  pdfUrl: string | null;
  viewCount: number;
  downloadCount: number;
  status: ArticleStatus;
  modality: string | null;
  importedFrom: string | null;
  externalId: string | null;
  submittedAt: Date;
  importedAt: Date | null;
  publishedAt: Date | null;
  authors: ArticleAuthorShape[];
  event?: EventSummaryShape | null;
};

type EventShape = {
  id: string;
  slug: string;
  title: string;
  edition: string;
  year: number;
  date: string;
  area: string;
  type: string;
  viewCount: number;
  coverUrl: string | null;
  presentation: string;
  themes: string[];
  committee: unknown;
  rules: unknown;
  previousEditions: unknown;
  contactEmail: string;
  contactPhone: string | null;
  isbn: string | null;
  doi: string | null;
  publisher: string | null;
  address: string | null;
  articles?: ArticleShape[];
  _count?: { articles: number };
};

type UserShape = {
  id: string;
  name: string;
  email: string;
  role: Role;
  jobTitle: string | null;
  bio: string | null;
  area: string | null;
  avatarUrl: string | null;
};

const articleStatusLabel = (status: ArticleStatus) => status.toLowerCase();

const safeParse = <T>(schema: z.ZodType<T>, value: unknown, fallback: T): T => {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
};

export function formatDate(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : undefined;
}

export function serializeAuthorSummary(author: AuthorShape) {
  return {
    id: author.id,
    slug: author.slug,
    name: author.name,
    bio: author.bio ?? undefined,
    area: author.area ?? undefined,
    avatarUrl: author.avatarUrl ?? undefined,
  };
}

export function serializeArticle(article: ArticleShape, options?: { includeEvent?: boolean }) {
  const includeEvent = options?.includeEvent ?? true;
  const authorProfiles = [...article.authors]
    .sort((left, right) => left.position - right.position)
    .map((item) => serializeAuthorSummary(item.author));

  return {
    id: article.id,
    title: article.title,
    authors: authorProfiles.map((author) => author.name),
    authorProfiles,
    area: article.area,
    abstract: article.abstract,
    pdfUrl: article.pdfUrl ?? undefined,
    viewCount: article.viewCount,
    downloadCount: article.downloadCount,
    pages: article.pages ?? "—",
    status: articleStatusLabel(article.status),
    modality: article.modality ?? undefined,
    importedFrom: article.importedFrom ?? undefined,
    externalId: article.externalId ?? undefined,
    submittedAt: formatDate(article.submittedAt),
    importedAt: formatDate(article.importedAt),
    publishedAt: formatDate(article.publishedAt),
    ...(includeEvent && article.event
      ? {
          event: article.event,
          eventId: article.event.id,
          eventSlug: article.event.slug,
          eventTitle: article.event.title,
          eventYear: article.event.year,
        }
      : {}),
  };
}

export function serializeEvent(event: EventShape, options?: { includeArticles?: boolean }) {
  const includeArticles = options?.includeArticles ?? true;
  const articles = includeArticles
    ? (event.articles ?? []).map((article) => serializeArticle(article, { includeEvent: false }))
    : undefined;

  const counts = (event.articles ?? []).reduce(
    (accumulator, article) => {
      accumulator.articleCount += 1;
      const label = articleStatusLabel(article.status);
      accumulator[label] += 1;
      return accumulator;
    },
    { articleCount: 0, draft: 0, published: 0, archived: 0 } as Record<string, number>,
  );

  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    edition: event.edition,
    year: event.year,
    date: event.date,
    area: event.area,
    type: event.type,
    viewCount: event.viewCount,
    cover: event.coverUrl ?? undefined,
    presentation: event.presentation,
    themes: event.themes,
    committee: safeParse(eventCommitteeSchema, event.committee ?? [], []),
    catalog: {
      isbn: event.isbn ?? "—",
      doi: event.doi ?? "—",
      publisher: event.publisher ?? "—",
      address: event.address ?? "—",
    },
    rules: safeParse(eventRulesSchema, event.rules ?? [], []),
    previousEditions: safeParse(eventPreviousEditionsSchema, event.previousEditions ?? [], []),
    contact: {
      email: event.contactEmail,
      phone: event.contactPhone ?? undefined,
    },
    articleCount: event.articles ? counts.articleCount : event._count?.articles ?? 0,
    publishedCount: event.articles ? counts.published : 0,
    draftCount: event.articles ? counts.draft : 0,
    archivedCount: event.articles ? counts.archived : 0,
    ...(articles ? { articles } : {}),
  };
}

export function serializeUserAccount(user: UserShape) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    jobTitle: user.jobTitle ?? undefined,
    bio: user.bio ?? undefined,
    area: user.area ?? undefined,
    avatarUrl: user.avatarUrl ?? undefined,
  };
}