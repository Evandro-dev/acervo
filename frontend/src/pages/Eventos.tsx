import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Filter } from "lucide-react";
import { EventCoverThumb } from "@/components/events/EventCoverThumb";
import { AppShell } from "@/components/layout/AppShell";
import { SiteContainer } from "@/components/layout/SiteContainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QueryState } from "@/components/ui/query-state";
import { SearchField } from "@/components/ui/search-field";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { usePublicEventsQuery } from "@/features/acervo/hooks";
import { eventTypes, type Event } from "@/types/acervo";

export default function Eventos() {
  const { data: events = [], isLoading, isError } = usePublicEventsQuery();
  const [query, setQuery] = useState("");
  const [year, setYear] = useState<number | null>(null);
  const [types, setTypes] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const allAreas = useMemo(
    () => Array.from(new Set(events.flatMap((event) => event.themes))).sort((left, right) => left.localeCompare(right)),
    [events],
  );

  const filtered = useMemo(() => {
    const q = deferredQuery.toLowerCase().trim();

    return events.filter((event) => {
      if (q && !`${event.title} ${event.area} ${event.themes.join(" ")}`.toLowerCase().includes(q)) return false;
      if (year && event.year !== year) return false;
      if (types.length && !types.includes(event.type)) return false;
      if (areas.length && !event.themes.some((theme) => areas.includes(theme))) return false;
      return true;
    });
  }, [areas, deferredQuery, events, types, year]);

  const toggle = (values: string[], value: string, setValues: (next: string[]) => void) =>
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);

  const activeCount = (year ? 1 : 0) + types.length + areas.length;

  return (
    <AppShell>
      <section className="bg-brand text-primary-foreground">
        <SiteContainer className="pb-5 pt-3">
          <h1 className="text-xl font-bold">Eventos</h1>
          <p className="text-xs opacity-90">{isLoading ? "Carregando..." : `${filtered.length} resultados`}</p>
          <div className="mt-3 flex gap-2">
            <SearchField
              containerClassName="flex-1"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar eventos..."
              className="border-0 bg-background text-foreground shadow-card"
            />
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="secondary" size="icon" className="relative shrink-0 bg-white text-primary-dark hover:bg-white/90">
                  <Filter className="h-4 w-4" />
                  {activeCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-dark px-1 text-[10px] font-bold text-primary-foreground">
                      {activeCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>

              <SheetContent
                side="bottom"
                className="h-[92vh] overflow-y-auto rounded-t-[28px] border-0 bg-white px-5 pb-6 pt-4 shadow-2xl md:bottom-auto md:left-1/2 md:right-auto md:top-1/2 md:h-auto md:max-h-[90vh] md:w-[min(92vw,720px)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl"
              >
                <SheetHeader className="mb-6 flex flex-row items-center justify-between space-y-0 text-left">
                  <SheetTitle className="text-2xl font-bold text-[#E30613]">Filtros</SheetTitle>
                  <SheetDescription className="sr-only">
                    Filtre a lista de eventos por data, tipo e area tematica.
                  </SheetDescription>
                </SheetHeader>

                <div className="mb-6">
                  <Label className="mb-2 block text-sm font-semibold text-black">Data</Label>
                  <Input type="date" className="h-11 rounded-xl border-zinc-300 bg-white text-sm shadow-none" />
                </div>

                <div className="mb-7">
                  <Label className="mb-4 block text-sm font-semibold text-black">Tipo de Evento</Label>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-3">
                    {eventTypes.map((type) => (
                      <label key={type} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={types.includes(type)} onCheckedChange={() => toggle(types, type, setTypes)} />
                        <span>{type}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mb-8">
                  <Label className="mb-4 block text-sm font-semibold text-black">Área</Label>
                  <div className="grid gap-3">
                    {allAreas.map((area) => (
                      <label key={area} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={areas.includes(area)} onCheckedChange={() => toggle(areas, area, setAreas)} />
                        <span>{area}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <SheetFooter className="mt-8 grid grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    className="h-12 rounded-xl border-zinc-300 text-base font-semibold"
                    onClick={() => {
                      setYear(null);
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
          </div>
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
                <EventCard key={event.id} ev={event} />
              ))}
            </div>
          </QueryState>
        </SiteContainer>
      </section>
    </AppShell>
  );
}

function EventCard({ ev }: { ev: Event }) {
  return (
    <Card className="flex h-full min-h-41 flex-col overflow-hidden border-border/60 shadow-card">
      <div className="flex flex-1 gap-3 p-3">
        <EventCoverThumb cover={ev.cover} title={ev.title} className="h-16 w-16" />
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="line-clamp-3 text-sm font-bold leading-tight">{ev.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{ev.date}</p>
          <div className="mt-2 flex min-w-0 flex-wrap items-start gap-1">
            <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-[10px]">
              {ev.type}
            </Badge>
            <Badge
              variant="outline"
              className="h-auto min-h-5 max-w-full min-w-0 whitespace-normal wrap-break-word px-1.5 py-0.5 text-left text-[10px] leading-tight"
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
        Ver detalhes <ChevronRight className="h-4 w-4" />
      </Link>
    </Card>
  );
}
