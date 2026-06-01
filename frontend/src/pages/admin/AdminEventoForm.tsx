import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { DateRange } from "react-day-picker";
import { ExternalLink, FileText, ImageIcon, Plus, Save, Trash2, Upload } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { AreaCombobox } from "@/components/ui/area-combobox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatePanel } from "@/components/ui/state-panel";
import { Textarea } from "@/components/ui/textarea";
import {
  useAreasQuery,
  useAdminEventsQuery,
  useCreateEventMutation,
  useEventQuery,
  useUpdateEventMutation,
  useUploadEventCoverImageMutation,
  useUploadEventRuleFileMutation,
} from "@/features/acervo/hooks";
import { useAuth } from "@/features/auth/auth-context";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api";
import { formatDateRangeLabel } from "@/lib/date-range";
import { isUsableResourceUrl } from "@/lib/file-links";
import { cn } from "@/lib/utils";
import { eventTypes, type Event, type EventMutationInput, type EventRule, type EventType } from "@/types/acervo";

const committeeTypeOptions = ["Organizadora", "Científica"] as const;
type CommitteeType = (typeof committeeTypeOptions)[number];

type ThemeFormItem = {
  key: string;
  value: string;
};

type CommitteeFormItem = {
  key: string;
  name: string;
  role: string;
};

type RuleFormItem = {
  key: string;
  title: string;
  fileUrl: string;
  pendingFile: File | null;
  useExternalLink: boolean;
};

type PreviousEditionFormItem = {
  key: string;
  label: string;
  year: string;
  linkMode: "none" | "internal" | "external";
  eventId: string;
  externalUrl: string;
};

type FormState = {
  title: string;
  edition: string;
  year: number;
  date: string;
  area: string;
  type: EventType;
  coverUrl: string;
  coverFile: File | null;
  presentation: string;
  contactEmail: string;
  contactPhone: string;
  catalogIsbn: string;
  catalogDoi: string;
  catalogPublisher: string;
  catalogAddress: string;
  themes: ThemeFormItem[];
  committee: CommitteeFormItem[];
  rules: RuleFormItem[];
  previousEditions: PreviousEditionFormItem[];
};

type PreparedRuleRow = {
  key: string;
  title: string;
  fileUrl: string;
  pendingFile: File | null;
};

let keySequence = 0;

function createKey(prefix: string) {
  keySequence += 1;
  return `${prefix}-${Date.now()}-${keySequence}`;
}

