import {
  applyExtractedMetadataToArticleForm,
  emptyArticleFormValue,
  splitArticleAuthors,
  type ArticleFormValue,
  type ArticleModality,
} from "@/lib/article-form";
import { splitCommaSeparatedValues } from "@/lib/comma-separated-values";
import type {
  ExtractedArticlePdfMetadata,
  ImportArticleInput,
} from "@/types/acervo";

export const ARTICLE_IMPORT_BATCH_SIZE = 25;

export type Modalidade = ArticleModality;
export type PdfQueueStatus =
  | "pending"
  | "reading"
  | "ready"
  | "failed"
  | "saving"
  | "saved"
  | "partial";

export type Draft = {
  title: string;
  authors: string;
  area: string;
  courses: string;
  abstract: string;
  modalidade: Modalidade;
};

export type PdfDraft = ArticleFormValue;

export type PdfQueueItem = {
  id: string;
  file: File;
  draft: PdfDraft;
  metadata: ExtractedArticlePdfMetadata | null;
  status: PdfQueueStatus;
  error: string | null;
};

export const emptyDraft = (): Draft => ({
  title: "",
  authors: "",
  area: "",
  courses: "",
  abstract: "",
  modalidade: "Resumo Simples",
});

export const emptyPdfDraft = (): PdfDraft => ({
  ...emptyArticleFormValue(),
});

export const toImportItem = (draft: Draft): ImportArticleInput => ({
  title: draft.title,
  authors: splitArticleAuthors(draft.authors),
  area: draft.area || "Geral",
  courses: splitCommaSeparatedValues(draft.courses),
  abstract: draft.abstract,
  modality: draft.modalidade,
  importedFrom: "Importação manual",
  submittedAt: new Date().toISOString().slice(0, 10),
});

export const toPdfImportItem = (draft: PdfDraft): ImportArticleInput => ({
  title: draft.title,
  authors: splitArticleAuthors(draft.authors),
  area: draft.area || "Geral",
  courses: splitCommaSeparatedValues(draft.courses),
  abstract: draft.abstract,
  pages: draft.pages || undefined,
  modality: draft.modalidade,
  importedFrom: "Leitura automática de PDF",
  submittedAt: new Date().toISOString().slice(0, 10),
});

export function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function createPdfQueueItem(file: File): PdfQueueItem {
  return {
    id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    draft: emptyPdfDraft(),
    metadata: null,
    status: "pending",
    error: null,
  };
}

export function applyMetadataToPdfDraft(
  draft: PdfDraft,
  metadata: ExtractedArticlePdfMetadata,
): PdfDraft {
  return applyExtractedMetadataToArticleForm(draft, metadata);
}

export function canImportPdfItem(item: PdfQueueItem) {
  return Boolean(item.draft.title.trim() && item.draft.authors.trim());
}

function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

export function getImportSuccessTitle(
  count: number,
  publishImmediately: boolean,
) {
  if (publishImmediately) {
    return `${count} ${pluralize(count, "trabalho publicado", "trabalhos publicados")}`;
  }

  return `${count} ${pluralize(count, "rascunho salvo", "rascunhos salvos")}`;
}

export function getManualImportButtonLabel(
  _count: number,
  publishImmediately: boolean,
  isPending: boolean,
) {
  if (isPending) {
    return "Processando dados...";
  }

  return publishImmediately ? "Publicar trabalhos" : "Salvar como rascunho";
}

export function getJsonImportButtonLabel(
  publishImmediately: boolean,
  isPending: boolean,
) {
  if (isPending) {
    return "Processando dados...";
  }

  return publishImmediately ? "Publicar arquivo" : "Salvar arquivo como rascunho";
}

export function getPdfImportButtonLabel(
  _count: number,
  publishImmediately: boolean,
  isPending: boolean,
) {
  if (isPending) {
    return "Processando dados...";
  }

  return publishImmediately ? "Publicar trabalhos" : "Salvar como rascunho";
}
