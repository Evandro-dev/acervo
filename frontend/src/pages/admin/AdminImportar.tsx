import { useEffect, useMemo, useRef, useState } from "react";
import {
  DownloadCloud,
  FileText,
  Info,
  Plus,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AdminShell } from "@/components/admin/AdminShell";
import { PdfFilePicker } from "@/components/admin/PdfFilePicker";
import { PdfImportQueuePanel } from "@/components/admin/PdfImportQueuePanel";
import { PdfImportReviewCard } from "@/components/admin/PdfImportReviewCard";
import { AreaCombobox } from "@/components/ui/area-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CourseMultiCombobox } from "@/components/ui/course-multi-combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QueryState } from "@/components/ui/query-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  useAreasQuery,
  useCoursesQuery,
  useEventOptionsQuery,
  useExtractArticlePdfMetadataMutation,
  useImportArticlesMutation,
  useUploadArticlePdfMutation,
} from "@/features/acervo/hooks";
import {
  ARTICLE_IMPORT_BATCH_SIZE,
  applyMetadataToPdfDraft,
  canImportPdfItem,
  createPdfQueueItem,
  emptyDraft,
  getImportSuccessTitle,
  getJsonImportButtonLabel,
  getManualImportButtonLabel,
  getPdfImportButtonLabel,
  isPdfFile,
  toImportItem,
  toPdfImportItem,
  type Draft,
  type Modalidade,
  type PdfDraft,
  type PdfQueueItem,
} from "@/features/acervo/article-import-model";
import { useAuth } from "@/features/auth/auth-context";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api";
import { chunkItems } from "@/lib/chunk-items";
import { splitCommaSeparatedValues } from "@/lib/comma-separated-values";
import {
  ARTICLE_MODALITIES,
  splitArticleAuthors,
} from "@/lib/article-form";
import {
  segmentedControlItemClassName,
  segmentedControlListClassName,
  segmentedTabsTriggerClassName,
} from "@/lib/segmented-control";
import { cn } from "@/lib/utils";
import type { ImportArticleInput } from "@/types/acervo";

const modalidades = ARTICLE_MODALITIES;

