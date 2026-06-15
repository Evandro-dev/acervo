import { api } from "@/lib/api";
import type {
  Article,
  ArticleListFilters,
  ArticleListResponse,
  ArticleOptions,
  ArticleUpdateInput,
  AreaSummary,
  Author,
  AuthorListFilters,
  AuthorListResponse,
  CourseSummary,
  Event,
  EventIncludeArticlesMode,
  EventListFilters,
  EventListResponse,
  EventMutationInput,
  EventOption,
  ExtractedArticlePdfMetadata,
  GlobalSearchResponse,
  ImportArticleInput,
} from "@/types/acervo";
import { normalizeEventType } from "@/types/acervo";
import {
  createQueryParams,
  normalizeFilterValues,
  normalizeLookupValue,
  normalizeNumberFilterValues,
} from "./query-params";

export type ExtractedCatalogPdfMetadata = {
  text: string;
  isbn?: string;
  pageCount: number;
  warnings: string[];
};

export type UploadedEventCatalogPdfMetadata = ExtractedCatalogPdfMetadata & {
  catalogPdfUrl: string;
  catalogImageUrl?: string;
};

export type AdminDashboardSummary = {
  eventCount: number;
  publishedCount: number;
  draftCount: number;
  archivedCount: number;
};

function normalizeEvent(event: Event): Event {
  return {
    ...event,
    type: normalizeEventType(event.type) ?? "Congresso",
    articles: event.articles ?? [],
  };
}

function normalizeEventListResponse(
  response: EventListResponse,
): EventListResponse {
  return {
    ...response,
    items: response.items.map(normalizeEvent),
  };
}

export async function fetchAdminDashboardSummary() {
  const response = await api.get<AdminDashboardSummary>(
    "/events/dashboard-summary",
  );

  return response.data;
}

export async function fetchEvents(
  includeArticles?: EventIncludeArticlesMode,
): Promise<EventListResponse>;
export async function fetchEvents(
  params?: EventListFilters,
): Promise<EventListResponse>;
export async function fetchEvents(
  paramsOrIncludeArticles: EventListFilters | EventIncludeArticlesMode = "none",
): Promise<EventListResponse> {
  const params =
    typeof paramsOrIncludeArticles === "string"
      ? { includeArticles: paramsOrIncludeArticles }
      : paramsOrIncludeArticles;

  const response = await api.get<EventListResponse>("/events", {
    params: createQueryParams({
      q: normalizeLookupValue(params.q),
      year: params.year,
      type: normalizeFilterValues(params.type),
      area: normalizeFilterValues(params.area),
      includeArticles: params.includeArticles ?? "none",
      page: params.page,
      pageSize: params.pageSize,
    }),
  });

  return normalizeEventListResponse(response.data);
}

export async function fetchEventOptions(): Promise<EventOption[]> {
  const response = await api.get<EventOption[]>("/events/options");

  return response.data;
}

export async function fetchEvent(
  idOrSlug: string,
  includeArticles: EventIncludeArticlesMode = "published",
) {
  const response = await api.get<Event>(`/events/${idOrSlug}`, {
    params: createQueryParams({ includeArticles }),
  });

  return normalizeEvent(response.data);
}

export async function fetchArticles(
  params?: ArticleListFilters,
): Promise<ArticleListResponse> {
  const response = await api.get<ArticleListResponse>("/articles", {
    params: createQueryParams({
      status: params?.status,
      area: normalizeFilterValues(params?.area),
      course: normalizeFilterValues(params?.course),
      q: normalizeLookupValue(params?.q),
      eventId: normalizeFilterValues(params?.eventId),
      eventYear: normalizeNumberFilterValues(params?.eventYear),
      modality: normalizeFilterValues(params?.modality),
      hasPdf: params?.hasPdf || undefined,
      author: normalizeLookupValue(params?.author),
      page: params?.page,
      pageSize: params?.pageSize,
    }),
  });

  return response.data;
}

export async function fetchArticleOptions(): Promise<ArticleOptions> {
  const response = await api.get<ArticleOptions>("/articles/options");

  return response.data;
}

export async function fetchArticle(id: string) {
  const response = await api.get<Article>(`/articles/${id}`);
  return response.data;
}

export async function trackArticleView(id: string) {
  await api.post(`/articles/${id}/view`);
}

