import { API_ENDPOINTS } from "@/config/api";

import { apiClient } from "./api";

export interface SpecifyVoteTestResponse {
  specifyVoteID: string;
  serviceID?: string;
  serviceType?: string;
  patientId?: string;
  genomeTestId?: string;
  hospitalId?: string;
  doctorId?: string;
  specifyStatus?: string;
  specifyNote?: string;
  rejectReason?: string;
  sendEmailPatient?: boolean;
  embryoNumber?: number;
  samplingSite?: string;
  sampleCollectDate?: string;
  geneticTestResults?: string;
  geneticTestResultsRelationship?: string;
  createdAt?: string;
  patient?: {
    patientId: string;
    patientName: string;
    patientPhone?: string;
    patientDob?: string;
    gender?: string;
    patientEmail?: string;
    patientJob?: string;
    patientContactName?: string;
    patientContactPhone?: string;
    patientAddress?: string;
  };
  genomeTest?: {
    testId: string;
    testName: string;
    testDescription?: string;
    testSample?: string[];
  };
  doctor?: {
    doctorId: string;
    doctorName: string;
  };
  hospital?: {
    hospitalId: string;
    hospitalName: string;
  };
}

export interface SpecifyVoteTestRequest {
  serviceId: string;
  patientId: string;
  genomeTestId: string;
  embryoNumber?: number;
  hospitalId?: string;
  doctorId?: string;
  samplingSite?: string;
  sampleCollectDate?: string;
  geneticTestResults?: string;
  geneticTestResultsRelationship?: string;
  specifyNote?: string;
  sendEmailPatient?: boolean;
}

export const specifyVoteTestService = {
  getAll: async (params?: { page?: number; size?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.append("page", params.page.toString());
    if (params?.size) queryParams.append("size", params.size.toString());
    const url = queryParams.toString()
      ? `${API_ENDPOINTS.SPECIFY_VOTE_TESTS}?${queryParams.toString()}`
      : API_ENDPOINTS.SPECIFY_VOTE_TESTS;
    return apiClient.get<SpecifyVoteTestResponse[]>(url);
  },

  getById: async (id: string) => {
    return apiClient.get<SpecifyVoteTestResponse>(API_ENDPOINTS.SPECIFY_VOTE_TEST_BY_ID(id));
  },

  getByPatientId: async (patientId: string, params?: { page?: number; size?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.append("page", params.page.toString());
    if (params?.size) queryParams.append("size", params.size.toString());
    const url = queryParams.toString()
      ? `${API_ENDPOINTS.SPECIFY_VOTE_TESTS_BY_PATIENT(patientId)}?${queryParams.toString()}`
      : API_ENDPOINTS.SPECIFY_VOTE_TESTS_BY_PATIENT(patientId);
    return apiClient.get<SpecifyVoteTestResponse[]>(url);
  },

  getByStatus: async (status: string, params?: { page?: number; size?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.append("page", params.page.toString());
    if (params?.size) queryParams.append("size", params.size.toString());
    const url = queryParams.toString()
      ? `${API_ENDPOINTS.SPECIFY_VOTE_TESTS_BY_STATUS(status)}?${queryParams.toString()}`
      : API_ENDPOINTS.SPECIFY_VOTE_TESTS_BY_STATUS(status);
    return apiClient.get<SpecifyVoteTestResponse[]>(url);
  },

  create: async (data: SpecifyVoteTestRequest) => {
    return apiClient.post<SpecifyVoteTestResponse>(API_ENDPOINTS.SPECIFY_VOTE_TESTS, data);
  },

  update: async (id: string, data: SpecifyVoteTestRequest) => {
    return apiClient.put<SpecifyVoteTestResponse>(API_ENDPOINTS.SPECIFY_VOTE_TEST_BY_ID(id), data);
  },

  updateStatus: async (id: string, status: string) => {
    return apiClient.patch<SpecifyVoteTestResponse>(
      `${API_ENDPOINTS.SPECIFY_VOTE_TEST_BY_ID(id)}/status?status=${encodeURIComponent(status)}`
    );
  },

  /** PATCH `.../expected-result-date?expectedResultDate=` (ISO-8601) — giống web sau gửi phân tích */
  updateExpectedResultDate: async (id: string, expectedResultDateIso: string) => {
    const q = encodeURIComponent(expectedResultDateIso);
    return apiClient.patch<SpecifyVoteTestResponse>(
      `${API_ENDPOINTS.SPECIFY_VOTE_TEST_BY_ID(id)}/expected-result-date?expectedResultDate=${q}`,
    );
  },

  delete: async (id: string) => {
    return apiClient.delete(API_ENDPOINTS.SPECIFY_VOTE_TEST_BY_ID(id));
  },
};
