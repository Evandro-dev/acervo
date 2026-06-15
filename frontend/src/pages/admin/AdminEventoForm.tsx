import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { DateRange } from "react-day-picker";
import {
  FileText,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { EventCatalogFilePicker } from "@/components/admin/EventCatalogFilePicker";
import { EventCoverImagePicker } from "@/components/admin/EventCoverImagePicker";
import { FormAccordionSection } from "@/components/admin/EventFormSection";
import { EventPreviousEditionsSection } from "@/components/admin/EventPreviousEditionsSection";
import { EventRulesSection } from "@/components/admin/EventRulesSection";
import { AdminShell } from "@/components/admin/AdminShell";
import { AreaCombobox } from "@/components/ui/area-combobox";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatePanel } from "@/components/ui/state-panel";
import { Textarea } from "@/components/ui/textarea";
import {
  useAreasQuery,
  useCreateEventMutation,
  useEventOptionsQuery,
  useEventQuery,
  useExtractCatalogPdfMetadataMutation,
  useRemoveUploadedEventRuleFileMutation,
  useUpdateEventMutation,
  useUploadEventCatalogPdfMutation,
  useUploadEventCoverImageMutation,
  useUploadEventRuleFileMutation,
} from "@/features/acervo/hooks";
import {
  buildFinalRules,
  committeeTypeOptions,
  createCommitteeItem,
  createThemeItem,
  emptyForm,
  extractIsbnFromCatalogText,
  isCatalogPdfFile,
  mapEventToForm,
  normalizeCommitteeType,
  removeItemByKey,
  replaceItemByKey,
  validateAndPrepare,
  type CatalogInputMode,
  type FormState,
} from "@/features/acervo/event-form-model";
import { useAuth } from "@/features/auth/auth-context";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api";
import { renderCatalogPdfPreview } from "@/lib/catalog-pdf-preview";
import { formatDateRangeLabel } from "@/lib/date-range";
import { cn } from "@/lib/utils";
import {
  eventTypes,
  type Event,
  type EventMutationInput,
  type EventType,
} from "@/types/acervo";

