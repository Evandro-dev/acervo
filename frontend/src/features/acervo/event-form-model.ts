import { isStoredEventRuleFileUrl } from "@/lib/event-rule-file";
import {
  isUsableExternalResourceUrl,
  isUsableResourceUrl,
} from "@/lib/file-links";
import {
  eventTypes,
  type Event,
  type EventMutationInput,
  type EventRule,
  type EventType,
} from "@/types/acervo";
export const committeeTypeOptions = ["Organizadora", "Científica"] as const;
export type CommitteeType = (typeof committeeTypeOptions)[number];

export type ThemeFormItem = {
  key: string;
  value: string;
};

export type CommitteeFormItem = {
  key: string;
  name: string;
  role: string;
};

export type RuleFormItem = {
  key: string;
  title: string;
  fileUrl: string;
  pendingFile: File | null;
  useExternalLink: boolean;
};

export type PreviousEditionFormItem = {
  key: string;
  label: string;
  year: string;
  linkMode: "none" | "internal" | "external";
  eventId: string;
  externalUrl: string;
};

export type FormState = {
  title: string;
  edition: string;
  year: number;
  date: string;
  area: string;
  type: EventType;
  coverUrl: string;
  coverFile: File | null;
  removeCoverOnSave: boolean;
  presentation: string;
  contactEmail: string;
  contactPhone: string;
  catalogIsbn: string;
  catalogDoi: string;
  catalogText: string;
  catalogPdfUrl: string;
  catalogImageUrl: string;
  catalogImagePreviewDataUrl: string;
  removeCatalogFilesOnSave: boolean;
  themes: ThemeFormItem[];
  committee: CommitteeFormItem[];
  rules: RuleFormItem[];
  previousEditions: PreviousEditionFormItem[];
};

export type PreparedRuleRow = {
  key: string;
  title: string;
  fileUrl: string;
  pendingFile: File | null;
};

export type RuleFileMode = "upload" | "external";
export type CatalogInputMode = "manual" | "pdf";

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

export function createThemeItem(value = ""): ThemeFormItem {
  return { key: createKey("theme"), value };
}

export function normalizeCommitteeType(value?: string): CommitteeType {
  const normalized = value
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

  return normalized === "CIENTIFICA" ? "Científica" : "Organizadora";
}

export function createCommitteeItem(
  value?: Partial<Omit<CommitteeFormItem, "key">>,
): CommitteeFormItem {
  return {
    key: createKey("committee"),
    name: value?.name ?? "",
    role: normalizeCommitteeType(value?.role),
  };
}

export function isSupportedCoverImageFile(file: File) {
  const supportedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const supportedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
  const fileName = file.name.toLowerCase();

  return (
    supportedTypes.includes(file.type) ||
    supportedExtensions.some((extension) => fileName.endsWith(extension))
  );
}

