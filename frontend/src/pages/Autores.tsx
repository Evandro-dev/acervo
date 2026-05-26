import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { User, FileText, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { SiteContainer } from "@/components/layout/SiteContainer";
import { Card } from "@/components/ui/card";
import { SearchField } from "@/components/ui/search-field";
import { Badge } from "@/components/ui/badge";
import { QueryState } from "@/components/ui/query-state";
import { useAuthorsQuery } from "@/features/acervo/hooks";

export default function Autores() {
  const { data: authors = [], isLoading, isError } = useAuthorsQuery();
  const [q, setQ] = useState("");
  const deferredQuery = useDeferredValue(q);

  const filtered = useMemo(() => {
    const search = deferredQuery.toLowerCase().trim();
    if (!search) return authors;
    return authors.filter((author) => author.name.toLowerCase().includes(search));
  }, [authors, deferredQuery]);

  return (
    <AppShell>
      <section className="bg-brand text-primary-foreground">
        <SiteContainer className="pb-5 pt-3">
          <h1 className="text-xl font-bold">Autores</h1>
          <p className="text-xs opacity-90">{isLoading ? "Carregando..." : `${authors.length} autores no acervo`}</p>
          <SearchField
            containerClassName="mt-3"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Buscar pesquisador..."
            className="border-0 bg-background text-foreground shadow-card"
          />
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
