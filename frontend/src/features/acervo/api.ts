import { api } from "@/lib/api";
import type {
  Article,
  AreaSummary,
  Author,
  Event,
  EventMutationInput,
  ExtractedArticlePdfMetadata,
  ImportArticleInput,
  CourseSummary,
} from "@/types/acervo";

type IncludeArticlesMode = "published" | "all" | "none";

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== ""),
  ) as T;
}

export async function fetchEvents(includeArticles: IncludeArticlesMode = "published") {
  const response = await api.get<Event[]>("/events", {
    params: { includeArticles },
  });

  return response.data.map((event) => ({
    ...event,
    articles: event.articles ?? [],
  }));
}

export async function fetchEvent(idOrSlug: string, includeArticles: "published" | "all" = "published") {
  const response = await api.get<Event>(`/events/${idOrSlug}`, {
    params: { includeArticles },
  });

  return {
    ...response.data,
    articles: response.data.articles ?? [],
  };
}

export async function fetchArticles(params?: {
  status?: "published" | "draft" | "archived" | "all";
  area?: string;
  q?: string;
  eventId?: string;
  author?: string;
  course?: string;
}) {
  const response = await api.get<Article[]>("/articles", {
    params: compact({
      status: params?.status,
      area: params?.area,
      q: params?.q,
      eventId: params?.eventId,
      author: params?.author,
      course: params?.course,
    }),
  });

  return response.data;
}

export async function fetchArticle(id: string) {
  const response = await api.get<Article>(`/articles/${id}`);
  return response.data;
}

export async function trackArticleView(id: string) {
  await api.post(`/articles/${id}/view`);
}

export async function fetchAuthors(search?: string) {
  const response = await api.get<Author[]>("/authors", {
    params: compact({ q: search }),
  });

  return response.data;
}

export async function fetchAreas(params?: { includeEmpty?: boolean; q?: string }) {
  const response = await api.get<AreaSummary[]>("/areas", {
    params: compact({
      includeEmpty: params?.includeEmpty,
      q: params?.q,
    }),
  });

  return response.data;
}

export async function fetchCourses(params?: { includeEmpty?: boolean; q?: string }) {
  const response = await api.get<CourseSummary[]>("/courses", {
    params: compact({
      includeEmpty: params?.includeEmpty,
      q: params?.q,
    }),
  });

  return response.data;
}

export async function fetchAuthor(idOrSlug: string) {
  const response = await api.get<Author>(`/authors/${idOrSlug}`);
  return response.data;
}

export async function trackEventView(id: string) {
  await api.post(`/events/${id}/view`);
}

export async function createEvent(payload: EventMutationInput) {
  const response = await api.post<Event>("/events", payload);
  return response.data;
}

export async function updateEvent(id: string, payload: Partial<EventMutationInput>) {
  const response = await api.put<Event>(`/events/${id}`, payload);
  return response.data;
}

export async function deleteEvent(id: string) {
  await api.delete(`/events/${id}`);
}

export async function uploadEventRuleFile(id: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post<{ fileUrl: string }>(`/events/${id}/rules/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return response.data;
}

export async function uploadEventCoverImage(id: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post<{ coverUrl: string }>(`/events/${id}/cover/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return response.data;
}

export async function updateArticleStatus(id: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
  const response = await api.patch<Article>(`/articles/${id}/status`, { status });
  return response.data;
}

export async function uploadArticlePdf(id: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post<Article>(`/articles/${id}/pdf`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function extractArticlePdfMetadata(file: File, options?: { eventId?: string }) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post<ExtractedArticlePdfMetadata>("/articles/extract-metadata", formData, {
    params: compact({
      eventId: options?.eventId,
    }),
    headers: { "Content-Type": "multipart/form-data" },
  });

  return response.data;
}

export async function downloadArticlePdf(id: string) {
  const response = await api.get<Blob>(`/articles/${id}/pdf`, {
    params: { download: true },
    responseType: "blob",
  });
  return response.data;
}

export async function deleteArticle(id: string) {
  await api.delete(`/articles/${id}`);
}

export async function importArticles(payload: {
  eventId: string;
  publishImmediately: boolean;
  items: ImportArticleInput[];
}) {
  const response = await api.post<{ count: number; items: Article[] }>("/articles/import", payload);
  return response.data;
}
