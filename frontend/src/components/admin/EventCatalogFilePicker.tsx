import { useId } from "react";
import {
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProtectedImage } from "@/components/ui/protected-image";
import { formatFileSize } from "@/lib/file-size";
import { getApiResourceUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

export type EventCatalogFilePickerProps = {
  currentImageUrl?: string;
  currentPdfUrl?: string;
  disabled?: boolean;
  previewDataUrl?: string;
  selectedPdfFile?: File | null;
  detectedIsbn?: string;
  isReading?: boolean;
  onFilesChange: (files: File[]) => void;
  onRemove: () => void;
  onCancelTemporarySelection?: () => void;
};

const acceptedCatalogPdfTypes = "application/pdf,.pdf";

function getResourceFileName(resourceUrl?: string) {
  if (!resourceUrl) return "";

  const rawFileName = resourceUrl.split("?")[0]?.split("/").pop() ?? "";

  try {
    return decodeURIComponent(rawFileName);
  } catch {
    return rawFileName;
  }
}

function getReadableCatalogFileName(resourceUrl?: string) {
  const fileName = getResourceFileName(resourceUrl);

  return fileName
    .replace(/^\d+-/, "")
    .replace(/-[0-9a-f]{8}(?=\.[^.]+$)/i, "");
}

export function EventCatalogFilePicker({
  currentImageUrl,
  currentPdfUrl,
  disabled = false,
  previewDataUrl,
  selectedPdfFile,
  detectedIsbn,
  isReading = false,
  onFilesChange,
  onRemove,
  onCancelTemporarySelection,
}: EventCatalogFilePickerProps) {
  const inputId = useId();

  const hasSavedCatalog = Boolean(currentImageUrl || currentPdfUrl);
  const hasTemporarySelection = Boolean(previewDataUrl || selectedPdfFile);
  const currentImageSrc = currentImageUrl
    ? getApiResourceUrl(currentImageUrl)
    : undefined;
  const currentPdfHref = currentPdfUrl
    ? getApiResourceUrl(currentPdfUrl)
    : undefined;
  const previewSrc = previewDataUrl || currentImageSrc;

  const previewAlt = hasTemporarySelection
    ? "Prévia da ficha catalográfica"
    : "Ficha catalográfica";

  const cancelTemporaryLabel = hasSavedCatalog
    ? "Cancelar troca"
    : "Remover seleção";
  const removeActionLabel = hasTemporarySelection
    ? cancelTemporaryLabel
    : "Remover ficha catalográfica";
  const canRemoveOrCancel = hasTemporarySelection
    ? Boolean(onCancelTemporarySelection)
    : hasSavedCatalog;

  const handleRemoveOrCancel = () => {
    if (hasTemporarySelection && onCancelTemporarySelection) {
      onCancelTemporarySelection();
      return;
    }

    if (hasSavedCatalog) {
      onRemove();
    }
  };

  const shouldShowSavedFileLinks = hasSavedCatalog && !hasTemporarySelection;
  const displayPdfName =
    selectedPdfFile?.name || getReadableCatalogFileName(currentPdfUrl);
  const displayPdfSize = selectedPdfFile ? formatFileSize(selectedPdfFile.size) : "";
  const hasMetadataPair = Boolean(displayPdfName && detectedIsbn);
  const shouldShowHeader =
    Boolean(displayPdfName) ||
    Boolean(detectedIsbn) ||
    isReading ||
    shouldShowSavedFileLinks ||
    canRemoveOrCancel;

  const replacePdfControl = (
    <label
      htmlFor={inputId}
      className={cn(
        "inline-flex h-7 cursor-pointer items-center justify-center gap-1 rounded-full border border-[#ff7a84] bg-[#b80010] px-2 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-[#a0000d] sm:h-8 sm:gap-1.5 sm:px-3 sm:text-xs",
        disabled && "pointer-events-none opacity-50",
      )}
      title="Trocar PDF"
    >
      <RefreshCw className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
      <span className="sm:hidden">Trocar</span>
      <span className="hidden sm:inline">Trocar PDF</span>
    </label>
  );

  const actionControls = (
    <>
      {replacePdfControl}

      {currentPdfHref && shouldShowSavedFileLinks ? (
        <Button
          asChild
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 rounded-full border border-[#ff7a84] bg-[#b80010] px-2 text-[11px] font-semibold text-white shadow-sm hover:bg-[#a0000d] hover:text-white sm:h-8 sm:px-3 sm:text-xs"
          aria-label="Abrir PDF da ficha catalográfica"
          title="Abrir PDF"
        >
          <a href={currentPdfHref} target="_blank" rel="noopener noreferrer">
            <FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span>PDF</span>
          </a>
        </Button>
      ) : null}

      {currentImageSrc && shouldShowSavedFileLinks ? (
        <Button
          asChild
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 rounded-full border border-[#ff7a84] bg-[#b80010] px-2 text-[11px] font-semibold text-white shadow-sm hover:bg-[#a0000d] hover:text-white sm:h-8 sm:px-3 sm:text-xs"
          aria-label="Abrir imagem da ficha catalográfica"
          title="Abrir imagem"
        >
          <a href={currentImageSrc} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span>Imagem</span>
          </a>
        </Button>
      ) : null}

      {canRemoveOrCancel ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="h-7 rounded-full border border-[#ff7a84] bg-[#b80010] px-2 text-[11px] font-semibold text-white shadow-sm hover:bg-[#a0000d] hover:text-white sm:h-8 sm:px-3 sm:text-xs"
          aria-label={removeActionLabel}
          title={removeActionLabel}
          onClick={handleRemoveOrCancel}
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Remover</span>
        </Button>
      ) : null}
    </>
  );

  const metadataContent = (
    <div
      className={cn(
        "grid min-w-0 flex-1 gap-1",
        hasMetadataPair ? "grid-cols-2" : "grid-cols-1",
        "sm:flex sm:flex-wrap sm:items-center",
      )}
    >
      {displayPdfName ? (
        <div className="flex min-w-0 items-center gap-1 rounded-full bg-[#b80010] px-2 py-1 text-[11px] text-white sm:gap-1.5 sm:px-2.5 sm:text-xs">
          <FileText className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
          <span className="min-w-0 truncate font-medium text-white">
            {displayPdfName}
          </span>
          {displayPdfSize ? (
            <span className="hidden shrink-0 sm:inline">{displayPdfSize}</span>
          ) : null}
        </div>
      ) : null}

      {detectedIsbn ? (
        <div className="flex min-w-0 items-center rounded-full bg-[#b80010] px-2 py-1 text-[10px] font-medium leading-none text-white sm:px-2.5 sm:text-xs sm:leading-normal">
          <span className="min-w-0 truncate">
            ISBN: <strong>{detectedIsbn}</strong>
          </span>
        </div>
      ) : null}

      {isReading ? (
        <div className="flex min-w-0 items-center gap-1 rounded-full bg-[#b80010] px-2 py-1 text-[11px] text-white sm:gap-1.5 sm:px-2.5 sm:text-xs">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
          <span className="truncate">Lendo ficha...</span>
        </div>
      ) : null}
    </div>
  );

  const headerContent = shouldShowHeader ? (
    <div className="flex flex-col gap-1.5 border-b border-[#d00012] bg-[#d00012] p-2 text-primary-foreground shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:p-2.5">
      {metadataContent}

      <div className="hidden shrink-0 flex-wrap justify-end gap-1.5 sm:flex">
        {actionControls}
      </div>
    </div>
  ) : null;

  const mobileFooterActions = (
    <div className="flex flex-wrap justify-center gap-1 border-t border-[#d00012] bg-[#d00012] p-1.5 text-primary-foreground sm:hidden">
      {actionControls}
    </div>
  );

  return (
    <div className="space-y-2">
      <input
        id={inputId}
        name={inputId}
        type="file"
        accept={acceptedCatalogPdfTypes}
        aria-label={hasSavedCatalog ? "Trocar PDF da ficha" : "Selecionar PDF da ficha"}
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) onFilesChange(files);
          event.target.value = "";
        }}
      />

      {previewSrc ? (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-white shadow-card transition-colors hover:border-[#d00012]">
          {headerContent}

          <div className="max-h-130 overflow-auto bg-white p-2">
            <ProtectedImage
              src={previewSrc}
              alt={previewAlt}
              className="mx-auto max-w-full object-contain"
            />
          </div>

          {(shouldShowSavedFileLinks || canRemoveOrCancel) ? mobileFooterActions : null}
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={cn(
            "group flex min-h-42.5 w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground transition-colors hover:border-[#d00012] hover:bg-[#fff5f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d00012]/25",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          {(selectedPdfFile || isReading || detectedIsbn) ? (
            <div className="mb-3 w-full rounded-xl border border-border/70 bg-background/95 text-left shadow-sm">
              {headerContent}
              {(canRemoveOrCancel || selectedPdfFile || isReading)
                ? mobileFooterActions
                : null}
            </div>
          ) : null}

          <div className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors group-hover:text-[#d00012]">
            {isReading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Upload className="h-6 w-6" />
            )}
          </div>

          <div className="flex flex-col gap-1">
            <div className="font-semibold text-foreground transition-colors group-hover:text-[#d00012]">
              {isReading ? "Processando ficha..." : "Selecionar PDF da ficha"}
            </div>
            <div className="max-w-md text-xs leading-relaxed text-muted-foreground">
              Selecione o PDF para gerar a prévia da ficha catalográfica.
            </div>
          </div>
        </label>
      )}
    </div>
  );
}
