import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DownloadCloud,
  FileText,
  Info,
  Plus,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AdminShell } from "@/components/admin/AdminShell";
import { PdfFilePicker } from "@/components/admin/PdfFilePicker";
import { AreaCombobox } from "@/components/ui/area-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QueryState } from "@/components/ui/query-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  useAdminEventsQuery,
  useAreasQuery,
  useCoursesQuery,
  useExtractArticlePdfMetadataMutation,
  useImportArticlesMutation,
  useUploadArticlePdfMutation,
} from "@/features/acervo/hooks";
import { useAuth } from "@/features/auth/auth-context";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api";
import { formatFileSize } from "@/lib/file-size";
import type { ExtractedArticlePdfMetadata, ImportArticleInput } from "@/types/acervo";

const modalidades = ["Resumo Simples", "Resumo Expandido", "Artigo Científico"] as const;
type Modalidade = (typeof modalidades)[number];
type PdfQueueStatus = "pending" | "reading" | "ready" | "failed" | "saving" | "saved" | "partial";

type Draft = {
  title: string;
  authors: string;
  area: string;
  courses: string;
  abstract: string;
  modalidade: Modalidade;
};

type PdfDraft = Draft & {
  pages: string;
};

type PdfQueueItem = {
  id: string;
  file: File;
  draft: PdfDraft;
  metadata: ExtractedArticlePdfMetadata | null;
  status: PdfQueueStatus;
  error: string | null;
};

const emptyDraft = (): Draft => ({
  title: "",
  authors: "",
  area: "",
  courses: "",
  abstract: "",
  modalidade: "Resumo Simples",
});

const emptyPdfDraft = (): PdfDraft => ({
  ...emptyDraft(),
  pages: "",
});

const toImportItem = (draft: Draft): ImportArticleInput => ({
  title: draft.title,
  authors: draft.authors
    .split(",")
    .map((author) => author.trim())
    .filter(Boolean),
  area: draft.area || "Geral",
  courses: splitCommaSeparated(draft.courses),
  abstract: draft.abstract,
  modality: draft.modalidade,
  importedFrom: "Importação manual",
  submittedAt: new Date().toISOString().slice(0, 10),
});

const toPdfImportItem = (draft: PdfDraft): ImportArticleInput => ({
  title: draft.title,
  authors: draft.authors
    .split(",")
    .map((author) => author.trim())
    .filter(Boolean),
  area: draft.area || "Geral",
  courses: splitCommaSeparated(draft.courses),
  abstract: draft.abstract,
  pages: draft.pages || undefined,
  modality: draft.modalidade,
  importedFrom: "Leitura automática de PDF",
  submittedAt: new Date().toISOString().slice(0, 10),
});

