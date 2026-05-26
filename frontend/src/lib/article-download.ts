import type { Article } from "@/types/acervo";

export function toArticleDownloadName(article: Pick<Article, "id" | "title">) {
  return `${article.title.replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-") || article.id}.pdf`;
}

export function triggerBrowserDownload(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