export function isCatalogPdfFile(file: File) {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function extractIsbnFromCatalogText(value: string) {
  const match = value.match(
    /ISBN\s*[:\-]?\s*((?:97[89][-\s]?)?\d[\d\s-]{8,20}[\dXx])/i,
  );
  if (!match) return "";

  return match[1].replace(/\s+/g, "-").replace(/-+/g, "-").trim();
}

export function createRuleItem(
  value?: Partial<Omit<RuleFormItem, "key" | "pendingFile">>,
): RuleFormItem {
  const fileUrl = value?.fileUrl ?? "";

  return {
    key: createKey("rule"),
    title: value?.title ?? "",
    fileUrl,
    pendingFile: null,
    useExternalLink:
      value?.useExternalLink ??
      (fileUrl ? !isStoredEventRuleFileUrl(fileUrl) : false),
  };
}

export function getRuleFileMode(rule: RuleFormItem): RuleFileMode {
  return rule.useExternalLink ? "external" : "upload";
}

export function setRuleFileMode(
  rule: RuleFormItem,
  mode: RuleFileMode,
): Partial<RuleFormItem> {
  if (mode === "external") {
    return {
      useExternalLink: true,
      pendingFile: null,
      fileUrl:
        !rule.fileUrl || isStoredEventRuleFileUrl(rule.fileUrl)
          ? ""
          : rule.fileUrl,
    };
  }

  return {
    useExternalLink: false,
    pendingFile: null,
    fileUrl: isStoredEventRuleFileUrl(rule.fileUrl) ? rule.fileUrl : "",
  };
}

export function createPreviousEditionItem(
  value?: Partial<Omit<PreviousEditionFormItem, "key">>,
): PreviousEditionFormItem {
  const eventId = value?.eventId ?? "";
  const externalUrl = value?.externalUrl ?? "";

  return {
    key: createKey("edition"),
    label: value?.label ?? "",
    year: value?.year ?? "",
    linkMode:
      value?.linkMode ??
      (eventId ? "internal" : externalUrl ? "external" : "none"),
    eventId,
    externalUrl,
  };
}

export function emptyForm(): FormState {
  return {
    title: "",
    edition: "",
    year: new Date().getFullYear(),
    date: "",
    area: "",
    type: "Congresso",
    coverUrl: "",
    coverFile: null,
    removeCoverOnSave: false,
    presentation: "",
    contactEmail: "",
    contactPhone: "",
    catalogIsbn: "",
    catalogDoi: "",
    catalogText: "",
    catalogPdfUrl: "",
    catalogImageUrl: "",
    catalogImagePreviewDataUrl: "",
    removeCatalogFilesOnSave: false,
    themes: [createThemeItem()],
    committee: [createCommitteeItem()],
    rules: [createRuleItem()],
    previousEditions: [],
  };
}

export function mapEventToForm(event: Event): FormState {
  return {
    title: event.title,
    edition: event.edition,
    year: event.year,
    date: event.date,
    area: event.area,
    type: event.type,
    coverUrl: event.cover ?? "",
    coverFile: null,
    removeCoverOnSave: false,
    presentation: event.presentation,
    contactEmail: event.contact.email,
    contactPhone: event.contact.phone ?? "",
    catalogIsbn: event.catalog.isbn ?? "",
    catalogDoi: event.catalog.doi ?? "",
    catalogText: event.catalog.text ?? "",
    catalogPdfUrl: event.catalog.pdfUrl ?? "",
    catalogImageUrl: event.catalog.imageUrl ?? "",
    catalogImagePreviewDataUrl: "",
    removeCatalogFilesOnSave: false,
    themes: event.themes.length
      ? event.themes.map((theme) => createThemeItem(theme))
      : [createThemeItem()],
    committee: event.committee.length
      ? event.committee.map((member) => createCommitteeItem(member))
      : [createCommitteeItem()],
    rules: event.rules.length
      ? event.rules.map((rule) =>
          createRuleItem({ title: rule.title, fileUrl: rule.file }),
        )
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

export function replaceItemByKey<T extends { key: string }>(
  items: T[],
  key: string,
  patch: Partial<T>,
) {
  return items.map((item) => (item.key === key ? { ...item, ...patch } : item));
}

export function removeItemByKey<T extends { key: string }>(items: T[], key: string) {
  return items.filter((item) => item.key !== key);
}

export function validateAndPrepare(
  form: FormState,
  options?: { catalogInputMode?: CatalogInputMode },
) {
  const title = form.title.trim();
  const date = form.date.trim();
  const area = form.area.trim();
  const presentation = form.presentation.trim();
  const contactEmail = form.contactEmail.trim();
  const contactPhone = form.contactPhone.trim();
  const catalogText = form.catalogText.replace(/\r\n/g, "\n");
  const catalogPdfUrl = form.catalogPdfUrl.trim();
  const catalogImageUrl = form.catalogImageUrl.trim();
  const catalogIsbn =
    form.catalogIsbn.trim() || extractIsbnFromCatalogText(catalogText);
  const shouldSaveCatalogText =
    options?.catalogInputMode !== "pdf" && !form.removeCatalogFilesOnSave;

  if (title.length < 2) {
    throw new Error("Identificação > Título: informe pelo menos 2 caracteres.");
  }

  if (!Number.isInteger(form.year) || form.year < 1900 || form.year > 3000) {
    throw new Error(
      "Identificação > Ano: informe um ano válido para o evento.",
    );
  }

  if (!area) {
    throw new Error(
      "Identificação > Tema principal: informe a Área principal do evento.",
    );
  }

  if (presentation.length < 10) {
    throw new Error(
      "Identificação > Apresentação: escreva pelo menos 10 caracteres.",
    );
  }

  if (!contactEmail) {
    throw new Error("Contato > E-mail: informe o e-mail de contato do evento.");
  }

  if (!isValidEmail(contactEmail)) {
    throw new Error("Contato > E-mail: informe um e-mail válido.");
  }

  const eventType = form.type?.toString().trim() ?? "";
  if (!eventType || !eventTypes.includes(eventType as EventType)) {
    throw new Error("Identificação > Tipo: selecione um tipo válido para o evento.");
  }

  const themes = form.themes.map((theme) => theme.value.trim()).filter(Boolean);

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

    const eventId =
      edition.linkMode === "internal" ? edition.eventId.trim() : "";
    const externalUrl =
      edition.linkMode === "external" ? edition.externalUrl.trim() : "";

    if (edition.linkMode === "internal" && !eventId) {
      throw new Error(
        "Selecione o evento interno da edição anterior ou altere o destino.",
      );
    }

    if (edition.linkMode === "external") {
      if (!externalUrl) {
        throw new Error(
          "Informe o link externo da edição anterior ou altere o destino.",
        );
      }

      if (!isUsableExternalResourceUrl(externalUrl)) {
        throw new Error(
          "O link externo da edição anterior precisa ser uma URL http ou https válida.",
        );
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
        throw new Error(
          "Cada norma com link externo precisa de uma URL válida.",
        );
      }
      if (!isUsableExternalResourceUrl(fileUrl)) {
        throw new Error(
          "Os links externos das normas precisam ser URLs http ou https válidas.",
        );
      }
    } else {
      if (!fileUrl && !rule.pendingFile) {
        throw new Error(
          "Cada norma precisa de um arquivo enviado ou de uma URL válida.",
        );
      }
      if (fileUrl && !isUsableResourceUrl(fileUrl)) {
        throw new Error(
          "As URLs das normas precisam apontar para recursos válidos.",
        );
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
    throw new Error(
      "A imagem atual do evento precisa apontar para uma URL válida.",
    );
  }

  if (form.coverFile && !isSupportedCoverImageFile(form.coverFile)) {
    throw new Error("A imagem do evento precisa ser JPG, PNG, WEBP ou GIF.");
  }

  if (catalogPdfUrl && !isUsableResourceUrl(catalogPdfUrl)) {
    throw new Error(
      "O PDF da ficha catalográfica precisa apontar para uma URL válida.",
    );
  }

  if (catalogImageUrl && !isUsableResourceUrl(catalogImageUrl)) {
    throw new Error(
      "A imagem da ficha catalográfica precisa apontar para uma URL válida.",
    );
  }

  const payload: EventMutationInput = {
    title,
    edition: form.edition.trim(),
    year: form.year,
    date,
    area,
    type: eventType as EventType,
    coverUrl: coverUrl || (form.removeCoverOnSave ? null : undefined),
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
      isbn: catalogIsbn || undefined,
      doi: form.catalogDoi.trim() || undefined,
      text: shouldSaveCatalogText ? catalogText || undefined : "",
      pdfUrl:
        catalogPdfUrl || (form.removeCatalogFilesOnSave ? null : undefined),
      imageUrl:
        catalogImageUrl || (form.removeCatalogFilesOnSave ? null : undefined),
    },
  };

  return {
    payload,
    preparedRules,
    pendingUploads,
    pendingCoverFile: form.coverFile,
  };
}

export function buildFinalRules(
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

