import { api } from "@/lib/api";
import type { ArticleReportFilters } from "@/types/acervo";

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== ""),
  ) as T;
}

export async function downloadArticleReport(filters: ArticleReportFilters) {
  const response = await api.get<Blob>("/reports/articles.xlsx", {
    params: compact(filters),
    responseType: "blob",
  });

  return response.data;
}
