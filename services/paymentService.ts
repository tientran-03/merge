import { apiClient, ApiResponse } from "./api";

// ============ Request Types ============

export interface InitiatePaymentRequest {
  orderId: string;
  amount: number;
  description?: string;
  /** Thanh toán cho mẫu bổ sung — backend gắn payment với sample add */
  sampleAddId?: string;
  returnUrl: string;
  cancelUrl: string;
}

// ============ Response Types ============

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
  paymentStatus: "PENDING" | "COMPLETED" | "FAILED" | "UNPAID";
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
  paymentStatus: "PENDING" | "COMPLETED" | "FAILED" | "UNPAID";
  paymentType: string | null;
  paymentAmount: number | null;
  hasPaymentRecord: boolean;
  transactionId?: string;
  amountIn?: number;
  transactionDate?: string;
}

/** GET /api/payment/check-sample-add-status/{sampleAddId} */
export interface CheckSampleAddPaymentStatusResponse {
  sampleAddId: string;
  orderId: string;
  paymentStatus: string;
  hasPaymentRecord: boolean;
  transactionId?: string;
  amountIn?: number;
  transactionDate?: string;
}

// ============ API Endpoints ============

const PAYMENT_ENDPOINTS = {
  CONFIG: "/api/payment/config",
  INITIATE: "/api/payment/initiate",
  CANCEL: (paymentId: string) => `/api/payment/${paymentId}/cancel`,
  CHECK_ORDER_STATUS: (orderId: string) => `/api/payment/check-order-status/${orderId}`,
  CHECK_SAMPLE_ADD_STATUS: (sampleAddId: string) =>
    `/api/payment/check-sample-add-status/${encodeURIComponent(sampleAddId)}`,
};

// ============ API Service ============

export const paymentService = {
  /**
   * Lấy cấu hình thanh toán Sepay (thông tin ngân hàng)
   */
  getPaymentConfig: async (): Promise<ApiResponse<SepayPaymentConfigResponse>> => {
    return apiClient.get<SepayPaymentConfigResponse>(PAYMENT_ENDPOINTS.CONFIG);
  },

  /**
   * Khởi tạo thanh toán
   * - Tạo payment record với status PENDING
   * - Trả về QR code URL để hiển thị
   * - Frontend sẽ poll checkOrderPaymentStatus để biết kết quả
   */
  initiatePayment: async (
    payload: InitiatePaymentRequest
  ): Promise<ApiResponse<InitiatePaymentResponse>> => {
    return apiClient.post<InitiatePaymentResponse>(PAYMENT_ENDPOINTS.INITIATE, payload);
  },

  /**
   * Hủy thanh toán đang PENDING
   */
  cancelPayment: async (paymentId: string): Promise<ApiResponse<void>> => {
    return apiClient.post<void>(PAYMENT_ENDPOINTS.CANCEL(paymentId), {});
  },

  /**
   * Kiểm tra trạng thái thanh toán của order
   * Dùng cho polling sau khi hiển thị QR - khi webhook từ Sepay cập nhật status
   */
  checkOrderPaymentStatus: async (
    orderId: string
  ): Promise<ApiResponse<CheckOrderPaymentStatusResponse>> => {
    return apiClient.get<CheckOrderPaymentStatusResponse>(
      PAYMENT_ENDPOINTS.CHECK_ORDER_STATUS(orderId)
    );
  },

  /**
   * Polling trạng thái thanh toán khi thanh toán online cho mẫu bổ sung (có sampleAddId trên payment).
   */
  checkSampleAddPaymentStatus: async (
    sampleAddId: string
  ): Promise<ApiResponse<CheckSampleAddPaymentStatusResponse>> => {
    return apiClient.get<CheckSampleAddPaymentStatusResponse>(
      PAYMENT_ENDPOINTS.CHECK_SAMPLE_ADD_STATUS(sampleAddId)
    );
  },
};
