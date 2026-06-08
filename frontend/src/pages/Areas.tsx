import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Filter, Tag } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SiteContainer } from "@/components/layout/SiteContainer";
import { GlobalSearchBox } from "@/components/search/GlobalSearchBox";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { QueryState } from "@/components/ui/query-state";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAreasQuery } from "@/features/acervo/hooks";
import { includesSearch } from "@/lib/search";

export default function Areas() {
  const { data: areas = [], isLoading, isError } = useAreasQuery({ includeEmpty: true });
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [showEmptyAreas, setShowEmptyAreas] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const filteredAreas = useMemo(
    () =>
      areas.filter((area) => {
        if (!showEmptyAreas && area.articleCount <= 0) return false;
        return includesSearch(area.name, deferredQuery);
      }),
    [areas, deferredQuery, showEmptyAreas],
  );
  const activeFilterCount = showEmptyAreas ? 1 : 0;

  return (
    <AppShell>
      <section className="bg-brand text-primary-foreground">
        <SiteContainer className="pb-5 pt-3">
          <h1 className="text-lg font-bold">Áreas Temáticas</h1>
          <p className="text-xs opacity-90">
            {isLoading ? "Carregando..." : `${filteredAreas.length} de ${areas.length} áreas de conhecimento`}
          </p>
          <Sheet open={open} onOpenChange={setOpen}>
            <GlobalSearchBox
              containerClassName="mt-3"
              value={query}
              onValueChange={setQuery}
              placeholder="Buscar no Acervo..."
              className="text-foreground"
              trailingAction={
                <SheetTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="relative h-9 w-9 shrink-0 rounded-lg bg-brand-soft text-primary-dark hover:bg-brand-soft/80"
                    aria-label="Abrir filtros de áreas"
                  >
                    <Filter className="h-4 w-4" />
                    {activeFilterCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-dark px-1 text-[10px] font-bold text-primary-foreground">
                        {activeFilterCount}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
              }
            />

            <SheetContent
              side="bottom"
              className="h-[92vh] overflow-y-auto rounded-t-[28px] border-0 bg-white px-5 pb-6 pt-4 shadow-2xl md:bottom-auto md:left-1/2 md:right-auto md:top-1/2 md:h-auto md:max-h-[90vh] md:w-[min(92vw,720px)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl"
            >
              <SheetHeader className="mb-6 flex flex-row items-center justify-between space-y-0 text-left">
                <SheetTitle className="text-2xl font-bold text-[#E30613]">Filtros</SheetTitle>
                <SheetDescription className="sr-only">Filtre a lista de áreas do Acervo.</SheetDescription>
              </SheetHeader>

              <label htmlFor="show-empty-areas" className="flex items-start gap-2 text-sm">
                <Checkbox
                  id="show-empty-areas"
                  checked={showEmptyAreas}
                  onCheckedChange={(checked) => setShowEmptyAreas(checked === true)}
                />
                <span className="leading-tight">Mostrar áreas sem publicações cadastradas</span>
              </label>

              <SheetFooter className="mt-8 grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="h-12 rounded-xl border-zinc-300 text-base font-semibold"
                  onClick={() => setShowEmptyAreas(false)}
                >
                  Limpar
                </Button>
                <Button
                  className="h-12 rounded-xl bg-linear-to-r from-[#E30613] to-[#B00010] text-base font-semibold text-white hover:opacity-90"
                  onClick={() => setOpen(false)}
                >
                  Aplicar filtros
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
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
              emptyMessage={
                query.trim()
                  ? "Nenhuma área corresponde à busca."
                  : "Nenhuma área cadastrada com publicações."
              }
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
