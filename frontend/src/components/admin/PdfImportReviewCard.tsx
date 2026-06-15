import type { RefObject } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DownloadCloud,
} from "lucide-react";
import { ArticleEditorForm } from "@/components/admin/ArticleEditorForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PdfDraft, PdfQueueItem } from "@/features/acervo/article-import-model";
import { addCommaSeparatedValue, splitCommaSeparatedValues } from "@/lib/comma-separated-values";
import { cn } from "@/lib/utils";

type PdfImportReviewCardProps = {
  activePdfIndex: number;
  activePdfItem: PdfQueueItem | null;
  areaSuggestions: string[];
  courseSuggestions: string[];
  disabled: boolean;
  importButtonLabel: string;
  importablePdfCount: number;
  isFirstPdfItem: boolean;
  isLastPdfItem: boolean;
  onDraftChange: (patch: Partial<PdfDraft>) => void;
  onImport: () => void;
  onNext: () => void;
  onPrevious: () => void;
  pdfItemCount: number;
  reviewCardRef: RefObject<HTMLDivElement | null>;
  selectedEventId: string;
  showReview: boolean;
};

export function PdfImportReviewCard({
  activePdfIndex,
  activePdfItem,
  areaSuggestions,
  courseSuggestions,
  disabled,
  importButtonLabel,
  importablePdfCount,
  isFirstPdfItem,
  isLastPdfItem,
  onDraftChange,
  onImport,
  onNext,
  onPrevious,
  pdfItemCount,
  reviewCardRef,
  selectedEventId,
  showReview,
}: PdfImportReviewCardProps) {
  return (
    <>
      {activePdfItem?.error ? (
        <Card className="border-amber-200 bg-amber-500/10 p-3 shadow-card">
          <div className="flex gap-2 text-xs text-amber-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold">Falha na leitura deste PDF</div>
              <div className="wrap-break-word">{activePdfItem.error}</div>
            </div>
          </div>
        </Card>
      ) : null}

      {showReview && activePdfItem ? (
        <Card ref={reviewCardRef} className="overflow-hidden border-border/60 p-3 shadow-card">
          <div className="mb-4 flex w-full min-w-0 items-start justify-between gap-2">
            <div className="min-w-0 flex-1 pr-1">
              <div className="truncate text-sm font-semibold">Revisão do arquivo atual</div>
              <div className="text-xs leading-snug text-muted-foreground">
                Corrija os campos deste PDF antes de salvar.
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
              <PdfReviewNavigation
                activePdfIndex={activePdfIndex}
                compact
                isFirstPdfItem={isFirstPdfItem}
                isLastPdfItem={isLastPdfItem}
                onNext={onNext}
                onPrevious={onPrevious}
                pdfItemCount={pdfItemCount}
              />

              {activePdfItem.status === "saved" ? (
                <Badge
                  variant="outline"
                  className="h-6 border-emerald-200 bg-emerald-500/10 px-1.5 text-[9px] leading-none text-emerald-700"
                >
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Importado
                </Badge>
              ) : null}
            </div>
          </div>

          {activePdfItem.metadata ? (
            <PdfMetadataSuggestions
              activePdfItem={activePdfItem}
              onDraftChange={onDraftChange}
            />
          ) : null}

          <ArticleEditorForm
            idPrefix="pdf-review"
            value={activePdfItem.draft}
            onChange={onDraftChange}
            areaOptions={areaSuggestions}
            courseOptions={courseSuggestions}
          />

          <div className="mt-4 flex items-center justify-end">
            <PdfReviewNavigation
              activePdfIndex={activePdfIndex}
              compact
              isFirstPdfItem={isFirstPdfItem}
              isLastPdfItem={isLastPdfItem}
              onNext={onNext}
              onPrevious={onPrevious}
              pdfItemCount={pdfItemCount}
            />
          </div>

          <div className="mt-4 flex justify-center">
            <Button
              className="w-full max-w-72 gap-2 bg-brand text-primary-foreground hover:bg-brand/90 sm:w-auto"
              disabled={importablePdfCount === 0 || !selectedEventId || disabled}
              onClick={onImport}
            >
              <DownloadCloud className="h-4 w-4" />
              <span className="truncate">{importButtonLabel}</span>
            </Button>
          </div>
        </Card>
      ) : null}
    </>
  );
}

