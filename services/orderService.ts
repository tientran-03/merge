import { API_ENDPOINTS } from "@/config/api";

import { apiClient } from "./api";

export interface PatientMetadataResponse {
  labcode: string;
  specifyId?: string;
  patientId?: string;
  sampleName?: string;
  status?: string;
}

export interface SpecifyPatientBrief {
  patientId?: string;
  patientName?: string;
  patientPhone?: string;
}

/** Một số field lồng từ GET order / GET specify (Jackson) — dùng hydrate form sửa đơn */
export interface SpecifyVoteTestResponse {
  specifyVoteID: string;
  serviceID?: string;
  serviceType?: string;
  patientId?: string;
  /** Một số API trả kèm object bệnh nhân lồng trong chỉ định */
  patient?: SpecifyPatientBrief;
  /** Chi tiết xét nghiệm lồng (khi có) */
  genomeTest?: Record<string, unknown>;
  patientClinical?: Record<string, unknown>;
  genomeTestId?: string;
  hospitalId?: string;
  /** Một số API trả kèm bệnh viện lồng (cần cho MinIO download-report trên mobile) */
  hospital?: { hospitalId?: string; hospitalName?: string };
  doctorId?: string;
  samplingSite?: string;
  sampleCollectDate?: string;
  geneticTestResults?: string;
  geneticTestResultsRelationship?: string;
  specifyStatus?: string;
  specifyNote?: string;
  sendEmailPatient?: boolean;
  createdAt?: string;
  embryoNumber?: number;
}

export interface OrderResponse {
  orderId: string;
  orderName: string;
  customerId?: string;
  customerName?: string;
  /** Người thu tiền (STAFF) — khớp backend OrderResponse.staffId */
  staffId?: string;
  staffName?: string;
  sampleCollectorId?: string;
  sampleCollectorName?: string;
  /** Một số payload GET đơn có thể lồng object thay vì chỉ id/tên phẳng */
  sampleCollector?: { staffId?: string; staffName?: string };
  staffAnalystId?: string;
  staffAnalystName?: string;
  barcodeId?: string;
  specifyId?: SpecifyVoteTestResponse;
  specifyVoteImagePath?: string;
  orderStatus: string;
  orderNote?: string;
  patientMetadata?: PatientMetadataResponse[];
  patientMetadataCount?: number;
  paymentStatus?: string;
  paymentType?: string;
  paymentAmount?: number;
  invoiceLink?: string;
  jobCount?: number;
  jobIds?: string[];
  createdAt?: string;
}

/**
 * Lấy id/tên nhân viên thu mẫu từ object đơn (field phẳng hoặc lồng) — dùng hydrate FormSelect.
 */
export function pickOrderSampleCollector(order: unknown): { id: string; name: string } {
  if (order == null || typeof order !== "object") return { id: "", name: "" };
  const o = order as Record<string, unknown>;
  const flatId = String(o.sampleCollectorId ?? "").trim();
  const flatName = String(o.sampleCollectorName ?? "").trim();
  const nested = o.sampleCollector;
  let nid = "";
  let nname = "";
  if (nested != null && typeof nested === "object") {
    const n = nested as Record<string, unknown>;
    nid = String(n.staffId ?? n.id ?? "").trim();
    nname = String(n.staffName ?? n.name ?? "").trim();
  }
  const id = flatId || nid;
  const name = (flatName || nname).trim();
  return { id, name };
}

