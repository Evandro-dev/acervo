import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  Library,
  Loader2,
  Search,
  Tag,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { EventCoverThumb } from "@/components/events/EventCoverThumb";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { useGlobalSearchQuery } from "@/features/acervo/hooks";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { normalizeSearch } from "@/lib/search";
import { cn } from "@/lib/utils";
import type { GlobalSearchResult, GlobalSearchType } from "@/types/acervo";

const RESULT_GROUPS: Array<{
  type: GlobalSearchType;
  label: string;
  icon: LucideIcon;
  href: string;
  keywords: string[];
}> = [
  {
    type: "article",
    label: "Publicações",
    icon: Library,
    href: "/publicacoes",
    keywords: [
      "publicacao",
      "publicacoes",
      "artigo",
      "artigos",
      "trabalho",
      "trabalhos",
    ],
  },
  {
    type: "event",
    label: "Eventos",
    icon: CalendarDays,
    href: "/eventos",
    keywords: ["evento", "eventos"],
  },
  {
    type: "author",
    label: "Autores",
    icon: UserRound,
    href: "/autores",
    keywords: ["autor", "autores"],
  },
  {
    type: "area",
    label: "Áreas",
    icon: Tag,
    href: "/areas",
    keywords: ["area", "areas"],
  },
  {
    type: "course",
    label: "Cursos",
    icon: GraduationCap,
    href: "/publicacoes",
    keywords: ["curso", "cursos"],
  },
];

type ResultGroup = (typeof RESULT_GROUPS)[number] & {
  results: GlobalSearchResult[];
  score: number;
};

type SearchItem =
  | {
      kind: "shortcut";
      id: string;
      title: string;
      subtitle: string;
      href: string;
      icon: LucideIcon;
    }
  | {
      kind: "result";
      result: GlobalSearchResult;
    };

type GlobalSearchBoxProps = {
  placeholder?: string;
  className?: string;
  containerClassName?: string;
  iconClassName?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  limit?: number;
  trailingAction?: ReactNode;
};

function getResultIcon(type: GlobalSearchType) {
  return RESULT_GROUPS.find((group) => group.type === type)?.icon ?? BookOpen;
}

function trimDescription(value?: string) {
  if (!value) return "";
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= 120) return trimmed;
  return `${trimmed.slice(0, 117).trim()}...`;
}

function getIntentScore(group: (typeof RESULT_GROUPS)[number], query: string) {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return 100;

  const normalizedLabel = normalizeSearch(group.label);
  if (
    group.keywords.includes(normalizedQuery) ||
    normalizedLabel === normalizedQuery
  )
    return 0;
  if (group.keywords.some((keyword) => keyword.startsWith(normalizedQuery)))
    return 1;
  if (normalizedLabel.includes(normalizedQuery)) return 2;
  return 100;
}

function getResultScore(result: GlobalSearchResult, query: string) {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return 50;

  const title = normalizeSearch(result.title);
  const subtitle = normalizeSearch(result.subtitle ?? "");
  const description = normalizeSearch(result.description ?? "");

  if (title === normalizedQuery) return 0;
  if (title.startsWith(normalizedQuery)) return 1;
  if (title.includes(normalizedQuery)) return 2;
  if (subtitle.startsWith(normalizedQuery)) return 3;
  if (subtitle.includes(normalizedQuery)) return 4;
  if (result.matchedFields.length > 0) return 5;
  if (description.includes(normalizedQuery)) return 6;
  return 50;
}

function getShortcutActions(query: string): SearchItem[] {
  const normalizedQuery = normalizeSearch(query);
  if (normalizedQuery.length < 2) return [];

  return RESULT_GROUPS.filter((group) => getIntentScore(group, query) <= 2).map(
    (group) => ({
      kind: "shortcut",
      id: `shortcut-${group.type}`,
      title: group.label,
      subtitle: "Abrir seção do Acervo",
      href: group.href,
      icon: group.icon,
    }),
  );
}

function getOrderedGroups(
  groups: Record<GlobalSearchType, GlobalSearchResult[]>,
  query: string,
): ResultGroup[] {
  return RESULT_GROUPS.map((group, originalIndex) => {
    const results = groups[group.type] ?? [];
    const resultScore = results.length
      ? Math.min(...results.map((result) => getResultScore(result, query)))
      : 50;
    const intentScore = getIntentScore(group, query);

    return {
      ...group,
      results,
      score: Math.min(intentScore, resultScore) * 10 + originalIndex,
    };
  })
    .filter((group) => group.results.length > 0)
    .sort((left, right) => left.score - right.score);
}

