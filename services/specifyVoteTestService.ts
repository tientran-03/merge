import { API_ENDPOINTS } from '@/config/api';

import { apiClient, type ApiResponse } from './api';

export interface ReproductionServiceNested {
  id: string;
  serviceId: string;
  serviceType?: string;
  patientId: string;
  patientName?: string;
  fetusesNumber?: number;
  fetusesWeek?: number;
  fetusesDay?: number;
  ultrasoundDay?: string;
  headRumpLength?: number;
  neckLength?: number;
  combinedTestResult?: string;
  ultrasoundResult?: string;
  createdAt?: string;
}
export interface EmbryoServiceNested {
  id: string;
  serviceId: string;
  serviceType?: string;
  patientId: string;
  patientName?: string;
  biospy?: string;
  biospyDate?: string;
  cellContainingSolution?: string;
  embryoCreate?: number;
  embryoStatus?: string;
  morphologicalAssessment?: string;
  cellNucleus?: boolean;
  negativeControl?: string;
  createdAt?: string;
}

export interface DiseaseServiceNested {
  id: string;
  serviceId: string;
  serviceType?: string;
  patientId: string;
  patientName?: string;
  symptom?: string;
  diagnose?: string;
  diagnoseImage?: string;
  testRelated?: string;
  treatmentMethods?: string;
  treatmentTimeDay?: number;
  drugResistance?: string;
  relapse?: string;
  createdAt?: string;
}

export interface PatientClinicalNested {
  id?: string;
  patientId?: string;
  patientName?: string;
  familyHistory?: string;
  patientHistory?: string;
  patientHeight?: number;
  patientWeight?: number;
  medicalHistory?: string;
  medicalUsing?: string[];
  chronicDisease?: string;
  toxicExposure?: string;
  acuteDisease?: string;
}
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
  expectedResultDate?: string;
  createdAt?: string;
  reproductionService?: ReproductionServiceNested;
  embryoService?: EmbryoServiceNested;
  diseaseService?: DiseaseServiceNested;
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
    hospitalId?: string;
  };
  genomeTest?: {
    testId: string;
    testName: string;
    testDescription?: string;
    code?: string;
    testSample?: string[];
    finalPrice?: number;
  };
  doctor?: {
    doctorId: string;
    doctorName: string;
    doctorDegree?: string;
    doctorSpecialized?: string;
    doctorPhone?: string;
    doctorEmail?: string;
  };
  hospital?: {
    hospitalId: number;
    hospitalName: string;
  };
  patientClinical?: PatientClinicalNested;
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

export interface SpecifyVoteTestPage {
  content: SpecifyVoteTestResponse[];
  totalElements?: number;
  totalPages?: number;
  size?: number;
  number?: number;
}

