import { API_ENDPOINTS } from '@/config/api';

import { apiClient } from './api';

export interface PatientClinicalResponse {
  id?: string;
  patientClinicalId?: string;
  patientId: string;
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

export interface PatientClinicalRequest {
  patientId: string;
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

export const patientClinicalService = {
  getAll: async () => {
    return apiClient.get<PatientClinicalResponse[]>(API_ENDPOINTS.PATIENT_CLINICALS);
  },

  getById: async (id: string) => {
    return apiClient.get<PatientClinicalResponse>(API_ENDPOINTS.PATIENT_CLINICAL_BY_ID(id));
  },

  getByPatientId: async (patientId: string) => {
    return apiClient.get<PatientClinicalResponse>(
      API_ENDPOINTS.PATIENT_CLINICAL_BY_PATIENT_ID(patientId)
    );
  },

  existsByPatientId: async (patientId: string) => {
    return apiClient.get<boolean>(API_ENDPOINTS.PATIENT_CLINICAL_EXISTS_BY_PATIENT_ID(patientId));
  },

  create: async (data: PatientClinicalRequest) => {
    return apiClient.post<PatientClinicalResponse>(API_ENDPOINTS.PATIENT_CLINICALS, data);
  },

  update: async (id: string, data: PatientClinicalRequest) => {
    return apiClient.put<PatientClinicalResponse>(API_ENDPOINTS.PATIENT_CLINICAL_BY_ID(id), data);
  },

  delete: async (id: string) => {
    return apiClient.delete(API_ENDPOINTS.PATIENT_CLINICAL_BY_ID(id));
  },

  addMedical: async (id: string, medical: string) => {
    return apiClient.post<PatientClinicalResponse>(
      `${API_ENDPOINTS.PATIENT_CLINICAL_BY_ID(id)}/medicals?medical=${encodeURIComponent(medical)}`,
      {}
    );
  },

  removeMedical: async (id: string, medical: string) => {
    return apiClient.delete<PatientClinicalResponse>(
      `${API_ENDPOINTS.PATIENT_CLINICAL_BY_ID(id)}/medicals?medical=${encodeURIComponent(medical)}`
    );
  },
};
