import { API_ENDPOINTS } from '@/config/api';

import { apiClient } from './api';

export interface MonthlyRevenueResponse {
  month: number;
  year: number;
  totalRevenue: number;
  orderCount: number;
}

export interface OrderStatusCountResponse {
  completedCount: number;
  rejectedCount: number;
  pendingCount: number;
  totalCount: number;
}

export interface RevenueStatisticsResponse {
  year: number;
  totalYearRevenue: number;
  totalYearOrders: number;
  monthlyRevenue: MonthlyRevenueResponse[];
  orderStatusCount: OrderStatusCountResponse;
  availableYears: number[];
}

export interface PaymentHistoryResponse {
  paymentId: string;
  transactionId: string | null;
  transactionDate: string | null;
  amountIn: number | null;
  paymentStatus: string | null;
  paymentType: string | null;
  bankBrandName: string | null;
  orderId: string | null;
  orderName: string | null;
  hospitalName: string | null;
  serviceName: string | null;
  genomeTestName: string | null;
}

export interface ServiceOrderCountResponse {
  serviceId: string;
  serviceName: string;
  orderCount: number;
}

export interface ServiceRevenueResponse {
  serviceId: string;
  serviceName: string;
  totalRevenue: number;
  orderCount: number;
}

export interface HospitalServiceUsageResponse {
  serviceId: string;
  serviceName: string;
  hospitalId: string;
  hospitalName: string;
  usageCount: number;
}

export interface GenomeTestByHospitalResponse {
  testId: string;
  testName: string;
  hospitalId: string;
  hospitalName: string;
  testCount: number;
}

export interface SampleAddStatisticsResponse {
  totalSampleAdds: number;
  forwardAnalysisCount: number;
  acceptedCount: number;
  rejectedCount: number;
  initiationCount: number;
}

export interface SampleAddRevenueResponse {
  sampleName: string;
  price: number;
  finalPrice: number;
  orderCount: number;
  totalRevenue: number;
}

export interface ServiceStatisticsResponse {
  serviceOrderCounts: ServiceOrderCountResponse[];
  serviceRevenues: ServiceRevenueResponse[];
  hospitalServiceUsages: HospitalServiceUsageResponse[];
  genomeTestByHospitals: GenomeTestByHospitalResponse[];
  sampleAddStatistics: SampleAddStatisticsResponse;
  sampleAddRevenues: SampleAddRevenueResponse[];
}

export interface TopHospitalRevenueResponse {
  hospitalId: string;
  hospitalName: string;
  serviceRevenue: number;
  sampleAddRevenue: number;
  totalRevenue: number;
  orderCount: number;
  sampleAddCount: number;
  rank: number;
}

export interface HospitalPaymentSummaryResponse {
  hospitalId: string;
  hospitalName: string;
  serviceUsageCount: number;
  serviceRevenue: number;
  sampleAddRevenue: number;
  totalRevenue: number;
  sampleAddCount: number;
  mostUsedServiceId: string | null;
  mostUsedServiceName: string | null;
  mostUsedGenomeTestId: string | null;
  mostUsedGenomeTestName: string | null;
}

export interface HospitalStatisticsResponse {
  topHospitalsByRevenue: TopHospitalRevenueResponse[];
  hospitalPaymentSummaries: HospitalPaymentSummaryResponse[];
}

function withQuery(
  base: string,
  params: Record<string, string | number | undefined | null>
): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    search.append(k, String(v));
  });
  const q = search.toString();
  return q ? `${base}?${q}` : base;
}

export const statisticsService = {
  getRevenueStatistics: (year?: number) => {
    const url = withQuery(API_ENDPOINTS.STATISTICS_REVENUE, { year });
    return apiClient.get<RevenueStatisticsResponse>(url);
  },

  getPaymentHistory: (params?: { year?: number; month?: number; page?: number; size?: number }) => {
    const url = withQuery(API_ENDPOINTS.STATISTICS_PAYMENT_HISTORY, {
      year: params?.year,
      month: params?.month,
      page: params?.page,
      size: params?.size,
    });
    return apiClient.get<PaymentHistoryResponse[]>(url);
  },

  getServiceStatistics: () =>
    apiClient.get<ServiceStatisticsResponse>(API_ENDPOINTS.STATISTICS_SERVICES),

  getHospitalStatistics: () =>
    apiClient.get<HospitalStatisticsResponse>(API_ENDPOINTS.STATISTICS_HOSPITALS),
};
