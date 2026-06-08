import { useDeferredValue, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  ExternalLink,
  FileDown,
  FileText,
  Pencil,
  Save,
  Send,
  Settings2,
  Trash2,
  Upload,
} from "lucide-react";
import { ArticleEditorForm } from "@/components/admin/ArticleEditorForm";
import { PdfFileSummary } from "@/components/admin/PdfFileSummary";
import { PublicationMetaRow } from "@/components/publications/PublicationMetaRow";
import { downloadArticlePdf } from "@/features/acervo/api";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SearchField } from "@/components/ui/search-field";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { QueryState } from "@/components/ui/query-state";
import {
  useAdminArticlesQuery,
  useAreasQuery,
  useCoursesQuery,
  useDeleteArticleMutation,
  useExtractArticlePdfMetadataMutation,
  useUpdateArticleMutation,
  useUpdateArticleStatusMutation,
  useUploadArticlePdfMutation,
} from "@/features/acervo/hooks";
import { useAuth } from "@/features/auth/auth-context";
import { toast } from "@/hooks/use-toast";
import { toArticleDownloadName, triggerBrowserDownload } from "@/lib/article-download";
import {
  ARTICLE_MODALITIES,
  applyExtractedMetadataToArticleForm,
  splitArticleAuthors,
  type ArticleFormValue,
  type ArticleModality,
} from "@/lib/article-form";
import { getApiErrorMessage } from "@/lib/api";
import { splitCommaSeparatedValues } from "@/lib/comma-separated-values";
import { isUsableResourceUrl } from "@/lib/file-links";
import type { Article, ArticleStatus, ExtractedArticlePdfMetadata } from "@/types/acervo";

const tabs: { key: ArticleStatus; label: string }[] = [
  { key: "draft", label: "Rascunhos" },
  { key: "published", label: "Publicados" },
  { key: "archived", label: "Arquivados" },
];

const toApiStatus = {
  draft: "DRAFT",
  published: "PUBLISHED",
  archived: "ARCHIVED",
} as const;

function hasAttachedPdf(article?: Pick<Article, "pdfUrl"> | null) {
  return isUsableResourceUrl(article?.pdfUrl);
}

function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function normalizeArticleModality(value?: string): ArticleModality {
  return ARTICLE_MODALITIES.find((modalidade) => modalidade === value) ?? "Resumo Simples";
}

function normalizePages(value?: string) {
  if (!value || value === "—" || value === "â€”") return "";
  return value;
}

function articleToFormValue(article: Article): ArticleFormValue {
  return {
    title: article.title,
    authors: article.authors.join(", "),
    area: article.area,
    courses: article.courses.join(", "),
    abstract: article.abstract,
    modalidade: normalizeArticleModality(article.modality),
    pages: normalizePages(article.pages),
  };
}

function isArticleFormReady(value: ArticleFormValue) {
  return Boolean(value.title.trim() && splitArticleAuthors(value.authors).length > 0 && value.area.trim());
}

function toArticleUpdatePayload(value: ArticleFormValue) {
  return {
    title: value.title.trim(),
    authors: splitArticleAuthors(value.authors),
    area: value.area.trim() || "Geral",
    courses: splitCommaSeparatedValues(value.courses),
    abstract: value.abstract,
    pages: value.pages.trim(),
    modality: value.modalidade,
  };
}

type PdfReviewState = {
  articleId: string;
  file: File;
  draft: ArticleFormValue;
  metadata: ExtractedArticlePdfMetadata | null;
  metadataError: string | null;
};

