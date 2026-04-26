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

export function getApiResponseSingle<T>(
  response: unknown,
): T | undefined {
  if (isApiResponse<T>(response) && response.success) {
    return response.data;
  }
  return undefined;
}
export function isApiSuccess(response: unknown): boolean {
  return isApiResponse(response) && response.success === true;
}

export function getApiErrorMessage(response: unknown, defaultMessage = 'Lỗi không xác định'): string {
  if (isApiResponse(response)) {
    return response.error ?? defaultMessage;
  }
  return defaultMessage;
}
