import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  createEvent,
  deleteArticle,
  deleteEvent,
  extractArticlePdfMetadata,
  extractCatalogPdfMetadata,
  fetchAdminDashboardSummary,
  fetchArticle,
  fetchArticleOptions,
  fetchArticles,
  fetchAreas,
  fetchAuthor,
  fetchAuthors,
  fetchCourses,
  fetchEvent,
  fetchEvents,
  fetchEventOptions,
  fetchGlobalSearch,
  importArticles,
  removeUploadedEventRuleFile,
  trackArticleView,
  trackEventView,
  updateArticle,
  updateArticleStatus,
  updateEvent,
  uploadArticlePdf,
  uploadEventCatalogPdf,
  uploadEventCoverImage,
  uploadEventRuleFile,
  type AdminDashboardSummary,
} from "./api";
import type {
  ArticleListFilters,
  ArticleListResponse,
  ArticleOptions,
  ArticleUpdateInput,
  AuthorListFilters,
  AuthorListResponse,
  EventIncludeArticlesMode,
  EventListFilters,
  EventOption,
  EventListResponse,
  EventMutationInput,
  ImportArticleInput,
} from "@/types/acervo";
import {
  compactKey,
  normalizeFilterValues,
  normalizeLookupValue,
  normalizeNumberFilterValues,
} from "./query-params";

type EventQueryOptions = {
  staleTime?: number;
  refetchOnMount?: boolean | "always";
  refetchOnWindowFocus?: boolean | "always";
};

type ArticleQueryOptions = {
  enabled?: boolean;
};

type PublicEventsFilters = Omit<EventListFilters, "includeArticles">;
type AdminEventsFilters = Omit<EventListFilters, "includeArticles">;
type PublishedArticlesFilters = Omit<ArticleListFilters, "status">;
type AdminArticlesFilters = ArticleListFilters;

function normalizeEventListFilters(
  filters?: EventListFilters,
  includeArticles: EventIncludeArticlesMode = "none",
): EventListFilters {
  return compactKey({
    q: normalizeLookupValue(filters?.q),
    year: filters?.year,
    type: normalizeFilterValues(filters?.type),
    area: normalizeFilterValues(filters?.area),
    includeArticles: filters?.includeArticles ?? includeArticles,
    page: filters?.page,
    pageSize: filters?.pageSize,
  }) as EventListFilters;
}

function normalizeArticleListFilters(
  filters?: ArticleListFilters,
): ArticleListFilters {
  return compactKey({
    status: filters?.status,
    area: normalizeFilterValues(filters?.area),
    course: normalizeFilterValues(filters?.course),
    q: normalizeLookupValue(filters?.q),
    eventId: normalizeFilterValues(filters?.eventId),
    eventYear: normalizeNumberFilterValues(filters?.eventYear),
    modality: normalizeFilterValues(filters?.modality),
    hasPdf: filters?.hasPdf || undefined,
    author: normalizeLookupValue(filters?.author),
    page: filters?.page,
    pageSize: filters?.pageSize,
  }) as ArticleListFilters;
}

function normalizeAuthorListFilters(
  filters?: AuthorListFilters,
): AuthorListFilters {
  return compactKey({
    q: normalizeLookupValue(filters?.q),
    area: normalizeFilterValues(filters?.area),
    page: filters?.page,
    pageSize: filters?.pageSize,
  }) as AuthorListFilters;
}

const acervoKeys = {
  root: ["acervo"] as const,
  dashboardSummary: () => ["acervo", "dashboard-summary"] as const,
  events: (scope: string, filters?: EventListFilters) =>
    ["acervo", "events", scope, filters ?? {}] as const,
  eventOptions: () => ["acervo", "events", "options"] as const,
  event: (idOrSlug: string, scope: string) =>
    ["acervo", "event", idOrSlug, scope] as const,
  articleOptions: () => ["acervo", "articles", "options"] as const,
  articles: (scope: string, filters?: ArticleListFilters) =>
    ["acervo", "articles", scope, filters ?? {}] as const,
  article: (id: string) => ["acervo", "article", id] as const,
  areas: (includeEmpty: boolean, search = "") =>
    ["acervo", "areas", includeEmpty, search] as const,
  courses: (includeEmpty: boolean, search = "") =>
    ["acervo", "courses", includeEmpty, search] as const,
  authors: (filters?: AuthorListFilters) =>
    ["acervo", "authors", filters ?? {}] as const,
  author: (idOrSlug: string) => ["acervo", "author", idOrSlug] as const,
  globalSearch: (query: string, limit: number) =>
    ["acervo", "global-search", query, limit] as const,
};

