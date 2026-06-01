export const MAX_ARTICLE_REPORT_ITEMS = 10_000;

export function exceedsArticleReportLimit(itemCount: number) {
  return itemCount > MAX_ARTICLE_REPORT_ITEMS;
}