export default function AdminEventoForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const isEdit = Boolean(id);
  const {
    data: existing,
    isLoading,
    isError,
  } = useEventQuery(isAuthenticated && id ? id : undefined, "all");
  const { data: areas = [] } = useAreasQuery({ includeEmpty: true });
  const { data: previousEditionEvents = [] } = useEventOptionsQuery(isAuthenticated);
  const createEventMutation = useCreateEventMutation();
  const updateEventMutation = useUpdateEventMutation();
  const extractCatalogPdfMetadataMutation =
    useExtractCatalogPdfMetadataMutation();
  const uploadEventCatalogPdfMutation = useUploadEventCatalogPdfMutation();
  const uploadEventCoverImageMutation = useUploadEventCoverImageMutation();
  const uploadEventRuleFileMutation = useUploadEventRuleFileMutation();
  const removeUploadedEventRuleFileMutation =
    useRemoveUploadedEventRuleFileMutation();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [catalogInputMode, setCatalogInputMode] =
    useState<CatalogInputMode>("manual");
  const [catalogPdfFile, setCatalogPdfFile] = useState<File | null>(null);
  const [catalogImageFile, setCatalogImageFile] = useState<File | null>(null);
  const [isRenderingCatalogPdfPreview, setIsRenderingCatalogPdfPreview] =
    useState(false);
  const [hasCatalogPdfResult, setHasCatalogPdfResult] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState<
    DateRange | undefined
  >(undefined);

  useEffect(() => {
    if (!existing) return;

    const hasSavedCatalogFile = Boolean(
      existing.catalog.imageUrl || existing.catalog.pdfUrl,
    );

    setForm(mapEventToForm(existing));
    setCatalogInputMode(hasSavedCatalogFile ? "pdf" : "manual");
    setCatalogPdfFile(null);
    setCatalogImageFile(null);
    setHasCatalogPdfResult(false);
    setSelectedDateRange(undefined);
  }, [existing]);

  const isReadingCatalogPdf =
    extractCatalogPdfMetadataMutation.isPending || isRenderingCatalogPdfPreview;
  const isSubmitting =
    createEventMutation.isPending ||
    updateEventMutation.isPending ||
    uploadEventCatalogPdfMutation.isPending ||
    uploadEventCoverImageMutation.isPending ||
    uploadEventRuleFileMutation.isPending ||
    removeUploadedEventRuleFileMutation.isPending;
  const isSaveDisabled = isSubmitting || isReadingCatalogPdf;
  const shouldShowCatalogTextField = catalogInputMode === "manual";
  const defaultOpenSections = [
    "identificacao",
    "contato",
    "ficha",
    "temas",
    "comissao",
    "normas",
    "edicoes",
  ];
  const previousEditionEventOptions = previousEditionEvents.filter(
    (event) => event.id !== id,
  );

  const handleEventPeriodChange = (range: DateRange | undefined) => {
    setSelectedDateRange(range);

    const from = range?.from;
    if (!from) {
      setForm((current) => ({ ...current, date: "" }));
      return;
    }

    setForm((current) => ({
      ...current,
      year: from.getFullYear(),
      date: formatDateRangeLabel({ from, to: range?.to }),
    }));
  };

  const handleCatalogPdfFilesChange = async (files: File[]) => {
    const file = files[0] ?? null;

    if (!file) return;

    if (!isCatalogPdfFile(file)) {
      setHasCatalogPdfResult(false);
      setCatalogPdfFile(null);
      setCatalogImageFile(null);
      setForm((current) => ({
        ...current,
        catalogImagePreviewDataUrl: "",
      }));
      toast({
        title: "Arquivo inválido",
        description: "Selecione um arquivo PDF da ficha catalográfica.",
        variant: "destructive",
      });
      return;
    }

    setHasCatalogPdfResult(false);
    setCatalogPdfFile(file);
    setCatalogImageFile(null);
    setIsRenderingCatalogPdfPreview(true);
    setForm((current) => ({
      ...current,
      catalogImagePreviewDataUrl: "",
    }));

    try {
      const [result, preview] = await Promise.all([
        extractCatalogPdfMetadataMutation.mutateAsync({ file }),
        renderCatalogPdfPreview(file, { scale: 2 }),
      ]);

      const catalogText = result.text;
      const catalogIsbn =
        result.isbn ?? extractIsbnFromCatalogText(catalogText);

      setCatalogImageFile(preview.imageFile);
      setForm((current) => ({
        ...current,
        catalogText: "",
        catalogIsbn: catalogIsbn || current.catalogIsbn,
        catalogImagePreviewDataUrl: preview.dataUrl,
        removeCatalogFilesOnSave: false,
      }));

      setHasCatalogPdfResult(true);

      toast({
        title: catalogText ? "Ficha lida do PDF" : "PDF processado",
        description: result.warnings.length
          ? result.warnings.join(" ")
          : `Texto extraído de ${result.pageCount} página(s).`,
        variant: catalogText ? "default" : "destructive",
      });
    } catch (error) {
      setHasCatalogPdfResult(false);
      setCatalogPdfFile(null);
      setCatalogImageFile(null);
      setForm((current) => ({
        ...current,
        catalogImagePreviewDataUrl: "",
      }));

      toast({
        title: "Falha ao ler PDF da ficha",
        description: getApiErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsRenderingCatalogPdfPreview(false);
    }
  };

  const clearSelectedCatalogPdf = () => {
    setCatalogPdfFile(null);
    setCatalogImageFile(null);
    setHasCatalogPdfResult(false);
    setForm((current) => {
      if (existing) {
        return {
          ...current,
          catalogIsbn: existing.catalog.isbn ?? "",
          catalogText: existing.catalog.text ?? "",
          catalogPdfUrl: existing.catalog.pdfUrl ?? "",
          catalogImageUrl: existing.catalog.imageUrl ?? "",
          catalogImagePreviewDataUrl: "",
          removeCatalogFilesOnSave: false,
        };
      }

      return {
        ...current,
        catalogText: "",
        catalogIsbn: "",
        catalogPdfUrl: "",
        catalogImageUrl: "",
        catalogImagePreviewDataUrl: "",
        removeCatalogFilesOnSave: false,
      };
    });
  };

  const removeCatalogPdfFromForm = () => {
    setCatalogPdfFile(null);
    setCatalogImageFile(null);
    setHasCatalogPdfResult(false);
    setForm((current) => ({
      ...current,
      catalogText: "",
      catalogIsbn: "",
      catalogPdfUrl: "",
      catalogImageUrl: "",
      catalogImagePreviewDataUrl: "",
      removeCatalogFilesOnSave:
        Boolean(current.catalogPdfUrl) || Boolean(current.catalogImageUrl),
    }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    let savedEvent: Event | null = null;

    try {
      const prepared = validateAndPrepare(form, { catalogInputMode });
      const primaryPayload = prepared.payload;

      savedEvent =
        isEdit && id
          ? await updateEventMutation.mutateAsync({
              id,
              payload: primaryPayload,
            })
          : await createEventMutation.mutateAsync(primaryPayload);

      let uploadedCoverUrl: string | undefined;
      const postSaveIssues: string[] = [];

      if (prepared.pendingCoverFile) {
        try {
          const response = await uploadEventCoverImageMutation.mutateAsync({
            id: savedEvent.id,
            file: prepared.pendingCoverFile,
          });
          uploadedCoverUrl = response.coverUrl;
        } catch {
          postSaveIssues.push("Falha ao anexar a imagem do evento.");
        }
      }

      if (prepared.pendingUploads.length > 0) {
        const uploadedRuleUrls = new Map<string, string>();
        const failedRules: string[] = [];

        for (const upload of prepared.pendingUploads) {
          try {
            const response = await uploadEventRuleFileMutation.mutateAsync({
              id: savedEvent.id,
              file: upload.file,
            });
            uploadedRuleUrls.set(upload.key, response.fileUrl);
          } catch {
            failedRules.push(upload.title);
          }
        }

        const finalRules = buildFinalRules(
          prepared.preparedRules,
          uploadedRuleUrls,
        );
        const finalPayload: EventMutationInput = {
          ...primaryPayload,
          coverUrl: uploadedCoverUrl ?? primaryPayload.coverUrl,
          rules: finalRules,
        };

        const savedEventId = savedEvent.id;
        try {
          savedEvent = await updateEventMutation.mutateAsync({
            id: savedEventId,
            payload: finalPayload,
          });
        } catch (error) {
          await Promise.allSettled(
            [...uploadedRuleUrls.values()].map((fileUrl) =>
              removeUploadedEventRuleFileMutation.mutateAsync({
                id: savedEventId,
                fileUrl,
              }),
            ),
          );
          throw error;
        }

        if (failedRules.length > 0) {
          postSaveIssues.push(
            failedRules.length === 1
              ? `Falha ao anexar a norma: ${failedRules[0]}.`
              : `Falha ao anexar ${failedRules.length} normas.`,
          );
        }
      }

      if (catalogPdfFile) {
        if (!catalogImageFile) {
          postSaveIssues.push("Falha ao gerar a imagem da ficha catalográfica.");
        } else {
          try {
            const result = await uploadEventCatalogPdfMutation.mutateAsync({
              id: savedEvent.id,
              pdfFile: catalogPdfFile,
              imageFile: catalogImageFile,
            });

            setForm((current) => ({
              ...current,
              catalogPdfUrl: result.catalogPdfUrl,
              catalogImageUrl: result.catalogImageUrl ?? "",
              catalogImagePreviewDataUrl: "",
              removeCatalogFilesOnSave: false,
            }));
            setCatalogPdfFile(null);
            setCatalogImageFile(null);
            setHasCatalogPdfResult(false);
          } catch (error) {
            postSaveIssues.push(
              `Falha ao anexar a ficha catalográfica: ${getApiErrorMessage(error)}.`,
            );
          }
        }
      }

      if (postSaveIssues.length > 0) {
        toast({
          title: "Evento salvo com pendências",
          description: `${postSaveIssues.join(" ")} Como a ficha foi enviada pelo modo PDF, nenhum texto manual será usado como fallback.`,
          variant: "destructive",
        });
        navigate(`/admin/eventos/${savedEvent.id}`);
        return;
      }

      toast({
        title: isEdit ? "Evento atualizado" : "Evento criado",
        description: savedEvent.title,
      });
      navigate("/admin/eventos");
    } catch (error) {
      if (savedEvent) {
        toast({
          title: "Evento salvo parcialmente",
          description: getApiErrorMessage(
            error,
            "Revise os anexos e complete a configuração do evento.",
          ),
          variant: "destructive",
        });
        navigate(`/admin/eventos/${savedEvent.id}`);
        return;
      }

      toast({
        title: "Falha ao salvar evento",
        description: getApiErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  if (isEdit && isLoading) {
    return (
      <AdminShell title="Editar evento">
        <StatePanel>Carregando os dados do evento...</StatePanel>
      </AdminShell>
    );
  }

  if (isEdit && (isError || !existing)) {
    return (
      <AdminShell title="Editar evento">
        <StatePanel>Não foi possível carregar este evento.</StatePanel>
      </AdminShell>
    );
  }

  return (
    <AdminShell title={isEdit ? "Editar evento" : "Novo evento"}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Accordion
          type="multiple"
          defaultValue={defaultOpenSections}
          className="flex flex-col gap-4"
        >
          <FormAccordionSection
            value="identificacao"
            title="Identificação"
            description="Dados principais do evento e da página pública."
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="event-title">Título</Label>
              <Input
                id="event-title"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="event-edition">Edição</Label>
                <Input
                  id="event-edition"
                  value={form.edition}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      edition: event.target.value,
                    }))
                  }
                  placeholder="2ª Edição"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="event-type">Tipo</Label>
                <Select
                  name="event-type"
                  value={form.type}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      type: value as EventType,
                    }))
                  }
                >
                  <SelectTrigger id="event-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {eventTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:items-end">
              <div className="flex flex-col gap-2 [&>div>button]:h-10! [&>div>button]:min-h-10! [&>div>button]:rounded-md! [&>div>button]:border-border! [&>div>button]:bg-background! [&>div>button]:py-2! [&>div>button]:shadow-none! [&>div>button_svg]:h-4 [&>div>button_svg]:w-4">
                <DateRangePicker
                  label="Período do evento"
                  value={selectedDateRange}
                  onChange={handleEventPeriodChange}
                  placeholder="Clique para escolher o período do evento"
                  fallbackLabel={form.date}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="event-area">Tema principal</Label>
                <AreaCombobox
                  id="event-area"
                  value={form.area}
                  options={areas.map((area) => area.name)}
                  onValueChange={(area) =>
                    setForm((current) => ({ ...current, area }))
                  }
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="text-sm font-medium leading-none">
                Imagem do evento
              </div>
              <EventCoverImagePicker
                currentCoverUrl={form.coverUrl || undefined}
                disabled={isSubmitting}
                selectedFile={form.coverFile}
                onChange={(file) =>
                  setForm((current) => ({
                    ...current,
                    coverFile: file,
                    removeCoverOnSave: file ? false : current.removeCoverOnSave,
                  }))
                }
                onRemove={() =>
                  setForm((current) => ({
                    ...current,
                    coverUrl: "",
                    coverFile: null,
                    removeCoverOnSave: true,
                  }))
                }
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="event-presentation">Apresentação</Label>
              <Textarea
                id="event-presentation"
                rows={5}
                value={form.presentation}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    presentation: event.target.value,
                  }))
                }
                placeholder="Contextualize o evento, objetivos, público e escopo."
              />
            </div>
          </FormAccordionSection>

          <FormAccordionSection
            value="contato"
            title="Contato"
            description="Informações exibidas na seção pública do evento."
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="event-contact-email">E-mail</Label>
                <Input
                  id="event-contact-email"
                  type="email"
                  value={form.contactEmail}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      contactEmail: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="event-contact-phone">Telefone</Label>
                <Input
                  id="event-contact-phone"
                  value={form.contactPhone}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      contactPhone: event.target.value,
                    }))
                  }
                  placeholder="(31) 3000-0000"
                />
              </div>
            </div>
          </FormAccordionSection>

          <FormAccordionSection
            value="ficha"
            title="Ficha Catalográfica"
            description="Cole manualmente a ficha completa ou envie o PDF para gerar a imagem da ficha."
          >
            <SegmentedControl
              ariaLabel="Origem da ficha catalográfica"
              className="grid-cols-2"
              value={catalogInputMode}
              onValueChange={(mode) =>
                setCatalogInputMode(mode as CatalogInputMode)
              }
              options={[
                {
                  value: "manual",
                  label: (
                    <>
                      <FileText className="h-4 w-4" /> Manual
                    </>
                  ),
                },
                {
                  value: "pdf",
                  label: (
                    <>
                      <Upload className="h-4 w-4" /> PDF
                    </>
                  ),
                },
              ]}
            />

            {catalogInputMode === "pdf" ? (
              <div className="flex flex-col gap-3">
                <EventCatalogFilePicker
                  currentImageUrl={form.catalogImageUrl || undefined}
                  currentPdfUrl={form.catalogPdfUrl || undefined}
                  disabled={isReadingCatalogPdf || isSubmitting}
                  previewDataUrl={form.catalogImagePreviewDataUrl || undefined}
                  selectedPdfFile={catalogPdfFile}
                  detectedIsbn={
                    catalogPdfFile ||
                    form.catalogImagePreviewDataUrl ||
                    form.catalogImageUrl ||
                    form.catalogPdfUrl ||
                    isReadingCatalogPdf
                      ? form.catalogIsbn || undefined
                      : undefined
                  }
                  isReading={isReadingCatalogPdf}
                  onFilesChange={handleCatalogPdfFilesChange}
                  onRemove={removeCatalogPdfFromForm}
                  onCancelTemporarySelection={clearSelectedCatalogPdf}
                />
              </div>
            ) : null}

            {shouldShowCatalogTextField ? (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="event-catalog-text">Ficha catalográfica</Label>
                  <Textarea
                    id="event-catalog-text"
                    rows={16}
                    wrap="off"
                    spellCheck={false}
                    className="min-h-80 overflow-x-auto font-mono text-[13px] leading-relaxed tab-2"
                    value={form.catalogText}
                    onChange={(event) => {
                      const catalogText = event.target.value;

                      setForm((current) => ({
                        ...current,
                        catalogText,
                        catalogIsbn: extractIsbnFromCatalogText(catalogText),
                      }));
                    }}
                    placeholder={`Cole aqui a ficha catalográfica completa.

Ex.:
Dados Internacionais de Catalogação na Publicação (CIP)
(Câmara Brasileira do Livro, SP, Brasil)

ExpoUna2025/2 [livro eletrônico] / organização...
ISBN 978-65-02-14535-7
...`}
                  />
                </div>

                {form.catalogIsbn ? (
                  <div className="rounded-md border border-border/60 bg-brand-soft px-3 py-2 text-xs text-primary-dark">
                    ISBN detectado: <strong>{form.catalogIsbn}</strong>
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    Nenhum ISBN detectado no texto até o momento.
                  </div>
                )}
              </>
            ) : null}
          </FormAccordionSection>

          <FormAccordionSection
            value="temas"
            title="Áreas Temáticas"
            description="Use uma linha por tema exibido na aba pública."
          >
            <div className="flex flex-col gap-2">
              {form.themes.map((theme, index) => (
                <div key={theme.key} className="flex items-center gap-2">
                  <Input
                    id={`event-theme-${theme.key}`}
                    aria-label={`Área temática ${index + 1}`}
                    value={theme.value}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        themes: replaceItemByKey(current.themes, theme.key, {
                          value: event.target.value,
                        }),
                      }))
                    }
                    placeholder={`Área Temática ${index + 1}`}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    aria-label={`Remover Área temática ${index + 1}`}
                    title={`Remover Área temática ${index + 1}`}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        themes:
                          current.themes.length > 1
                            ? removeItemByKey(current.themes, theme.key)
                            : [createThemeItem()],
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  themes: [...current.themes, createThemeItem()],
                }))
              }
            >
              <Plus className="h-4 w-4" /> Adicionar Área temática
            </Button>
          </FormAccordionSection>

          <FormAccordionSection
            value="comissao"
            title="Comissão"
            description="Nome e tipo dos responsáveis pelo evento."
          >
            <div className="flex flex-col gap-3">
              {form.committee.map((member, index) => (
                <Card key={member.key} className="border-border/60 p-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_180px_auto]">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`event-committee-name-${member.key}`}>
                        Nome
                      </Label>
                      <Input
                        id={`event-committee-name-${member.key}`}
                        value={member.name}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            committee: replaceItemByKey(
                              current.committee,
                              member.key,
                              { name: event.target.value },
                            ),
                          }))
                        }
                        placeholder="Profa. Dra. Roberta Manfron"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`event-committee-role-${member.key}`}>
                        Tipo
                      </Label>
                      <Select
                        name={`event-committee-role-${member.key}`}
                        value={normalizeCommitteeType(member.role)}
                        onValueChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            committee: replaceItemByKey(
                              current.committee,
                              member.key,
                              { role: value },
                            ),
                          }))
                        }
                      >
                        <SelectTrigger
                          id={`event-committee-role-${member.key}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {committeeTypeOptions.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="w-full sm:w-10"
                        aria-label={`Remover membro ${index + 1} da comissão`}
                        title={`Remover membro ${index + 1} da comissão`}
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            committee:
                              current.committee.length > 1
                                ? removeItemByKey(current.committee, member.key)
                                : [createCommitteeItem()],
                          }))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  committee: [...current.committee, createCommitteeItem()],
                }))
              }
            >
              <Plus className="h-4 w-4" /> Adicionar membro
            </Button>
          </FormAccordionSection>

          <EventRulesSection rules={form.rules} onFormChange={setForm} />
          <EventPreviousEditionsSection
            eventOptions={previousEditionEventOptions}
            previousEditions={form.previousEditions}
            onFormChange={setForm}
          />
        </Accordion>

        <div className="sticky bottom-0 z-20 rounded-xl border border-border/60 bg-background/95 p-3 shadow-card backdrop-blur">
          <Button
            type="submit"
            disabled={isSaveDisabled}
            className={cn(
              "w-full gap-2 bg-brand text-primary-foreground hover:opacity-90",
              isSaveDisabled && "opacity-80",
            )}
          >
            {isSaveDisabled ? (
              <Upload className="h-4 w-4 animate-pulse" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSubmitting
              ? "Salvando evento..."
              : isReadingCatalogPdf
                ? "Lendo ficha catalográfica..."
                : "Salvar evento completo"}
          </Button>
        </div>
      </form>
    </AdminShell>
  );
}
