import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

export interface PaginationParams {
  page?: number;
  size?: number;
  sort?: string;
}

export interface UsePaginatedQueryOptions<T> {
  queryKey: (string | number | undefined)[];
  queryFn: (
    params: PaginationParams
  ) => Promise<{ success: boolean; data?: PaginatedResponse<T> | T[] }>;
  defaultPageSize?: number;
  enabled?: boolean;
}

export interface UsePaginatedQueryReturn<T> {
  data: T[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  isFetching: boolean;
  currentPage: number;
  totalPages: number;
  totalElements: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  setPageSize: (size: number) => void;
}

export function usePaginatedQuery<T>({
  queryKey,
  queryFn,
  defaultPageSize = 20,
  enabled = true,
}: UsePaginatedQueryOptions<T>): UsePaginatedQueryReturn<T> {
  const [currentPage, setCurrentPage] = useState(0); // 0-based
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: [...queryKey, currentPage, pageSize],
    queryFn: async () => {
      const response = await queryFn({ page: currentPage, size: pageSize });
      return response;
    },
    enabled,
  });

  const paginationInfo = useMemo(() => {
    if (!data?.success || !data.data) {
      return {
        items: [] as T[],
        totalPages: 0,
        totalElements: 0,
        currentPage: 0,
        hasNext: false,
        hasPrevious: false,
      };
    }

    const responseData = data.data;
    if (Array.isArray(responseData)) {
      return {
        items: responseData,
        totalPages: 1,
        totalElements: responseData.length,
        currentPage: 0,
        hasNext: false,
        hasPrevious: false,
      };
    }
    const paginated = responseData as PaginatedResponse<T>;
    return {
      items: paginated.content || [],
      totalPages: paginated.totalPages || 0,
      totalElements: paginated.totalElements || 0,
      currentPage: paginated.number || 0,
      hasNext: !paginated.last,
      hasPrevious: !paginated.first,
    };
  }, [data]);

  const goToPage = (page: number) => {
    if (page >= 0 && page < paginationInfo.totalPages) {
      setCurrentPage(page);
    }
  };

  const nextPage = () => {
    if (paginationInfo.hasNext) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const previousPage = () => {
    if (paginationInfo.hasPrevious) {
      setCurrentPage(prev => Math.max(0, prev - 1));
    }
  };

  return {
    data: paginationInfo.items,
    isLoading,
    error: error as Error | null,
    refetch,
    isFetching,
    currentPage: paginationInfo.currentPage,
    totalPages: paginationInfo.totalPages,
    totalElements: paginationInfo.totalElements,
    pageSize,
    hasNextPage: paginationInfo.hasNext,
    hasPreviousPage: paginationInfo.hasPrevious,
    goToPage,
    nextPage,
    previousPage,
    setPageSize: (size: number) => {
      setPageSize(size);
      setCurrentPage(0);
    },
  };
}
