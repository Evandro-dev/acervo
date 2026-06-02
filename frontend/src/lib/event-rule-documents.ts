export const eventRuleDocumentAccept = [
  "application/pdf",
  ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".pptx",
].join(",");

const supportedExtensions = [".pdf", ".docx", ".pptx"] as const;

function getPathname(value: string) {
  try {
    return new URL(value, "http://local.acervo").pathname;
  } catch {
    return value;
  }
}

export function getEventRuleDocumentExtension(value: string) {
  const pathname = getPathname(value).toLowerCase();
  return supportedExtensions.find((extension) => pathname.endsWith(extension));
}

export function getEventRuleDocumentLabel(value: string) {
  switch (getEventRuleDocumentExtension(value)) {
    case ".pdf":
      return "PDF";
    case ".docx":
      return "Word";
    case ".pptx":
      return "PowerPoint";
    default:
      return "Arquivo";
  }
}

export function isSupportedEventRuleDocument(file: Pick<File, "name">) {
  return Boolean(getEventRuleDocumentExtension(file.name));
}

export function removeEventRuleDocumentExtension(fileName: string) {
  const extension = getEventRuleDocumentExtension(fileName);
  return extension ? fileName.slice(0, -extension.length) : fileName;
}
