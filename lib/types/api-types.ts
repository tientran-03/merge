import type { FieldError } from "react-hook-form";

export type FormError = FieldError;

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}

export function isApiResponse<T>(data: unknown): data is ApiResponse<T> {
  return (
    typeof data === "object" &&
    data !== null &&
    "success" in data &&
    typeof (data as ApiResponse).success === "boolean"
  );
}

export function getApiResponseData<T>(
  response: unknown,
  defaultValue: T[] = []
): T[] {
  if (isApiResponse<T[]>(response) && response.success) {
    return response.data ?? defaultValue;
  }
  return defaultValue;
}

/**
 * Safely gets data from an API response with better typing
 * @example
 * const customers = getApiResponseData<CustomerResponse>(customersResponse);
 * const single = getApiResponseSingle<OrderResponse>(orderResponse);
 */
export function getApiResponseSingle<T>(
  response: unknown,
): T | undefined {
  if (isApiResponse<T>(response) && response.success) {
    return response.data;
  }
  return undefined;
}

/**
 * Checks if an API response indicates success
 */
export function isApiSuccess(response: unknown): boolean {
  return isApiResponse(response) && response.success === true;
}

/**
 * Gets error message from an API response
 */
export function getApiErrorMessage(response: unknown, defaultMessage = 'Lỗi không xác định'): string {
  if (isApiResponse(response)) {
    return response.error ?? defaultMessage;
  }
  return defaultMessage;
}
