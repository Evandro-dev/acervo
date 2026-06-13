import { Link } from "react-router-dom";
import { Users, Tag, Library } from "lucide-react";
import { PublicEventCard } from "@/components/events/PublicEventCard";
import { AppShell } from "@/components/layout/AppShell";
import { SiteContainer } from "@/components/layout/SiteContainer";
import { PublicArticleCard } from "@/components/publications/PublicArticleCard";
import { GlobalSearchBox } from "@/components/search/GlobalSearchBox";
import { QueryState } from "@/components/ui/query-state";
import { usePublicEventsQuery } from "@/features/acervo/hooks";

export default function Home() {
  const { data: events = [], isLoading, isError } = usePublicEventsQuery();

  const recent = events.slice(0, 3);
  const totalArticles = events.reduce((accumulator, event) => accumulator + event.publishedCount, 0);
  const featuredEntry = events
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

          <GlobalSearchBox
            containerClassName="mt-4"
            placeholder="Buscar publicações, eventos, autores, áreas ou cursos..."
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
              {recent.map((event) => (
                <PublicEventCard key={event.id} event={event} />
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
            <PublicArticleCard
              article={featuredArticle}
              href={featuredArticleHref}
              eventTitle={featuredEvent?.title ?? featuredArticle?.eventTitle ?? "Anais"}
            />
          </QueryState>
        </SiteContainer>
      </section>
    </AppShell>
  );
}