function splitCommaSeparated(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function inferModalidadeFromPageCount(pageCount: number): Modalidade {
  if (!Number.isFinite(pageCount) || pageCount <= 1) return modalidades[0];
  if (pageCount <= 5) return modalidades[1];
  return modalidades[2];
}

function formatPageRangeFromPageCount(pageCount: number) {
  if (!Number.isFinite(pageCount) || pageCount <= 0) return "";
  if (pageCount === 1) return "1";
  return `1-${pageCount}`;
}

function createPdfQueueItem(file: File): PdfQueueItem {
  return {
    id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    draft: emptyPdfDraft(),
    metadata: null,
    status: "pending",
    error: null,
  };
}

function applyMetadataToPdfDraft(draft: PdfDraft, metadata: ExtractedArticlePdfMetadata): PdfDraft {
  return {
    ...draft,
    title: draft.title || metadata.title || draft.title,
    authors: draft.authors || (metadata.authors.length ? metadata.authors.join(", ") : draft.authors),
    abstract: draft.abstract || metadata.abstract || draft.abstract,
    area: draft.area || metadata.suggestedArea || draft.area,
    pages: draft.pages || formatPageRangeFromPageCount(metadata.pageCount),
    modalidade: inferModalidadeFromPageCount(metadata.pageCount),
  };
}

function canImportPdfItem(item: PdfQueueItem) {
  return Boolean(item.draft.title.trim() && item.draft.authors.trim());
}

function getPdfStatusMeta(status: PdfQueueStatus) {
  switch (status) {
    case "pending":
      return { label: "Pendente", variant: "outline" as const, className: "border-dashed" };
    case "reading":
      return { label: "Lendo", variant: "secondary" as const, className: "" };
    case "ready":
      return {
        label: "Pronto para revisar",
        variant: "outline" as const,
        className: "border-emerald-200 bg-emerald-500/10 text-emerald-700",
      };
    case "failed":
      return {
        label: "Leitura falhou",
        variant: "outline" as const,
        className: "border-amber-200 bg-amber-500/10 text-amber-700",
      };
    case "saving":
      return { label: "Salvando", variant: "secondary" as const, className: "" };
    case "saved":
      return {
        label: "Salvo com PDF",
        variant: "outline" as const,
        className: "border-emerald-200 bg-emerald-600/10 text-emerald-700",
      };
    case "partial":
      return {
        label: "Salvo sem PDF",
        variant: "outline" as const,
        className: "border-amber-200 bg-amber-500/10 text-amber-700",
      };
    default:
      return { label: "Pendente", variant: "outline" as const, className: "" };
  }
}

export default function AdminImportar() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { data: events = [], isLoading, isError } = useAdminEventsQuery(isAuthenticated);
  const { data: areas = [] } = useAreasQuery({ includeEmpty: true });
  const { data: courses = [] } = useCoursesQuery({ includeEmpty: true });
  const importMutation = useImportArticlesMutation();
  const uploadPdfMutation = useUploadArticlePdfMutation();
  const extractPdfMutation = useExtractArticlePdfMetadataMutation();
  const [eventId, setEventId] = useState("");
  const [publishNow, setPublishNow] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([emptyDraft()]);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [pdfItems, setPdfItems] = useState<PdfQueueItem[]>([]);
  const [activePdfIndex, setActivePdfIndex] = useState(0);
  const [isBatchReading, setIsBatchReading] = useState(false);
  const [isBatchSaving, setIsBatchSaving] = useState(false);
  const reviewCardRef = useRef<HTMLDivElement | null>(null);
  const reviewWasVisibleRef = useRef(false);

  const selectedEventId = eventId || events[0]?.id || "";
  const event = events.find((currentEvent) => currentEvent.id === selectedEventId);
  const areaSuggestions = useMemo(
    () =>
      Array.from(new Set([...areas.map((area) => area.name), ...(event?.themes ?? [])])).sort((left, right) =>
        left.localeCompare(right),
      ),
    [areas, event?.themes],
  );

  const activePdfItem = pdfItems[activePdfIndex] ?? null;
  const isFirstPdfItem = activePdfIndex === 0;
  const isLastPdfItem = activePdfIndex >= pdfItems.length - 1;
  const pendingPdfCount = pdfItems.filter((item) => item.status === "pending").length;
  const failedPdfCount = pdfItems.filter((item) => item.status === "failed").length;
  const readyPdfCount = pdfItems.filter((item) => item.status === "ready").length;
  const savedPdfCount = pdfItems.filter((item) => item.status === "saved").length;
  const importablePdfItems = pdfItems.filter(canImportPdfItem);
  const hasStartedPdfProcessing = pdfItems.some((item) => item.status !== "pending");
  const showActivePdfReview = Boolean(
    activePdfItem && activePdfItem.status !== "pending" && activePdfItem.status !== "reading",
  );
  const validManual = useMemo(
    () => drafts.filter((draft) => draft.title.trim() && draft.authors.trim()).length,
    [drafts],
  );
  const isImporting = importMutation.isPending || uploadPdfMutation.isPending || isBatchSaving;

  useEffect(() => {
    const reviewJustBecameVisible = showActivePdfReview && !reviewWasVisibleRef.current;
    reviewWasVisibleRef.current = showActivePdfReview;

    if (!reviewJustBecameVisible) return;

    reviewCardRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [showActivePdfReview]);

  const updateDraft = (index: number, patch: Partial<Draft>) =>
    setDrafts((currentDrafts) =>
      currentDrafts.map((draft, currentIndex) => (currentIndex === index ? { ...draft, ...patch } : draft)),
    );

  const removeDraft = (index: number) =>
    setDrafts((currentDrafts) => currentDrafts.filter((_, currentIndex) => currentIndex !== index));

  const addDraft = () => setDrafts((currentDrafts) => [...currentDrafts, emptyDraft()]);

  const updateActivePdfDraft = (patch: Partial<PdfDraft>) => {
    if (!activePdfItem) return;

    setPdfItems((currentItems) =>
      currentItems.map((item) =>
        item.id === activePdfItem.id
          ? {
              ...item,
              draft: { ...item.draft, ...patch },
            }
          : item,
      ),
    );
  };

  const goToPreviousPdf = () => setActivePdfIndex((currentIndex) => Math.max(0, currentIndex - 1));
  const goToNextPdf = () =>
    setActivePdfIndex((currentIndex) => Math.min(Math.max(pdfItems.length - 1, 0), currentIndex + 1));

  const importManual = async () => {
    if (!selectedEventId || validManual === 0) return;
    const items = drafts
      .filter((draft) => draft.title.trim() && draft.authors.trim())
      .map((draft) => toImportItem(draft));

    try {
      const result = await importMutation.mutateAsync({
        eventId: selectedEventId,
        publishImmediately: publishNow,
        items,
      });

      toast({
        title: `${result.count} ${result.count === 1 ? "trabalho importado" : "trabalhos importados"}`,
        description: publishNow ? "Já disponíveis no Acervo." : "Salvos como rascunho para revisão.",
      });
      navigate("/admin/publicacoes");
    } catch (error) {
      toast({ title: "Falha na importação", description: getApiErrorMessage(error), variant: "destructive" });
    }
  };

  const parseJson = (): ImportArticleInput[] | null => {
    setJsonError(null);

    try {
      const data = JSON.parse(jsonText);
      const rows = Array.isArray(data) ? data : [data];

      return rows.map((row, index) => {
        if (!row.title) throw new Error(`Item ${index + 1}: campo "title" obrigatório`);
        if (!row.authors) throw new Error(`Item ${index + 1}: campo "authors" obrigatório`);

        const authors = Array.isArray(row.authors)
          ? row.authors
          : String(row.authors)
              .split(",")
              .map((author: string) => author.trim())
              .filter(Boolean);

        const modalidade = (modalidades as readonly string[]).includes(row.modalidade)
          ? (row.modalidade as Modalidade)
          : "Resumo Simples";

        return {
          title: String(row.title),
          authors,
          area: String(row.area ?? "Geral"),
          courses: Array.isArray(row.courses)
            ? row.courses.map(String)
            : splitCommaSeparated(String(row.courses ?? "")),
          abstract: String(row.abstract ?? ""),
          pages: row.pages ? String(row.pages) : undefined,
          modality: modalidade,
          importedFrom: String(row.importedFrom ?? "Arquivo JSON"),
          externalId: row.externalId ? String(row.externalId) : undefined,
          submittedAt: String(row.submittedAt ?? new Date().toISOString().slice(0, 10)),
          pdfUrl: row.pdfUrl ? String(row.pdfUrl) : undefined,
        } satisfies ImportArticleInput;
      });
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : "Arquivo inválido");
      return null;
    }
  };

  const importFile = async () => {
    const items = parseJson();
    if (!items || !selectedEventId) return;

    try {
      const result = await importMutation.mutateAsync({
        eventId: selectedEventId,
        publishImmediately: publishNow,
        items,
      });

      toast({
        title: `${result.count} ${result.count === 1 ? "trabalho importado" : "trabalhos importados"}`,
        description: publishNow ? "Já disponáveis no Acervo." : "Salvos como rascunho para revisão.",
      });
      navigate("/admin/publicacoes");
    } catch (error) {
      toast({ title: "Falha na importação", description: getApiErrorMessage(error), variant: "destructive" });
    }
  };

  const onJsonFile = async (file: File) => {
    const text = await file.text();
    setJsonText(text);
    toast({ title: "Arquivo carregado", description: file.name });
  };

  const onPdfFiles = (files: ArrayLike<File> | null) => {
    if (!files?.length) return;

    const selectedFiles = Array.from(files).filter(isPdfFile);
    if (!selectedFiles.length) {
      toast({
        title: "Nenhum PDF válido encontrado",
        description: "Selecione arquivos .pdf para continuar.",
        variant: "destructive",
      });
      return;
    }

    const nextItems = selectedFiles.map((file) => createPdfQueueItem(file));
    const wasEmpty = pdfItems.length === 0;

    setPdfItems((currentItems) => [...currentItems, ...nextItems]);
    if (wasEmpty) {
      setActivePdfIndex(0);
    }

    toast({
      title: `${nextItems.length} ${nextItems.length === 1 ? "PDF carregado" : "PDFs carregados"}`,
      description:
        nextItems.length === 1
          ? nextItems[0].file.name
          : `${nextItems.length} arquivos adicionados a fila de revisão.`,
    });
  };

  const clearPdfQueue = () => {
    setPdfItems([]);
    setActivePdfIndex(0);
  };

  const removeActivePdfItem = () => {
    if (!activePdfItem) return;

    const nextItems = pdfItems.filter((item) => item.id !== activePdfItem.id);
    setPdfItems(nextItems);
    setActivePdfIndex(nextItems.length ? Math.min(activePdfIndex, nextItems.length - 1) : 0);
  };

  const readAllPdfMetadata = async () => {
    if (!pdfItems.length) return;

    const targetItems = pdfItems.filter((item) => item.status === "pending" || item.status === "failed");
    if (!targetItems.length) {
      toast({
        title: "Nenhum PDF pendente",
        description: "Todos os arquivos da fila já foram lidos.",
      });
      return;
    }

    setIsBatchReading(true);
    let successCount = 0;
    let failureCount = 0;

    try {
      for (const item of targetItems) {
        setPdfItems((currentItems) =>
          currentItems.map((currentItem) =>
            currentItem.id === item.id
              ? {
                  ...currentItem,
                  status: "reading",
                  error: null,
                }
              : currentItem,
          ),
        );

        try {
          const metadata = await extractPdfMutation.mutateAsync({ file: item.file, eventId: selectedEventId });
          successCount += 1;

          setPdfItems((currentItems) =>
            currentItems.map((currentItem) =>
              currentItem.id === item.id
                ? {
                    ...currentItem,
                    metadata,
                    draft: applyMetadataToPdfDraft(currentItem.draft, metadata),
                    status: "ready",
                    error: null,
                  }
                : currentItem,
            ),
          );
        } catch (error) {
          failureCount += 1;
          setPdfItems((currentItems) =>
            currentItems.map((currentItem) =>
              currentItem.id === item.id
                ? {
                    ...currentItem,
                    status: "failed",
                    error: getApiErrorMessage(error, "Não foi possível ler este PDF."),
                  }
                : currentItem,
            ),
          );
        }
      }

      toast({
        title: "Leitura em lote concluída",
        description:
          failureCount > 0
            ? `${successCount} PDFs lidos com sucesso e ${failureCount} com falha.`
            : `${successCount} ${successCount === 1 ? "PDF lido" : "PDFs lidos"} com sucesso.`,
      });
    } finally {
      setIsBatchReading(false);
    }
  };

  const importPdfBatch = async () => {
    if (!selectedEventId || importablePdfItems.length === 0) return;

    const previousStatuses = new Map(importablePdfItems.map((item) => [item.id, item.status]));
    const importableIds = new Set(importablePdfItems.map((item) => item.id));

    setIsBatchSaving(true);
    setPdfItems((currentItems) =>
      currentItems.map((item) =>
        importableIds.has(item.id)
          ? {
              ...item,
              status: "saving",
              error: null,
            }
          : item,
      ),
    );

    try {
      const result = await importMutation.mutateAsync({
        eventId: selectedEventId,
        publishImmediately: publishNow,
        items: importablePdfItems.map((item) => toPdfImportItem(item.draft)),
      });

      const savedIds = new Set<string>();
      const partialIds = new Set<string>();
      const partialMessages = new Map<string, string>();

      for (const [index, item] of importablePdfItems.entries()) {
        const createdArticle = result.items[index];

        if (!createdArticle?.id) {
          partialIds.add(item.id);
          partialMessages.set(item.id, "O trabalho foi criado, mas o PDF precisa ser anexado manualmente.");
          continue;
        }

        try {
          await uploadPdfMutation.mutateAsync({ id: createdArticle.id, file: item.file });
          savedIds.add(item.id);
        } catch (error) {
          partialIds.add(item.id);
          partialMessages.set(
            item.id,
            getApiErrorMessage(error, "Abra a publicação na curadoria e anexe o PDF manualmente."),
          );
        }
      }

      setPdfItems((currentItems) =>
        currentItems.map((item) => {
          if (savedIds.has(item.id)) {
            return { ...item, status: "saved", error: null };
          }

          if (partialIds.has(item.id)) {
            return {
              ...item,
              status: "partial",
              error: partialMessages.get(item.id) ?? "O PDF não foi anexado automaticamente.",
            };
          }

          return item;
        }),
      );

      if (partialIds.size > 0) {
        toast({
          title: "Importação concluída com pendências",
          description:
            partialIds.size === 1
              ? "1 trabalho foi salvo sem anexar o PDF automaticamente."
              : `${partialIds.size} trabalhos foram salvos sem anexar o PDF automaticamente.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: `${result.count} ${result.count === 1 ? "trabalho importado" : "trabalhos importados"}`,
          description: publishNow ? "Já disponíveis no Acervo." : "Salvos como rascunho para revisão.",
        });
      }

      navigate("/admin/publicacoes");
    } catch (error) {
      setPdfItems((currentItems) =>
        currentItems.map((item) =>
          importableIds.has(item.id)
            ? {
                ...item,
                status: previousStatuses.get(item.id) ?? "ready",
              }
            : item,
        ),
      );
      toast({ title: "Falha na importação do lote", description: getApiErrorMessage(error), variant: "destructive" });
    } finally {
      setIsBatchSaving(false);
    }
  };

  return (
    <AdminShell title="Importar trabalhos">
      <Card className="mb-3 flex gap-2 border-border/60 bg-brand-soft p-3 text-xs text-primary-dark shadow-card">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Por padrão, os trabalhos importados ficam como <strong>rascunho</strong>: revise-os em{" "}
          <strong>Publicações</strong> antes de torná-los públicos. Se preferir, ative{" "}
          <strong>Publicar imediatamente</strong> para disponibilizá-los direto no Acervo.
        </p>
      </Card>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        isEmpty={!events.length}
        loadingMessage="Carregando eventos para importação..."
        errorMessage="Não foi possível carregar os eventos para importação."
        emptyMessage="Cadastre um evento antes de importar trabalhos."
      >
        <>
          <datalist id="course-suggestions">
            {courses.map((course) => (
              <option key={course.id} value={course.name} />
            ))}
          </datalist>
          <Card className="mb-3 border-border/60 p-3 shadow-card">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label>Evento de destino</Label>
                <Select value={selectedEventId} onValueChange={setEventId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um evento" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((currentEvent) => (
                      <SelectItem key={currentEvent.id} value={currentEvent.id}>
                        {currentEvent.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex cursor-pointer items-center justify-between rounded-md border border-border bg-muted/30 p-3">
                <div>
                  <div className="text-sm font-semibold">Publicar imediatamente</div>
                  <div className="text-[11px] text-muted-foreground">
                    Pula o rascunho e disponibiliza imediatamente no Acervo após importação.
                  </div>
                </div>
                <Switch checked={publishNow} onCheckedChange={setPublishNow} />
              </label>
            </div>
          </Card>

          <Card className="border-border/60 p-3 shadow-card" data-testid="import-mode-card">
            <Tabs defaultValue="manual" className="w-full">
              <TabsList className="grid w-full grid-cols-2 gap-2">
              <TabsTrigger value="manual" className="text-xs hover:bg-background/70 hover:text-foreground">
                <Plus className="mr-1 h-3.5 w-3.5" /> Manual
              </TabsTrigger>
              <TabsTrigger value="pdf" className="text-xs hover:bg-background/70 hover:text-foreground">
                <Sparkles className="mr-1 h-3.5 w-3.5" /> PDF
              </TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="mt-3 space-y-3">
              {drafts.map((draft, index) => (
                <Card key={index} className="border-border/60 p-3 shadow-card">
                  <div className="mb-2 flex items-center justify-between">
                    <Badge variant="secondary" className="text-[10px]">
                      Trabalho {index + 1}
                    </Badge>
                    {drafts.length > 1 && (
                      <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => removeDraft(index)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <div>
                      <Label className="text-xs">Título *</Label>
                      <Input value={draft.title} onChange={(event) => updateDraft(index, { title: event.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Autores * (separados por virgula)</Label>
                      <Input
                        value={draft.authors}
                        onChange={(event) => updateDraft(index, { authors: event.target.value })}
                        placeholder="Ana Silva, Carlos Lima"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Área</Label>
                        <AreaCombobox
                          value={draft.area}
                          options={areaSuggestions}
                          onValueChange={(area) => updateDraft(index, { area })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Modalidade</Label>
                        <Select
                          value={draft.modalidade}
                          onValueChange={(value) => updateDraft(index, { modalidade: value as Modalidade })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {modalidades.map((modalidade) => (
                              <SelectItem key={modalidade} value={modalidade}>
                                {modalidade}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Cursos relacionados (separados por vírgula)</Label>
                      <Input
                        list="course-suggestions"
                        value={draft.courses}
                        onChange={(event) => updateDraft(index, { courses: event.target.value })}
                        placeholder="Ex.: Direito, Administração"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Resumo</Label>
                      <Textarea
                        rows={3}
                        value={draft.abstract}
                        onChange={(event) => updateDraft(index, { abstract: event.target.value })}
                      />
                    </div>
                  </div>
                </Card>
              ))}

              <Button variant="outline" className="w-full gap-1.5" onClick={addDraft}>
                <Plus className="h-4 w-4" /> Adicionar outro trabalho
              </Button>

              <Button
                className="w-full gap-2 bg-brand text-primary-foreground hover:opacity-90"
                disabled={validManual === 0 || !selectedEventId || importMutation.isPending}
                onClick={importManual}
              >
                <DownloadCloud className="h-4 w-4" />
                {importMutation.isPending
                  ? "Importando..."
                  : `Importar ${validManual} ${validManual === 1 ? "trabalho" : "trabalhos"}`}
              </Button>
            </TabsContent>

            <TabsContent value="file" className="mt-3 space-y-3">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 px-3 py-10 text-center text-sm text-muted-foreground hover:bg-muted/50">
                <Upload className="h-6 w-6" />
                <div>
                  <div className="font-semibold text-foreground">Selecionar arquivo .json</div>
                  <div className="text-[11px]">Exportado do OJS, formulário ou planilha</div>
                </div>
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(event) => event.target.files?.[0] && onJsonFile(event.target.files[0])}
                />
              </label>
              {jsonText && (
                <Card className="border-border/60 p-3 shadow-card">
                  <Label className="text-xs">Conteúdo carregado</Label>
                  <Textarea
                    rows={6}
                    value={jsonText}
                    onChange={(event) => setJsonText(event.target.value)}
                    className="mt-1 font-mono text-xs"
                  />
                  {jsonError && (
                    <div className="mt-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">{jsonError}</div>
                  )}
                </Card>
              )}
              <Button
                className="w-full gap-2 bg-brand text-primary-foreground hover:opacity-90"
                disabled={!jsonText.trim() || !selectedEventId || importMutation.isPending}
                onClick={importFile}
              >
                <DownloadCloud className="h-4 w-4" /> {importMutation.isPending ? "Importando..." : "Importar arquivo"}
              </Button>
            </TabsContent>

            <TabsContent value="pdf" className="mt-3 space-y-3">
              <Card className="border-border/60 p-3 shadow-card">
                <div className="mb-3 flex items-start gap-2 text-xs text-muted-foreground">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  <p>
                    Selecione vários PDFs, mande o sistema ler todos de uma vez e revise o arquivo atual com as setas.
                    O contador mostra sua posição na fila e você pode salvar o lote inteiro depois.
                  </p>
                </div>

                {!pdfItems.length ? (
                  <PdfFilePicker
                    title="Selecionar arquivos .pdf"
                    description="A leitura automática funciona melhor com PDFs acadêmicos digitais."
                    multiple
                    onFilesChange={(files) => onPdfFiles(files)}
                  />
                ) : (
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="Arquivo anterior"
                            className="size-8 rounded-full"
                            disabled={isFirstPdfItem}
                            onClick={goToPreviousPdf}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Badge variant="secondary" className="min-w-20 justify-center">
                            {activePdfIndex + 1} de {pdfItems.length}
                          </Badge>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="Próximo arquivo"
                            className="size-8 rounded-full"
                            disabled={isLastPdfItem}
                            onClick={goToNextPdf}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="font-semibold text-foreground">{activePdfItem?.file.name}</div>
                        <div className="text-xs text-muted-foreground">{formatFileSize(activePdfItem?.file.size ?? 0)}</div>
                      </div>
                      {activePdfItem ? (
                        <Badge
                          variant={getPdfStatusMeta(activePdfItem.status).variant}
                          className={getPdfStatusMeta(activePdfItem.status).className}
                        >
                          {getPdfStatusMeta(activePdfItem.status).label}
                        </Badge>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
                        <Upload className="h-4 w-4" /> Adicionar PDFs
                        <input
                          type="file"
                          accept="application/pdf,.pdf"
                          multiple
                          className="hidden"
                          onChange={(event) => {
                            onPdfFiles(event.target.files);
                            event.target.value = "";
                          }}
                        />
                      </label>
                      <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={removeActivePdfItem}>
                        <X className="h-4 w-4" /> Remover atual
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={clearPdfQueue}>
                        Limpar fila
                      </Button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline">{pendingPdfCount} pendentes</Badge>
                      <Badge
                        variant="outline"
                        className={
                          hasStartedPdfProcessing
                            ? "border-emerald-200 bg-emerald-500/10 text-emerald-700"
                            : "border-dashed border-border bg-muted/40 text-muted-foreground"
                        }
                      >
                        {readyPdfCount} prontos
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          hasStartedPdfProcessing
                            ? "border-amber-200 bg-amber-500/10 text-amber-700"
                            : "border-dashed border-border bg-muted/40 text-muted-foreground"
                        }
                      >
                        {failedPdfCount} com falha
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          hasStartedPdfProcessing
                            ? "border-sky-200 bg-sky-500/10 text-sky-700"
                            : "border-dashed border-border bg-muted/40 text-muted-foreground"
                        }
                      >
                        {savedPdfCount} salvos
                      </Badge>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="mt-3 w-full gap-2"
                      disabled={isBatchReading}
                      onClick={readAllPdfMetadata}
                    >
                      <Sparkles className="h-4 w-4" />
                      {isBatchReading
                        ? "Lendo PDFs da fila..."
                        : `Ler ${
                            pendingPdfCount + failedPdfCount || pdfItems.length
                          } ${pendingPdfCount + failedPdfCount === 1 ? "PDF pendente" : "PDFs pendentes"}`}
                    </Button>
                    <p className="mt-2 text-xs text-muted-foreground">
                      O botão acima processa todos os PDFs pendentes ou com falha da fila de uma vez.
                    </p>
                  </div>
                )}
              </Card>

              {activePdfItem?.error ? (
                <Card className="border-amber-200 bg-amber-500/10 p-3 shadow-card">
                  <div className="flex gap-2 text-xs text-amber-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <div className="font-semibold">Falha na leitura deste PDF</div>
                      <div>{activePdfItem.error}</div>
                    </div>
                  </div>
                </Card>
              ) : null}

              {showActivePdfReview ? (
                <Card ref={reviewCardRef} className="border-border/60 p-3 shadow-card">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">Revisão do arquivo atual</div>
                      <div className="text-xs text-muted-foreground">
                        Corrija os campos deste PDF antes de salvar.
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label="Arquivo anterior na revisão"
                          className="size-8 rounded-full"
                          disabled={isFirstPdfItem}
                          onClick={goToPreviousPdf}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Badge variant="secondary" className="min-w-20 justify-center">
                          {activePdfIndex + 1} de {pdfItems.length}
                        </Badge>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label="Próximo arquivo na revisão"
                          className="size-8 rounded-full"
                          disabled={isLastPdfItem}
                          onClick={goToNextPdf}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                      {activePdfItem.status === "saved" ? (
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-500/10 text-emerald-700">
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Importado
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  {activePdfItem?.metadata ? (
                    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{activePdfItem.metadata.pageCount} páginas</Badge>
                        <Badge variant="outline">{activePdfItem.metadata.authors.length} autores sugeridos</Badge>
                        <Badge variant="outline">{activePdfItem.metadata.emails.length} e-mails encontrados</Badge>
                      </div>

                      {activePdfItem.metadata.emails.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          <strong className="text-foreground">E-mails:</strong> {activePdfItem.metadata.emails.join(", ")}
                        </div>
                      )}

                      {activePdfItem.metadata.areaSuggestions.length > 0 && (
                        <div>
                          <div className="mb-1 text-xs text-muted-foreground">
                            <strong className="text-foreground">Área sugerida:</strong>{" "}
                            {activePdfItem.metadata.suggestedArea ?? "Sem sugestão forte"}
                            {activePdfItem.metadata.areaSuggestionConfidence
                              ? ` (${activePdfItem.metadata.areaSuggestionConfidence})`
                              : ""}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {activePdfItem.metadata.areaSuggestions.map((suggestion) => (
                              <Button
                                key={`${activePdfItem.id}-${suggestion.name}`}
                                type="button"
                                size="sm"
                                variant={activePdfItem.draft.area === suggestion.name ? "default" : "outline"}
                                className="h-7 px-2 text-[11px]"
                                onClick={() => updateActivePdfDraft({ area: suggestion.name })}
                              >
                                {suggestion.name}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}

                      {activePdfItem.metadata.warnings.length > 0 && (
                        <div className="rounded-md bg-amber-500/10 p-3 text-xs text-amber-700">
                          {activePdfItem.metadata.warnings.map((warning) => (
                            <div key={warning}>{warning}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-2">
                    <div>
                      <Label className="text-xs">Título *</Label>
                      <Input
                        value={activePdfItem!.draft.title}
                        onChange={(event) => updateActivePdfDraft({ title: event.target.value })}
                        placeholder="Preenchido automaticamente quando possível"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Autores * (separados por virgula)</Label>
                      <Input
                        value={activePdfItem!.draft.authors}
                        onChange={(event) => updateActivePdfDraft({ authors: event.target.value })}
                        placeholder="Ana Silva, Carlos Lima"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <div>
                        <Label className="text-xs">Área do artigo</Label>
                        <AreaCombobox
                          value={activePdfItem!.draft.area}
                          options={areaSuggestions}
                          onValueChange={(area) => updateActivePdfDraft({ area })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Modalidade</Label>
                        <Select
                          value={activePdfItem!.draft.modalidade}
                          onValueChange={(value) => updateActivePdfDraft({ modalidade: value as Modalidade })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {modalidades.map((modalidade) => (
                              <SelectItem key={modalidade} value={modalidade}>
                                {modalidade}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Páginas</Label>
                        <Input
                          value={activePdfItem!.draft.pages}
                          onChange={(event) => updateActivePdfDraft({ pages: event.target.value })}
                          placeholder="Ex.: 15-28"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Cursos relacionados (separados por vírgula)</Label>
                      <Input
                        list="course-suggestions"
                        value={activePdfItem!.draft.courses}
                        onChange={(event) => updateActivePdfDraft({ courses: event.target.value })}
                        placeholder="Ex.: Enfermagem, Biomedicina"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Resumo</Label>
                      <Textarea
                        rows={6}
                        value={activePdfItem!.draft.abstract}
                        onChange={(event) => updateActivePdfDraft({ abstract: event.target.value })}
                        placeholder="Preenchido automaticamente quando possível"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Arquivo anterior na revisão"
                      className="size-8 rounded-full"
                      disabled={isFirstPdfItem}
                      onClick={goToPreviousPdf}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Badge variant="secondary" className="min-w-20 justify-center">
                      {activePdfIndex + 1} de {pdfItems.length}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Próximo arquivo na revisão"
                      className="size-8 rounded-full"
                      disabled={isLastPdfItem}
                      onClick={goToNextPdf}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ) : null}

              {pdfItems.length > 0 ? (
                <Card className="border-border/60 p-3 shadow-card">
                  <div className="flex flex-col gap-2">
                    <div className="text-sm font-semibold">
                      {importablePdfItems.length}{" "}
                      {importablePdfItems.length === 1 ? "trabalho pronto para salvar" : "trabalhos prontos para salvar"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Os itens sem título ou autores ficam na fila até você revisar.
                    </div>
                  </div>
                </Card>
              ) : null}

              <Button
                className="w-full gap-2 bg-brand text-primary-foreground hover:opacity-90"
                disabled={importablePdfItems.length === 0 || !selectedEventId || isImporting || isBatchReading}
                onClick={importPdfBatch}
              >
                <DownloadCloud className="h-4 w-4" />
                {isImporting
                  ? "Salvando lote..."
                  : `Salvar ${importablePdfItems.length} ${
                      importablePdfItems.length === 1 ? "trabalho" : "trabalhos"
                    } e anexar PDFs`}
              </Button>
              </TabsContent>
            </Tabs>
          </Card>
        </>
      </QueryState>
    </AdminShell>
  );
}
