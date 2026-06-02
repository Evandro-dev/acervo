import { useId } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/file-size";
import { cn } from "@/lib/utils";

type PdfFilePickerProps = {
  description: string;
  disabled?: boolean;
  multiple?: boolean;
  onFilesChange: (files: File[]) => void;
  onRemove?: () => void;
  selectedFile?: File | null;
  title: string;
};

export function PdfFilePicker({
  description,
  disabled = false,
  multiple = false,
  onFilesChange,
  onRemove,
  selectedFile,
  title,
}: PdfFilePickerProps) {
  const inputId = useId();

  return (
    <div>
      <input
        id={inputId}
        type="file"
        accept="application/pdf,.pdf"
        multiple={multiple}
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) onFilesChange(files);
          event.target.value = "";
        }}
      />

      {selectedFile ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex min-w-0 items-center gap-3">
            <FileText className="h-6 w-6 shrink-0 text-brand" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">{selectedFile.name}</div>
              <div className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label
              htmlFor={inputId}
              className={cn(
                "inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                disabled && "pointer-events-none opacity-50",
              )}
            >
              <Upload className="h-4 w-4" /> Trocar PDF
            </label>
            {onRemove ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled}
                className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                aria-label="Remover PDF selecionado"
                onClick={onRemove}
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
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 px-3 py-10 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/50",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          <FileText className="h-6 w-6" />
          <div>
            <div className="font-semibold text-foreground">{title}</div>
            <div className="text-[11px]">{description}</div>
          </div>
        </label>
      )}
    </div>
  );
}