function PdfReviewNavigation({
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
        aria-label="Arquivo anterior na revisão"
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
        aria-label="Próximo arquivo na revisão"
        className={cn("shrink-0 rounded-full", compact ? "size-7" : "size-8")}
        disabled={isLastPdfItem}
        onClick={onNext}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function PdfMetadataSuggestions({
  activePdfItem,
  onDraftChange,
}: {
  activePdfItem: PdfQueueItem;
  onDraftChange: (patch: Partial<PdfDraft>) => void;
}) {
  return (
    <div className="mb-4 flex min-w-0 flex-col gap-3 overflow-hidden rounded-xl border border-border/60 bg-muted/20 p-3">
      <div className="flex min-w-0 flex-wrap gap-2">
        <Badge variant="secondary" className="max-w-full">
          {activePdfItem.metadata!.pageCount} páginas
        </Badge>
        <Badge variant="outline" className="max-w-full">
          {activePdfItem.metadata!.authors.length} autores sugeridos
        </Badge>
        <Badge variant="outline" className="max-w-full">
          {activePdfItem.metadata!.emails.length} e-mails encontrados
        </Badge>
      </div>

      {activePdfItem.metadata!.emails.length > 0 && (
        <div className="min-w-0 wrap-break-word text-xs text-muted-foreground">
          <strong className="text-foreground">E-mails:</strong>{" "}
          {activePdfItem.metadata!.emails.join(", ")}
        </div>
      )}

      {activePdfItem.metadata!.areaSuggestions.length > 0 && (
        <div className="min-w-0">
          <div className="mb-1 min-w-0 wrap-break-word text-xs text-muted-foreground">
            <strong className="text-foreground">Área sugerida:</strong>{" "}
            {activePdfItem.metadata!.suggestedArea ?? "Sem sugestão forte"}
            {activePdfItem.metadata!.areaSuggestionConfidence
              ? ` (${activePdfItem.metadata!.areaSuggestionConfidence})`
              : ""}
          </div>

          <div className="flex min-w-0 flex-wrap gap-2">
            {activePdfItem.metadata!.areaSuggestions.map((suggestion) => (
              <Button
                key={`${activePdfItem.id}-${suggestion.name}`}
                type="button"
                size="sm"
                variant={activePdfItem.draft.area === suggestion.name ? "default" : "outline"}
                className="h-auto min-h-7 max-w-full whitespace-normal wrap-break-word px-2 py-1 text-left text-[11px] leading-snug"
                onClick={() => onDraftChange({ area: suggestion.name })}
              >
                {suggestion.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {(activePdfItem.metadata!.courseSuggestions?.length ?? 0) > 0 && (
        <div className="min-w-0">
          <div className="mb-1 min-w-0 wrap-break-word text-xs text-muted-foreground">
            <strong className="text-foreground">Cursos sugeridos:</strong>{" "}
            confirme os cursos relacionados antes de salvar
            {activePdfItem.metadata!.courseSuggestionConfidence
              ? ` (${activePdfItem.metadata!.courseSuggestionConfidence})`
              : ""}
            .
          </div>

          <div className="flex min-w-0 flex-wrap gap-2">
            {activePdfItem.metadata!.courseSuggestions?.map((suggestion) => (
              <Button
                key={`${activePdfItem.id}-${suggestion.name}`}
                type="button"
                size="sm"
                variant={
                  splitCommaSeparatedValues(activePdfItem.draft.courses).includes(suggestion.name)
                    ? "default"
                    : "outline"
                }
                className="h-auto min-h-7 max-w-full whitespace-normal wrap-break-word px-2 py-1 text-left text-[11px] leading-snug"
                onClick={() =>
                  onDraftChange({
                    courses: addCommaSeparatedValue(activePdfItem.draft.courses, suggestion.name),
                  })
                }
              >
                {suggestion.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {activePdfItem.metadata!.warnings.length > 0 && (
        <div className="min-w-0 rounded-md bg-amber-500/10 p-3 text-xs text-amber-700">
          {activePdfItem.metadata!.warnings.map((warning) => (
            <div key={warning} className="wrap-break-word">
              {warning}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}