import { formatFileSize } from "@/lib/file-size";
import { cn } from "@/lib/utils";

type PdfFileSummaryProps = {
  name: string;
  size: number;
  className?: string;
};

export function PdfFileSummary({ name, size, className }: PdfFileSummaryProps) {
  return (
    <div className={cn("w-full min-w-0 overflow-hidden rounded-lg border border-border/60 bg-background/70", className)}>
      <div className="flex min-w-0">
        <div className="min-w-0 flex-1 overflow-hidden px-3 py-2">
          <div className="pdf-file-marquee-track">
            <span className="shrink-0 whitespace-nowrap pr-8 text-[11px] font-semibold leading-snug text-foreground sm:whitespace-normal sm:wrap-break-word sm:pr-0 sm:text-sm">
              {name}
            </span>

            <span
              aria-hidden="true"
              className="shrink-0 whitespace-nowrap pr-8 text-[11px] font-semibold leading-snug text-foreground sm:hidden"
            >
              {name}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center border-l border-border/60 bg-muted px-2.5 text-[10px] font-semibold text-muted-foreground sm:text-xs">
          {formatFileSize(size)}
        </div>
      </div>
    </div>
  );
}
