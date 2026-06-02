import { useEffect, useId, useMemo } from "react";
import { ImagePlus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProtectedImage } from "@/components/ui/protected-image";
import { getApiResourceUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

type EventCoverImagePickerProps = {
  currentCoverUrl?: string;
  disabled?: boolean;
  selectedFile: File | null;
  onChange: (file: File | null) => void;
  onRemove: () => void;
};

const acceptedImageTypes = "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif";

export function EventCoverImagePicker({
  currentCoverUrl,
  disabled = false,
  selectedFile,
  onChange,
  onRemove,
}: EventCoverImagePickerProps) {
  const inputId = useId();
  const selectedPreviewUrl = useMemo(() => {
    if (!selectedFile || typeof URL.createObjectURL !== "function") return undefined;
    return URL.createObjectURL(selectedFile);
  }, [selectedFile]);

  useEffect(
    () => () => {
      if (selectedPreviewUrl && typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(selectedPreviewUrl);
      }
    },
    [selectedPreviewUrl],
  );

  const previewUrl = selectedPreviewUrl ?? (currentCoverUrl ? getApiResourceUrl(currentCoverUrl) : undefined);

  return (
    <div className="space-y-2">
      <input
        id={inputId}
        type="file"
        accept={acceptedImageTypes}
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />

      {previewUrl ? (
        <div className="relative overflow-hidden rounded-xl border border-border/60 bg-brand-soft shadow-card">
          <ProtectedImage src={previewUrl} alt="Preview da imagem do evento" className="aspect-[16/7] w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/60 p-2 text-white backdrop-blur-sm">
            <label
              htmlFor={inputId}
              className={cn(
                "inline-flex cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors hover:bg-white/15",
                disabled && "pointer-events-none opacity-50",
              )}
            >
              <RefreshCw className="h-4 w-4" />
              Trocar foto
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              className="h-8 gap-1.5 px-3 text-xs text-white hover:bg-white/15 hover:text-white"
              aria-label="Remover imagem do evento"
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4" />
              Remover
            </Button>
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
          <ImagePlus className="h-6 w-6" />
          <div>
            <div className="font-semibold text-foreground">Selecionar imagem do evento</div>
            <div className="text-[11px]">Envie uma imagem JPG, PNG, WEBP ou GIF para destacar o evento.</div>
          </div>
        </label>
      )}

      {selectedFile ? (
        <p className="truncate text-xs text-muted-foreground">
          Nova imagem selecionada: <strong>{selectedFile.name}</strong>
        </p>
      ) : null}
    </div>
  );
}