export function useAdminDashboardSummaryQuery(
  enabled = true,
): UseQueryResult<AdminDashboardSummary> {
  return useQuery({
    enabled,
    queryKey: acervoKeys.dashboardSummary(),
    queryFn: fetchAdminDashboardSummary,
  });
}

export function useEventOptionsQuery(
  enabled = true,
): UseQueryResult<EventOption[]> {
  return useQuery({
    enabled,
    queryKey: acervoKeys.eventOptions(),
    queryFn: fetchEventOptions,
    staleTime: 5 * 60 * 1000,
  });
}

export function useArticleOptionsQuery(
  enabled = true,
): UseQueryResult<ArticleOptions> {
  return useQuery({
    enabled,
    queryKey: acervoKeys.articleOptions(),
    queryFn: fetchArticleOptions,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePublicEventsQuery(
  filters?: PublicEventsFilters,
): UseQueryResult<EventListResponse> {
  const queryFilters = normalizeEventListFilters(filters, "none");

  return useQuery({
    queryKey: acervoKeys.events("public", queryFilters),
    queryFn: () => fetchEvents(queryFilters),
  });
}

export function useAdminEventsQuery(
  enabled = true,
  filters?: AdminEventsFilters,
): UseQueryResult<EventListResponse> {
  const queryFilters = normalizeEventListFilters(
    {
      ...filters,
      includeArticles: "all",
    },
    "all",
  );

  return useQuery({
    enabled,
    queryKey: acervoKeys.events("admin", queryFilters),
    queryFn: () => fetchEvents(queryFilters),
  });
}

export function useEventQuery(
  idOrSlug?: string,
  includeArticles: EventIncludeArticlesMode = "published",
  options?: EventQueryOptions,
) {
  const normalizedId = normalizeLookupValue(idOrSlug);

  return useQuery({
    enabled: Boolean(normalizedId),
    queryKey: acervoKeys.event(normalizedId ?? "", includeArticles),
    queryFn: () => fetchEvent(normalizedId!, includeArticles),
    ...options,
  });
}

export function usePublishedArticlesQuery(
  filters?: PublishedArticlesFilters,
  options?: ArticleQueryOptions,
): UseQueryResult<ArticleListResponse> {
  const queryFilters = normalizeArticleListFilters({
    ...filters,
    status: "published",
  });

  return useQuery({
    enabled: options?.enabled ?? true,
    queryKey: acervoKeys.articles("published", queryFilters),
    queryFn: () => fetchArticles(queryFilters),
  });
}

export function useAdminArticlesQuery(
  enabled = true,
  filters?: AdminArticlesFilters,
): UseQueryResult<ArticleListResponse> {
  const queryFilters = normalizeArticleListFilters({
    ...filters,
    status: filters?.status ?? "all",
  });

  return useQuery({
    enabled,
    queryKey: acervoKeys.articles("admin", queryFilters),
    queryFn: () => fetchArticles(queryFilters),
  });
}

export function useArticleQuery(id?: string) {
  const normalizedId = normalizeLookupValue(id);

  return useQuery({
    enabled: Boolean(normalizedId),
    queryKey: acervoKeys.article(normalizedId ?? ""),
    queryFn: () => fetchArticle(normalizedId!),
  });
}

export function useAreasQuery(options?: {
  includeEmpty?: boolean;
  search?: string;
}) {
  const includeEmpty = options?.includeEmpty ?? false;
  const search = normalizeLookupValue(options?.search) ?? "";

  return useQuery({
    queryKey: acervoKeys.areas(includeEmpty, search),
    queryFn: () => fetchAreas({ includeEmpty, q: search || undefined }),
  });
}

export function useCoursesQuery(options?: {
  includeEmpty?: boolean;
  search?: string;
}) {
  const includeEmpty = options?.includeEmpty ?? false;
  const search = normalizeLookupValue(options?.search) ?? "";

  return useQuery({
    queryKey: acervoKeys.courses(includeEmpty, search),
    queryFn: () => fetchCourses({ includeEmpty, q: search || undefined }),
  });
}

export function useAuthorsQuery(
  search?: string,
): UseQueryResult<AuthorListResponse>;
export function useAuthorsQuery(
  filters?: AuthorListFilters,
): UseQueryResult<AuthorListResponse>;
export function useAuthorsQuery(
  searchOrFilters: string | AuthorListFilters = "",
): UseQueryResult<AuthorListResponse> {
  const queryFilters = normalizeAuthorListFilters(
    typeof searchOrFilters === "string"
      ? { q: searchOrFilters }
      : searchOrFilters,
  );

  return useQuery({
    queryKey: acervoKeys.authors(queryFilters),
    queryFn: () => fetchAuthors(queryFilters),
  });
}

export function useAuthorQuery(idOrSlug?: string) {
  const normalizedId = normalizeLookupValue(idOrSlug);

  return useQuery({
    enabled: Boolean(normalizedId),
    queryKey: acervoKeys.author(normalizedId ?? ""),
    queryFn: () => fetchAuthor(normalizedId!),
  });
}

export function useGlobalSearchQuery(
  query: string,
  options?: { limit?: number },
) {
  const normalizedQuery = query.trim();
  const limit = options?.limit ?? 5;

  return useQuery({
    enabled: normalizedQuery.length >= 2,
    queryKey: acervoKeys.globalSearch(normalizedQuery, limit),
    queryFn: () => fetchGlobalSearch(normalizedQuery, { limit }),
    staleTime: 20_000,
  });
}

function useInvalidateAcervoData() {
  const queryClient = useQueryClient();

  return async () => {
    await queryClient.invalidateQueries({ queryKey: acervoKeys.root });
  };
}

export function useCreateEventMutation() {
  const invalidate = useInvalidateAcervoData();

  return useMutation({
    mutationFn: (payload: EventMutationInput) => createEvent(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateEventMutation() {
  const invalidate = useInvalidateAcervoData();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<EventMutationInput>;
    }) => updateEvent(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteEventMutation() {
  const invalidate = useInvalidateAcervoData();

  return useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: invalidate,
  });
}

export function useUploadEventRuleFileMutation() {
  const invalidate = useInvalidateAcervoData();

  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      uploadEventRuleFile(id, file),
    onSuccess: invalidate,
  });
}

export function useRemoveUploadedEventRuleFileMutation() {
  return useMutation({
    mutationFn: ({ id, fileUrl }: { id: string; fileUrl: string }) =>
      removeUploadedEventRuleFile(id, fileUrl),
  });
}

export function useUploadEventCoverImageMutation() {
  const invalidate = useInvalidateAcervoData();

  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      uploadEventCoverImage(id, file),
    onSuccess: invalidate,
  });
}

export function useUploadEventCatalogPdfMutation() {
  const invalidate = useInvalidateAcervoData();

  return useMutation({
    mutationFn: ({
      id,
      pdfFile,
      imageFile,
    }: {
      id: string;
      pdfFile: File;
      imageFile: File;
    }) => uploadEventCatalogPdf(id, pdfFile, imageFile),
    onSuccess: invalidate,
  });
}

export function useUpdateArticleStatusMutation() {
  const invalidate = useInvalidateAcervoData();

  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    }) => updateArticleStatus(id, status),
    onSuccess: invalidate,
  });
}

