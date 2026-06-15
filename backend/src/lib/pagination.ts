import { z } from "zod";

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 50;
export const MAX_PAGE = 10_000;

export type PaginationOptions = {
  defaultPageSize?: number;
  maxPageSize?: number;
};

export type PaginationQuery = {
  page: number;
  pageSize: number;
};

export type PaginationParams = PaginationQuery & {
  skip: number;
  take: number;
};

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

function clampPageSize(value: number, maxPageSize: number) {
  return Math.min(Math.max(1, value), maxPageSize);
}

function resolvePaginationOptions(options?: PaginationOptions) {
  const maxPageSize = clampPageSize(options?.maxPageSize ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE);
  const defaultPageSize = clampPageSize(options?.defaultPageSize ?? DEFAULT_PAGE_SIZE, maxPageSize);

  return {
    defaultPageSize,
    maxPageSize,
  };
}

export function createPaginationQuerySchema(options?: PaginationOptions) {
  const { defaultPageSize, maxPageSize } = resolvePaginationOptions(options);

  return z.object({
    page: z.coerce.number().int().min(1).max(MAX_PAGE).default(DEFAULT_PAGE),
    pageSize: z.coerce.number().int().min(1).max(maxPageSize).default(defaultPageSize),
  });
}

export const paginationQuerySchema = createPaginationQuerySchema();

export function getPageCount(total: number, pageSize: number) {
  const safeTotal = Math.max(0, Math.trunc(total));
  const safePageSize = Math.max(1, Math.trunc(pageSize));

  if (safeTotal === 0) return 1;

  return Math.ceil(safeTotal / safePageSize);
}

export function getPaginationParams(query: PaginationQuery): PaginationParams {
  const page = Math.min(Math.max(1, Math.trunc(query.page)), MAX_PAGE);
  const pageSize = Math.min(Math.max(1, Math.trunc(query.pageSize)), MAX_PAGE_SIZE);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function createPaginatedResponse<T>(
  items: T[],
  total: number,
  pagination: Pick<PaginationParams, "page" | "pageSize">,
): PaginatedResponse<T> {
  const safeTotal = Math.max(0, Math.trunc(total));

  return {
    items,
    total: safeTotal,
    page: pagination.page,
    pageSize: pagination.pageSize,
    pageCount: getPageCount(safeTotal, pagination.pageSize),
  };
}