export const orderService = {
  getAll: async (params?: { page?: number; size?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.append("page", params.page.toString());
    if (params?.size) queryParams.append("size", params.size.toString());
    const url = queryParams.toString() 
      ? `${API_ENDPOINTS.ORDERS}?${queryParams.toString()}`
      : API_ENDPOINTS.ORDERS;
    return apiClient.get<OrderResponse[]>(url);
  },

  /**
   * Lấy đơn theo PK `orderId`; nếu 404 (ORDER_001 / không tìm thấy đơn) thì thử theo `orderName`
   * (backend `GET /orders/name/{orderName}`) — một số luồng truyền nhầm mã hiển thị.
   */
  getById: async (id: string) => {
    const trimmed = String(id ?? "").trim();
    if (!trimmed) {
      return { success: false as const, error: "Thiếu mã đơn hàng" };
    }
    const byId = await apiClient.get<OrderResponse>(API_ENDPOINTS.ORDER_BY_ID(trimmed));
    if (byId.success && byId.data) {
      return byId;
    }
    const errBlob = `${byId.error || ""} ${byId.message || ""}`.toLowerCase();
    const looksLikeOrderNotFound =
      errBlob.includes("không tìm thấy đơn") ||
      errBlob.includes("order_001") ||
      errBlob.includes("order not found");
    if (!looksLikeOrderNotFound) {
      return byId;
    }
    const byName = await apiClient.get<OrderResponse>(API_ENDPOINTS.ORDER_BY_NAME(trimmed));
    if (byName.success && byName.data) {
      return byName;
    }
    return byId;
  },

  getBySpecifyId: async (specifyId: string) => {
    return apiClient.get<OrderResponse[]>(API_ENDPOINTS.ORDER_BY_SPECIFY_ID(specifyId));
  },

  getByStatus: async (status: string, params?: { page?: number; size?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.append("page", params.page.toString());
    if (params?.size) queryParams.append("size", params.size.toString());
    const url = queryParams.toString()
      ? `${API_ENDPOINTS.ORDER_BY_STATUS(status)}?${queryParams.toString()}`
      : API_ENDPOINTS.ORDER_BY_STATUS(status);
    return apiClient.get<OrderResponse[]>(url);
  },

  getByPatientId: async (patientId: string, params?: { page?: number; size?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.append("page", params.page.toString());
    if (params?.size) queryParams.append("size", params.size.toString());
    const url = queryParams.toString()
      ? `${API_ENDPOINTS.ORDER_BY_PATIENT_ID(patientId)}?${queryParams.toString()}`
      : API_ENDPOINTS.ORDER_BY_PATIENT_ID(patientId);
    return apiClient.get<OrderResponse[]>(url);
  },

  search: async (query: string, params?: { page?: number; size?: number }) => {
    const queryParams = new URLSearchParams();
    queryParams.append("orderName", query);
    if (params?.page !== undefined) queryParams.append("page", params.page.toString());
    if (params?.size) queryParams.append("size", params.size.toString());
    return apiClient.get<OrderResponse[]>(
      `${API_ENDPOINTS.ORDER_SEARCH}?${queryParams.toString()}`
    );
  },

  create: async (data: any) => {
    return apiClient.post<OrderResponse>(API_ENDPOINTS.ORDERS, data);
  },

  update: async (id: string, data: any) => {
    return apiClient.put<OrderResponse>(API_ENDPOINTS.ORDER_BY_ID(id), data);
  },

  /** Giống web `orderApi.updateOrderInvoiceLink` — PATCH `.../invoice-link?invoiceLink=` */
  updateInvoiceLink: async (orderId: string, invoiceLink: string) => {
    const q = encodeURIComponent(invoiceLink);
    return apiClient.patch<OrderResponse>(
      `${API_ENDPOINTS.ORDER_BY_ID(orderId)}/invoice-link?invoiceLink=${q}`,
      undefined
    );
  },

  updateStatus: async (id: string, status: string) => {
    return apiClient.patch<OrderResponse>(
      `${API_ENDPOINTS.ORDER_BY_ID(id)}/status?status=${status}`
    );
  },

  /** Giống web `orderApi.updateResultDate` — PATCH `/orders/{id}/result-date?resultDate=ISO` */
  updateResultDate: async (id: string, resultDateIso: string) => {
    const q = encodeURIComponent(resultDateIso);
    return apiClient.patch<OrderResponse>(
      `${API_ENDPOINTS.ORDER_BY_ID(id)}/result-date?resultDate=${q}`
    );
  },

  reject: async (id: string, rejectReason: string) => {
    return apiClient.patch<OrderResponse>(
      `${API_ENDPOINTS.ORDER_BY_ID(id)}/reject`,
      { rejectReason }
    );
  },

  delete: async (id: string) => {
    return apiClient.delete(API_ENDPOINTS.ORDER_BY_ID(id));
  },
};
