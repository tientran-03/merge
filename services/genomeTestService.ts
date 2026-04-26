import { API_ENDPOINTS } from "@/config/api";

import { apiClient } from "./api";

export interface ServiceEntityResponse {
  serviceId: string;
  name: string;
}

export interface GenomeTestResponse {
  testId: string;
  testName: string;
  testDescription?: string | null;
  code?: string | null;
  testSample?: string[];
  price?: number | null;
  taxRate?: number | null;
  finalPrice?: number | null;
  service?: ServiceEntityResponse;
}

export interface CreateGenomeTestRequest {
  testId: string;
  testName: string;
  testDescription?: string;
  code?: string;
  serviceId?: string;
  price: number;
  taxRate?: number;
  testSample?: string[];
}

export const genomeTestService = {
  getAll: async (params?: { page?: number; size?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.append("page", params.page.toString());
    if (params?.size) queryParams.append("size", params.size.toString());
    const url = queryParams.toString()
      ? `${API_ENDPOINTS.GENOME_TESTS}?${queryParams.toString()}`
      : API_ENDPOINTS.GENOME_TESTS;
    return apiClient.get<GenomeTestResponse[]>(url);
  },

  getByServiceId: async (serviceId: string, params?: { page?: number; size?: number }) => {
    const sid = String(serviceId ?? '').trim();
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.append("page", params.page.toString());
    if (params?.size) queryParams.append("size", params.size.toString());
    const url = queryParams.toString()
      ? `${API_ENDPOINTS.GENOME_TESTS_BY_SERVICE(sid)}?${queryParams.toString()}`
      : API_ENDPOINTS.GENOME_TESTS_BY_SERVICE(sid);
    return apiClient.get<GenomeTestResponse[]>(url);
  },

  getById: async (id: string) => {
    const gid = String(id ?? '').trim();
    return apiClient.get<GenomeTestResponse>(API_ENDPOINTS.GENOME_TEST_BY_ID(gid));
  },

  create: async (data: CreateGenomeTestRequest) => {
    return apiClient.post<GenomeTestResponse>(API_ENDPOINTS.GENOME_TESTS, data);
  },

  update: async (id: string, data: CreateGenomeTestRequest) => {
    const gid = String(id ?? '').trim();
    const isNumericId = /^\d+$/.test(gid);
    // Backend variants:
    // - PATCH /api/v1/genome-tests/{id}
    // - PUT /api/v1/genome-tests/{id}
    // - PUT /api/v1/genome-tests  (body contains testId)
    // Many backends expect internal numeric id in the path. If we only have a testId
    // like "N24004", calling /genome-tests/N24004 may return 404 or even 500 (SYSTEM_003).
    // In that case, try to resolve internal id first.
    if (!isNumericId) {
      try {
        const listRes = await genomeTestService.getAll({ page: 0, size: 1000 });
        const list = (listRes.success && Array.isArray(listRes.data) ? listRes.data : []) as any[];
        const wantedTestId = String(data.testId || gid).trim();
        const found = list.find((t) => String(t?.testId || '').trim() === wantedTestId);
        const internalId = found?.id != null ? String(found.id).trim() : '';
        if (internalId && internalId !== gid && /^\d+$/.test(internalId)) {
          const patchRes = await apiClient.patch<GenomeTestResponse>(
            API_ENDPOINTS.GENOME_TEST_BY_ID(internalId),
            data
          );
          if (patchRes.success) return patchRes;

          const putByInternalRes = await apiClient.put<GenomeTestResponse>(
            API_ENDPOINTS.GENOME_TEST_BY_ID(internalId),
            data
          );
          if (putByInternalRes.success) return putByInternalRes;
        }
      } catch {
        // ignore and continue to legacy behavior
      }
    }

    const patchRes = await apiClient.patch<GenomeTestResponse>(API_ENDPOINTS.GENOME_TEST_BY_ID(gid), data);
    if (patchRes.success) return patchRes;

    const putByIdRes = await apiClient.put<GenomeTestResponse>(API_ENDPOINTS.GENOME_TEST_BY_ID(gid), data);
    if (putByIdRes.success) return putByIdRes;

    const msg = String(putByIdRes.error || patchRes.error || '').toLowerCase();
    if (
      msg.includes('404') ||
      msg.includes('not found') ||
      msg.includes('không tìm thấy') ||
      // Some deployments return a generic 500 for invalid id-in-path.
      msg.includes('system_003') ||
      msg.includes('lỗi hệ thống') ||
      msg.includes('loi he thong')
    ) {
      // Some backends don't update by `testId` in path; they require internal `id`.
      // Try to discover internal id from list endpoint then retry.
      try {
        const listRes = await genomeTestService.getAll({ page: 0, size: 500 });
        const list = (listRes.success && Array.isArray(listRes.data) ? listRes.data : []) as any[];
        const wantedTestId = String(data.testId || gid).trim();
        const found = list.find((t) => String(t?.testId || '').trim() === wantedTestId);
        const internalId = found?.id != null ? String(found.id).trim() : '';
        if (internalId && internalId !== gid) {
          const retry = await apiClient.put<GenomeTestResponse>(
            API_ENDPOINTS.GENOME_TEST_BY_ID(internalId),
            data
          );
          if (retry.success) return retry;
        }
      } catch {
        // ignore and fall back
      }
      // Last resort for older backends.
      return apiClient.put<GenomeTestResponse>(API_ENDPOINTS.GENOME_TESTS, data);
    }
    // Prefer the most informative error (PUT-by-id tends to carry backend validation messages)
    return putByIdRes.success ? putByIdRes : patchRes;
  },

  delete: async (id: string) => {
    return apiClient.delete(API_ENDPOINTS.GENOME_TEST_BY_ID(id));
  },
};