export function useUpdateArticleMutation() {
  const invalidate = useInvalidateAcervoData();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: ArticleUpdateInput;
    }) => updateArticle(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteArticleMutation() {
  const invalidate = useInvalidateAcervoData();

  return useMutation({
    mutationFn: (id: string) => deleteArticle(id),
    onSuccess: invalidate,
  });
}

export function useUploadArticlePdfMutation() {
  const invalidate = useInvalidateAcervoData();

  return useMutation({
    mutationFn: ({
      id,
      file,
    }: {
      id: string;
      file: File;
      invalidateOnSuccess?: boolean;
    }) => uploadArticlePdf(id, file),
    onSuccess: async (_article, variables) => {
      if (variables.invalidateOnSuccess !== false) await invalidate();
    },
  });
}

export function useExtractArticlePdfMetadataMutation() {
  return useMutation({
    mutationFn: ({
      file,
      eventId,
    }: {
      file: File;
      eventId?: string;
    }) => extractArticlePdfMetadata(file, { eventId }),
  });
}

export function useImportArticlesMutation() {
  const invalidate = useInvalidateAcervoData();

  return useMutation({
    mutationFn: ({
      invalidateOnSuccess: _invalidateOnSuccess,
      ...payload
    }: {
      eventId: string;
      publishImmediately: boolean;
      items: ImportArticleInput[];
      invalidateOnSuccess?: boolean;
    }) => importArticles(payload),
    onSuccess: async (_result, variables) => {
      if (variables.invalidateOnSuccess !== false) await invalidate();
    },
  });
}

export function useTrackArticleViewMutation() {
  const invalidate = useInvalidateAcervoData();

  return useMutation({
    mutationFn: (id: string) => trackArticleView(id),
    onSuccess: invalidate,
  });
}

export function useTrackEventViewMutation() {
  const invalidate = useInvalidateAcervoData();

  return useMutation({
    mutationFn: (id: string) => trackEventView(id),
    onSuccess: invalidate,
  });
}

export function useExtractCatalogPdfMetadataMutation() {
  return useMutation({
    mutationFn: ({ file }: { file: File }) => extractCatalogPdfMetadata(file),
  });
}
