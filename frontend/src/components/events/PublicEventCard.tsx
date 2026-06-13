import { Link } from "react-router-dom";
import { Barcode, BookMarked, ChevronRight } from "lucide-react";
import { EventCoverThumb } from "@/components/events/EventCoverThumb";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { type Event } from "@/types/acervo";

type PublicEventCardEvent = Event & {
  catalog?: {
    isbn?: string | null;
  } | null;
};

type PublicEventCardProps = {
  event: PublicEventCardEvent;
};

export function PublicEventCard({ event }: PublicEventCardProps) {
  const isbn = event.catalog?.isbn?.trim();

  return (
    <Link
      to={`/eventos/${event.slug}`}
      aria-label={`Ver detalhes do evento ${event.title}`}
      className="group block h-full rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <Card className="flex h-full min-h-41 flex-col overflow-hidden border-border/60 shadow-card transition hover:shadow-elevated group-hover:border-primary/40">
        <div className="flex flex-1 gap-3 bg-brand-soft p-3 transition group-hover:bg-brand-soft/80">
          <EventCoverThumb cover={event.cover} title={event.title} className="h-16 w-16" />

          <div className="flex min-w-0 flex-1 flex-col">
            <h3 className="line-clamp-3 text-sm font-bold leading-tight transition group-hover:text-primary">
              {event.title}
            </h3>

            <p className="mt-1 text-xs text-muted-foreground">{event.date}</p>

            <div className="mt-2 flex min-w-0 flex-wrap items-start gap-1">
              <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-[10px]">
                {event.type}
              </Badge>

              {isbn && isbn !== "—" && (
                <Badge
                  variant="outline"
                  className="h-auto min-h-5 max-w-full min-w-0 gap-1 whitespace-normal wrap-break-word px-1.5 py-0.5 text-left text-[10px] leading-tight"
                >
                  <Barcode className="h-2.5 w-2.5 shrink-0" />
                  <span className="min-w-0 wrap-break-word">ISBN {isbn}</span>
                </Badge>
              )}

              <Badge
                variant="outline"
                className="h-auto min-h-5 max-w-full min-w-0 whitespace-normal wrap-break-word px-1.5 py-0.5 text-left text-[10px] leading-tight"
              >
                {event.area}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex min-h-10 shrink-0 items-center justify-between border-t border-border/60 px-4 py-2.5 text-sm font-semibold text-primary-dark transition group-hover:bg-primary group-hover:text-primary-foreground">
          <span className="flex items-center gap-2">
            <BookMarked className="h-4 w-4" />
            Ver detalhes
          </span>

          <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </div>
      </Card>
    </Link>
  );
}