import { useParams, Link } from "react-router-dom";
import { User, BookMarked, ChevronRight, Tag } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { HeroBackButton } from "@/components/layout/HeroBackButton";
import { SiteContainer } from "@/components/layout/SiteContainer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatePanel } from "@/components/ui/state-panel";
import { useAuthorQuery } from "@/features/acervo/hooks";

export default function AutorDetalhe() {
  const { name } = useParams();
  const decoded = decodeURIComponent(name ?? "");
  const { data: author, isLoading, isError } = useAuthorQuery(decoded);

  if (isLoading) {
    return (
      <AppShell>
        <section className="bg-brand text-primary-foreground">
          <SiteContainer className="pb-6 pt-4">
            <HeroBackButton />
            <h1 className="truncate text-lg font-bold">Carregando autor...</h1>
          </SiteContainer>
        </section>
        <section className="py-4">
          <SiteContainer>
            <StatePanel>Buscando a produção deste autor.</StatePanel>
          </SiteContainer>
        </section>
      </AppShell>
    );
  }

  if (isError || !author) {
    return (
      <AppShell>
        <section className="bg-brand text-primary-foreground">
          <SiteContainer className="pb-6 pt-4">
            <HeroBackButton />
            <h1 className="truncate text-lg font-bold">Autor</h1>
          </SiteContainer>
        </section>
        <section className="py-4">
          <SiteContainer>
            <StatePanel>Não foi possível carregar este autor.</StatePanel>
          </SiteContainer>
        </section>
      </AppShell>
    );
  }

  const works = author.works ?? [];

  return (
    <AppShell>
      <section className="bg-brand text-primary-foreground">
        <SiteContainer className="pb-6 pt-4">
          <HeroBackButton />
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15">
              <User className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold">{author.name}</h1>
              <p className="text-xs opacity-90">{works.length} publicações no Acervo</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {author.areas.map((area) => (
              <Badge key={area} className="border-0 bg-white/20 text-primary-foreground">
                <Tag className="mr-1 h-3 w-3" /> {area}
              </Badge>
            ))}
          </div>
        </SiteContainer>
      </section>

      <section className="py-4">
        <SiteContainer>
          <h2 className="mb-3 text-base font-bold text-brand">Trabalhos publicados</h2>
          <div className="space-y-3">
            {works.map((work) => (
              <Card key={work.id} className="overflow-hidden border-border/60 shadow-card">
                <div className="p-3">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-soft text-primary-dark">
                      <BookMarked className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                        {work.eventTitle} · {work.eventYear}
                      </div>
                      <h3 className="text-sm font-bold leading-tight">{work.title}</h3>
                      <p className="mt-1 text-[11px] text-muted-foreground">{work.authors.join(" · ")}</p>
                    </div>
                  </div>
                </div>
                <Link
                  to={`/eventos/${work.eventSlug ?? work.eventId}/artigos/${work.id}`}
                  className="flex items-center justify-between border-t border-border/60 bg-brand-soft px-4 py-2 text-xs font-semibold text-primary-dark"
                >
                  Ler artigo <ChevronRight className="h-4 w-4" />
                </Link>
              </Card>
            ))}
          </div>
        </SiteContainer>
      </section>
    </AppShell>
  );
}
