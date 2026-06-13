export type ApiValidationErrorData = {
  details?: {
    fieldErrors?: Record<string, string[] | undefined>;
    formErrors?: string[];
  };
  issues?: Array<{
    path?: string;
    label?: string;
    message?: string;
  }>;
};

const apiFieldLabels: Record<string, string> = {
  name: "Nome",
  email: "E-mail",
  password: "Senha",
  jobTitle: "Cargo na instituição",
  slug: "Identificação > URL",
  title: "Identificação > Título",
  edition: "Identificação > Edição",
  year: "Identificação > Ano",
  date: "Identificação > Período do evento",
  area: "Identificação > Tema principal",
  type: "Identificação > Tipo",
  coverUrl: "Identificação > Imagem do evento",
  presentation: "Identificação > Apresentação",
  themes: "Áreas temáticas",
  committee: "Comissão",
  rules: "Normas",
  previousEditions: "Edições anteriores",
  contact: "Contato",
  "contact.email": "Contato > E-mail",
  "contact.phone": "Contato > Telefone",
  catalog: "Ficha catalográfica",
  "catalog.isbn": "Ficha catalográfica > ISBN",
  "catalog.doi": "Ficha catalográfica > DOI",
  "catalog.text": "Ficha catalográfica > Texto",
};

function getApiFieldLabel(path?: string) {
  if (!path) return "Formulário";
  if (apiFieldLabels[path]) return apiFieldLabels[path];

  const root = path.split(".")[0];
  if (apiFieldLabels[root]) return apiFieldLabels[root];

  return path.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function humanizeApiValidationMessage(message?: string) {
  if (!message) return "verifique este campo.";

  const minimumTextMatch =
    message.match(/String must contain at least (\d+) character/i) ??
    message.match(/Too small:\s*expected string to have >=\s*(\d+) character/i);

  if (minimumTextMatch) {
    return `preencha com pelo menos ${minimumTextMatch[1]} caracteres.`;
  }

  const maximumTextMatch =
    message.match(/String must contain at most (\d+) character/i) ??
    message.match(/Too big:\s*expected string to have <=\s*(\d+) character/i);

  if (maximumTextMatch) {
    return `use no máximo ${maximumTextMatch[1]} caracteres.`;
  }

  const minimumItemsMatch = message.match(/Too small:\s*expected array to have >=\s*(\d+) item/i);
  if (minimumItemsMatch) {
    return `adicione pelo menos ${minimumItemsMatch[1]} item(ns).`;
  }

  if (/Invalid email/i.test(message)) return "informe um e-mail válido.";
  if (/Invalid url/i.test(message)) return "informe uma URL válida.";
  if (/Required|received (?:undefined|null)/i.test(message)) return "campo obrigatório.";
  if (/Expected number|received nan/i.test(message)) return "informe um número válido.";

  if (/^(?:Too small|Too big|Invalid input|Invalid option|Invalid string|Expected )/i.test(message)) {
    return "verifique este campo.";
  }

  return message;
}

export function getApiValidationMessage(data: ApiValidationErrorData) {
  const issueMessages =
    data.issues
      ?.map((issue) => {
        const label = issue.label ?? getApiFieldLabel(issue.path);
        return `${label}: ${humanizeApiValidationMessage(issue.message)}`;
      })
      .filter(Boolean) ?? [];

  const fieldMessages = Object.entries(data.details?.fieldErrors ?? {}).flatMap(([field, messages]) =>
    (messages ?? []).map((message) => `${getApiFieldLabel(field)}: ${humanizeApiValidationMessage(message)}`),
  );

  const formMessages = data.details?.formErrors?.map(humanizeApiValidationMessage) ?? [];
  const messages = [...issueMessages, ...fieldMessages, ...formMessages];
  const uniqueMessages = Array.from(new Set(messages)).slice(0, 4);

  if (!uniqueMessages.length) return undefined;
  return `Verifique: ${uniqueMessages.join(" ")}`;
}
