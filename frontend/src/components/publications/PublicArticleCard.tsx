import { Link } from "react-router-dom";
import { BookMarked, ChevronRight, FileText } from "lucide-react";
import { PublicationMetaRow } from "@/components/publications/PublicationMetaRow";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { publicMutedBadgeClassName } from "../../lib/public-badge-styles";

type PublicArticleCardArticle = {
  id?: string;
  title?: string;
  abstract?: string | null;
  area?: string | null;
  authors?: string[];
  pages?: string | null;
  viewCount?: number | null;
  downloadCount?: number | null;
};

type PublicArticleCardProps = {
  article?: PublicArticleCardArticle | null;
  href: string;
  eventTitle?: string;
  actionLabel?: string;
  showDownloads?: boolean;
};

export function PublicArticleCard({
  article,
  href,
  eventTitle = "Anais",
  actionLabel = "Ler artigo",
  showDownloads = true,
}: PublicArticleCardProps) {
  if (!article) return null;

  const authorsText = article.authors?.length ? article.authors.join(" · ") : null;
  const pagesText = article.pages ? `pp. ${article.pages}` : null;
  const secondaryText = [authorsText, pagesText].filter(Boolean).join(" · ");

  return (
    <Link
      to={href}
      aria-label={`${actionLabel} ${article.title ?? ""}`}
      className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <Card className="overflow-hidden border-border/60 shadow-card transition hover:shadow-elevated group-hover:border-primary/40">
        <div className="bg-brand-soft p-4 transition group-hover:bg-brand-soft/80">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand text-primary-foreground">
              <BookMarked className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <PublicationMetaRow
                eventTitle={eventTitle}
                viewCount={article.viewCount ?? 0}
                downloadCount={showDownloads ? article.downloadCount ?? 0 : undefined}
                showDownloads={showDownloads}
                titleClassName="text-[11px]"
                metricsClassName="gap-1.5 text-[11px]"
                itemClassName={publicMutedBadgeClassName("h-5 px-1.5 text-[10px]")}
              />

              <h3 className="text-sm font-bold leading-tight text-foreground transition group-hover:text-primary">
                {article.title}
              </h3>

              {article.abstract ? (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{article.abstract}</p>
              ) : secondaryText ? (
                <p className="mt-1 text-[11px] text-muted-foreground">{secondaryText}</p>
              ) : null}

              {article.area && (
                <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={publicMutedBadgeClassName(
                      "h-auto min-h-5 max-w-full min-w-0 whitespace-normal px-2 py-0.5 text-left leading-tight",
                    )}
                  >
                    <span className="line-clamp-2 min-w-0 wrap-break-word">{article.area}</span>
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5 text-sm font-semibold text-primary-dark transition group-hover:bg-primary group-hover:text-primary-foreground">
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {actionLabel}
          </span>

          <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </div>
      </Card>
    </Link>
  );
}
