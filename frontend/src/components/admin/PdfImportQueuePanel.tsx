import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PdfFileSummary } from "@/components/admin/PdfFileSummary";
import type { PdfQueueItem } from "@/features/acervo/article-import-model";
import { cn } from "@/lib/utils";

type PdfImportQueuePanelProps = {
  activePdfIndex: number;
  activePdfItem: PdfQueueItem | null;
  failedPdfCount: number;
  hasStartedPdfProcessing: boolean;
  isBatchReading: boolean;
  isFirstPdfItem: boolean;
  isLastPdfItem: boolean;
  onAddFiles: (files: FileList | null) => void;
  onClearQueue: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onReadAll: () => void;
  onRemoveActive: () => void;
  pdfItemCount: number;
  pendingPdfCount: number;
  readyPdfCount: number;
};

export function PdfImportQueuePanel({
  activePdfIndex,
  activePdfItem,
  failedPdfCount,
  hasStartedPdfProcessing,
  isBatchReading,
  isFirstPdfItem,
  isLastPdfItem,
  onAddFiles,
  onClearQueue,
  onNext,
  onPrevious,
  onReadAll,
  onRemoveActive,
  pdfItemCount,
  pendingPdfCount,
  readyPdfCount,
}: PdfImportQueuePanelProps) {
  const readablePdfCount = pendingPdfCount + failedPdfCount || pdfItemCount;

  const readButtonLabel = isBatchReading
    ? "Lendo PDFs da fila..."
    : `Ler ${readablePdfCount} ${
        readablePdfCount === 1 ? "PDF pendente" : "PDFs pendentes"
      }`;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
          <div className="flex w-full items-center justify-between gap-2 md:hidden">
            <PdfQueueBadges
              className="min-w-0 flex-1 justify-start"
              failedPdfCount={failedPdfCount}
              hasStartedPdfProcessing={hasStartedPdfProcessing}
              pendingPdfCount={pendingPdfCount}
              readyPdfCount={readyPdfCount}
              compact
            />

            <PdfQueueNavigation
              activePdfIndex={activePdfIndex}
              compact
              isFirstPdfItem={isFirstPdfItem}
              isLastPdfItem={isLastPdfItem}
              onNext={onNext}
              onPrevious={onPrevious}
              pdfItemCount={pdfItemCount}
            />
          </div>

          <div className="hidden md:flex md:items-center md:gap-2">
            <PdfQueueNavigation
              activePdfIndex={activePdfIndex}
              isFirstPdfItem={isFirstPdfItem}
              isLastPdfItem={isLastPdfItem}
              onNext={onNext}
              onPrevious={onPrevious}
              pdfItemCount={pdfItemCount}
            />
          </div>

          <div className="grid w-full grid-cols-3 gap-1 md:w-auto md:grid-cols-none md:flex md:flex-wrap md:items-center md:gap-2">
            <label className="inline-flex h-8 min-w-0 cursor-pointer items-center justify-center gap-1 rounded-full bg-brand px-1 text-[9px] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-brand/90 md:px-3 md:text-xs">
              <Upload className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Adicionar PDFs</span>
              <input
                id="pdf-queue-files"
                name="pdf-queue-files"
                type="file"
                accept="application/pdf,.pdf"
                aria-label="Adicionar PDFs"
                multiple
                className="hidden"
                onChange={(event) => {
                  onAddFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 min-w-0 rounded-full border-border bg-background px-1 text-[9px] font-semibold text-destructive hover:bg-muted/50 hover:text-destructive [&_svg]:stroke-current md:px-3 md:text-xs"
              onClick={onRemoveActive}
            >
              <X className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Remover atual</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 min-w-0 rounded-full border-border bg-background px-1 text-[9px] font-semibold text-destructive hover:bg-muted/50 hover:text-destructive [&_svg]:stroke-current md:px-3 md:text-xs"
              onClick={onClearQueue}
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Limpar fila</span>
            </Button>
          </div>
        </div>

        <PdfQueueBadges
          className="hidden md:flex"
          failedPdfCount={failedPdfCount}
          hasStartedPdfProcessing={hasStartedPdfProcessing}
          pendingPdfCount={pendingPdfCount}
          readyPdfCount={readyPdfCount}
        />
      </div>

      <PdfFileSummary
        className="mt-4"
        name={activePdfItem?.file.name ?? ""}
        size={activePdfItem?.file.size ?? 0}
      />

      <div className="mt-4 flex justify-center">
        <Button
          type="button"
          className="w-full max-w-72 gap-2 bg-brand text-primary-foreground hover:bg-brand/90 md:w-auto"
          disabled={isBatchReading}
          onClick={onReadAll}
        >
          <Sparkles className="h-4 w-4" />
          {readButtonLabel}
        </Button>
      </div>
    </div>
  );
}

function PdfQueueNavigation({
  activePdfIndex,
  compact = false,
  isFirstPdfItem,
  isLastPdfItem,
  onNext,
  onPrevious,
  pdfItemCount,
}: {
  activePdfIndex: number;
  compact?: boolean;
  isFirstPdfItem: boolean;
  isLastPdfItem: boolean;
  onNext: () => void;
  onPrevious: () => void;
  pdfItemCount: number;
}) {
  return (
    <div className={cn("flex shrink-0 items-center", compact ? "gap-1" : "gap-1.5")}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Arquivo anterior"
        className={cn("shrink-0 rounded-full", compact ? "size-7" : "size-8")}
        disabled={isFirstPdfItem}
        onClick={onPrevious}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Badge
        variant="secondary"
        className={cn(
          "justify-center whitespace-nowrap",
          compact ? "min-w-14 px-1.5 text-[10px]" : "min-w-16 px-2 text-[11px]",
        )}
      >
        {activePdfIndex + 1} de {pdfItemCount}
      </Badge>

      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="PrÃ³ximo arquivo"
        className={cn("shrink-0 rounded-full", compact ? "size-7" : "size-8")}
        disabled={isLastPdfItem}
        onClick={onNext}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function PdfQueueBadges({
  className,
  compact = false,
  failedPdfCount,
  hasStartedPdfProcessing,
  pendingPdfCount,
  readyPdfCount,
}: {
  className?: string;
  compact?: boolean;
  failedPdfCount: number;
  hasStartedPdfProcessing: boolean;
  pendingPdfCount: number;
  readyPdfCount: number;
}) {
  const badgeClassName = compact ? "h-6 shrink-0 px-1.5 text-[9px] leading-none" : undefined;

  return (
    <div className={cn("flex", compact ? "flex-nowrap gap-1" : "flex-wrap justify-end gap-2", className)}>
      <Badge variant="outline" className={badgeClassName}>
        {pendingPdfCount} pendentes
      </Badge>

      <Badge
        variant="outline"
        className={cn(
          badgeClassName,
          hasStartedPdfProcessing
            ? "border-emerald-200 bg-emerald-500/10 text-emerald-700"
            : "border-dashed border-border bg-muted/40 text-muted-foreground",
        )}
      >
        {readyPdfCount} prontos
      </Badge>

      <Badge
        variant="outline"
        className={cn(
          badgeClassName,
          hasStartedPdfProcessing
            ? "border-amber-200 bg-amber-500/10 text-amber-700"
            : "border-dashed border-border bg-muted/40 text-muted-foreground",
        )}
      >
        {failedPdfCount} com falha
      </Badge>
    </div>
  );
}