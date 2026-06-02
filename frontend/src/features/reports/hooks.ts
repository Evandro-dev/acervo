import { useQuery } from "@tanstack/react-query";
import type { ArticleReportFilters } from "@/types/acervo";
import { fetchArticleReportCount } from "./api";

const articleReportKeys = {
  count: (filters: ArticleReportFilters) => ["reports", "articles", "count", filters] as const,
};

export function useArticleReportCountQuery(filters: ArticleReportFilters, enabled = true) {
  return useQuery({
    enabled,
    queryKey: articleReportKeys.count(filters),
    queryFn: () => fetchArticleReportCount(filters),
  });
}