export default function AdminPublicacoes() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { data: articles = [], isLoading, isError } = useAdminArticlesQuery(isAuthenticated);
  const { data: areas = [] } = useAreasQuery({ includeEmpty: true });
  const { data: courses = [] } = useCoursesQuery({ includeEmpty: true });
  const updateStatusMutation = useUpdateArticleStatusMutation();
  const updateArticleMutation = useUpdateArticleMutation();
  const deleteArticleMutation = useDeleteArticleMutation();
  const uploadPdfMutation = useUploadArticlePdfMutation();
  const extractPdfMutation = useExtractArticlePdfMetadataMutation();
  const [tab, setTab] = useState<ArticleStatus>("draft");
  const [q, setQ] = useState("");
  const deferredQuery = useDeferredValue(q);
  const [managingId, setManagingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ArticleFormValue | null>(null);
  const [pdfReview, setPdfReview] = useState<PdfReviewState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ articleId: string; title: string } | null>(null);
  const [uploadingArticleId, setUploadingArticleId] = useState<string | null>(null);
  const [downloadingArticleId, setDownloadingArticleId] = useState<string | null>(null);

  const items = useMemo(
    () => articles.filter((article) => article.status === tab),
    [articles, tab],
  );

  const filtered = useMemo(() => {
    const search = deferredQuery.toLowerCase().trim();
    if (!search) return items;

    return items.filter((article) =>
      `${article.title} ${article.authors.join(" ")} ${article.area} ${article.eventTitle ?? ""} ${article.externalId ?? ""}`
        .toLowerCase()
        .includes(search),
    );
  }, [deferredQuery, items]);

  const counts = useMemo(() => {
    return articles.reduce(
      (summary, article) => {
        summary[article.status] += 1;
        return summary;
      },
      { draft: 0, published: 0, archived: 0 },
    );
  }, [articles]);

  const areaSuggestions = useMemo(() => areas.map((area) => area.name), [areas]);
  const courseSuggestions = useMemo(() => courses.map((course) => course.name), [courses]);
  const managingItem = managingId ? articles.find((article) => article.id === managingId) ?? null : null;
  const editingItem = editingId ? articles.find((article) => article.id === editingId) ?? null : null;
  const pdfReviewItem = pdfReview ? articles.find((article) => article.id === pdfReview.articleId) ?? null : null;

  const changeStatus = async (article: Article, status: keyof typeof toApiStatus, successTitle: string) => {
    try {
      await updateStatusMutation.mutateAsync({ id: article.id, status: toApiStatus[status] });
      toast({ title: successTitle, description: article.title });
      setManagingId(null);
    } catch (error) {
      toast({ title: "Falha ao atualizar status", description: getApiErrorMessage(error), variant: "destructive" });
    }
  };

  const openEditDialog = (article: Article) => {
    setEditDraft(articleToFormValue(article));
    setEditingId(article.id);
    setManagingId(null);
  };

  const saveArticleEdit = async () => {
    if (!editingItem || !editDraft || !isArticleFormReady(editDraft)) return;

    try {
      await updateArticleMutation.mutateAsync({
        id: editingItem.id,
        payload: toArticleUpdatePayload(editDraft),
      });
      toast({ title: "Trabalho atualizado", description: editingItem.title });
      setEditingId(null);
      setEditDraft(null);
    } catch (error) {
      toast({ title: "Falha ao salvar alterações", description: getApiErrorMessage(error), variant: "destructive" });
    }
  };

  const preparePdfReview = async (event: React.ChangeEvent<HTMLInputElement>, article: Article) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!isPdfFile(file)) {
      toast({ title: "Arquivo inválido", description: "Selecione um arquivo PDF para continuar.", variant: "destructive" });
      return;
    }

    setUploadingArticleId(article.id);

    let metadata: ExtractedArticlePdfMetadata | null = null;
    let metadataError: string | null = null;

    try {
      metadata = await extractPdfMutation.mutateAsync({ file, eventId: article.eventId });
    } catch (error) {
      metadataError = getApiErrorMessage(
        error,
        "Não foi possível ler os metadados automaticamente. Revise os dados manualmente antes de salvar.",
      );
    } finally {
      setUploadingArticleId(null);
    }

    const baseDraft = articleToFormValue(article);
    setPdfReview({
      articleId: article.id,
      file,
      draft: metadata ? applyExtractedMetadataToArticleForm(baseDraft, metadata) : baseDraft,
      metadata,
      metadataError,
    });
    setManagingId(null);
  };

  const savePdfReview = async () => {
    if (!pdfReview || !pdfReviewItem) return;
    if (!isArticleFormReady(pdfReview.draft)) return;

    try {
      await uploadPdfMutation.mutateAsync({ id: pdfReview.articleId, file: pdfReview.file });

      try {
        await updateArticleMutation.mutateAsync({
          id: pdfReview.articleId,
          payload: toArticleUpdatePayload(pdfReview.draft),
        });
        toast({ title: "PDF e dados atualizados", description: pdfReviewItem.title });
      } catch (error) {
        toast({
          title: "PDF substituído, mas os dados não foram salvos",
          description: getApiErrorMessage(error),
          variant: "destructive",
        });
      }

      setPdfReview(null);
    } catch (error) {
      toast({ title: "Falha ao substituir PDF", description: getApiErrorMessage(error), variant: "destructive" });
    }
  };

  const handlePdfDownload = async (article: Article) => {
    if (!hasAttachedPdf(article)) {
      toast({ title: "PDF indisponível", description: "Este trabalho ainda não possui arquivo anexado.", variant: "destructive" });
      return;
    }

    setDownloadingArticleId(article.id);

    try {
      const blob = await downloadArticlePdf(article.id);
      triggerBrowserDownload(blob, toArticleDownloadName(article));
      await queryClient.invalidateQueries({ queryKey: ["acervo"] });
      toast({ title: "Download iniciado", description: article.title });
    } catch (error) {
      toast({ title: "Falha ao baixar PDF", description: getApiErrorMessage(error), variant: "destructive" });
    } finally {
      setDownloadingArticleId(null);
    }
  };

  const remove = async () => {
    if (!confirmDelete) return;

    try {
      await deleteArticleMutation.mutateAsync(confirmDelete.articleId);
      toast({ title: "Trabalho removido", description: confirmDelete.title });
      setConfirmDelete(null);
      setManagingId(null);
      setEditingId(null);
      setPdfReview(null);
    } catch (error) {
      toast({ title: "Falha ao remover trabalho", description: getApiErrorMessage(error), variant: "destructive" });
    }
  };

  const isUploadingManagingPdf = managingItem ? uploadingArticleId === managingItem.id : false;
  const isDownloadingManagingPdf = managingItem ? downloadingArticleId === managingItem.id : false;
  const managingHasPdf = hasAttachedPdf(managingItem);
  const isSavingEdit = updateArticleMutation.isPending;
  const isSavingPdfReview = uploadPdfMutation.isPending || updateArticleMutation.isPending;

  return (
    <AdminShell title="Publicações">
      <SegmentedControl<ArticleStatus>
        ariaLabel="Status das publicações"
        className="mb-3 grid-cols-3"
        value={tab}
        onValueChange={setTab}
        options={tabs.map((currentTab) => ({
          value: currentTab.key,
          label: (
            <>
              {currentTab.label}
              <span className="rounded-full bg-muted-foreground/15 px-1.5 text-[10px]">
                {counts[currentTab.key]}
              </span>
            </>
          ),
        }))}
      />

      <SearchField
        containerClassName="mb-3"
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="Buscar título, autor, ID externo..."
      />

      <QueryState
        isLoading={isLoading}
        isError={isError}
        isEmpty={filtered.length === 0}
        loadingMessage="Carregando publicações administrativas..."
        errorMessage="Não foi possível carregar as publicações administrativas."
        emptyMessage={q.trim() ? "Nenhum trabalho corresponde a busca atual." : "Nenhum trabalho nesta categoria."}
      >
        <div className="space-y-3">
          {filtered.map((article) => (
            <Card key={article.id} className="border-border/60 p-3 shadow-card">
              <PublicationMetaRow
                eventTitle={article.eventTitle}
                viewCount={article.viewCount}
                downloadCount={article.downloadCount}
              />
              <h3 className="mt-0.5 text-sm font-bold leading-tight">{article.title}</h3>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {article.authors.join(" · ")} · pp. {article.pages}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {article.area}
                </Badge>
                {article.importedFrom && (
                  <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px]">
                    <ExternalLink className="h-2.5 w-2.5" />
                    {article.importedFrom}
                  </Badge>
                )}
                {article.externalId && (
                  <Badge variant="outline" className="h-5 px-1.5 font-mono text-[10px]">
                    {article.externalId}
                  </Badge>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => setManagingId(article.id)}>
                  <Settings2 className="h-3.5 w-3.5" /> Gerenciar
                </Button>

                <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => openEditDialog(article)}>
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>

                {tab === "draft" && (
                  <Button
                    size="sm"
                    className="flex-1 gap-1 bg-success text-success-foreground hover:bg-success/90"
                    onClick={() => changeStatus(article, "published", "Trabalho publicado no Acervo")}
                  >
                    <Send className="h-3.5 w-3.5" /> Publicar
                  </Button>
                )}

                {tab === "published" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1"
                    onClick={() => changeStatus(article, "archived", "Trabalho arquivado")}
                  >
                    <Archive className="h-3.5 w-3.5" /> Arquivar
                  </Button>
                )}

                {tab === "archived" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1"
                    onClick={() => changeStatus(article, "draft", "Trabalho restaurado para rascunho")}
                  >
                    <ArchiveRestore className="h-3.5 w-3.5" /> Restaurar
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmDelete({ articleId: article.id, title: article.title })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </QueryState>

      <Dialog open={Boolean(managingId)} onOpenChange={(open) => !open && setManagingId(null)}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <PublicationMetaRow
              eventTitle={managingItem?.eventTitle}
              viewCount={managingItem?.viewCount}
              downloadCount={managingItem?.downloadCount}
              className="pr-8"
            />
            <DialogTitle className="text-left text-base leading-tight">Gerenciar trabalho</DialogTitle>
            <DialogDescription className="text-left">
              {managingItem?.title}
              {managingItem ? ` · pp. ${managingItem.pages}` : ""}
            </DialogDescription>
          </DialogHeader>

          {managingItem && (
            <>
              <div className="space-y-3 text-sm">
                <Row label="Autores" value={managingItem.authors.join(" · ")} />
                <Row label="Área" value={managingItem.area} />
                <Row label="Cursos" value={managingItem.courses.length ? managingItem.courses.join(", ") : "-"} />
                <Row label="Origem" value={managingItem.importedFrom ?? "-"} />
                <Row label="ID externo" value={managingItem.externalId ?? "-"} mono />
                <Row label="Submetido em" value={managingItem.submittedAt ?? "-"} />
                {managingItem.importedAt && <Row label="Importado em" value={managingItem.importedAt} />}
                {managingItem.publishedAt && <Row label="Publicado em" value={managingItem.publishedAt} />}
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Resumo</div>
                  <p className="leading-relaxed">{managingItem.abstract}</p>
                </div>
                <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  {managingHasPdf ? "PDF anexado" : "PDF não anexado (ainda)"}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 gap-1"
                    onClick={() => openEditDialog(managingItem)}
                  >
                    <Pencil className="h-4 w-4" />
                    Editar dados
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 gap-1"
                    onClick={() => handlePdfDownload(managingItem)}
                    disabled={!managingHasPdf || isDownloadingManagingPdf}
                  >
                    <FileDown className="h-4 w-4" />
                    {isDownloadingManagingPdf ? "Baixando..." : "Baixar PDF"}
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="relative w-full gap-1 overflow-hidden"
                  disabled={isUploadingManagingPdf}
                >
                  <Upload className="h-4 w-4" />
                  {isUploadingManagingPdf ? "Lendo PDF..." : managingHasPdf ? "Substituir PDF" : "Enviar PDF"}
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="absolute inset-0 cursor-pointer opacity-0"
                    onChange={(event) => preparePdfReview(event, managingItem)}
                    disabled={isUploadingManagingPdf}
                  />
                </Button>

                <div className="flex gap-2">
                  {managingItem.status === "draft" && (
                    <Button
                      className="flex-1 gap-1 bg-success text-success-foreground hover:bg-success/90"
                      onClick={() => changeStatus(managingItem, "published", "Trabalho publicado no Acervo")}
                    >
                      <Send className="h-4 w-4" /> Publicar
                    </Button>
                  )}
                  {managingItem.status === "published" && (
                    <Button
                      variant="outline"
                      className="flex-1 gap-1"
                      onClick={() => changeStatus(managingItem, "archived", "Trabalho arquivado")}
                    >
                      <Archive className="h-4 w-4" /> Arquivar
                    </Button>
                  )}
                  {managingItem.status === "archived" && (
                    <Button
                      variant="outline"
                      className="flex-1 gap-1"
                      onClick={() => changeStatus(managingItem, "draft", "Trabalho restaurado para rascunho")}
                    >
                      <ArchiveRestore className="h-4 w-4" /> Restaurar
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingId)}
        onOpenChange={(open) => {
          if (open) return;
          setEditingId(null);
          setEditDraft(null);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-left text-base leading-tight">Editar trabalho</DialogTitle>
            <DialogDescription className="text-left">
              Corrija os dados acadêmicos do trabalho antes de publicar ou manter no acervo.
            </DialogDescription>
          </DialogHeader>

          {editDraft && (
            <ArticleEditorForm
              idPrefix="article-edit"
              value={editDraft}
              onChange={(patch) => setEditDraft((current) => (current ? { ...current, ...patch } : current))}
              areaOptions={areaSuggestions}
              courseOptions={courseSuggestions}
            />
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingId(null);
                setEditDraft(null);
              }}
              disabled={isSavingEdit}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="gap-2 bg-brand text-primary-foreground hover:bg-brand/90"
              onClick={saveArticleEdit}
              disabled={!editDraft || !isArticleFormReady(editDraft) || isSavingEdit}
            >
              <Save className="h-4 w-4" />
              {isSavingEdit ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pdfReview)}
        onOpenChange={(open) => {
          if (open || isSavingPdfReview) return;
          setPdfReview(null);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-left text-base leading-tight">Revisar novo PDF</DialogTitle>
            <DialogDescription className="text-left">
              Confira os dados antes de substituir o arquivo de {pdfReviewItem?.title ?? "trabalho"}.
            </DialogDescription>
          </DialogHeader>

          {pdfReview && (
            <>
              <PdfFileSummary name={pdfReview.file.name} size={pdfReview.file.size} />

              {pdfReview.metadataError ? (
                <div className="flex gap-2 rounded-md bg-amber-500/10 p-3 text-xs text-amber-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>{pdfReview.metadataError}</div>
                </div>
              ) : null}

              <ArticleEditorForm
                idPrefix="article-pdf-review"
                value={pdfReview.draft}
                onChange={(patch) =>
                  setPdfReview((current) =>
                    current ? { ...current, draft: { ...current.draft, ...patch } } : current,
                  )
                }
                areaOptions={areaSuggestions}
                courseOptions={courseSuggestions}
              />

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setPdfReview(null)} disabled={isSavingPdfReview}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="gap-2 bg-brand text-primary-foreground hover:bg-brand/90"
                  onClick={savePdfReview}
                  disabled={!isArticleFormReady(pdfReview.draft) || isSavingPdfReview}
                >
                  <Save className="h-4 w-4" />
                  {isSavingPdfReview ? "Salvando..." : "Salvar alterações"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(confirmDelete)} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este trabalho?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.title}" será excluído do Acervo. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}

function Row({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={`col-span-2 text-sm ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
