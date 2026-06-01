import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createEvent,
  deleteArticle,
  deleteEvent,
  extractArticlePdfMetadata,
  fetchArticle,
  fetchArticles,
  fetchAreas,
  fetchCourses,
  fetchAuthor,
  fetchAuthors,
  fetchEvent,
  fetchEvents,
  importArticles,
  trackArticleView,
  trackEventView,
  updateArticleStatus,
  updateEvent,
  uploadArticlePdf,
  uploadEventCoverImage,
  uploadEventRuleFile,
} from "./api";
import type { EventMutationInput, ImportArticleInput } from "@/types/acervo";

type EventQueryOptions = {
  staleTime?: number;
  refetchOnMount?: boolean | "always";
  refetchOnWindowFocus?: boolean | "always";
};

function normalizeLookupValue(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null") return undefined;
  return trimmed;
}

const acervoKeys = {
  root: ["acervo"] as const,
  events: (scope: string) => ["acervo", "events", scope] as const,
  event: (idOrSlug: string, scope: string) => ["acervo", "event", idOrSlug, scope] as const,
  articles: (scope: string, filters?: Record<string, unknown>) => ["acervo", "articles", scope, filters ?? {}] as const,
  article: (id: string) => ["acervo", "article", id] as const,
  areas: (includeEmpty: boolean, search = "") => ["acervo", "areas", includeEmpty, search] as const,
  courses: (includeEmpty: boolean, search = "") => ["acervo", "courses", includeEmpty, search] as const,
  authors: (search = "") => ["acervo", "authors", search] as const,
  author: (idOrSlug: string) => ["acervo", "author", idOrSlug] as const,
};

export function usePublicEventsQuery() {
  return useQuery({
    queryKey: acervoKeys.events("public"),
    queryFn: () => fetchEvents("published"),
  });
}

export function useAdminEventsQuery(enabled = true) {
  return useQuery({
    enabled,
    queryKey: acervoKeys.events("admin"),
    queryFn: () => fetchEvents("all"),
  });
}

export function useEventQuery(
  idOrSlug?: string,
  includeArticles: "published" | "all" = "published",
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

export function usePublishedArticlesQuery() {
  return useQuery({
    queryKey: acervoKeys.articles("published"),
    queryFn: () => fetchArticles({ status: "published" }),
  });
}

export function useAdminArticlesQuery(enabled = true) {
  return useQuery({
    enabled,
    queryKey: acervoKeys.articles("admin", { status: "all" }),
    queryFn: () => fetchArticles({ status: "all" }),
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

export function useAreasQuery(options?: { includeEmpty?: boolean; search?: string }) {
  const includeEmpty = options?.includeEmpty ?? false;
  const search = options?.search ?? "";

  return useQuery({
    queryKey: acervoKeys.areas(includeEmpty, search),
    queryFn: () => fetchAreas({ includeEmpty, q: search || undefined }),
  });
}

export function useCoursesQuery(options?: { includeEmpty?: boolean; search?: string }) {
  const includeEmpty = options?.includeEmpty ?? false;
  const search = options?.search ?? "";

  return useQuery({
    queryKey: acervoKeys.courses(includeEmpty, search),
    queryFn: () => fetchCourses({ includeEmpty, q: search || undefined }),
  });
}

export function useAuthorsQuery(search = "") {
  return useQuery({
    queryKey: acervoKeys.authors(search),
    queryFn: () => fetchAuthors(search || undefined),
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
    mutationFn: ({ id, payload }: { id: string; payload: Partial<EventMutationInput> }) => updateEvent(id, payload),
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
    mutationFn: ({ id, file }: { id: string; file: File }) => uploadEventRuleFile(id, file),
    onSuccess: invalidate,
  });
}

export function useUploadEventCoverImageMutation() {
  const invalidate = useInvalidateAcervoData();

  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => uploadEventCoverImage(id, file),
    onSuccess: invalidate,
  });
}

export function useUpdateArticleStatusMutation() {
  const invalidate = useInvalidateAcervoData();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" }) =>
      updateArticleStatus(id, status),
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
    mutationFn: ({ id, file }: { id: string; file: File }) => uploadArticlePdf(id, file),
    onSuccess: invalidate,
  });
}

export function useExtractArticlePdfMetadataMutation() {
  return useMutation({
    mutationFn: ({ file, eventId }: { file: File; eventId?: string }) => extractArticlePdfMetadata(file, { eventId }),
  });
}

export function useImportArticlesMutation() {
  const invalidate = useInvalidateAcervoData();

  return useMutation({
    mutationFn: (payload: { eventId: string; publishImmediately: boolean; items: ImportArticleInput[] }) =>
      importArticles(payload),
    onSuccess: invalidate,
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
