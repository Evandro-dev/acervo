type PdfProcessingErrorCode =
  | "PDF_UPLOAD_INVALID"
  | "PDF_BINARY_INVALID"
  | "PDF_PASSWORD_REQUIRED"
  | "PDF_CORRUPTED"
  | "PDF_UNREADABLE";

type PdfProcessingErrorOptions = {
  cause?: unknown;
  statusCode?: number;
  code?: PdfProcessingErrorCode;
};

export class PdfProcessingError extends Error {
  readonly statusCode: number;
  readonly code: PdfProcessingErrorCode;

  constructor(message: string, options: PdfProcessingErrorOptions = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "PdfProcessingError";
    this.statusCode = options.statusCode ?? 422;
    this.code = options.code ?? "PDF_UNREADABLE";
  }
}

function getErrorName(error: unknown) {
  if (error instanceof Error && error.name) return error.name;
  if (typeof error === "object" && error !== null && "name" in error && typeof error.name === "string") {
    return error.name;
  }
  return "";
}

export function createInvalidPdfUploadError(message: string) {
  return new PdfProcessingError(message, {
    statusCode: 400,
    code: "PDF_UPLOAD_INVALID",
  });
}

export function createInvalidPdfBinaryError() {
  return new PdfProcessingError("O arquivo enviado nao parece ser um PDF valido.", {
    statusCode: 400,
    code: "PDF_BINARY_INVALID",
  });
}

export function mapPdfParserError(error: unknown) {
  if (error instanceof PdfProcessingError) return error;

  switch (getErrorName(error)) {
    case "PasswordException":
      return new PdfProcessingError("Esse PDF esta protegido por senha e nao pode ser lido automaticamente.", {
        cause: error,
        statusCode: 422,
        code: "PDF_PASSWORD_REQUIRED",
      });
    case "InvalidPDFException":
    case "FormatError":
      return new PdfProcessingError("O PDF enviado esta corrompido ou em um formato invalido.", {
        cause: error,
        statusCode: 422,
        code: "PDF_CORRUPTED",
      });
    case "UnknownErrorException":
      return new PdfProcessingError("Nao foi possivel ler este PDF. Revise o arquivo e tente novamente.", {
        cause: error,
        statusCode: 422,
        code: "PDF_UNREADABLE",
      });
    default:
      return error;
  }
}
