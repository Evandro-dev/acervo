import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { FileDown, Quote, Users, BookMarked, Tag } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { downloadArticlePdf } from "@/features/acervo/api";
import { AppShell } from "@/components/layout/AppShell";
import { HeroBackButton } from "@/components/layout/HeroBackButton";
import { SiteContainer } from "@/components/layout/SiteContainer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";
import { useArticleQuery, useEventQuery, useTrackArticleViewMutation } from "@/features/acervo/hooks";
import { toast } from "@/hooks/use-toast";
import { toArticleDownloadName, triggerBrowserDownload } from "@/lib/article-download";
import { reserveViewTracking, rollbackViewTracking } from "@/lib/engagement";
import { getApiErrorMessage } from "@/lib/api";
import { isUsableResourceUrl } from "@/lib/file-links";

function normalizeRouteValue(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null") return undefined;
  return trimmed;
}

export default function ArtigoDetalhe() {
  const { eventId, articleId } = useParams();
  const normalizedArticleId = normalizeRouteValue(articleId);
  const normalizedEventId = normalizeRouteValue(eventId);
  const { data: article, isLoading: isArticleLoading, isError: isArticleError } = useArticleQuery(normalizedArticleId);
  const resolvedEventId = normalizedEventId ?? article?.event?.slug ?? article?.eventSlug ?? article?.event?.id ?? article?.eventId;
  const { data: event } = useEventQuery(resolvedEventId);
  const trackArticleViewMutation = useTrackArticleViewMutation();
  const queryClient = useQueryClient();
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (!article?.id) return;
    if (!reserveViewTracking("article", article.id)) return;

    trackArticleViewMutation.mutate(article.id, {
      onError: () => rollbackViewTracking("article", article.id),
    });
  }, [article?.id, trackArticleViewMutation]);

  if (isArticleLoading) {
    return (
      <AppShell>
        <section className="bg-brand text-primary-foreground">
          <SiteContainer className="pb-6 pt-3">
            <HeroBackButton />
            <h1 className="mt-1 text-lg font-bold leading-tight">Carregando artigo...</h1>
          </SiteContainer>
        </section>
        <section className="py-5">
          <SiteContainer>
            <StatePanel>Buscando os dados do artigo.</StatePanel>
          </SiteContainer>
        </section>
      </AppShell>
    );
  }

  if (isArticleError || !article) {
    return (
      <AppShell>
        <section className="bg-brand text-primary-foreground">
          <SiteContainer className="pb-6 pt-3">
            <HeroBackButton />
            <h1 className="mt-1 text-lg font-bold leading-tight">Artigo</h1>
          </SiteContainer>
        </section>
        <section className="py-5">
          <SiteContainer>
            <StatePanel>Não foi possível carregar este artigo.</StatePanel>
          </SiteContainer>
        </section>
      </AppShell>
    );
  }

  const articleEventTitle = event?.title ?? article.event?.title ?? article.eventTitle;
  const articleEventYear = event?.year ?? article.event?.year ?? article.eventYear;
  const articleEventSlug = event?.slug ?? article.event?.slug ?? article.eventSlug ?? article.eventId ?? normalizedEventId;
  const articleEventHref = articleEventSlug ? `/eventos/${articleEventSlug}` : "/eventos";
  const hasPdf = isUsableResourceUrl(article.pdfUrl);

  const handleDownloadPdf = async () => {
    if (!hasPdf) {
      toast({ title: "PDF indisponível", description: "Este artigo ainda não possui arquivo anexado." });
      return;
    }

    setIsDownloading(true);

    try {
      const blob = await downloadArticlePdf(article.id);
      triggerBrowserDownload(blob, toArticleDownloadName(article));
      await queryClient.invalidateQueries({ queryKey: ["acervo"] });
    } catch (error) {
      toast({
        title: "Falha ao baixar PDF",
        description: getApiErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <AppShell>
      <section className="bg-brand text-primary-foreground">
        <SiteContainer className="pb-6 pt-3">
          <HeroBackButton />
          <Link to={articleEventHref} className="text-[11px] font-semibold uppercase tracking-wider opacity-90">
            {articleEventTitle}
          </Link>
          <h1 className="mt-1 text-lg font-bold leading-tight">{article.title}</h1>
          <p className="mt-2 flex items-start gap-1.5 text-xs opacity-90">
            <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="flex flex-wrap gap-x-1">
              {article.authorProfiles.map((author, index) => (
                <Link key={author.id} to={`/autores/${author.slug}`} className="underline-offset-2 hover:underline">
                  {author.name}
                  {index < article.authorProfiles.length - 1 ? "," : ""}
                </Link>
              ))}
            </span>
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge className="border-0 bg-white/20 text-primary-foreground">
              <Tag className="mr-1 h-3 w-3" /> {article.area}
            </Badge>
            <Badge className="border-0 bg-white/20 text-primary-foreground">pp. {article.pages}</Badge>
          </div>

          <Button
            className="mt-4 w-full gap-2 bg-white text-primary-dark hover:bg-white/90"
            size="lg"
            onClick={handleDownloadPdf}
            disabled={isDownloading}
          >
            <FileDown className="h-4 w-4" /> {isDownloading ? "Baixando..." : "Baixar PDF"}
          </Button>
        </SiteContainer>
      </section>

      <section className="py-5">
        <SiteContainer>
          <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-brand">
            <BookMarked className="h-4 w-4" /> Resumo
          </h2>
          <p className="text-sm leading-relaxed text-foreground/85">{article.abstract}</p>

          <h2 className="mb-2 mt-6 flex items-center gap-2 text-base font-bold text-brand">
            <Quote className="h-4 w-4" /> Como citar
          </h2>
          <Card className="border-border/60 bg-muted/40 p-3 text-xs leading-relaxed">
            {article.authors.join("; ")}. <strong>{article.title}</strong>. In: Anais do {articleEventTitle}, {articleEventYear}. p.{" "}
            {article.pages}. ISBN: {event?.catalog.isbn ?? "—"}.
          </Card>
        </SiteContainer>
      </section>
    </AppShell>
  );
}
