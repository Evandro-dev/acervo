import { useDeferredValue, useMemo, useState } from "react";
import { FilterButton } from "@/components/filters/FilterButton";
import { FilterGroup } from "@/components/filters/FilterGroup";
import { FilterSheetContent } from "@/components/filters/FilterSheetContent";
import { toFilterId, toggleFilterValue } from "@/components/filters/filter-utils";
import { PublicEventCard } from "@/components/events/PublicEventCard";
import { AppShell } from "@/components/layout/AppShell";
import { SiteContainer } from "@/components/layout/SiteContainer";
import { GlobalSearchBox } from "@/components/search/GlobalSearchBox";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListPagination } from "@/components/ui/list-pagination";
import { QueryState } from "@/components/ui/query-state";
import {
  Sheet,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAreasQuery, usePublicEventsQuery } from "@/features/acervo/hooks";
import { usePaginatedQueryState } from "@/hooks/usePaginatedQueryState";
import { eventTypes, type EventType } from "@/types/acervo";

const EVENTS_PAGE_SIZE = 12;

function normalizeYear(value: string) {
  const year = Number(value);

  if (!Number.isInteger(year) || year < 1900 || year > 3000) {
    return undefined;
  }

  return year;
}

export default function Eventos() {
  const [query, setQuery] = useState("");
  const [eventYear, setEventYear] = useState("");
  const [types, setTypes] = useState<EventType[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const deferredQuery = useDeferredValue(query);
  const selectedYear = normalizeYear(eventYear);

  const selectedTypes = useMemo(
    () => [...types].sort((left, right) => left.localeCompare(right)),
    [types],
  );
  const selectedAreas = useMemo(
    () => [...areas].sort((left, right) => left.localeCompare(right)),
    [areas],
  );

  const typesKey = selectedTypes.join("|");
  const areasKey = selectedAreas.join("|");
  const paginationResetKey = [deferredQuery, eventYear, typesKey, areasKey].join("\u0001");
  const { page, setPage } = usePaginatedQueryState({
    resetKey: paginationResetKey,
  });

  const {
    data: eventsResponse,
    isLoading,
    isError,
  } = usePublicEventsQuery({
    page,
    pageSize: EVENTS_PAGE_SIZE,
    q: deferredQuery || undefined,
    year: selectedYear,
    type: selectedTypes.length > 0 ? selectedTypes : undefined,
    area: selectedAreas.length > 0 ? selectedAreas : undefined,
  });

  const { data: registeredAreas = [] } = useAreasQuery({ includeEmpty: true });
  const events = eventsResponse?.items ?? [];

  const allAreas = useMemo(
    () =>
      registeredAreas
        .map((area) => area.name)
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right)),
    [registeredAreas],
  );

  const activeCount =
    (selectedYear ? 1 : 0) + selectedTypes.length + selectedAreas.length;
  const totalResults = eventsResponse?.total ?? 0;

  return (
    <AppShell>
      <section className="bg-brand text-primary-foreground">
        <SiteContainer className="pb-5 pt-3">
          <h1 className="text-xl font-bold">Eventos</h1>
          <p className="text-xs opacity-90">
            {isLoading ? "Carregando..." : `${totalResults} resultados`}
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
                  <FilterButton
                    activeCount={activeCount}
                    label="Abrir filtros de eventos"
                  />
                </SheetTrigger>
              }
            />

            <FilterSheetContent
              description="Filtre a lista de eventos por ano, tipo e área temática."
              onApply={() => setOpen(false)}
              onClear={() => {
                setEventYear("");
                setTypes([]);
                setAreas([]);
              }}
            >
              <div className="mb-6">
                <Label
                  htmlFor="event-year-filter"
                  className="mb-2 block text-sm font-semibold text-black"
                >
                  Ano
                </Label>
                <Input
                  id="event-year-filter"
                  type="number"
                  inputMode="numeric"
                  min={1900}
                  max={3000}
                  placeholder="Ex.: 2026"
                  value={eventYear}
                  onChange={(event) => setEventYear(event.target.value)}
                  className="h-11 rounded-xl border-zinc-300 bg-white text-sm shadow-none"
                />
              </div>

              <FilterGroup title="Tipo de Evento">
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-3">
                  {eventTypes.map((type) => {
                    const id = toFilterId("event-type", type);

                    return (
                      <label
                        key={type}
                        htmlFor={id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Checkbox
                          id={id}
                          checked={types.includes(type)}
                          onCheckedChange={() =>
                            setTypes((current) => toggleFilterValue(current, type))
                          }
                        />
                        <span>{type}</span>
                      </label>
                    );
                  })}
                </div>
              </FilterGroup>

              <FilterGroup title="Área">

                {allAreas.length > 0 ? (
                  <div className="grid gap-3">
                    {allAreas.map((area) => {
                      const id = toFilterId("event-area", area);

                      return (
                        <label
                          key={area}
                          htmlFor={id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <Checkbox
                            id={id}
                            checked={areas.includes(area)}
                            onCheckedChange={() =>
                              setAreas((current) => toggleFilterValue(current, area))
                            }
                          />
                          <span>{area}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma área cadastrada ainda.
                  </p>
                )}
              </FilterGroup>
            </FilterSheetContent>
          </Sheet>
        </SiteContainer>
      </section>

      <section className="py-4">
        <SiteContainer>
          <QueryState
            isLoading={isLoading}
            isError={isError}
            isEmpty={events.length === 0}
            loadingMessage="Carregando eventos..."
            errorMessage="Não foi possível carregar os eventos."
            emptyMessage="Nenhum evento encontrado."
          >
            <div className="grid auto-rows-fr gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {events.map((event) => (
                <PublicEventCard key={event.id} event={event} />
              ))}
            </div>

            <ListPagination
              className="mt-6"
              page={eventsResponse?.page ?? page}
              pageCount={eventsResponse?.pageCount ?? 1}
              total={eventsResponse?.total}
              pageSize={eventsResponse?.pageSize ?? EVENTS_PAGE_SIZE}
              onPageChange={setPage}
            />
          </QueryState>
        </SiteContainer>
      </section>
    </AppShell>
  );
}
