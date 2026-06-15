import { useEffect, useState } from "react";

type UsePaginatedQueryStateOptions = {
  initialPage?: number;
  resetKey?: string;
};

export function usePaginatedQueryState({
  initialPage = 1,
  resetKey,
}: UsePaginatedQueryStateOptions = {}) {
  const [page, setPage] = useState(initialPage);

  useEffect(() => {
    setPage(initialPage);
  }, [initialPage, resetKey]);

  return { page, setPage };
}
