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
const fallbackHint = "Caso não tenha uma imagem, será exibido um ícone de calendário para seu evento.";

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
        name={inputId}
        type="file"
        accept={acceptedImageTypes}
        aria-label="Selecionar imagem do evento"
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />

      {previewUrl ? (
        <div className="group relative h-40 w-full overflow-hidden rounded-xl border border-border/60 bg-muted shadow-card transition-colors hover:border-[#d00012] sm:h-48">
          <ProtectedImage src={previewUrl} alt="Preview da imagem do evento" className="h-full w-full object-contain" />
          <label
            htmlFor={inputId}
            className={cn(
              "absolute inset-0 flex cursor-pointer items-center justify-center bg-black/0 text-white opacity-100 transition-all duration-200 sm:opacity-0 sm:group-hover:bg-black/45 sm:group-hover:opacity-100 sm:group-focus-within:bg-black/45 sm:group-focus-within:opacity-100",
              disabled && "pointer-events-none opacity-0",
            )}
          >
            <span className="flex max-w-xs flex-col items-center gap-1 rounded-xl bg-black/65 px-4 py-3 text-center shadow-sm sm:bg-transparent sm:shadow-none">
              <span className="inline-flex items-center gap-2 text-xs font-semibold sm:text-sm">
                <RefreshCw className="h-4 w-4" />
                Trocar foto
              </span>
              <span className="text-[11px] font-normal leading-relaxed text-white/85">{fallbackHint}</span>
            </span>
          </label>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="absolute right-2 top-2 z-10 h-9 w-9 rounded-full bg-white text-destructive shadow-md hover:bg-white/90 hover:text-destructive"
            aria-label="Remover imagem do evento"
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={cn(
            "group flex h-40 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 px-3 text-center text-sm text-muted-foreground transition-colors hover:border-[#d00012] hover:bg-[#fff5f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d00012]/25 sm:h-48",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          <ImagePlus className="h-6 w-6 transition-colors group-hover:text-[#d00012]" />
          <div>
            <div className="font-semibold text-foreground transition-colors group-hover:text-[#d00012]">Selecionar imagem do evento</div>
            <div className="text-[11px]">Envie uma imagem JPG, PNG, WEBP ou GIF para destacar o evento.</div>
            <div className="mt-1 text-[11px]">{fallbackHint}</div>
          </div>
        </label>
      )}

    </div>
  );
}
