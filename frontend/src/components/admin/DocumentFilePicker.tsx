import { useId } from "react";
import { ExternalLink, FileText, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/file-size";
import { cn } from "@/lib/utils";

export type CurrentDocumentFile = {
  description?: string;
  href?: string;
  name: string;
};

export type DocumentFilePickerProps = {
  accept: string;
  currentFile?: CurrentDocumentFile | null;
  currentRemoveAriaLabel?: string;
  description: string;
  disabled?: boolean;
  multiple?: boolean;
  onFilesChange: (files: File[]) => void;
  onRemove?: () => void;
  onRemoveCurrent?: () => void;
  removeAriaLabel?: string;
  replaceLabel?: string;
  selectedFile?: File | null;
  title: string;
};

export function DocumentFilePicker({
  accept,
  currentFile,
  currentRemoveAriaLabel,
  description,
  disabled = false,
  multiple = false,
  onFilesChange,
  onRemove,
  onRemoveCurrent,
  removeAriaLabel = "Remover arquivo selecionado",
  replaceLabel = "Trocar arquivo",
  selectedFile,
  title,
}: DocumentFilePickerProps) {
  const inputId = useId();
  const displayedFile = selectedFile
    ? {
        description: formatFileSize(selectedFile.size),
        href: undefined,
        isSelected: true,
        name: selectedFile.name,
      }
    : currentFile
      ? {
          description: currentFile.description,
          href: currentFile.href,
          isSelected: false,
          name: currentFile.name,
        }
      : null;
  const removeHandler = displayedFile?.isSelected ? onRemove : onRemoveCurrent;
  const displayedRemoveAriaLabel = displayedFile?.isSelected
    ? removeAriaLabel
    : currentRemoveAriaLabel || removeAriaLabel;

  return (
    <div>
      <input
        id={inputId}
        name={inputId}
        type="file"
        accept={accept}
        aria-label={title}
        multiple={multiple}
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) onFilesChange(files);
          event.target.value = "";
        }}
      />

      {displayedFile ? (
        <div className="group flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3 transition-colors hover:border-[#d00012] hover:bg-[#fff5f6]">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-primary-dark transition-colors group-hover:bg-[#d00012]/10 group-hover:text-[#d00012]">
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-[#d00012]">
                {displayedFile.name}
              </div>
              {displayedFile.description ? (
                <div className="text-xs text-muted-foreground">
                  {displayedFile.description}
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {displayedFile.href ? (
              <Button
                asChild
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-md hover:border-[#d00012] hover:bg-[#fff5f6] hover:text-[#d00012]"
              >
                <a
                  href={displayedFile.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            ) : null}
            <label
              htmlFor={inputId}
              className={cn(
                "inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:border-[#d00012] hover:bg-[#fff5f6] hover:text-[#d00012]",
                disabled && "pointer-events-none opacity-50",
              )}
            >
              <Upload className="h-4 w-4" /> {replaceLabel}
            </label>
            {removeHandler ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled}
                className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                aria-label={displayedRemoveAriaLabel}
                onClick={removeHandler}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={cn(
            "group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 px-3 py-10 text-center text-sm text-muted-foreground transition-colors hover:border-[#d00012] hover:bg-[#fff5f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d00012]/25",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          <FileText className="h-6 w-6 transition-colors group-hover:text-[#d00012]" />
          <div>
            <div className="font-semibold text-foreground transition-colors group-hover:text-[#d00012]">{title}</div>
            <div className="text-[11px]">{description}</div>
          </div>
        </label>
      )}
    </div>
  );
}
