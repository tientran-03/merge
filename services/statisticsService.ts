import { API_ENDPOINTS } from "@/config/api";
import { apiClient } from "./api";

export interface MonthlyRevenueResponse {
  month: number;
  year?: number;
  totalRevenue: number;
  orderCount: number;
}

/** Khớp backend + admin web (pie trạng thái đơn) */
export interface OrderStatusCountResponse {
  completedCount?: number;
  rejectedCount?: number;
  pendingCount?: number;
  totalCount?: number;
}

export interface RevenueStatisticsResponse {
  year?: number;
  monthlyRevenue?: MonthlyRevenueResponse[];
  monthlyRevenues?: MonthlyRevenueResponse[];
  totalYearRevenue?: number;
  totalRevenue?: number;
  totalYearOrders?: number;
  totalOrders?: number;
  orderStatusCount?: OrderStatusCountResponse;
  orderStatusCounts?: { status: string; count: number }[];
  availableYears?: number[];
}

export interface PaymentHistoryResponse {
  paymentId?: string;
  transactionId?: string | null;
  transactionDate?: string | null;
  amountIn?: number | null;
  paymentStatus?: string | null;
  paymentType?: string | null;
  bankBrandName?: string | null;
  orderId?: string | null;
  orderName?: string | null;
  hospitalName?: string | null;
  serviceName?: string | null;
  genomeTestName?: string | null;
}

export interface ServiceOrderCountResponse {
  serviceId?: string;
  serviceName: string;
  orderCount: number;
}

export interface ServiceRevenueResponse {
  serviceId?: string;
  serviceName: string;
  totalRevenue: number;
  orderCount?: number;
}

export interface HospitalServiceUsageResponse {
  serviceId?: string;
  serviceName: string;
  hospitalId?: string;
  hospitalName: string;
  usageCount: number;
}

export interface GenomeTestByHospitalResponse {
  testId?: string;
  testName: string;
  hospitalId?: string;
  hospitalName: string;
  testCount: number;
}

export interface SampleAddStatisticsResponse {
  totalSampleAdds?: number;
  forwardAnalysisCount?: number;
  acceptedCount?: number;
  rejectedCount?: number;
  initiationCount?: number;
}

export interface SampleAddRevenueResponse {
  sampleName?: string;
  price?: number;
  finalPrice?: number;
  orderCount?: number;
  totalRevenue: number;
}

export interface ServiceStatisticsResponse {
  serviceOrderCounts: ServiceOrderCountResponse[];
  serviceRevenues: ServiceRevenueResponse[];
  hospitalServiceUsages?: HospitalServiceUsageResponse[];
  genomeTestByHospitals?: GenomeTestByHospitalResponse[];
  sampleAddStatistics?: SampleAddStatisticsResponse;
  sampleAddRevenues?: SampleAddRevenueResponse[];
}

export interface TopHospitalRevenueResponse {
  hospitalId: string;
  hospitalName: string;
  serviceRevenue?: number;
  sampleAddRevenue?: number;
  totalRevenue: number;
  orderCount: number;
  sampleAddCount?: number;
  rank?: number;
}

export interface HospitalPaymentSummaryResponse {
  hospitalId: string;
  hospitalName: string;
  serviceUsageCount?: number;
  serviceRevenue?: number;
  sampleAddRevenue?: number;
  totalRevenue: number;
  sampleAddCount?: number;
  mostUsedServiceId?: string | null;
  mostUsedServiceName?: string | null;
  mostUsedGenomeTestId?: string | null;
  mostUsedGenomeTestName?: string | null;
}

export interface HospitalStatisticsResponse {
  topHospitalsByRevenue: TopHospitalRevenueResponse[];
  hospitalPaymentSummaries: HospitalPaymentSummaryResponse[];
}

export const statisticsService = {
  getRevenueStatistics: async (year?: number) => {
    const url = year
      ? `${API_ENDPOINTS.STATISTICS_REVENUE}?year=${year}`
      : API_ENDPOINTS.STATISTICS_REVENUE;
    return apiClient.get<RevenueStatisticsResponse>(url);
  },

  getPaymentHistory: async (params?: {
    year?: number;
    month?: number;
    page?: number;
    size?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.year !== undefined) queryParams.append("year", params.year.toString());
    if (params?.month !== undefined) queryParams.append("month", params.month.toString());
    if (params?.page !== undefined) queryParams.append("page", params.page.toString());
    if (params?.size !== undefined) queryParams.append("size", params.size.toString());

    const url = queryParams.toString()
      ? `${API_ENDPOINTS.STATISTICS_PAYMENT_HISTORY}?${queryParams.toString()}`
      : API_ENDPOINTS.STATISTICS_PAYMENT_HISTORY;
    return apiClient.get<PaymentHistoryResponse[]>(url);
  },

  getServiceStatistics: async () => {
    return apiClient.get<ServiceStatisticsResponse>(API_ENDPOINTS.STATISTICS_SERVICES);
  },

  getHospitalStatistics: async () => {
    return apiClient.get<HospitalStatisticsResponse>(API_ENDPOINTS.STATISTICS_HOSPITALS);
  },
};