export default function AdminImportar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const {
    data: events = [],
    isLoading,
    isError,
  } = useEventOptionsQuery(isAuthenticated);
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
  const courseSuggestions = useMemo(() => courses.map((course) => course.name), [courses]);

  const activePdfItem = pdfItems[activePdfIndex] ?? null;
  const isFirstPdfItem = activePdfIndex === 0;
  const isLastPdfItem = activePdfIndex >= pdfItems.length - 1;
  const pendingPdfCount = pdfItems.filter((item) => item.status === "pending").length;
  const failedPdfCount = pdfItems.filter((item) => item.status === "failed").length;
  const readyPdfCount = pdfItems.filter((item) => item.status === "ready").length;
  const importablePdfItems = pdfItems.filter(
    (item) => canImportPdfItem(item) && item.status !== "saved" && item.status !== "partial",
  );
  const hasStartedPdfProcessing = pdfItems.some((item) => item.status !== "pending");
  const showActivePdfReview = Boolean(
    activePdfItem && activePdfItem.status !== "pending" && activePdfItem.status !== "reading",
  );
  const validManual = useMemo(
    () => drafts.filter((draft) => draft.title.trim() && draft.authors.trim()).length,
    [drafts],
  );
  const isImporting = importMutation.isPending || uploadPdfMutation.isPending || isBatchSaving;
  const markAcervoDataAsStale = () =>
    queryClient.invalidateQueries({ queryKey: ["acervo"], refetchType: "none" });

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
        invalidateOnSuccess: false,
      });

      toast({
        title: getImportSuccessTitle(result.count, publishNow),
        description: publishNow ? "Já disponíveis no Acervo." : "Salvos como rascunho para revisão.",
      });
      await markAcervoDataAsStale();
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
            : splitCommaSeparatedValues(String(row.courses ?? "")),
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
        invalidateOnSuccess: false,
      });

      toast({
        title: getImportSuccessTitle(result.count, publishNow),
        description: publishNow ? "Já disponíveis no Acervo." : "Salvos como rascunho para revisão.",
      });
      await markAcervoDataAsStale();
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
    const savedIds = new Set<string>();
    const partialIds = new Set<string>();
    const partialMessages = new Map<string, string>();
    const pendingIds = new Set(importablePdfItems.map((item) => item.id));
    let importedCount = 0;

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
      for (const batch of chunkItems(importablePdfItems, ARTICLE_IMPORT_BATCH_SIZE)) {
        const result = await importMutation.mutateAsync({
          eventId: selectedEventId,
          publishImmediately: publishNow,
          items: batch.map((item) => toPdfImportItem(item.draft)),
          invalidateOnSuccess: false,
        });
        importedCount += result.count;

        for (const [index, item] of batch.entries()) {
          const createdArticle = result.items[index];
          pendingIds.delete(item.id);

          if (!createdArticle?.id) {
            partialIds.add(item.id);
            partialMessages.set(item.id, "O trabalho foi criado, mas o PDF precisa ser anexado manualmente.");
            continue;
          }

          try {
            await uploadPdfMutation.mutateAsync({
              id: createdArticle.id,
              file: item.file,
              invalidateOnSuccess: false,
            });
            savedIds.add(item.id);
          } catch (error) {
            partialIds.add(item.id);
            partialMessages.set(
              item.id,
              getApiErrorMessage(error, "Abra a publicação na curadoria e anexe o PDF manualmente."),
            );
          }
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
          title: getImportSuccessTitle(importedCount, publishNow),
          description: publishNow ? "Já disponíveis no Acervo." : "Salvos como rascunho para revisão.",
        });
      }

      await markAcervoDataAsStale();
      navigate("/admin/publicacoes");
    } catch (error) {
      setPdfItems((currentItems) =>
        currentItems.map((item) =>
          savedIds.has(item.id)
            ? { ...item, status: "saved", error: null }
            : partialIds.has(item.id)
              ? {
                ...item,
                status: "partial",
                error: partialMessages.get(item.id) ?? "O PDF não foi anexado automaticamente.",
              }
              : pendingIds.has(item.id)
                ? {
                  ...item,
                  status: previousStatuses.get(item.id) ?? "ready",
                }
                : item,
        ),
      );
      toast({
        title: "Falha na importação do lote",
        description:
          savedIds.size + partialIds.size > 0
            ? `${savedIds.size + partialIds.size} trabalho(s) já foram processados. ${getApiErrorMessage(error)}`
            : getApiErrorMessage(error),
        variant: "destructive",
      });
      if (savedIds.size + partialIds.size > 0) {
        await queryClient.invalidateQueries({ queryKey: ["acervo"] });
      }
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
          <Card className="mb-3 border-border/60 p-3 shadow-card">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="import-event">Evento de destino</Label>
                <Select name="import-event" value={selectedEventId} onValueChange={setEventId}>
                  <SelectTrigger id="import-event">
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

          <Card className="overflow-hidden border-border/60 p-3 shadow-card" data-testid="import-mode-card">
            <Tabs defaultValue="manual" className="w-full min-w-0 overflow-hidden">
              <TabsList className={cn("w-full grid-cols-2", segmentedControlListClassName)}>
                <TabsTrigger
                  value="manual"
                  className={cn(segmentedControlItemClassName, segmentedTabsTriggerClassName)}
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Manual</span>
                </TabsTrigger>
                <TabsTrigger
                  value="pdf"
                  className={cn(segmentedControlItemClassName, segmentedTabsTriggerClassName)}
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">PDF</span>
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
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2"
                          aria-label={`Remover trabalho ${index + 1}`}
                          title={`Remover trabalho ${index + 1}`}
                          onClick={() => removeDraft(index)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <div>
                        <Label htmlFor={`manual-title-${index}`} className="text-xs">Título *</Label>
                        <Input
                          id={`manual-title-${index}`}
                          value={draft.title}
                          onChange={(event) => updateDraft(index, { title: event.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`manual-authors-${index}`} className="text-xs">Autores * (separados por virgula)</Label>
                        <Input
                          id={`manual-authors-${index}`}
                          value={draft.authors}
                          onChange={(event) => updateDraft(index, { authors: event.target.value })}
                          placeholder="Ana Silva, Carlos Lima"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor={`manual-area-${index}`} className="text-xs">Área</Label>
                          <AreaCombobox
                            id={`manual-area-${index}`}
                            value={draft.area}
                            options={areaSuggestions}
                            onValueChange={(area) => updateDraft(index, { area })}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`manual-modality-${index}`} className="text-xs">Modalidade</Label>
                          <Select
                            name={`manual-modality-${index}`}
                            value={draft.modalidade}
                            onValueChange={(value) => updateDraft(index, { modalidade: value as Modalidade })}
                          >
                            <SelectTrigger id={`manual-modality-${index}`}>
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
                        <Label htmlFor={`manual-related-courses-${index}`} className="text-xs">
                          Cursos relacionados (separados por vírgula)
                        </Label>
                        <CourseMultiCombobox
                          id={`manual-related-courses-${index}`}
                          value={draft.courses}
                          options={courseSuggestions}
                          onValueChange={(courses) => updateDraft(index, { courses })}
                          placeholder="Ex.: Direito, Administração"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`manual-abstract-${index}`} className="text-xs">Resumo</Label>
                        <Textarea
                          id={`manual-abstract-${index}`}
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
                  {getManualImportButtonLabel(validManual, publishNow, importMutation.isPending)}
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
                    id="json-import-file"
                    name="json-import-file"
                    type="file"
                    accept="application/json,.json"
                    aria-label="Selecionar arquivo JSON"
                    className="hidden"
                    onChange={(event) => event.target.files?.[0] && onJsonFile(event.target.files[0])}
                  />
                </label>
                {jsonText && (
                  <Card className="border-border/60 p-3 shadow-card">
                    <Label htmlFor="json-import-content" className="text-xs">Conteúdo carregado</Label>
                    <Textarea
                      id="json-import-content"
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
                  <DownloadCloud className="h-4 w-4" />
                  {getJsonImportButtonLabel(publishNow, importMutation.isPending)}
                </Button>
              </TabsContent>

              <TabsContent value="pdf" className="mt-3 space-y-3">
                {!pdfItems.length ? (
                  <PdfFilePicker
                    title="Selecionar arquivos .pdf"
                    description="A leitura automática funciona melhor com PDFs acadêmicos digitais."
                    multiple
                    onFilesChange={(files) => onPdfFiles(files)}
                  />
                ) : (
                  <PdfImportQueuePanel
                    activePdfIndex={activePdfIndex}
                    activePdfItem={activePdfItem}
                    failedPdfCount={failedPdfCount}
                    hasStartedPdfProcessing={hasStartedPdfProcessing}
                    isBatchReading={isBatchReading}
                    isFirstPdfItem={isFirstPdfItem}
                    isLastPdfItem={isLastPdfItem}
                    onAddFiles={onPdfFiles}
                    onClearQueue={clearPdfQueue}
                    onNext={goToNextPdf}
                    onPrevious={goToPreviousPdf}
                    onReadAll={readAllPdfMetadata}
                    onRemoveActive={removeActivePdfItem}
                    pdfItemCount={pdfItems.length}
                    pendingPdfCount={pendingPdfCount}
                    readyPdfCount={readyPdfCount}
                  />
                )}
                <PdfImportReviewCard
                  activePdfIndex={activePdfIndex}
                  activePdfItem={activePdfItem}
                  areaSuggestions={areaSuggestions}
                  courseSuggestions={courseSuggestions}
                  disabled={isImporting || isBatchReading}
                  importButtonLabel={getPdfImportButtonLabel(importablePdfItems.length, publishNow, isImporting)}
                  importablePdfCount={importablePdfItems.length}
                  isFirstPdfItem={isFirstPdfItem}
                  isLastPdfItem={isLastPdfItem}
                  onDraftChange={updateActivePdfDraft}
                  onImport={importPdfBatch}
                  onNext={goToNextPdf}
                  onPrevious={goToPreviousPdf}
                  pdfItemCount={pdfItems.length}
                  reviewCardRef={reviewCardRef}
                  selectedEventId={selectedEventId}
                  showReview={showActivePdfReview}
                />
              </TabsContent>
            </Tabs>
          </Card>
        </>
      </QueryState>
    </AdminShell >
  );
}