export const specifyVoteTestService = {
  getAll: async (params?: { page?: number; size?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.append('page', params.page.toString());
    if (params?.size) queryParams.append('size', params.size.toString());
    const url = queryParams.toString()
      ? `${API_ENDPOINTS.SPECIFY_VOTE_TESTS}?${queryParams.toString()}`
      : API_ENDPOINTS.SPECIFY_VOTE_TESTS;
    return apiClient.get<SpecifyVoteTestResponse[]>(url);
  },

  getAllPaged: async (params?: { page?: number; size?: number; sort?: string }) => {
    const queryParams = new URLSearchParams();
    queryParams.set('page', String(params?.page ?? 0));
    queryParams.set('size', String(params?.size ?? 10));
    queryParams.set('sort', params?.sort ?? 'createdAt,desc');
    const url = `${API_ENDPOINTS.SPECIFY_VOTE_TESTS}/paged?${queryParams.toString()}`;
    return apiClient.get<SpecifyVoteTestPage>(url);
  },

  getAllAggregatedForStaff: async (): Promise<ApiResponse<SpecifyVoteTestResponse[]>> => {
    const pageSize = 100;
    let page = 0;
    const all: SpecifyVoteTestResponse[] = [];
    const sort = 'createdAt,desc';
    for (let guard = 0; guard < 200; guard++) {
      const res = await specifyVoteTestService.getAllPaged({ page, size: pageSize, sort });
      if (!res.success) {
        return { success: false, error: res.error ?? 'Không thể tải phiếu xét nghiệm' };
      }
      const body = res.data as SpecifyVoteTestPage | undefined;
      if (!body || !Array.isArray(body.content)) {
        return { success: false, error: 'Định dạng phản hồi không hợp lệ' };
      }
      all.push(...body.content);
      const totalPages = Math.max(1, body.totalPages ?? 1);
      if (page >= totalPages - 1 || body.content.length < pageSize) break;
      page += 1;
    }
    return { success: true, data: all };
  },

  getById: async (id: string) => {
    return apiClient.get<SpecifyVoteTestResponse>(API_ENDPOINTS.SPECIFY_VOTE_TEST_BY_ID(id));
  },

  getByHospitalId: async (hospitalId: string, params?: { page?: number; size?: number }) => {
    if (!hospitalId) {
      return { success: false, error: 'Hospital ID is required', data: [] };
    }
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.append('page', params.page.toString());
    if (params?.size) queryParams.append('size', params.size.toString());
    const url = queryParams.toString()
      ? `${API_ENDPOINTS.SPECIFY_VOTE_TESTS_BY_HOSPITAL(hospitalId)}?${queryParams.toString()}`
      : API_ENDPOINTS.SPECIFY_VOTE_TESTS_BY_HOSPITAL(hospitalId);
    return apiClient.get<SpecifyVoteTestResponse[]>(url);
  },

  getByHospitalIdPaged: async (
    hospitalId: string,
    params?: { page?: number; size?: number; sort?: string }
  ) => {
    if (!hospitalId) {
      return {
        success: false,
        error: 'Hospital ID is required',
        data: { content: [], totalElements: 0 },
      };
    }
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.append('page', params.page.toString());
    if (params?.size) queryParams.append('size', params.size.toString());
    if (params?.sort) queryParams.append('sort', params.sort);
    const url = `${API_ENDPOINTS.SPECIFY_VOTE_TESTS_BY_HOSPITAL_PAGED(hospitalId)}?${queryParams.toString()}`;
    return apiClient.get<{ content: SpecifyVoteTestResponse[]; totalElements: number }>(url);
  },

  getByPatientId: async (patientId: string, params?: { page?: number; size?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.append('page', params.page.toString());
    if (params?.size) queryParams.append('size', params.size.toString());
    const url = queryParams.toString()
      ? `${API_ENDPOINTS.SPECIFY_VOTE_TESTS_BY_PATIENT(patientId)}?${queryParams.toString()}`
      : API_ENDPOINTS.SPECIFY_VOTE_TESTS_BY_PATIENT(patientId);
    return apiClient.get<SpecifyVoteTestResponse[]>(url);
  },

  getByStatus: async (status: string, params?: { page?: number; size?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page !== undefined) queryParams.append('page', params.page.toString());
    if (params?.size) queryParams.append('size', params.size.toString());
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

  reject: async (id: string, rejectReason: string) => {
    return apiClient.patch<SpecifyVoteTestResponse>(
      `${API_ENDPOINTS.SPECIFY_VOTE_TEST_BY_ID(id)}/reject`,
      { rejectReason }
    );
  },

  updateExpectedResultDate: async (id: string, expectedResultDate: string) => {
    return apiClient.patch<SpecifyVoteTestResponse>(
      `${API_ENDPOINTS.SPECIFY_VOTE_TEST_BY_ID(id)}/expected-result-date?expectedResultDate=${encodeURIComponent(expectedResultDate)}`
    );
  },

  delete: async (id: string) => {
    return apiClient.delete(API_ENDPOINTS.SPECIFY_VOTE_TEST_BY_ID(id));
  },
};
