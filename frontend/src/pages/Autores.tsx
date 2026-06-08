import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { User, FileText, ChevronRight, Filter } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SiteContainer } from "@/components/layout/SiteContainer";
import { GlobalSearchBox } from "@/components/search/GlobalSearchBox";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useAuthorsQuery } from "@/features/acervo/hooks";
import { includesSearch } from "@/lib/search";

export default function Autores() {
  const { data: authors = [], isLoading, isError } = useAuthorsQuery();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const deferredQuery = useDeferredValue(q);

  const areaOptions = useMemo(
    () =>
      Array.from(new Set(authors.flatMap((author) => author.areas))).sort((left, right) =>
        left.localeCompare(right),
      ),
    [authors],
  );

  const filtered = useMemo(() => {
    return authors.filter((author) => {
      if (selectedAreas.length && !author.areas.some((area) => selectedAreas.includes(area))) return false;
      return includesSearch(`${author.name} ${author.areas.join(" ")}`, deferredQuery);
    });
  }, [authors, deferredQuery, selectedAreas]);

  const activeFilterCount = selectedAreas.length;

  const toggleArea = (area: string) => {
    setSelectedAreas((current) =>
      current.includes(area) ? current.filter((item) => item !== area) : [...current, area],
    );
  };

  return (
    <AppShell>
      <section className="bg-brand text-primary-foreground">
        <SiteContainer className="pb-5 pt-3">
          <h1 className="text-xl font-bold">Autores</h1>
          <p className="text-xs opacity-90">{isLoading ? "Carregando..." : `${filtered.length} autores no acervo`}</p>
          <Sheet open={open} onOpenChange={setOpen}>
            <GlobalSearchBox
              containerClassName="mt-3"
              value={q}
              onValueChange={setQ}
              placeholder="Buscar no Acervo..."
              className="text-foreground"
              trailingAction={
                <SheetTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="relative h-9 w-9 shrink-0 rounded-lg bg-brand-soft text-primary-dark hover:bg-brand-soft/80"
                    aria-label="Abrir filtros de autores"
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
                <SheetDescription className="sr-only">Filtre autores por área de publicação.</SheetDescription>
              </SheetHeader>

              <div className="mb-8">
                <div className="mb-4 block text-sm font-semibold text-black">Área</div>
                {areaOptions.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {areaOptions.map((area) => (
                      <label key={area} htmlFor={`author-area-${encodeURIComponent(area)}`} className="flex items-start gap-2 text-sm">
                        <Checkbox
                          id={`author-area-${encodeURIComponent(area)}`}
                          checked={selectedAreas.includes(area)}
                          onCheckedChange={() => toggleArea(area)}
                        />
                        <span className="leading-tight">{area}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma área disponível.</p>
                )}
              </div>

              <SheetFooter className="mt-8 grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="h-12 rounded-xl border-zinc-300 text-base font-semibold"
                  onClick={() => setSelectedAreas([])}
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
        <SiteContainer className="space-y-2">
          <QueryState
            isLoading={isLoading}
            isError={isError}
            isEmpty={filtered.length === 0}
            loadingMessage="Carregando autores..."
            errorMessage="Não foi possível carregar os autores."
            emptyMessage="Nenhum autor encontrado."
          >
            <>
              {filtered.map((author) => (
                <Link key={author.id} to={`/autores/${author.slug}`} className="block">
                  <Card className="flex items-center gap-3 border-border/60 p-3 shadow-card">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-primary-dark">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-bold">{author.name}</h3>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                        <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                          <FileText className="mr-1 h-2.5 w-2.5" /> {author.articleCount}
                        </Badge>
                        <span className="truncate text-[11px] text-muted-foreground">{author.areas.slice(0, 2).join(" · ")}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Card>
                </Link>
              ))}
            </>
          </QueryState>
        </SiteContainer>
      </section>
    </AppShell>
  );
}
