import type { ExtractedArticlePdfMetadata } from "@/types/acervo";

export const ARTICLE_MODALITIES = ["Resumo Simples", "Resumo Expandido", "Artigo Científico"] as const;

export type ArticleModality = (typeof ARTICLE_MODALITIES)[number];

export type ArticleFormValue = {
  title: string;
  authors: string;
  area: string;
  courses: string;
  abstract: string;
  modalidade: ArticleModality;
  pages: string;
};

export const emptyArticleFormValue = (): ArticleFormValue => ({
  title: "",
  authors: "",
  area: "",
  courses: "",
  abstract: "",
  modalidade: "Resumo Simples",
  pages: "",
});

export function splitArticleAuthors(value: string) {
  return value
    .split(",")
    .map((author) => author.trim())
    .filter(Boolean);
}

export function formatPageRangeFromPageCount(pageCount: number) {
  if (!Number.isFinite(pageCount) || pageCount <= 0) return "";
  if (pageCount === 1) return "1";
  return `1-${pageCount}`;
}

export function inferArticleModalityFromPageCount(pageCount: number): ArticleModality {
  if (!Number.isFinite(pageCount) || pageCount <= 1) return ARTICLE_MODALITIES[0];
  if (pageCount <= 5) return ARTICLE_MODALITIES[1];
  return ARTICLE_MODALITIES[2];
}

export function applyExtractedMetadataToArticleForm(
  currentValue: ArticleFormValue,
  metadata: ExtractedArticlePdfMetadata,
): ArticleFormValue {
  return {
    ...currentValue,
    title: metadata.title || currentValue.title,
    authors: metadata.authors.length ? metadata.authors.join(", ") : currentValue.authors,
    abstract: metadata.abstract || currentValue.abstract,
    area: metadata.suggestedArea || currentValue.area,
    courses: metadata.suggestedCourses?.length ? metadata.suggestedCourses.join(", ") : currentValue.courses,
    pages: formatPageRangeFromPageCount(metadata.pageCount) || currentValue.pages,
    modalidade: inferArticleModalityFromPageCount(metadata.pageCount),
  };
}
