import { ChevronLeft, ChevronRight } from "lucide-react";

type ListPaginationProps = {
  page: number;
  pageCount: number;
  total?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  className?: string;
};

const paginationTextButtonClass =
  "inline-flex h-9 items-center justify-center gap-1 rounded-full px-2 text-sm font-semibold text-primary transition-colors hover:text-primary-dark disabled:pointer-events-none disabled:text-muted-foreground disabled:opacity-45";

const paginationNumberButtonClass =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-border bg-background px-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:border-brand/45 hover:bg-brand-soft hover:text-primary-dark disabled:pointer-events-none disabled:opacity-45";

function clampPage(page: number, pageCount: number) {
  if (!Number.isFinite(page)) return 1;

  return Math.min(Math.max(1, Math.trunc(page)), Math.max(1, pageCount));
}

function getVisiblePages(page: number, pageCount: number) {
  if (pageCount <= 5) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, pageCount]);

  for (let current = page - 1; current <= page + 1; current += 1) {
    if (current > 1 && current < pageCount) {
      pages.add(current);
    }
  }

  if (page <= 3) {
    pages.add(2);
    pages.add(3);
  }

  if (page >= pageCount - 2) {
    pages.add(pageCount - 2);
    pages.add(pageCount - 1);
  }

  return Array.from(pages)
    .filter((item) => item >= 1 && item <= pageCount)
    .sort((left, right) => left - right);
}

function getRangeLabel(page: number, pageSize?: number, total?: number) {
  if (!total || !pageSize) return undefined;

  if (total <= 0) return "Nenhum item encontrado";

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return `Mostrando ${start}-${end} de ${total}`;
}

export function ListPagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  className,
}: ListPaginationProps) {
  const safePageCount = Math.max(1, Math.trunc(pageCount || 1));
  const currentPage = clampPage(page, safePageCount);

  if (safePageCount <= 1) return null;

  const visiblePages = getVisiblePages(currentPage, safePageCount);
  const rangeLabel = getRangeLabel(currentPage, pageSize, total);

  function handlePageChange(nextPage: number) {
    const normalizedPage = clampPage(nextPage, safePageCount);

    if (normalizedPage !== currentPage) {
      onPageChange(normalizedPage);
    }
  }

  return (
    <nav
      aria-label="Paginação"
      className={[
        "flex flex-col items-center justify-center gap-2 border-t border-border/60 pt-4",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="text-center text-xs font-medium text-muted-foreground sm:text-sm">
        {rangeLabel ?? `Página ${currentPage} de ${safePageCount}`}
      </div>

      <div className="flex w-full flex-wrap items-center justify-center gap-1.5 sm:gap-2">
        <button
          type="button"
          className={paginationTextButtonClass}
          disabled={currentPage <= 1}
          onClick={() => handlePageChange(currentPage - 1)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Anterior
        </button>

        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {visiblePages.map((visiblePage, index) => {
            const previousPage = visiblePages[index - 1];
            const shouldShowEllipsis =
              previousPage !== undefined && visiblePage - previousPage > 1;
            const isCurrentPage = visiblePage === currentPage;

            return (
              <div key={visiblePage} className="flex items-center gap-1.5">
                {shouldShowEllipsis ? (
                  <span className="inline-flex h-9 min-w-7 items-center justify-center text-sm font-semibold text-muted-foreground">
                    ...
                  </span>
                ) : null}

                <button
                  type="button"
                  aria-current={isCurrentPage ? "page" : undefined}
                  className={[
                    paginationNumberButtonClass,
                    isCurrentPage
                      ? "border-brand bg-brand text-primary-foreground shadow-card hover:border-brand hover:bg-brand hover:text-primary-foreground"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => handlePageChange(visiblePage)}
                >
                  {visiblePage}
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className={paginationTextButtonClass}
          disabled={currentPage >= safePageCount}
          onClick={() => handlePageChange(currentPage + 1)}
        >
          Próxima
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
