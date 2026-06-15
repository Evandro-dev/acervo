import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, FileText, User } from "lucide-react";
import { FilterButton } from "@/components/filters/FilterButton";
import { FilterSheetContent } from "@/components/filters/FilterSheetContent";
import { toFilterId, toggleFilterValue } from "@/components/filters/filter-utils";
import { AppShell } from "@/components/layout/AppShell";
import { SiteContainer } from "@/components/layout/SiteContainer";
import { GlobalSearchBox } from "@/components/search/GlobalSearchBox";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ListPagination } from "@/components/ui/list-pagination";
import { QueryState } from "@/components/ui/query-state";
import {
  Sheet,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAreasQuery, useAuthorsQuery } from "@/features/acervo/hooks";
import { usePaginatedQueryState } from "@/hooks/usePaginatedQueryState";

const AUTHORS_PAGE_SIZE = 12;

export default function Autores() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const deferredQuery = useDeferredValue(q);
  const paginationResetKey = [deferredQuery, selectedAreas.join("|")].join("\u0001");
  const { page, setPage } = usePaginatedQueryState({
    resetKey: paginationResetKey,
  });

  const {
    data: authorsResponse,
    isLoading,
    isError,
  } = useAuthorsQuery({
    q: deferredQuery || undefined,
    area: selectedAreas.length > 0 ? selectedAreas : undefined,
    page,
    pageSize: AUTHORS_PAGE_SIZE,
  });

  const { data: areas = [] } = useAreasQuery({ includeEmpty: true });

  const authors = authorsResponse?.items ?? [];
  const pageCount = authorsResponse?.pageCount ?? 1;
  const totalAuthors = authorsResponse?.total ?? 0;

  const areaOptions = useMemo(
    () =>
      areas
        .map((area) => area.name)
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right)),
    [areas],
  );

  const activeFilterCount = selectedAreas.length;

  useEffect(() => {
    if (!isLoading && page > pageCount) {
      setPage(pageCount);
    }
  }, [isLoading, page, pageCount]);

  const toggleArea = (area: string) => {
    setSelectedAreas((current) => toggleFilterValue(current, area));
  };

  return (
    <AppShell>
      <section className="bg-brand text-primary-foreground">
        <SiteContainer className="pb-5 pt-3">
          <h1 className="text-xl font-bold">Autores</h1>
          <p className="text-xs opacity-90">
            {isLoading ? "Carregando..." : `${totalAuthors} autores no acervo`}
          </p>

          <Sheet open={open} onOpenChange={setOpen}>
            <GlobalSearchBox
              containerClassName="mt-3"
              value={q}
              onValueChange={setQ}
              placeholder="Buscar no Acervo..."
              className="text-foreground"
              trailingAction={
                <SheetTrigger asChild>
                  <FilterButton
                    activeCount={activeFilterCount}
                    label="Abrir filtros de autores"
                  />
                </SheetTrigger>
              }
            />

            <FilterSheetContent
              description="Filtre autores por área de publicação."
              onApply={() => setOpen(false)}
              onClear={() => setSelectedAreas([])}
            >

              <div className="mb-8">
                <div className="mb-4 block text-sm font-semibold text-black">
                  Área
                </div>
                {areaOptions.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {areaOptions.map((area) => {
                      const id = toFilterId("author-area", area);

                      return (
                        <label
                          key={area}
                          htmlFor={id}
                          className="flex items-start gap-2 text-sm"
                        >
                          <Checkbox
                            id={id}
                            checked={selectedAreas.includes(area)}
                            onCheckedChange={() => toggleArea(area)}
                          />
                          <span className="leading-tight">{area}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma área disponível.
                  </p>
                )}
              </div>

            </FilterSheetContent>
          </Sheet>
        </SiteContainer>
      </section>

      <section className="py-4">
        <SiteContainer className="space-y-2">
          <QueryState
            isLoading={isLoading}
            isError={isError}
            isEmpty={authors.length === 0}
            loadingMessage="Carregando autores..."
            errorMessage="Não foi possível carregar os autores."
            emptyMessage="Nenhum autor encontrado."
          >
            <>
              {authors.map((author) => (
                <Link
                  key={author.id}
                  to={`/autores/${author.slug}`}
                  className="block"
                >
                  <Card className="flex items-center gap-3 border-border/60 p-3 shadow-card">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-primary-dark">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-bold">
                        {author.name}
                      </h3>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                        <Badge
                          variant="secondary"
                          className="h-4 px-1.5 text-[10px]"
                        >
                          <FileText className="mr-1 h-2.5 w-2.5" />
                          {author.articleCount}
                        </Badge>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {author.areas.slice(0, 2).join(" · ")}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Card>
                </Link>
              ))}

              <ListPagination
                className="mt-6"
                page={authorsResponse?.page ?? page}
                pageCount={pageCount}
                total={authorsResponse?.total}
                pageSize={authorsResponse?.pageSize ?? AUTHORS_PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          </QueryState>
        </SiteContainer>
      </section>
    </AppShell>
  );
}