function slugifyForClient(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createThemeItem(value = ""): ThemeFormItem {
  return { key: createKey("theme"), value };
}

function normalizeCommitteeType(value?: string): CommitteeType {
  const normalized = value
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

  return normalized === "CIENTIFICA" ? "Científica" : "Organizadora";
}

function createCommitteeItem(value?: Partial<Omit<CommitteeFormItem, "key">>): CommitteeFormItem {
  return {
    key: createKey("committee"),
    name: value?.name ?? "",
    role: normalizeCommitteeType(value?.role),
  };
}

function isLocalEventRuleFileUrl(fileUrl: string) {
  const trimmed = fileUrl.trim();
  return trimmed.startsWith("/events/") || /\/events\/[^/]+\/files\/[^/]+$/i.test(trimmed);
}

function isSupportedCoverImageFile(file: File) {
  const supportedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const supportedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
  const fileName = file.name.toLowerCase();

  return supportedTypes.includes(file.type) || supportedExtensions.some((extension) => fileName.endsWith(extension));
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function createRuleItem(value?: Partial<Omit<RuleFormItem, "key" | "pendingFile">>): RuleFormItem {
  const fileUrl = value?.fileUrl ?? "";

  return {
    key: createKey("rule"),
    title: value?.title ?? "",
    fileUrl,
    pendingFile: null,
    useExternalLink: value?.useExternalLink ?? (fileUrl ? !isLocalEventRuleFileUrl(fileUrl) : false),
  };
}

function createPreviousEditionItem(
  value?: Partial<Omit<PreviousEditionFormItem, "key">>,
): PreviousEditionFormItem {
  const eventId = value?.eventId ?? "";
  const externalUrl = value?.externalUrl ?? "";

  return {
    key: createKey("edition"),
    label: value?.label ?? "",
    year: value?.year ?? "",
    linkMode: value?.linkMode ?? (eventId ? "internal" : externalUrl ? "external" : "none"),
    eventId,
    externalUrl,
  };
}

function emptyForm(): FormState {
  return {
    title: "",
    edition: "",
    year: new Date().getFullYear(),
    date: "",
    area: "",
    type: "Congresso",
    coverUrl: "",
    coverFile: null,
    presentation: "",
    contactEmail: "",
    contactPhone: "",
    catalogIsbn: "",
    catalogDoi: "",
    catalogPublisher: "",
    catalogAddress: "",
    themes: [createThemeItem()],
    committee: [createCommitteeItem()],
    rules: [createRuleItem()],
    previousEditions: [],
  };
}

function mapEventToForm(event: Event): FormState {
  return {
    title: event.title,
    edition: event.edition,
    year: event.year,
    date: event.date,
    area: event.area,
    type: event.type,
    coverUrl: event.cover ?? "",
    coverFile: null,
    presentation: event.presentation,
    contactEmail: event.contact.email,
    contactPhone: event.contact.phone ?? "",
    catalogIsbn: event.catalog.isbn ?? "",
    catalogDoi: event.catalog.doi ?? "",
    catalogPublisher: event.catalog.publisher ?? "",
    catalogAddress: event.catalog.address ?? "",
    themes: event.themes.length ? event.themes.map((theme) => createThemeItem(theme)) : [createThemeItem()],
    committee: event.committee.length
      ? event.committee.map((member) => createCommitteeItem(member))
      : [createCommitteeItem()],
    rules: event.rules.length
      ? event.rules.map((rule) => createRuleItem({ title: rule.title, fileUrl: rule.file }))
      : [createRuleItem()],
    previousEditions: event.previousEditions.map((edition) =>
      createPreviousEditionItem({
        label: edition.label,
        year: String(edition.year),
        eventId: edition.eventId ?? "",
        externalUrl: edition.externalUrl ?? "",
      }),
    ),
  };
}

function replaceItemByKey<T extends { key: string }>(items: T[], key: string, patch: Partial<T>) {
  return items.map((item) => (item.key === key ? { ...item, ...patch } : item));
}

function removeItemByKey<T extends { key: string }>(items: T[], key: string) {
  return items.filter((item) => item.key !== key);
}

function validateAndPrepare(form: FormState) {
  const title = form.title.trim();
  const date = form.date.trim();
  const area = form.area.trim();
  const presentation = form.presentation.trim();
  const contactEmail = form.contactEmail.trim();
  const contactPhone = form.contactPhone.trim();

  if (title.length < 2) {
    throw new Error("Identificação > Título: informe pelo menos 2 caracteres.");
  }

  if (!Number.isInteger(form.year) || form.year < 1900 || form.year > 3000) {
    throw new Error("Identificação > Ano: informe um ano válido para o evento.");
  }

  if (!area) {
    throw new Error("Identificação > Tema principal: informe a área principal do evento.");
  }

  if (presentation.length < 10) {
    throw new Error("Identificação > Apresentação: escreva pelo menos 10 caracteres.");
  }

  if (!contactEmail) {
    throw new Error("Contato > E-mail: informe o e-mail de contato do evento.");
  }

  if (!isValidEmail(contactEmail)) {
    throw new Error("Contato > E-mail: informe um e-mail válido.");
  }

  const themes = form.themes
    .map((theme) => theme.value.trim())
    .filter(Boolean);

  const committee = form.committee.flatMap((member) => {
    const name = member.name.trim();
    const role = member.role.trim();

    if (!name) return [];
    if (!name || !role) {
      throw new Error("Preencha nome e tipo de todos os membros da comissão.");
    }

    return [{ name, role: normalizeCommitteeType(role) }];
  });

  const previousEditions = form.previousEditions.flatMap((edition) => {
    const label = edition.label.trim();
    const yearValue = edition.year.trim();

    if (!label && !yearValue) return [];
    if (!label || !yearValue) {
      throw new Error("Preencha rótulo e ano de todas as edições anteriores.");
    }

    const year = Number(yearValue);
    if (!Number.isInteger(year) || year < 1900 || year > 3000) {
      throw new Error("Informe um ano válido para as edições anteriores.");
    }

    const eventId = edition.linkMode === "internal" ? edition.eventId.trim() : "";
    const externalUrl = edition.linkMode === "external" ? edition.externalUrl.trim() : "";

    if (edition.linkMode === "internal" && !eventId) {
      throw new Error("Selecione o evento interno da edição anterior ou altere o destino.");
    }

    if (edition.linkMode === "external") {
      if (!externalUrl) {
        throw new Error("Informe o link externo da edição anterior ou altere o destino.");
      }

      if (!isUsableResourceUrl(externalUrl) || externalUrl.startsWith("/")) {
        throw new Error("O link externo da edição anterior precisa ser uma URL http ou https válida.");
      }
    }

    return [
      {
        id: slugifyForClient(`${label}-${year}`) || createKey("prev"),
        label,
        year,
        ...(eventId ? { eventId } : {}),
        ...(externalUrl ? { externalUrl } : {}),
      },
    ];
  });

  const preparedRules: PreparedRuleRow[] = [];
  for (const rule of form.rules) {
    const title = rule.title.trim();
    const fileUrl = rule.fileUrl.trim();

    if (!title && !fileUrl && !rule.pendingFile) continue;
    if (!title) {
      throw new Error("Preencha o título de todas as normas.");
    }

    if (rule.useExternalLink) {
      if (!fileUrl) {
        throw new Error("Cada norma com link externo precisa de uma URL válida.");
      }
      if (!isUsableResourceUrl(fileUrl)) {
        throw new Error("Os links externos das normas precisam apontar para recursos válidos.");
      }
    } else {
      if (!fileUrl && !rule.pendingFile) {
        throw new Error("Cada norma precisa de um PDF enviado ou de uma URL válida.");
      }
      if (fileUrl && !isUsableResourceUrl(fileUrl)) {
        throw new Error("As URLs das normas precisam apontar para recursos válidos.");
      }
    }

    preparedRules.push({
      key: rule.key,
      title,
      fileUrl,
      pendingFile: rule.pendingFile,
    });
  }

  const initialRules: EventRule[] = preparedRules
    .filter((rule) => Boolean(rule.fileUrl))
    .map((rule) => ({
      title: rule.title,
      file: rule.fileUrl,
    }));

  const pendingUploads = preparedRules
    .filter((rule) => Boolean(rule.pendingFile))
    .map((rule) => ({
      key: rule.key,
      title: rule.title,
      file: rule.pendingFile!,
    }));

  const coverUrl = form.coverUrl.trim();
  if (coverUrl && !isUsableResourceUrl(coverUrl)) {
    throw new Error("A imagem atual do evento precisa apontar para uma URL válida.");
  }

  if (form.coverFile && !isSupportedCoverImageFile(form.coverFile)) {
    throw new Error("A imagem do evento precisa ser JPG, PNG, WEBP ou GIF.");
  }

  const payload: EventMutationInput = {
    title,
    edition: form.edition.trim(),
    year: form.year,
    date,
    area,
    type: form.type,
    coverUrl: coverUrl || undefined,
    presentation,
    themes,
    committee,
    rules: initialRules,
    previousEditions,
    contact: {
      email: contactEmail,
      phone: contactPhone || undefined,
    },
    catalog: {
      isbn: form.catalogIsbn.trim() || undefined,
      doi: form.catalogDoi.trim() || undefined,
      publisher: form.catalogPublisher.trim() || undefined,
      address: form.catalogAddress.trim() || undefined,
    },
  };

  return {
    payload,
    preparedRules,
    pendingUploads,
    pendingCoverFile: form.coverFile,
  };
}

function buildFinalRules(
  preparedRules: PreparedRuleRow[],
  uploadedRuleUrls: Map<string, string>,
) {
  return preparedRules.flatMap((rule) => {
    const uploadedUrl = uploadedRuleUrls.get(rule.key);
    if (uploadedUrl) {
      return [{ title: rule.title, file: uploadedUrl }];
    }

    if (rule.fileUrl) {
      return [{ title: rule.title, file: rule.fileUrl }];
    }

    return [];
  });
}

function FormAccordionSection({
  value,
  title,
  description,
  children,
}: {
  value: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem value={value} className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
      <AccordionTrigger className="bg-brand-soft px-4 py-4 text-left hover:no-underline">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-bold text-brand">{title}</span>
          {description ? <span className="text-xs font-normal leading-relaxed text-brand/80">{description}</span> : null}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4 pt-4">
        <div className="flex flex-col gap-4">{children}</div>
      </AccordionContent>
    </AccordionItem>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export default function AdminEventoForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const isEdit = Boolean(id);
  const { data: existing, isLoading, isError } = useEventQuery(isAuthenticated && id ? id : undefined, "all");
  const { data: areas = [] } = useAreasQuery({ includeEmpty: true });
  const { data: adminEvents = [] } = useAdminEventsQuery(isAuthenticated);
  const createEventMutation = useCreateEventMutation();
  const updateEventMutation = useUpdateEventMutation();
  const uploadEventCoverImageMutation = useUploadEventCoverImageMutation();
  const uploadEventRuleFileMutation = useUploadEventRuleFileMutation();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>(undefined);
  const [coverInputKey, setCoverInputKey] = useState(0);

  useEffect(() => {
    if (!existing) return;
    setForm(mapEventToForm(existing));
    setSelectedDateRange(undefined);
    setCoverInputKey((current) => current + 1);
  }, [existing]);

  const isSubmitting =
    createEventMutation.isPending ||
    updateEventMutation.isPending ||
    uploadEventCoverImageMutation.isPending ||
    uploadEventRuleFileMutation.isPending;
  const defaultOpenSections = ["identificacao", "contato", "ficha", "temas", "comissao", "normas", "edicoes"];
  const previousEditionEventOptions = adminEvents.filter((event) => event.id !== id);

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

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    let savedEvent: Event | null = null;

    try {
      const prepared = validateAndPrepare(form);
      const primaryPayload = prepared.payload;

      savedEvent = isEdit && id
        ? await updateEventMutation.mutateAsync({ id, payload: primaryPayload })
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

        const finalRules = buildFinalRules(prepared.preparedRules, uploadedRuleUrls);
        const finalPayload: EventMutationInput = {
          ...primaryPayload,
          coverUrl: uploadedCoverUrl ?? primaryPayload.coverUrl,
          rules: finalRules,
        };

        savedEvent = await updateEventMutation.mutateAsync({
          id: savedEvent.id,
          payload: finalPayload,
        });

        if (failedRules.length > 0) {
          postSaveIssues.push(
            failedRules.length === 1
              ? `Falha ao anexar a norma: ${failedRules[0]}.`
              : `Falha ao anexar ${failedRules.length} normas.`,
          );
        }
      }

      if (postSaveIssues.length > 0) {
        toast({
          title: "Evento salvo com pendências",
          description: `${postSaveIssues.join(" ")} Revise o evento salvo.`,
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
          description: getApiErrorMessage(error, "Revise os anexos e complete a configuração do evento."),
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
        <Accordion type="multiple" defaultValue={defaultOpenSections} className="flex flex-col gap-4">
          <FormAccordionSection
            value="identificacao"
            title="Identificação"
            description="Dados principais do evento e da página pública."
          >
            <div className="flex flex-col gap-2">
              <Label>Título</Label>
              <Input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Edição</Label>
                <Input
                  value={form.edition}
                  onChange={(event) => setForm((current) => ({ ...current, edition: event.target.value }))}
                  placeholder="2ª Edição"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Tipo</Label>
                <Select
                  value={form.type}
                  onValueChange={(value) => setForm((current) => ({ ...current, type: value as EventType }))}
                >
                  <SelectTrigger>
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

            <div className="flex flex-col gap-2">
              <DateRangePicker
                label="Período do evento"
                value={selectedDateRange}
                onChange={handleEventPeriodChange}
                placeholder="Clique para escolher o período do evento"
                fallbackLabel={form.date}
              />
              <p className="text-xs text-muted-foreground">
                Ao escolher o calendário, o sistema salva automaticamente o ano do evento como <strong>{form.year}</strong>.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Tema principal</Label>
              <AreaCombobox
                value={form.area}
                options={areas.map((area) => area.name)}
                onValueChange={(area) => setForm((current) => ({ ...current, area }))}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px]">
              <div className="flex flex-col gap-2">
                <Label>Imagem do evento</Label>
                <Input
                  key={coverInputKey}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setForm((current) => ({ ...current, coverFile: file }));
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Caso não tenha uma imagem, será exibido um ícone de calendário para seu evento.
                </p>
                {form.coverFile ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-md bg-brand-soft px-3 py-2 text-xs text-primary-dark">
                    <ImageIcon className="h-4 w-4" />
                    <span className="min-w-0 flex-1 truncate">Nova imagem selecionada: {form.coverFile.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto px-1 py-0 text-xs text-primary-dark hover:bg-transparent"
                      onClick={() => {
                        setForm((current) => ({ ...current, coverFile: null }));
                        setCoverInputKey((current) => current + 1);
                      }}
                    >
                      Remover seleção
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className="overflow-hidden rounded-xl border border-border/60 bg-brand-soft">
                {form.coverUrl ? (
                  <img src={form.coverUrl} alt="Imagem atual do evento" className="h-32 w-full object-cover sm:h-full" />
                ) : (
                  <div className="flex h-32 flex-col items-center justify-center gap-2 px-4 text-center text-xs text-muted-foreground sm:h-full">
                    <ImageIcon className="h-6 w-6 text-primary" />
                    Nenhuma imagem cadastrada
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Apresentação</Label>
              <Textarea
                rows={5}
                value={form.presentation}
                onChange={(event) => setForm((current) => ({ ...current, presentation: event.target.value }))}
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
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={form.contactEmail}
                  onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Telefone</Label>
                <Input
                  value={form.contactPhone}
                  onChange={(event) => setForm((current) => ({ ...current, contactPhone: event.target.value }))}
                  placeholder="(31) 3000-0000"
                />
              </div>
            </div>
          </FormAccordionSection>

          <FormAccordionSection
            value="ficha"
            title="Ficha Catalográfica"
            description="Metadados institucionais exibidos na página pública."
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>ISBN</Label>
                <Input
                  value={form.catalogIsbn}
                  onChange={(event) => setForm((current) => ({ ...current, catalogIsbn: event.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Editora</Label>
                <Input
                  value={form.catalogPublisher}
                  onChange={(event) => setForm((current) => ({ ...current, catalogPublisher: event.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Endereço</Label>
                <Input
                  value={form.catalogAddress}
                  onChange={(event) => setForm((current) => ({ ...current, catalogAddress: event.target.value }))}
                />
              </div>
            </div>
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
                    value={theme.value}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        themes: replaceItemByKey(current.themes, theme.key, { value: event.target.value }),
                      }))
                    }
                    placeholder={`Área Temática ${index + 1}`}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
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
              onClick={() => setForm((current) => ({ ...current, themes: [...current.themes, createThemeItem()] }))}
            >
              <Plus className="h-4 w-4" /> Adicionar área temática
            </Button>
          </FormAccordionSection>

          <FormAccordionSection
            value="comissao"
            title="Comissão"
            description="Nome e tipo dos responsáveis pelo evento."
          >
            <div className="flex flex-col gap-3">
              {form.committee.map((member) => (
                <Card key={member.key} className="border-border/60 p-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_180px_auto]">
                    <div className="flex flex-col gap-2">
                      <Label>Nome</Label>
                      <Input
                        value={member.name}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            committee: replaceItemByKey(current.committee, member.key, { name: event.target.value }),
                          }))
                        }
                        placeholder="Profa. Dra. Roberta Manfron"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Tipo</Label>
                      <Select
                        value={normalizeCommitteeType(member.role)}
                        onValueChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            committee: replaceItemByKey(current.committee, member.key, { role: value }),
                          }))
                        }
                      >
                        <SelectTrigger>
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

          <FormAccordionSection
            value="normas"
            title="Normas"
            description="Cadastre título e PDF real de cada norma publicada no evento."
          >
            {form.rules.length === 0 ? <EmptyHint>Nenhuma norma cadastrada.</EmptyHint> : null}
            <div className="flex flex-col gap-3">
              {form.rules.map((rule) => (
                <Card key={rule.key} className="border-border/60 p-3">
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                      <div className="flex flex-col gap-2">
                        <Label>Título da norma</Label>
                        <Input
                          value={rule.title}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              rules: replaceItemByKey(current.rules, rule.key, { title: event.target.value }),
                            }))
                          }
                          placeholder="Normas de submissão"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="w-full sm:w-10"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              rules:
                                current.rules.length > 1
                                  ? removeItemByKey(current.rules, rule.key)
                                  : [createRuleItem()],
                            }))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-brand-soft px-3 py-2 text-xs text-primary-dark">
                      <FileText className="h-4 w-4" />
                      O fluxo principal é submeter o PDF no Acervo. Use link externo somente quando o arquivo já estiver hospedado fora.
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={rule.useExternalLink ? "outline" : "secondary"}
                        className="gap-2"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            rules: replaceItemByKey(current.rules, rule.key, {
                              useExternalLink: false,
                              pendingFile: null,
                              fileUrl: isLocalEventRuleFileUrl(rule.fileUrl) ? rule.fileUrl : "",
                            }),
                          }))
                        }
                      >
                        <Upload className="h-4 w-4" /> Enviar PDF
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={rule.useExternalLink ? "secondary" : "outline"}
                        className="gap-2"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            rules: replaceItemByKey(current.rules, rule.key, {
                              useExternalLink: true,
                              pendingFile: null,
                              fileUrl: !rule.fileUrl || isLocalEventRuleFileUrl(rule.fileUrl) ? "" : rule.fileUrl,
                            }),
                          }))
                        }
                      >
                        <ExternalLink className="h-4 w-4" /> Usar link externo
                      </Button>
                    </div>

                    {rule.useExternalLink ? (
                      <div className="flex flex-col gap-2">
                        <Label>Link externo do PDF</Label>
                        <Input
                          value={rule.fileUrl}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              rules: replaceItemByKey(current.rules, rule.key, { fileUrl: event.target.value }),
                            }))
                          }
                          placeholder="https://..."
                        />
                        {rule.fileUrl && isUsableResourceUrl(rule.fileUrl) ? (
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <FileText className="h-4 w-4" />
                            <span className="truncate">Link externo pronto para uso.</span>
                            <a
                              href={rule.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-semibold text-primary"
                            >
                              Abrir <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <Label>PDF da norma</Label>
                        <Input
                          type="file"
                          accept="application/pdf,.pdf"
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            setForm((current) => ({
                              ...current,
                              rules: replaceItemByKey(current.rules, rule.key, {
                                pendingFile: file,
                                title: file && !rule.title.trim() ? file.name.replace(/\.pdf$/i, "") : rule.title,
                              }),
                            }));
                          }}
                        />
                        {rule.pendingFile ? (
                          <div className="rounded-md bg-brand-soft px-3 py-2 text-xs text-primary-dark">
                            Novo PDF selecionado: <strong>{rule.pendingFile.name}</strong>
                          </div>
                        ) : null}
                        {rule.fileUrl && isLocalEventRuleFileUrl(rule.fileUrl) ? (
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <FileText className="h-4 w-4" />
                            <span className="truncate">Arquivo atual vinculado.</span>
                            {isUsableResourceUrl(rule.fileUrl) ? (
                              <a
                                href={rule.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-primary"
                              >
                                Abrir <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() => setForm((current) => ({ ...current, rules: [...current.rules, createRuleItem()] }))}
            >
              <Plus className="h-4 w-4" /> Adicionar norma
            </Button>
          </FormAccordionSection>

          <FormAccordionSection
            value="edicoes"
            title="Edições anteriores"
            description="Histórico exibido na seção pública do evento."
          >
            {form.previousEditions.length === 0 ? <EmptyHint>Esta pode ser a primeira edição.</EmptyHint> : null}
            <div className="flex flex-col gap-3">
              {form.previousEditions.map((edition) => (
                <Card key={edition.key} className="border-border/60 p-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_160px_auto]">
                    <div className="flex flex-col gap-2">
                      <Label>Nome</Label>
                      <Input
                        value={edition.label}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            previousEditions: replaceItemByKey(current.previousEditions, edition.key, {
                              label: event.target.value,
                            }),
                          }))
                        }
                        placeholder="I Congresso Multidisciplinar"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Ano</Label>
                      <Input
                        type="number"
                        value={edition.year}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            previousEditions: replaceItemByKey(current.previousEditions, edition.key, {
                              year: event.target.value,
                            }),
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="w-full sm:w-10"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            previousEditions: removeItemByKey(current.previousEditions, edition.key),
                          }))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[180px_1fr]">
                    <div className="flex flex-col gap-2">
                      <Label>Destino da seta</Label>
                      <Select
                        value={edition.linkMode}
                        onValueChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            previousEditions: replaceItemByKey(current.previousEditions, edition.key, {
                              linkMode: value as PreviousEditionFormItem["linkMode"],
                              eventId: value === "internal" ? edition.eventId : "",
                              externalUrl: value === "external" ? edition.externalUrl : "",
                            }),
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem link</SelectItem>
                          <SelectItem value="internal">Evento no Acervo</SelectItem>
                          <SelectItem value="external">Link externo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {edition.linkMode === "internal" ? (
                      <div className="flex flex-col gap-2">
                        <Label>Evento vinculado</Label>
                        {previousEditionEventOptions.length ? (
                          <Select
                            value={edition.eventId || undefined}
                            onValueChange={(eventId) => {
                              const selectedEvent = previousEditionEventOptions.find((event) => event.id === eventId);

                              setForm((current) => ({
                                ...current,
                                previousEditions: replaceItemByKey(current.previousEditions, edition.key, {
                                  eventId,
                                  label: edition.label || selectedEvent?.title || "",
                                  year: edition.year || (selectedEvent ? String(selectedEvent.year) : ""),
                                }),
                              }));
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o evento da edição" />
                            </SelectTrigger>
                            <SelectContent>
                              {previousEditionEventOptions.map((event) => (
                                <SelectItem key={event.id} value={event.id}>
                                  {event.year} · {event.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <EmptyHint>Nenhum outro evento cadastrado no Acervo.</EmptyHint>
                        )}
                      </div>
                    ) : null}

                    {edition.linkMode === "external" ? (
                      <div className="flex flex-col gap-2">
                        <Label>Link externo da edição</Label>
                        <Input
                          value={edition.externalUrl}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              previousEditions: replaceItemByKey(current.previousEditions, edition.key, {
                                externalUrl: event.target.value,
                              }),
                            }))
                          }
                          placeholder="https://..."
                        />
                      </div>
                    ) : null}
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
                  previousEditions: [...current.previousEditions, createPreviousEditionItem()],
                }))
              }
            >
              <Plus className="h-4 w-4" /> Adicionar edição anterior
            </Button>
          </FormAccordionSection>
        </Accordion>

        <div className="sticky bottom-0 z-20 rounded-xl border border-border/60 bg-background/95 p-3 shadow-card backdrop-blur">
          <Button
            type="submit"
            disabled={isSubmitting}
            className={cn("w-full gap-2 bg-brand text-primary-foreground hover:opacity-90", isSubmitting && "opacity-80")}
          >
            {isSubmitting ? <Upload className="h-4 w-4 animate-pulse" /> : <Save className="h-4 w-4" />}
            {isSubmitting ? "Salvando evento..." : "Salvar evento completo"}
          </Button>
        </div>
      </form>
    </AdminShell>
  );
}
