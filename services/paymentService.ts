import { apiClient, ApiResponse } from './api';

export interface InitiatePaymentRequest {
  orderId: string;
  amount: number;
  description?: string;
  returnUrl: string;
  cancelUrl: string;
  sampleAddId?: string;
}

export interface UpdatePaymentRequest {
  orderId: string;
  transactionId?: string;
  transactionDate?: string;
  amountIn?: number;
  transactionContent?: string;
  paymentStatus?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'UNPAID';
  paymentType?: 'CASH' | 'ONLINE_PAYMENT';
}

export interface InitiatePaymentResponse {
  paymentId: string;
  orderId: string;
  orderName: string;
  transactionContent: string;
  amount: number;
  qrCodeUrl: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  paymentStatus: 'PENDING' | 'COMPLETED' | 'FAILED' | 'UNPAID';
  returnUrl: string;
  cancelUrl: string;
  expiresAt: number;
}

export interface SepayPaymentConfigResponse {
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  template: string;
  qrCodeBaseUrl: string;
}

export interface CheckOrderPaymentStatusResponse {
  orderId: string;
  orderName: string;
  paymentStatus: 'PENDING' | 'COMPLETED' | 'FAILED' | 'UNPAID';
  paymentType: string | null;
  paymentAmount: number | null;
  hasPaymentRecord: boolean;
  transactionId?: string;
  amountIn?: number;
  transactionDate?: string;
}

export interface CheckSampleAddPaymentStatusResponse {
  sampleAddId: string;
  orderId: string;
  paymentStatus: 'PENDING' | 'COMPLETED' | 'FAILED' | 'UNPAID';
  hasPaymentRecord: boolean;
  transactionId?: string;
  amountIn?: number;
  transactionDate?: string;
}

const PAYMENT_ENDPOINTS = {
  CONFIG: '/api/payment/config',
  INITIATE: '/api/payment/initiate',
  UPDATE: (paymentId: string) => `/api/payment/${encodeURIComponent(paymentId)}`,
  CANCEL: (paymentId: string) => `/api/payment/${paymentId}/cancel`,
  CHECK_ORDER_STATUS: (orderId: string) => `/api/payment/check-order-status/${orderId}`,
  CHECK_SAMPLE_ADD_STATUS: (sampleAddId: string) =>
    `/api/payment/check-sample-add-status/${encodeURIComponent(sampleAddId)}`,
};

export const paymentService = {
  getPaymentConfig: async (): Promise<ApiResponse<SepayPaymentConfigResponse>> => {
    return apiClient.get<SepayPaymentConfigResponse>(PAYMENT_ENDPOINTS.CONFIG);
  },
  initiatePayment: async (
    payload: InitiatePaymentRequest
  ): Promise<ApiResponse<InitiatePaymentResponse>> => {
    return apiClient.post<InitiatePaymentResponse>(PAYMENT_ENDPOINTS.INITIATE, payload);
  },

  updatePayment: async (
    paymentId: string,
    payload: UpdatePaymentRequest
  ): Promise<ApiResponse<unknown>> => {
    return apiClient.put(PAYMENT_ENDPOINTS.UPDATE(paymentId), payload);
  },

  cancelPayment: async (paymentId: string): Promise<ApiResponse<void>> => {
    return apiClient.post<void>(PAYMENT_ENDPOINTS.CANCEL(paymentId), {});
  },

  checkOrderPaymentStatus: async (
    orderId: string
  ): Promise<ApiResponse<CheckOrderPaymentStatusResponse>> => {
    return apiClient.get<CheckOrderPaymentStatusResponse>(
      PAYMENT_ENDPOINTS.CHECK_ORDER_STATUS(orderId)
    );
  },

  checkSampleAddPaymentStatus: async (
    sampleAddId: string
  ): Promise<ApiResponse<CheckSampleAddPaymentStatusResponse>> => {
    return apiClient.get<CheckSampleAddPaymentStatusResponse>(
      PAYMENT_ENDPOINTS.CHECK_SAMPLE_ADD_STATUS(sampleAddId)
    );
  },
};
