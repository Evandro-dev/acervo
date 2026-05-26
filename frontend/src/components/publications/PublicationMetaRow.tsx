import { Eye, FileDown } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

type PublicationEngagementIndicatorsProps = {
  viewCount?: number;
  downloadCount?: number;
  showDownloads?: boolean;
  className?: string;
  itemClassName?: string;
};

type PublicationMetaRowProps = PublicationEngagementIndicatorsProps & {
  eventTitle?: string;
  eventHref?: string;
  titleClassName?: string;
};

export function PublicationEngagementIndicators({
  viewCount = 0,
  downloadCount = 0,
  showDownloads = true,
  className,
  itemClassName,
}: PublicationEngagementIndicatorsProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground", className)}>
      <span className={cn("inline-flex items-center gap-1", itemClassName)}>
        <Eye className="h-3.5 w-3.5" /> {viewCount}
      </span>
      {showDownloads && (
        <span className={cn("inline-flex items-center gap-1", itemClassName)}>
          <FileDown className="h-3.5 w-3.5" /> {downloadCount}
        </span>
      )}
    </div>
  );
}

export function PublicationMetaRow({
  eventTitle,
  eventHref,
  viewCount = 0,
  downloadCount = 0,
  showDownloads = true,
  className,
  titleClassName,
  metricsClassName,
}: PublicationMetaRowProps & { metricsClassName?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      {eventTitle ? (
        eventHref ? (
          <Link to={eventHref} className={cn("text-[10px] font-semibold uppercase tracking-wider text-primary", titleClassName)}>
            {eventTitle}
          </Link>
        ) : (
          <div className={cn("text-[10px] font-semibold uppercase tracking-wider text-primary", titleClassName)}>
            {eventTitle}
          </div>
        )
      ) : (
        <span className="sr-only">Métricas da publicação</span>
      )}

      <PublicationEngagementIndicators
        viewCount={viewCount}
        downloadCount={downloadCount}
        showDownloads={showDownloads}
        className={metricsClassName}
      />
    </div>
  );
}
