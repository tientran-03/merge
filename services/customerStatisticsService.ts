import { API_ENDPOINTS } from "@/config/api";
import { apiClient } from "./api";

export interface OrderStatusCountResponse {
  completedCount: number;
  rejectedCount: number;
  pendingCount: number;
  totalCount: number;
}

export interface MostUsedServiceResponse {
  serviceId: string | null;
  serviceName: string;
  orderCount: number;
}

export interface ServiceUsageResponse {
  serviceId: string | null;
  serviceName: string;
  orderCount: number;
}

export interface CustomerStatisticsResponse {
  year: number;
  orderStatusCount: OrderStatusCountResponse;
  mostUsedService: MostUsedServiceResponse;
  serviceUsages?: ServiceUsageResponse[];
  availableYears: number[];
}

export interface CustomerPaymentHistoryResponse {
  paymentId: string;
  orderId: string | null;
  orderName: string | null;
  paymentAmount: number | null;
  paymentStatus: string | null;
  paymentType: string | null;
  transactionDate: string | null;
}

export const customerStatisticsService = {
  getStatistics: async (year?: number, hospitalId?: number) => {
    const params = new URLSearchParams();
    if (year != null) params.append("year", year.toString());
    if (hospitalId != null) params.append("hospitalId", hospitalId.toString());
    const query = params.toString();
    const url = query ? `${API_ENDPOINTS.CUSTOMER_STATISTICS}?${query}` : API_ENDPOINTS.CUSTOMER_STATISTICS;
    return apiClient.get<CustomerStatisticsResponse>(url);
  },

  getPaymentHistory: async (params?: {
    year?: number;
    month?: number;
    page?: number;
    size?: number;
    hospitalId?: number;
  }) => {
    const search = new URLSearchParams();
    if (params?.year != null) search.append("year", params.year.toString());
    if (params?.month != null) search.append("month", params.month.toString());
    if (params?.page != null) search.append("page", params.page.toString());
    if (params?.size != null) search.append("size", params.size.toString());
    if (params?.hospitalId != null) search.append("hospitalId", params.hospitalId.toString());
    const query = search.toString();
    const url = query ? `${API_ENDPOINTS.CUSTOMER_STATISTICS_PAYMENT_HISTORY}?${query}` : API_ENDPOINTS.CUSTOMER_STATISTICS_PAYMENT_HISTORY;
    return apiClient.get<CustomerPaymentHistoryResponse[]>(url);
  },
};
