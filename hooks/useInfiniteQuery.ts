import { useInfiniteQuery as useReactQueryInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number; // current page (0-based)
  first: boolean;
  last: boolean;
}

export interface UseInfiniteQueryOptions<T> {
  queryKey: (string | number | undefined)[];
  queryFn: (page: number, size: number) => Promise<{ success: boolean; data?: PaginatedResponse<T> | T[] }>;
  defaultPageSize?: number;
  enabled?: boolean;
  getNextPageParam?: (lastPage: { success: boolean; data?: PaginatedResponse<T> | T[] }) => number | undefined;
}

export interface UseInfiniteQueryReturn<T> {
  data: T[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  totalElements: number;
  totalPages: number;
}

export function useInfiniteQuery<T>({
  queryKey,
  queryFn,
  defaultPageSize = 20,
  enabled = true,
  getNextPageParam,
}: UseInfiniteQueryOptions<T>): UseInfiniteQueryReturn<T> {
  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useReactQueryInfiniteQuery({
    queryKey: [...queryKey, "infinite"],
    queryFn: async ({ pageParam = 0 }) => {
      return await queryFn(pageParam, defaultPageSize);
    },
    getNextPageParam: getNextPageParam || ((lastPage) => {
      if (!lastPage?.success || !lastPage.data) return undefined;
      
      // Check if response is paginated
      if (Array.isArray(lastPage.data)) {
        // Not paginated, no more pages
        return undefined;
      }

      const paginated = lastPage.data as PaginatedResponse<T>;
      if (paginated.last) return undefined;
      return paginated.number + 1;
    }),
    enabled,
    initialPageParam: 0,
  });

  const flattenedData = useMemo(() => {
    if (!data?.pages) return [];
    
    const allItems: T[] = [];
    data.pages.forEach((page) => {
      if (!page?.success || !page.data) return;
      
      if (Array.isArray(page.data)) {
        allItems.push(...page.data);
      } else {
        const paginated = page.data as PaginatedResponse<T>;
        allItems.push(...(paginated.content || []));
      }
    });
    
    return allItems;
  }, [data]);

  const paginationInfo = useMemo(() => {
    if (!data?.pages || data.pages.length === 0) {
      return { totalElements: 0, totalPages: 0 };
    }

    const lastPage = data.pages[data.pages.length - 1];
    if (!lastPage?.success || !lastPage.data) {
      return { totalElements: flattenedData.length, totalPages: 1 };
    }

    if (Array.isArray(lastPage.data)) {
      return { totalElements: flattenedData.length, totalPages: 1 };
    }

    const paginated = lastPage.data as PaginatedResponse<T>;
    return {
      totalElements: paginated.totalElements || flattenedData.length,
      totalPages: paginated.totalPages || 1,
    };
  }, [data, flattenedData]);

  return {
    data: flattenedData,
    isLoading,
    error: error as Error | null,
    refetch,
    isFetching,
    isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    fetchNextPage,
    totalElements: paginationInfo.totalElements,
    totalPages: paginationInfo.totalPages,
  };
}