export async function fetchAuthors(search?: string): Promise<AuthorListResponse>;
export async function fetchAuthors(
  params?: AuthorListFilters,
): Promise<AuthorListResponse>;
export async function fetchAuthors(
  paramsOrSearch?: AuthorListFilters | string,
): Promise<AuthorListResponse> {
  const params =
    typeof paramsOrSearch === "string" ? { q: paramsOrSearch } : paramsOrSearch;

  const response = await api.get<AuthorListResponse>("/authors", {
    params: createQueryParams({
      q: normalizeLookupValue(params?.q),
      area: normalizeFilterValues(params?.area),
      page: params?.page,
      pageSize: params?.pageSize,
    }),
  });

  return response.data;
}

export async function fetchAreas(params?: {
  includeEmpty?: boolean;
  q?: string;
}) {
  const response = await api.get<AreaSummary[]>("/areas", {
    params: createQueryParams({
      includeEmpty: params?.includeEmpty,
      q: normalizeLookupValue(params?.q),
    }),
  });

  return response.data;
}

export async function fetchCourses(params?: {
  includeEmpty?: boolean;
  q?: string;
}) {
  const response = await api.get<CourseSummary[]>("/courses", {
    params: createQueryParams({
      includeEmpty: params?.includeEmpty,
      q: normalizeLookupValue(params?.q),
    }),
  });

  return response.data;
}

export async function fetchAuthor(idOrSlug: string) {
  const response = await api.get<Author>(`/authors/${idOrSlug}`);
  return response.data;
}

export async function fetchGlobalSearch(
  query: string,
  options?: { limit?: number },
) {
  const response = await api.get<GlobalSearchResponse>("/search", {
    params: createQueryParams({
      q: normalizeLookupValue(query),
      limit: options?.limit,
    }),
  });

  return response.data;
}

export async function trackEventView(id: string) {
  await api.post(`/events/${id}/view`);
}

export async function createEvent(payload: EventMutationInput) {
  const response = await api.post<Event>("/events", payload);
  return response.data;
}

export async function updateEvent(
  id: string,
  payload: Partial<EventMutationInput>,
) {
  const response = await api.put<Event>(`/events/${id}`, payload);
  return response.data;
}

export async function deleteEvent(id: string) {
  await api.delete(`/events/${id}`);
}

export async function uploadEventRuleFile(id: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post<{ fileUrl: string }>(
    `/events/${id}/rules/upload`,
    formData,
  );

  return response.data;
}

export async function removeUploadedEventRuleFile(
  id: string,
  fileUrl: string,
) {
  await api.delete(`/events/${id}/rules/upload`, { data: { fileUrl } });
}

export async function uploadEventCoverImage(id: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post<{ coverUrl: string }>(
    `/events/${id}/cover/upload`,
    formData,
  );

  return response.data;
}

export async function extractCatalogPdfMetadata(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post<ExtractedCatalogPdfMetadata>(
    "/events/catalog/pdf-metadata",
    formData,
  );

  return response.data;
}

export async function uploadEventCatalogPdf(
  id: string,
  pdfFile: File,
  imageFile: File,
) {
  const formData = new FormData();

  formData.append("pdf", pdfFile);
  formData.append("image", imageFile);

  const response = await api.post<UploadedEventCatalogPdfMetadata>(
    `/events/${id}/catalog/upload`,
    formData,
  );

  return response.data;
}

export async function updateArticleStatus(
  id: string,
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED",
) {
  const response = await api.patch<Article>(`/articles/${id}/status`, {
    status,
  });

  return response.data;
}

export async function updateArticle(id: string, payload: ArticleUpdateInput) {
  const response = await api.put<Article>(`/articles/${id}`, payload);
  return response.data;
}

export async function uploadArticlePdf(id: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post<Article>(`/articles/${id}/pdf`, formData);

  return response.data;
}

export async function extractArticlePdfMetadata(
  file: File,
  options?: { eventId?: string },
) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post<ExtractedArticlePdfMetadata>(
    "/articles/extract-metadata",
    formData,
    {
      params: createQueryParams({
        eventId: normalizeLookupValue(options?.eventId),
      }),
    },
  );

  return response.data;
}

export async function downloadArticlePdf(id: string) {
  const response = await api.get<Blob>(`/articles/${id}/pdf`, {
    params: createQueryParams({ download: true }),
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
  const response = await api.post<{ count: number; items: Article[] }>(
    "/articles/import",
    payload,
  );

  return response.data;
}
