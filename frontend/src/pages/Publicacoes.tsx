import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { X } from "lucide-react";
import { FilterButton } from "@/components/filters/FilterButton";
import { FilterGroup } from "@/components/filters/FilterGroup";
import { FilterSheetContent } from "@/components/filters/FilterSheetContent";
import { toFilterId, toggleFilterValue } from "@/components/filters/filter-utils";
import { AppShell } from "@/components/layout/AppShell";
import { SiteContainer } from "@/components/layout/SiteContainer";
import { PublicArticleCard } from "@/components/publications/PublicArticleCard";
import { GlobalSearchBox } from "@/components/search/GlobalSearchBox";
import { Checkbox } from "@/components/ui/checkbox";
import { ListPagination } from "@/components/ui/list-pagination";
import { QueryState } from "@/components/ui/query-state";
import {
  Sheet,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  useArticleOptionsQuery,
  usePublishedArticlesQuery,
} from "@/features/acervo/hooks";
import { usePaginatedQueryState } from "@/hooks/usePaginatedQueryState";

const PUBLICATIONS_PAGE_SIZE = 12;

export default function Publicacoes() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [selectedModalities, setSelectedModalities] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [onlyWithPdf, setOnlyWithPdf] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const areaFilter = searchParams.get("area");
  const courseFilter = searchParams.get("course");
  const deferredQuery = useDeferredValue(q);
  const { data: articleOptions } = useArticleOptionsQuery();

  const activeAreas = useMemo(
    () => Array.from(new Set([...(areaFilter ? [areaFilter] : []), ...selectedAreas])),
    [areaFilter, selectedAreas],
  );
  const selectedEventYears = useMemo(
    () =>
      selectedYears
        .map((year) => Number(year))
        .filter((year) => Number.isInteger(year)),
    [selectedYears],
  );
  const activeAreasKey = activeAreas.join("|");
  const selectedEventsKey = selectedEvents.join("|");
  const selectedModalitiesKey = selectedModalities.join("|");
  const selectedYearsKey = selectedYears.join("|");
  const paginationResetKey = [
    activeAreasKey,
    courseFilter ?? "",
    deferredQuery,
    onlyWithPdf ? "pdf" : "all",
    selectedEventsKey,
    selectedModalitiesKey,
    selectedYearsKey,
  ].join("\u0001");
  const { page, setPage } = usePaginatedQueryState({
    resetKey: paginationResetKey,
  });

  const {
    data: articlesResponse,
    isLoading,
    isError,
  } = usePublishedArticlesQuery({
    page,
    pageSize: PUBLICATIONS_PAGE_SIZE,
    q: deferredQuery || undefined,
    area: activeAreas.length > 0 ? activeAreas : undefined,
    course: courseFilter || undefined,
    eventId: selectedEvents.length > 0 ? selectedEvents : undefined,
    modality: selectedModalities.length > 0 ? selectedModalities : undefined,
    eventYear: selectedEventYears.length > 0 ? selectedEventYears : undefined,
    hasPdf: onlyWithPdf || undefined,
  });

  const articles = articlesResponse?.items ?? [];
  const totalArticles = articlesResponse?.total ?? 0;
  const pageCount = articlesResponse?.pageCount ?? 1;

  const areaOptions = useMemo(
    () =>
      Array.from(new Set([...(articleOptions?.areas ?? []), ...activeAreas])).sort((left, right) =>
        left.localeCompare(right),
      ),
    [activeAreas, articleOptions?.areas],
  );

  const eventOptions = articleOptions?.events ?? [];

  const modalityOptions = useMemo(
    () =>
      Array.from(new Set([...(articleOptions?.modalities ?? []), ...selectedModalities])).sort((left, right) =>
        left.localeCompare(right),
      ),
    [articleOptions?.modalities, selectedModalities],
  );

  const yearOptions = useMemo(
    () =>
      Array.from(new Set([...(articleOptions?.years ?? []).map(String), ...selectedYears])).sort(
        (left, right) => Number(right) - Number(left),
      ),
    [articleOptions?.years, selectedYears],
  );

  const activeFilterCount =
    activeAreas.length +
    (courseFilter ? 1 : 0) +
    selectedEvents.length +
    selectedModalities.length +
    selectedYears.length +
    (onlyWithPdf ? 1 : 0);

  useEffect(() => {
    if (!isLoading && page > pageCount) {
      setPage(pageCount);
    }
  }, [isLoading, page, pageCount]);

  const clearArea = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("area");
    setSearchParams(next);
  };

  const clearCourse = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("course");
    setSearchParams(next);
  };

  const toggleArea = (area: string) => {
    const isSelected = activeAreas.includes(area);

    if (isSelected) {
      if (area === areaFilter) clearArea();
      setSelectedAreas((current) => current.filter((item) => item !== area));
      return;
    }

    setSelectedAreas((current) => [...current, area]);
  };

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("area");
    next.delete("course");
    setSearchParams(next);
    setSelectedAreas([]);
    setSelectedEvents([]);
    setSelectedModalities([]);
    setSelectedYears([]);
    setOnlyWithPdf(false);
  };

  return (
    <AppShell>
      <section className="bg-brand text-primary-foreground">
        <SiteContainer className="pb-5 pt-3">
          <h1 className="text-lg font-bold">Publicações</h1>
          <p className="text-xs opacity-90">{isLoading ? "Carregando..." : `${totalArticles} artigos disponíveis`}</p>

          {areaFilter && (
            <button
              type="button"
              onClick={clearArea}
              className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur hover:bg-white/25"
            >
              Área: {areaFilter}
              <X className="h-3 w-3" />
            </button>
          )}

          {courseFilter && (
            <button
              type="button"
              onClick={clearCourse}
              className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur hover:bg-white/25"
            >
              Curso: {courseFilter}
              <X className="h-3 w-3" />
            </button>
          )}

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
                    label="Abrir filtros de publicações"
                  />
                </SheetTrigger>
              }
            />

            <FilterSheetContent
              description="Filtre a lista de publicações por área, evento, modalidade, ano e disponibilidade de PDF."
              onApply={() => setOpen(false)}
              onClear={clearFilters}
            >

              <div className="space-y-7">
                <FilterGroup title="Área">
                  {areaOptions.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {areaOptions.map((area) => {
                        const id = toFilterId("publication-area", area);

                        return (
                          <label key={area} htmlFor={id} className="flex items-start gap-2 text-sm">
                            <Checkbox
                              id={id}
                              checked={activeAreas.includes(area)}
                              onCheckedChange={() => toggleArea(area)}
                            />
                            <span className="leading-tight">{area}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma área disponível.</p>
                  )}
                </FilterGroup>

                <FilterGroup title="Evento">
                  {eventOptions.length > 0 ? (
                    <div className="grid gap-3">
                      {eventOptions.map((event) => {
                        const id = toFilterId("publication-event", event.id);

                        return (
                          <label key={event.id} htmlFor={id} className="flex items-start gap-2 text-sm">
                            <Checkbox
                              id={id}
                              checked={selectedEvents.includes(event.id)}
                              onCheckedChange={() => setSelectedEvents((current) => toggleFilterValue(current, event.id))}
                            />
                            <span className="leading-tight">{event.title}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum evento disponível.</p>
                  )}
                </FilterGroup>

                <FilterGroup title="Modalidade">
                  {modalityOptions.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      {modalityOptions.map((modality) => {
                        const id = toFilterId("publication-modality", modality);

                        return (
                          <label key={modality} htmlFor={id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              id={id}
                              checked={selectedModalities.includes(modality)}
                              onCheckedChange={() =>
                                setSelectedModalities((current) => toggleFilterValue(current, modality))
                              }
                            />
                            <span>{modality}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma modalidade disponível.</p>
                  )}
                </FilterGroup>

                <FilterGroup title="Ano">
                  {yearOptions.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
                      {yearOptions.map((year) => (
                        <label key={year} htmlFor={`publication-year-${year}`} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            id={`publication-year-${year}`}
                            checked={selectedYears.includes(year)}
                            onCheckedChange={() => setSelectedYears((current) => toggleFilterValue(current, year))}
                          />
                          <span>{year}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum ano disponível.</p>
                  )}
                </FilterGroup>

                <FilterGroup title="Arquivo">
                  <label htmlFor="publication-only-with-pdf" className="flex items-center gap-2 text-sm">
                    <Checkbox
                      id="publication-only-with-pdf"
                      checked={onlyWithPdf}
                      onCheckedChange={(checked) => setOnlyWithPdf(checked === true)}
                    />
                    <span>Somente publicações com PDF</span>
                  </label>
                </FilterGroup>
              </div>

            </FilterSheetContent>
          </Sheet>
        </SiteContainer>
      </section>

      <section className="py-4">
        <SiteContainer>
          <QueryState
            isLoading={isLoading}
            isError={isError}
            isEmpty={articles.length === 0}
            loadingMessage="Carregando publicações..."
            errorMessage="Não foi possível carregar as publicações."
            emptyMessage={
              activeFilterCount > 0 || q.trim()
                ? "Nenhuma publicação corresponde aos filtros atuais."
                : "Nenhuma publicação encontrada."
            }
          >
            <div className="grid auto-rows-fr gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {articles.map((article) => (
                <PublicArticleCard
                  key={article.id}
                  article={article}
                  href={`/eventos/${article.eventSlug ?? article.eventId}/artigos/${article.id}`}
                  eventTitle={article.eventTitle}
                />
              ))}
            </div>

            <ListPagination
              className="mt-6"
              page={articlesResponse?.page ?? page}
              pageCount={pageCount}
              total={articlesResponse?.total}
              pageSize={articlesResponse?.pageSize ?? PUBLICATIONS_PAGE_SIZE}
              onPageChange={setPage}
            />
          </QueryState>
        </SiteContainer>
      </section>
    </AppShell>
  );
}


