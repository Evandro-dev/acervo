import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, FileText, BookMarked, Users, Tag, Library } from "lucide-react";
import { EventCoverThumb } from "@/components/events/EventCoverThumb";
import { AppShell } from "@/components/layout/AppShell";
import { SiteContainer } from "@/components/layout/SiteContainer";
import { PublicationMetaRow } from "@/components/publications/PublicationMetaRow";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { QueryState } from "@/components/ui/query-state";
import { SearchField } from "@/components/ui/search-field";
import { usePublicEventsQuery } from "@/features/acervo/hooks";

export default function Home() {
  const { data: events = [], isLoading, isError } = usePublicEventsQuery();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const search = deferredQuery.toLowerCase().trim();

  const filteredEvents = useMemo(() => {
    if (!search) return events;

    return events.filter((event) =>
      [
        event.title,
        event.area,
        event.type,
        event.themes.join(" "),
        event.articles.map((article) => `${article.title} ${article.authors.join(" ")} ${article.area}`).join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
  }, [events, search]);

  const recent = filteredEvents.slice(0, 3);
  const totalArticles = events.reduce((accumulator, event) => accumulator + event.publishedCount, 0);
  const featuredEntry = filteredEvents
    .flatMap((event) => event.articles.map((article) => ({ article, event })))
    .find(({ article }) => article.status === "published");
  const featuredArticle = featuredEntry?.article;
  const featuredEvent = featuredEntry?.event ?? null;
  const featuredArticleHref =
    featuredArticle && (featuredEvent?.slug ?? featuredArticle.eventSlug ?? featuredArticle.eventId)
      ? `/eventos/${featuredEvent?.slug ?? featuredArticle.eventSlug ?? featuredArticle.eventId}/artigos/${featuredArticle.id}`
      : "/publicacoes";

  return (
    <AppShell>
      <section className="bg-brand text-primary-foreground">
        <SiteContainer className="pb-6 pt-2 md:pb-10 md:pt-6">
          <h1 className="text-xl font-bold md:text-3xl">Bem-vindo(a) ao Acervo,</h1>
          <p className="mt-1 text-sm opacity-90 md:text-base">Repositório Oficial dos Anais da Una Pouso Alegre</p>
          <SearchField
            containerClassName="mt-4"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar eventos, autores ou áreas..."
            className="border-0 bg-background text-foreground shadow-card"
          />

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white/10 px-3 py-2 backdrop-blur">
              <div className="text-xs opacity-80">Eventos</div>
              <div className="text-lg font-bold">{isLoading ? "..." : events.length}</div>
            </div>
            <div className="rounded-lg bg-white/10 px-3 py-2 backdrop-blur">
              <div className="text-xs opacity-80">Publicações</div>
              <div className="text-lg font-bold">{isLoading ? "..." : totalArticles}</div>
            </div>
          </div>
        </SiteContainer>
      </section>

      <section className="pt-4">
        <SiteContainer>
          <div className="grid grid-cols-3 gap-2 md:gap-4">
            {[
              { to: "/publicacoes", icon: Library, label: "Publicações" },
              { to: "/autores", icon: Users, label: "Autores" },
              { to: "/areas", icon: Tag, label: "Áreas" },
            ].map(({ to, icon: Icon, label }) => (
              <Link
                key={to}
                to={to}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-border/60 bg-card p-3 text-center shadow-card transition hover:shadow-elevated md:p-5"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-primary-dark md:h-12 md:w-12">
                  <Icon className="h-4 w-4 md:h-6 md:w-6" />
                </div>
                <span className="text-[11px] font-semibold md:text-sm">{label}</span>
              </Link>
            ))}
          </div>
        </SiteContainer>
      </section>

      <section className="pt-5">
        <SiteContainer>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold md:text-xl">Eventos</h2>
            <Link to="/eventos" className="text-xs font-semibold text-primary">
              Ver todos
            </Link>
          </div>

          <QueryState
            isLoading={isLoading}
            isError={isError}
            isEmpty={recent.length === 0}
            loadingMessage="Carregando eventos..."
            errorMessage="Não foi possível carregar os eventos."
            emptyMessage="Nenhum evento disponível."
          >
            <div className="grid auto-rows-fr gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {recent.map((ev) => (
                <Card key={ev.id} className="flex h-full min-h-[164px] flex-col overflow-hidden border-border/60 shadow-card">
                  <div className="flex flex-1 gap-3 p-3">
                    <EventCoverThumb cover={ev.cover} title={ev.title} className="h-16 w-16" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <h3 className="line-clamp-3 text-sm font-bold leading-tight">{ev.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{ev.date}</p>
                      <div className="mt-1.5 flex min-w-0 flex-wrap items-start gap-1">
                        <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-[10px]">
                          {ev.type}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="h-auto min-h-5 max-w-full min-w-0 whitespace-normal break-words px-1.5 py-0.5 text-left text-[10px] leading-tight"
                        >
                          {ev.area}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Link
                    to={`/eventos/${ev.slug}`}
                    className="mt-auto flex min-h-10 shrink-0 items-center justify-between border-t border-border/60 bg-brand-soft px-4 py-2.5 text-sm font-semibold text-primary-dark"
                  >
                    Ver detalhes
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Card>
              ))}
            </div>
          </QueryState>
        </SiteContainer>
      </section>

      <section className="mt-6">
        <SiteContainer>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold">Publicação em destaque</h2>
            <Link to="/publicacoes" className="text-xs font-semibold text-primary">
              Explorar
            </Link>
          </div>

          <QueryState
            isLoading={isLoading}
            isError={isError}
            isEmpty={!featuredArticle}
            loadingMessage="Carregando publicação em destaque..."
            errorMessage="Não foi possível carregar a publicação em destaque."
            emptyMessage="Nenhuma publicação em destaque."
          >
            <Card className="overflow-hidden border-border/60 shadow-card">
              <div className="bg-brand-soft p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-primary-foreground">
                    <BookMarked className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <PublicationMetaRow
                      eventTitle={featuredEvent?.title ?? featuredArticle?.eventTitle ?? "Anais"}
                      eventHref={featuredEvent ? `/eventos/${featuredEvent.slug}` : undefined}
                      viewCount={featuredArticle?.viewCount}
                      downloadCount={featuredArticle?.downloadCount}
                      titleClassName="text-[11px]"
                      metricsClassName="text-[11px]"
                    />
                    <h3 className="text-sm font-bold leading-tight">{featuredArticle?.title}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{featuredArticle?.abstract}</p>
                  </div>
                </div>
              </div>
              <Link
                to={featuredArticleHref}
                className="flex items-center justify-between border-t border-border/60 px-4 py-2.5 text-sm font-semibold text-primary-dark"
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Ler artigo
                </span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Card>
          </QueryState>
        </SiteContainer>
      </section>
    </AppShell>
  );
}
