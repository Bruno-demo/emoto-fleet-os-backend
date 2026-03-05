import { PaginationQueryDto } from './dto/pagination-query.dto';

export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// Normalizes query pagination values and computes skip/take offsets.
export function getPaginationParams(
  query: PaginationQueryDto,
): PaginationParams {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

// Formats paginated API responses with deterministic metadata.
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResponse<T> {
  return {
    data,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
