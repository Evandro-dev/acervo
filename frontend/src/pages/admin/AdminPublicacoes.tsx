import { useDeferredValue, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, Send, Archive, Trash2, FileText, ExternalLink, ArchiveRestore, Upload, FileDown } from "lucide-react";
import { PublicationMetaRow } from "@/components/publications/PublicationMetaRow";
import { downloadArticlePdf } from "@/features/acervo/api";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  useDeleteArticleMutation,
  useUpdateArticleStatusMutation,
  useUploadArticlePdfMutation,
} from "@/features/acervo/hooks";
import { useAuth } from "@/features/auth/auth-context";
import { toast } from "@/hooks/use-toast";
import { toArticleDownloadName, triggerBrowserDownload } from "@/lib/article-download";
import { getApiErrorMessage } from "@/lib/api";
import { isUsableResourceUrl } from "@/lib/file-links";
import type { Article, ArticleStatus } from "@/types/acervo";

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

export default function AdminPublicacoes() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { data: articles = [], isLoading, isError } = useAdminArticlesQuery(isAuthenticated);
  const updateStatusMutation = useUpdateArticleStatusMutation();
  const deleteArticleMutation = useDeleteArticleMutation();
  const uploadPdfMutation = useUploadArticlePdfMutation();
  const [tab, setTab] = useState<ArticleStatus>("draft");
  const [q, setQ] = useState("");
  const deferredQuery = useDeferredValue(q);
  const [preview, setPreview] = useState<string | null>(null);
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

  const previewItem = preview ? articles.find((article) => article.id === preview) ?? null : null;

  const changeStatus = async (article: Article, status: keyof typeof toApiStatus, successTitle: string) => {
    try {
      await updateStatusMutation.mutateAsync({ id: article.id, status: toApiStatus[status] });
      toast({ title: successTitle, description: article.title });
      setPreview(null);
    } catch (error) {
      toast({ title: "Falha ao atualizar status", description: getApiErrorMessage(error), variant: "destructive" });
    }
  };

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>, article: Article) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadingArticleId(article.id);

    try {
      await uploadPdfMutation.mutateAsync({ id: article.id, file });
      toast({ title: "PDF enviado", description: `${article.title} (${file.name})` });
    } catch (error) {
      toast({ title: "Falha ao enviar PDF", description: getApiErrorMessage(error), variant: "destructive" });
    } finally {
      setUploadingArticleId(null);
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
      setPreview(null);
    } catch (error) {
      toast({ title: "Falha ao remover trabalho", description: getApiErrorMessage(error), variant: "destructive" });
    }
  };

  const isUploadingPreviewPdf = previewItem ? uploadingArticleId === previewItem.id : false;
  const isDownloadingPreviewPdf = previewItem ? downloadingArticleId === previewItem.id : false;
  const previewHasPdf = hasAttachedPdf(previewItem);

  return (
    <AdminShell title="Publicações">
      <div className="mb-3 grid grid-cols-3 gap-2 rounded-md bg-muted p-1 text-xs font-medium">
        {tabs.map((currentTab) => (
          <button
            key={currentTab.key}
            type="button"
            onClick={() => setTab(currentTab.key)}
            className={`flex items-center justify-center gap-1 rounded px-2 py-1.5 transition-colors ${
              tab === currentTab.key
                ? "bg-background shadow-card"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
            }`}
          >
            {currentTab.label}
            <span className="rounded-full bg-muted-foreground/15 px-1.5 text-[10px]">{counts[currentTab.key]}</span>
          </button>
        ))}
      </div>

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
                <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => setPreview(article.id)}>
                  <Eye className="h-3.5 w-3.5" /> Ver
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

      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <PublicationMetaRow
              eventTitle={previewItem?.eventTitle}
              viewCount={previewItem?.viewCount}
              downloadCount={previewItem?.downloadCount}
              className="pr-8"
            />
            <DialogTitle className="text-left text-base leading-tight">{previewItem?.title}</DialogTitle>
            <DialogDescription className="text-left">
              {previewItem?.authors.join(" · ")} · pp. {previewItem?.pages}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <Row label="Área" value={previewItem?.area} />
            <Row label="Origem" value={previewItem?.importedFrom ?? "-"} />
            <Row label="ID externo" value={previewItem?.externalId ?? "-"} mono />
            <Row label="Submetido em" value={previewItem?.submittedAt ?? "-"} />
            {previewItem?.importedAt && <Row label="Importado em" value={previewItem.importedAt} />}
            {previewItem?.publishedAt && <Row label="Publicado em" value={previewItem.publishedAt} />}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Resumo</div>
              <p className="leading-relaxed">{previewItem?.abstract}</p>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
              <FileText className="h-4 w-4" />
              {previewHasPdf ? "PDF anexado" : "PDF não anexado (ainda)"}
            </div>
          </div>
          {previewItem && (
            <div className="space-y-2 pt-2">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 gap-1"
                  onClick={() => handlePdfDownload(previewItem)}
                  disabled={!previewHasPdf || isDownloadingPreviewPdf}
                >
                  <FileDown className="h-4 w-4" />
                  {isDownloadingPreviewPdf ? "Baixando..." : "Baixar PDF"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="relative flex-1 gap-1 overflow-hidden"
                  disabled={isUploadingPreviewPdf}
                >
                  <Upload className="h-4 w-4" />
                  {isUploadingPreviewPdf ? "Enviando..." : previewHasPdf ? "Substituir PDF" : "Enviar PDF"}
                  <input
                    type="file"
                    accept="application/pdf"
                    className="absolute inset-0 cursor-pointer opacity-0"
                    onChange={(event) => handlePdfUpload(event, previewItem)}
                    disabled={isUploadingPreviewPdf}
                  />
                </Button>
              </div>

              <div className="flex gap-2">
                {previewItem.status !== "published" && (
                  <Button
                    className="flex-1 gap-1 bg-success text-success-foreground hover:bg-success/90"
                    onClick={() => changeStatus(previewItem, "published", "Trabalho publicado no Acervo")}
                  >
                    <Send className="h-4 w-4" /> Publicar
                  </Button>
                )}
                {previewItem.status === "published" && (
                  <Button
                    variant="outline"
                    className="flex-1 gap-1"
                    onClick={() => changeStatus(previewItem, "archived", "Trabalho arquivado")}
                  >
                    <Archive className="h-4 w-4" /> Arquivar
                  </Button>
                )}
              </div>
            </div>
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
