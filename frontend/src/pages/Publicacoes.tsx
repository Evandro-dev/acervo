import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BookMarked, ChevronRight, Filter, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SiteContainer } from "@/components/layout/SiteContainer";
import { PublicationMetaRow } from "@/components/publications/PublicationMetaRow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { usePublishedArticlesQuery } from "@/features/acervo/hooks";
import { includesSearch } from "@/lib/search";
import type { Article } from "@/types/acervo";

function getArticleEventKey(article: Article) {
  return article.eventId || article.eventSlug || article.eventTitle || "";
}

function getArticleModality(article: Article) {
  return article.modality?.trim() || "Sem modalidade";
}

function getArticleYear(article: Article) {
  return article.eventYear ? String(article.eventYear) : "";
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function toFilterId(prefix: string, value: string) {
  return `${prefix}-${encodeURIComponent(value)}`;
}

export default function Publicacoes() {
  const { data: articles = [], isLoading, isError } = usePublishedArticlesQuery();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [selectedModalities, setSelectedModalities] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [onlyWithPdf, setOnlyWithPdf] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const areaFilter = searchParams.get("area");
  const deferredQuery = useDeferredValue(q);

  const areaOptions = useMemo(
    () => Array.from(new Set(articles.map((article) => article.area).filter(Boolean))).sort((left, right) => left.localeCompare(right)),
    [articles],
  );

  const eventOptions = useMemo(() => {
    const events = new Map<string, string>();

    articles.forEach((article) => {
      const key = getArticleEventKey(article);
      if (key && article.eventTitle) {
        events.set(key, article.eventTitle);
      }
    });

    return Array.from(events, ([value, label]) => ({ value, label })).sort((left, right) =>
      left.label.localeCompare(right.label),
    );
  }, [articles]);

  const modalityOptions = useMemo(
    () => Array.from(new Set(articles.map(getArticleModality))).sort((left, right) => left.localeCompare(right)),
    [articles],
  );

  const yearOptions = useMemo(
    () =>
      Array.from(new Set(articles.map(getArticleYear).filter(Boolean))).sort(
        (left, right) => Number(right) - Number(left),
      ),
    [articles],
  );

  const activeAreas = useMemo(
    () => Array.from(new Set([...(areaFilter ? [areaFilter] : []), ...selectedAreas])),
    [areaFilter, selectedAreas],
  );
  const activeFilterCount =
    activeAreas.length + selectedEvents.length + selectedModalities.length + selectedYears.length + (onlyWithPdf ? 1 : 0);

  const filtered = useMemo(() => {
    return articles.filter((article) => {
      if (activeAreas.length && !activeAreas.includes(article.area)) return false;
      if (selectedEvents.length && !selectedEvents.includes(getArticleEventKey(article))) return false;
      if (selectedModalities.length && !selectedModalities.includes(getArticleModality(article))) return false;
      if (selectedYears.length && !selectedYears.includes(getArticleYear(article))) return false;
      if (onlyWithPdf && !article.pdfUrl) return false;

      return includesSearch(
        `${article.title} ${article.authors.join(" ")} ${article.area} ${article.eventTitle ?? ""} ${
          article.modality ?? ""
        } ${article.abstract ?? ""}`,
        deferredQuery,
      );
    });
  }, [activeAreas, articles, deferredQuery, onlyWithPdf, selectedEvents, selectedModalities, selectedYears]);

  const clearArea = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("area");
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
    clearArea();
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
          <p className="text-xs opacity-90">{isLoading ? "Carregando..." : `${filtered.length} artigos disponíveis`}</p>
          {areaFilter && (
            <button
              onClick={clearArea}
              className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur hover:bg-white/25"
            >
              Área: {areaFilter}
              <X className="h-3 w-3" />
            </button>
          )}
          <div className="mt-3 flex gap-2">
            <SearchField
              containerClassName="flex-1"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Buscar título, autor, área..."
              className="border-0 bg-background text-foreground shadow-card"
            />

            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="relative shrink-0 bg-white text-primary-dark hover:bg-white/90"
                  aria-label="Abrir filtros de publicações"
                >
                  <Filter className="h-4 w-4" />
                  {activeFilterCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-dark px-1 text-[10px] font-bold text-primary-foreground">
                      {activeFilterCount}
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
                    Filtre a lista de publicações por área, evento, modalidade, ano e disponibilidade de PDF.
                  </SheetDescription>
                </SheetHeader>

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
                      <p className="text-sm text-muted-foreground">Nenhuma Área disponí­vel.</p>
                    )}
                  </FilterGroup>

                  <FilterGroup title="Evento">
                    {eventOptions.length > 0 ? (
                      <div className="grid gap-3">
                        {eventOptions.map((event) => {
                          const id = toFilterId("publication-event", event.value);

                          return (
                          <label
                            key={event.value}
                            htmlFor={id}
                            className="flex items-start gap-2 text-sm"
                          >
                            <Checkbox
                              id={id}
                              checked={selectedEvents.includes(event.value)}
                              onCheckedChange={() => setSelectedEvents((current) => toggleValue(current, event.value))}
                            />
                            <span className="leading-tight">{event.label}</span>
                          </label>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhum evento disponí­vel.</p>
                    )}
                  </FilterGroup>

                  <FilterGroup title="Modalidade">
                    {modalityOptions.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                        {modalityOptions.map((modality) => {
                          const id = toFilterId("publication-modality", modality);

                          return (
                          <label
                            key={modality}
                            htmlFor={id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <Checkbox
                              id={id}
                              checked={selectedModalities.includes(modality)}
                              onCheckedChange={() => setSelectedModalities((current) => toggleValue(current, modality))}
                            />
                            <span>{modality}</span>
                          </label>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhuma modalidade disponí­vel.</p>
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
                              onCheckedChange={() => setSelectedYears((current) => toggleValue(current, year))}
                            />
                            <span>{year}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhum ano disponí­vel.</p>
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

                <SheetFooter className="mt-8 grid grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    className="h-12 rounded-xl border-zinc-300 text-base font-semibold"
                    onClick={clearFilters}
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
            loadingMessage="Carregando publicações..."
            errorMessage="Não foi possível carregar as publicações."
            emptyMessage={
              activeFilterCount > 0 || q.trim()
                ? "Nenhuma publicação corresponde aos filtros atuais."
                : "Nenhuma publicação encontrada."
            }
          >
            <div className="grid auto-rows-fr gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((article) => (
                <Card key={article.id} className="flex h-full flex-col overflow-hidden border-border/60 shadow-card">
                  <div className="flex-1 p-3">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand text-primary-foreground">
                        <BookMarked className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <PublicationMetaRow
                          eventTitle={article.eventTitle}
                          eventHref={`/eventos/${article.eventSlug ?? article.eventId}`}
                          viewCount={article.viewCount}
                          downloadCount={article.downloadCount}
                          titleClassName="truncate"
                        />
                        <h3 className="text-sm font-bold leading-tight">{article.title}</h3>
                        <p className="mt-1 text-[11px] text-muted-foreground">{article.authors.join(" Â· ")}</p>
                        <div className="mt-1.5 flex min-w-0 flex-wrap items-start gap-2">
                          <Badge
                            variant="secondary"
                            className="h-auto min-h-5 max-w-full min-w-0 whitespace-normal wrap-break-word px-1.5 py-0.5 text-left text-[10px] leading-tight"
                          >
                            {article.area}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                  <Link
                    to={`/eventos/${article.eventSlug ?? article.eventId}/artigos/${article.id}`}
                    className="flex items-center justify-between border-t border-border/60 bg-brand-soft px-4 py-2 text-xs font-semibold text-primary-dark"
                  >
                    Ler artigo <ChevronRight className="h-4 w-4" />
                  </Link>
                </Card>
              ))}
            </div>
          </QueryState>
        </SiteContainer>
      </section>
    </AppShell>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-4 block text-sm font-semibold text-black">{title}</div>
      {children}
    </section>
  );
}
