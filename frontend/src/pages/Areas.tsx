import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Tag } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SiteContainer } from "@/components/layout/SiteContainer";
import { GlobalSearchBox } from "@/components/search/GlobalSearchBox";
import { Card } from "@/components/ui/card";
import { QueryState } from "@/components/ui/query-state";
import { useAreasQuery } from "@/features/acervo/hooks";
import { includesSearch } from "@/lib/search";

export default function Areas() {
  const { data: areas = [], isLoading, isError } = useAreasQuery();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const filteredAreas = useMemo(
    () => areas.filter((area) => includesSearch(area.name, deferredQuery)),
    [areas, deferredQuery],
  );
  const hasSearch = query.trim().length > 0;

  return (
    <AppShell>
      <section className="bg-brand text-primary-foreground">
        <SiteContainer className="pb-5 pt-3">
          <h1 className="text-lg font-bold">Áreas Temáticas</h1>
          <p className="text-xs opacity-90">
            {isLoading
              ? "Carregando..."
              : hasSearch
                ? `${filteredAreas.length} de ${areas.length} áreas`
                : `${areas.length} áreas de conhecimento`}
          </p>
          <GlobalSearchBox
            containerClassName="mt-3"
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar no Acervo..."
            className="border-0 bg-background text-foreground shadow-card"
          />
        </SiteContainer>
      </section>

      <section className="py-4">
        <SiteContainer>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
            <QueryState
              isLoading={isLoading}
              isError={isError}
              isEmpty={filteredAreas.length === 0}
              loadingMessage="Carregando áreas..."
              errorMessage="Não foi possível carregar as áreas."
              emptyMessage={hasSearch ? "Nenhuma área corresponde à busca." : "Nenhuma área cadastrada."}
              panelClassName="col-span-full"
            >
              <>
                {filteredAreas.map((area) => (
                  <Link key={area.id} to={`/publicacoes?area=${encodeURIComponent(area.name)}`}>
                    <Card className="flex h-full flex-col justify-between gap-3 border-border/60 p-3 shadow-card">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-soft text-primary-dark">
                        <Tag className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold leading-tight">{area.name}</h3>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{area.articleCount} Artigos</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </>
            </QueryState>
          </div>
        </SiteContainer>
      </section>
    </AppShell>
  );
}
