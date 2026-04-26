import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";

export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number; // current page (0-based)
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
  queryFn: (params: PaginationParams) => Promise<{
    success: boolean;
    data?: PaginatedResponse<T> | T[];
    error?: string;
    message?: string;
  }>;
  defaultPageSize?: number;
  enabled?: boolean;
}

export interface UsePaginatedQueryReturn<T> {
  data: T[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  isFetching: boolean;
  // Pagination info
  currentPage: number;
  totalPages: number;
  totalElements: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  // Pagination actions
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  setPageSize: (size: number) => void;
  /** Đưa về trang đầu (sau khi tạo mới — để bản ghi mới nằm trong trang đang xem). */
  resetToFirstPage: () => void;
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
      if (!response.success) {
        throw new Error(response.error || response.message || "Không tải được dữ liệu");
      }
      if (__DEV__) {
        console.log("🔍 usePaginatedQuery - Raw Response:", {
          success: response.success,
          hasData: !!response.data,
          dataType: typeof response.data,
          isArray: Array.isArray(response.data),
          dataValue: response.data
            ? Array.isArray(response.data)
              ? `Array(${response.data.length})`
              : JSON.stringify(response.data).substring(0, 200)
            : "undefined",
        });
      }
      return response;
    },
    enabled,
    retry: (failureCount, err) => {
      const msg = ((err as Error)?.message || "").toLowerCase();
      const transient =
        msg.includes("timeout") ||
        msg.includes("network") ||
        msg.includes("gateway") ||
        msg.includes("502") ||
        msg.includes("503") ||
        msg.includes("504") ||
        msg.includes("408");
      if (transient) return failureCount < 2;
      return false;
    },
    retryDelay: (attempt) => Math.min(1500 * 2 ** attempt, 8000),
  });

  const paginationInfo = useMemo(() => {
    if (!data?.success || !data.data) {
      if (__DEV__ && data?.success === true && data.data == null) {
        console.log("⚠️ usePaginatedQuery: success but no data payload", { data });
      }
      return {
        items: [] as T[],
        totalPages: 0,
        totalElements: 0,
        currentPage: 0,
        hasNext: false,
        hasPrevious: false,
      };
    }

    // Check if response is paginated
    const responseData = data.data;
    
    if (__DEV__) {
      console.log("📦 usePaginatedQuery: Response data", {
        isArray: Array.isArray(responseData),
        hasContent: (responseData as any)?.content !== undefined,
        keys: typeof responseData === 'object' ? Object.keys(responseData) : [],
        type: typeof responseData,
      });
    }

    if (Array.isArray(responseData)) {
      // Not paginated, return as is
      if (__DEV__) {
        console.log("✅ usePaginatedQuery: Returning array, length:", responseData.length);
      }
      return {
        items: responseData,
        totalPages: 1,
        totalElements: responseData.length,
        currentPage: 0,
        hasNext: false,
        hasPrevious: false,
      };
    }

    // Paginated response
    const paginated = responseData as PaginatedResponse<T>;
    if (__DEV__) {
      console.log("✅ usePaginatedQuery: Returning paginated", {
        contentLength: paginated.content?.length || 0,
        totalPages: paginated.totalPages,
        totalElements: paginated.totalElements,
      });
    }
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

  const resetToFirstPage = () => {
    setCurrentPage(0);
  };

  const nextPage = () => {
    if (paginationInfo.hasNext) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const previousPage = () => {
    if (paginationInfo.hasPrevious) {
      setCurrentPage((prev) => Math.max(0, prev - 1));
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
    resetToFirstPage,
    nextPage,
    previousPage,
    setPageSize: (size: number) => {
      setPageSize(size);
      setCurrentPage(0); // Reset to first page when page size changes
    },
  };
}
