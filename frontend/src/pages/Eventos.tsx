import { useDeferredValue, useMemo, useState } from "react";
import { Filter } from "lucide-react";
import { PublicEventCard } from "@/components/events/PublicEventCard";
import { AppShell } from "@/components/layout/AppShell";
import { SiteContainer } from "@/components/layout/SiteContainer";
import { GlobalSearchBox } from "@/components/search/GlobalSearchBox";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useAreasQuery, usePublicEventsQuery } from "@/features/acervo/hooks";
import { includesSearch } from "@/lib/search";
import { eventTypes } from "@/types/acervo";

export default function Eventos() {
  const { data: events = [], isLoading, isError } = usePublicEventsQuery();
  const { data: registeredAreas = [] } = useAreasQuery({ includeEmpty: true });
  const [query, setQuery] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const allAreas = useMemo(
    () =>
      Array.from(
        new Set([
          ...registeredAreas.map((area) => area.name),
          ...events.map((event) => event.area).filter(Boolean),
        ]),
      ).sort((left, right) => left.localeCompare(right)),
    [events, registeredAreas],
  );

  const filtered = useMemo(() => {
    const selectedYear = eventDate ? Number(eventDate.slice(0, 4)) : null;

    return events.filter((event) => {
      if (deferredQuery && !includesSearch(`${event.title} ${event.area} ${event.themes.join(" ")}`, deferredQuery)) {
        return false;
      }

      if (selectedYear && event.year !== selectedYear) return false;
      if (types.length && !types.includes(event.type)) return false;
      if (areas.length && !areas.includes(event.area)) return false;

      return true;
    });
  }, [areas, deferredQuery, eventDate, events, types]);

  const toggle = (values: string[], value: string, setValues: (next: string[]) => void) =>
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);

  const activeCount = (eventDate ? 1 : 0) + types.length + areas.length;
  const toFilterId = (prefix: string, value: string) => `${prefix}-${encodeURIComponent(value)}`;

  return (
    <AppShell>
      <section className="bg-brand text-primary-foreground">
        <SiteContainer className="pb-5 pt-3">
          <h1 className="text-xl font-bold">Eventos</h1>
          <p className="text-xs opacity-90">{isLoading ? "Carregando..." : `${filtered.length} resultados`}</p>

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
                    aria-label="Abrir filtros de eventos"
                  >
                    <Filter className="h-4 w-4" />

                    {activeCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-dark px-1 text-[10px] font-bold text-primary-foreground">
                        {activeCount}
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
                <SheetDescription className="sr-only">
                  Filtre a lista de eventos por data, tipo e área temática.
                </SheetDescription>
              </SheetHeader>

              <div className="mb-6">
                <Label htmlFor="event-date-filter" className="mb-2 block text-sm font-semibold text-black">
                  Data
                </Label>
                <Input
                  id="event-date-filter"
                  type="date"
                  value={eventDate}
                  onChange={(event) => setEventDate(event.target.value)}
                  className="h-11 rounded-xl border-zinc-300 bg-white text-sm shadow-none"
                />
              </div>

              <div className="mb-7">
                <div className="mb-4 block text-sm font-semibold text-black">Tipo de Evento</div>

                <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-3">
                  {eventTypes.map((type) => {
                    const id = toFilterId("event-type", type);

                    return (
                      <label key={type} htmlFor={id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          id={id}
                          checked={types.includes(type)}
                          onCheckedChange={() => toggle(types, type, setTypes)}
                        />
                        <span>{type}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="mb-8">
                <div className="mb-4 block text-sm font-semibold text-black">Área</div>

                {allAreas.length > 0 ? (
                  <div className="grid gap-3">
                    {allAreas.map((area) => {
                      const id = toFilterId("event-area", area);

                      return (
                        <label key={area} htmlFor={id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            id={id}
                            checked={areas.includes(area)}
                            onCheckedChange={() => toggle(areas, area, setAreas)}
                          />
                          <span>{area}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma área cadastrada ainda.</p>
                )}
              </div>

              <SheetFooter className="mt-8 grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="h-12 rounded-xl border-zinc-300 text-base font-semibold"
                  onClick={() => {
                    setEventDate("");
                    setTypes([]);
                    setAreas([]);
                  }}
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
          <QueryState
            isLoading={isLoading}
            isError={isError}
            isEmpty={filtered.length === 0}
            loadingMessage="Carregando eventos..."
            errorMessage="Não foi possível carregar os eventos."
            emptyMessage="Nenhum evento encontrado."
          >
            <div className="grid auto-rows-fr gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((event) => (
                <PublicEventCard key={event.id} event={event} />
              ))}
            </div>
          </QueryState>
        </SiteContainer>
      </section>
    </AppShell>
  );
}