function flattenSearchItems(
  shortcuts: SearchItem[],
  groups: ResultGroup[],
): SearchItem[] {
  return [
    ...shortcuts,
    ...groups.flatMap((group) =>
      group.results.map((result) => ({ kind: "result" as const, result })),
    ),
  ];
}

function findNormalizedMatchRange(text: string, query: string) {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return null;

  for (let start = 0; start < text.length; start += 1) {
    for (let end = start + 1; end <= text.length; end += 1) {
      const normalizedSlice = normalizeSearch(text.slice(start, end));
      if (normalizedSlice === normalizedQuery) return { start, end };
      if (normalizedSlice.length > normalizedQuery.length) break;
    }
  }

  return null;
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const range = findNormalizedMatchRange(text, query);
  if (!range) return <>{text}</>;

  return (
    <>
      {text.slice(0, range.start)}
      <mark className="rounded bg-brand-soft px-0.5 font-semibold text-primary-dark">
        {text.slice(range.start, range.end)}
      </mark>
      {text.slice(range.end)}
    </>
  );
}

export function GlobalSearchBox({
  placeholder = "Buscar no Acervo...",
  className,
  containerClassName,
  iconClassName,
  value: controlledValue,
  defaultValue = "",
  onValueChange,
  limit = 5,
  trailingAction,
}: GlobalSearchBoxProps) {
  const navigate = useNavigate();
  const generatedId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [requestedActiveIndex, setRequestedActiveIndex] = useState(0);
  const value = controlledValue ?? uncontrolledValue;
  const debouncedValue = useDebouncedValue(value, 220);
  const search = debouncedValue.trim();
  const { data, isFetching, isError } = useGlobalSearchQuery(search, { limit });
  const shortcuts = useMemo(() => getShortcutActions(search), [search]);
  const orderedGroups = useMemo(
    () => (data ? getOrderedGroups(data.groups, search) : []),
    [data, search],
  );
  const searchItems = useMemo(
    () => flattenSearchItems(shortcuts, orderedGroups),
    [orderedGroups, shortcuts],
  );
  const shouldShowPanel = open && value.trim().length > 0;
  const hasEnoughText = value.trim().length >= 2;
  const listboxId = `${generatedId}-results`;
  const activeIndex = Math.min(
    requestedActiveIndex,
    Math.max(searchItems.length - 1, 0),
  );

  const updateValue = (nextValue: string) => {
    if (controlledValue === undefined) {
      setUncontrolledValue(nextValue);
    }
    setRequestedActiveIndex(0);
    onValueChange?.(nextValue);
    setOpen(true);
  };

  const goToHref = (href: string) => {
    setOpen(false);
    inputRef.current?.blur();
    navigate(href);
  };

  const activeItem = searchItems[activeIndex];
  const activeItemId = activeItem
    ? activeItem.kind === "shortcut"
      ? `${listboxId}-${activeItem.id}`
      : `${listboxId}-${activeItem.result.type}-${activeItem.result.id}`
    : undefined;

  return (
    <Popover open={shouldShowPanel} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div
          className={cn(
            "w-full",
            trailingAction
              ? "flex items-center gap-2 rounded-xl border border-border/70 bg-background p-1 shadow-card"
              : "relative",
            containerClassName,
          )}
        >
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground",
                iconClassName,
              )}
            />

            <Input
              ref={inputRef}
              id={generatedId}
              name={generatedId}
              type="search"
              role="combobox"
              aria-label="Buscar no Acervo"
              aria-autocomplete="list"
              aria-expanded={shouldShowPanel}
              aria-controls={listboxId}
              aria-activedescendant={activeItemId}
              value={value}
              onChange={(event) => updateValue(event.target.value)}
              onFocus={() => setOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setOpen(true);
                  setRequestedActiveIndex((current) =>
                    Math.min(current + 1, Math.max(searchItems.length - 1, 0)),
                  );
                }

                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setRequestedActiveIndex((current) =>
                    Math.max(current - 1, 0),
                  );
                }

                if (event.key === "Enter" && activeItem) {
                  event.preventDefault();
                  goToHref(
                    activeItem.kind === "shortcut"
                      ? activeItem.href
                      : activeItem.result.href,
                  );
                }

                if (event.key === "Escape") {
                  event.preventDefault();
                  setOpen(false);
                  inputRef.current?.blur();
                }
              }}
              placeholder={placeholder}
              autoComplete="off"
              className={cn(
                "w-full pl-9",
                trailingAction &&
                  "border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
                className,
              )}
            />
          </div>

          {trailingAction ? (
            <div className="shrink-0">{trailingAction}</div>
          ) : null}
        </div>
      </PopoverAnchor>

      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border-border/70 p-0 shadow-2xl"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onFocusOutside={(event) => {
          if (
            event.target instanceof Node &&
            inputRef.current?.contains(event.target)
          ) {
            event.preventDefault();
          }
        }}
      >
        <div className="border-b border-border/60 bg-linear-to-r from-brand-soft to-background px-4 py-3">
          <div className="text-sm font-bold text-foreground">
            Busca geral do Acervo
          </div>
          <div className="text-xs text-muted-foreground">
            Pesquise publicações, eventos, autores, áreas e cursos.
          </div>
        </div>

        {!hasEnoughText ? (
          <div className="p-4 text-sm text-muted-foreground">
            Digite pelo menos 2 caracteres para buscar.
          </div>
        ) : isFetching && !data ? (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Buscando no Acervo...
          </div>
        ) : isError ? (
          <div className="p-4 text-sm text-destructive">
            Não foi possível carregar os resultados agora.
          </div>
        ) : searchItems.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            Nenhum resultado encontrado para “{search}”.
          </div>
        ) : (
          <div
            id={listboxId}
            role="listbox"
            className="max-h-[70vh] overflow-y-auto p-2"
          >
            {shortcuts.length ? (
              <section className="py-1">
                <div className="flex items-center gap-2 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  <Search className="h-3.5 w-3.5" />
                  Atalhos
                </div>

                <div className="space-y-1">
                  {shortcuts.map((item, index) => {
                    if (item.kind !== "shortcut") return null;

                    const Icon = item.icon;
                    const isActive = index === activeIndex;

                    return (
                      <Link
                        id={`${listboxId}-${item.id}`}
                        role="option"
                        aria-selected={isActive}
                        key={item.id}
                        to={item.href}
                        onMouseEnter={() => setRequestedActiveIndex(index)}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex gap-3 rounded-xl px-3 py-2.5 text-left transition",
                          isActive
                            ? "bg-brand-soft text-primary-dark"
                            : "hover:bg-muted/70",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                            isActive
                              ? "bg-white text-primary-dark"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-1 text-sm font-bold leading-snug">
                            {item.title}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {item.subtitle}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {orderedGroups.map((group) => {
              const GroupIcon = group.icon;

              return (
                <section key={group.type} className="py-1">
                  <div className="flex items-center gap-2 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    <GroupIcon className="h-3.5 w-3.5" />
                    {group.label}
                  </div>

                  <div className="space-y-1">
                    {group.results.map((result) => {
                      const flatIndex = searchItems.findIndex(
                        (item) =>
                          item.kind === "result" &&
                          item.result.type === result.type &&
                          item.result.id === result.id,
                      );

                      const isActive = flatIndex === activeIndex;
                      const Icon = getResultIcon(result.type);
                      const showEventCover =
                        result.type === "event" && Boolean(result.cover);

                      return (
                        <Link
                          id={`${listboxId}-${result.type}-${result.id}`}
                          role="option"
                          aria-selected={isActive}
                          key={`${result.type}-${result.id}`}
                          to={result.href}
                          onMouseEnter={() =>
                            setRequestedActiveIndex(flatIndex)
                          }
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex gap-3 rounded-xl px-3 py-2.5 text-left transition",
                            isActive
                              ? "bg-brand-soft text-primary-dark"
                              : "hover:bg-muted/70",
                          )}
                        >
                          {showEventCover ? (
                            <EventCoverThumb
                              cover={result.cover}
                              title={result.title}
                              className="mt-0.5 h-12 w-12"
                            />
                          ) : (
                            <span
                              className={cn(
                                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                                isActive
                                  ? "bg-white text-primary-dark"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                          )}

                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 text-sm font-bold leading-snug">
                              <HighlightedText
                                text={result.title}
                                query={search}
                              />
                            </span>

                            {result.subtitle ? (
                              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                <HighlightedText
                                  text={result.subtitle}
                                  query={search}
                                />
                              </span>
                            ) : null}

                            {result.description ? (
                              <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                <HighlightedText
                                  text={trimDescription(result.description)}
                                  query={search}
                                />
                              </span>
                            ) : null}

                            {result.matchedFields.length ? (
                              <span className="mt-2 flex flex-wrap gap-1">
                                {result.matchedFields
                                  .slice(0, 3)
                                  .map((field) => (
                                    <Badge
                                      key={field}
                                      variant="outline"
                                      className="h-5 rounded-full px-1.5 text-[10px]"
                                    >
                                      {field}
                                    </Badge>
                                  ))}
                              </span>
                            ) : null}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            {isFetching ? (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Atualizando
                resultados...
              </div>
            ) : null}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
