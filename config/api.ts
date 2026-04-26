import { Platform } from "react-native";

const getApiBaseUrl = () => {
  if (__DEV__) {
    if (Platform.OS === "android") {
      return "http://10.0.2.2:8080";
    } else if (Platform.OS === "ios") {
      return "https://api.htgenetic.io.vn";
    } else {
      return "https://api.htgenetic.io.vn";
    }
  } else {
    return "https://api.htgenetic.io.vn";
  }
};

export const API_BASE_URL = getApiBaseUrl();

// Log API URL for debugging (only in dev)
if (__DEV__) {
  console.log("🔗 API Base URL:", API_BASE_URL);
  console.log("📱 Platform:", Platform.OS);
}
export const API_ENDPOINTS = {
  LOGIN: "/api/auth/login",
  LOGOUT: "/api/auth/logout",
  ME: "/api/auth/me",

  /** Phiên đăng nhập & thiết bị tin cậy (TrustedDeviceController) */
  DEVICES_TRUSTED: "/api/v1/devices/trusted",
  DEVICES_SESSIONS: "/api/v1/devices/sessions",
  DEVICES_TRUST: "/api/v1/devices/trust",
  DEVICES_TRUSTED_BY_ID: (id: number) => `/api/v1/devices/trusted/${id}`,
  DEVICES_SESSION_LOGOUT: (sessionId: string) =>
    `/api/v1/devices/sessions/${encodeURIComponent(sessionId)}/logout`,
  
  ORDERS: "/api/v1/orders",
  ORDER_BY_ID: (id: string) => `/api/v1/orders/${encodeURIComponent(id)}`,
  /** Khi `orderId` không khớp PK (vd. người dùng nhập mã hiển thị trùng `orderName`) */
  ORDER_BY_NAME: (orderName: string) => `/api/v1/orders/name/${encodeURIComponent(orderName)}`,
  ORDER_BY_SPECIFY_ID: (specifyId: string) => `/api/v1/orders/specify/${specifyId}`,
  ORDER_BY_STATUS: (status: string) => `/api/v1/orders/status/${status}`,
  ORDER_BY_PATIENT_ID: (patientId: string) => `/api/v1/orders/patient/${patientId}`,
  ORDER_SEARCH: "/api/v1/orders/search",
  
  PATIENTS: "/api/v1/patients",
  PATIENT_BY_ID: (id: string) => `/api/v1/patients/${id}`,
  PATIENT_BY_PHONE: (phone: string) => `/api/v1/patients/phone/${phone}`,
  PATIENT_SEARCH: "/api/v1/patients/search/name",
  
  SERVICES: "/api/v1/services",
  SERVICE_BY_ID: (id: string) => `/api/v1/services/${id}`,
  
  SAMPLE_ADDS: "/api/v1/sample-adds",
  SAMPLE_ADD_BY_ID: (id: string) => `/api/v1/sample-adds/${id}`,
  SAMPLE_ADD_BY_ORDER: (orderId: string) => `/api/v1/sample-adds/order/${orderId}`,

  /** Cấu hình giá dịch vụ thêm mẫu (SampleAddServiceController) */
  SAMPLE_ADD_SERVICES: "/api/v1/sample-add-services",
  SAMPLE_ADD_SERVICE_BY_ID: (id: string) => `/api/v1/sample-add-services/${id}`,

  USERS: "/api/v1/user/list",
  USER_CREATE: "/api/v1/user/create",
  USER_INFO: "/api/v1/user/info",
  USER_PROFILE: "/api/v1/user/profile",
  USER_BLOCK: "/api/v1/user/block",
  USER_UNBLOCK: "/api/v1/user/unblock",
  USER_COUNT_BY_ROLE: (role: string) => `/api/v1/count/users/${role}`,

  CUSTOMERS: "/api/v1/customers",
  CUSTOMER_BY_ID: (id: string) => `/api/v1/customers/${id}`,

  DOCTORS: "/api/v1/doctors",
  DOCTOR_BY_ID: (id: string) => `/api/v1/doctors/${id}`,
  HOSPITAL_STAFFS: "/api/v1/hospital-staff",
  HOSPITAL_STAFF_BY_ID: (id: string) => `/api/v1/hospital-staff/${id}`,
  HOSPITAL_STAFF_BY_HOSPITAL_ID: (hospitalId: string) => `/api/v1/hospital-staff/hospital/${hospitalId}`,
  
  BARCODES: "/api/v1/barcodes",
  BARCODE_BY_ID: (id: string) => `/api/v1/barcodes/${id}`,
  BARCODES_BY_STATUS: (status: string) => `/api/v1/barcodes/status/${status}`,
  
  SPECIFY_VOTE_TESTS: "/api/v1/specify-vote-tests",
  SPECIFY_VOTE_TEST_BY_ID: (id: string) => `/api/v1/specify-vote-tests/${id}`,
  SPECIFY_VOTE_TESTS_BY_STATUS: (status: string) => `/api/v1/specify-vote-tests/status/${status}`,
  SPECIFY_VOTE_TESTS_BY_PATIENT: (patientId: string) => `/api/v1/specify-vote-tests/patient/${patientId}`,
  
  GENOME_TESTS: "/api/v1/genome-tests",
  GENOME_TEST_BY_ID: (id: string) => `/api/v1/genome-tests/${id}`,
  GENOME_TESTS_BY_SERVICE: (serviceId: string) => `/api/v1/genome-tests/service/${serviceId}`,

  PATIENT_CLINICALS: "/api/v1/patient-clinicals",
  PATIENT_CLINICAL_BY_ID: (id: string) => `/api/v1/patient-clinicals/${id}`,
  PATIENT_CLINICAL_BY_PATIENT_ID: (patientId: string) => `/api/v1/patient-clinicals/patient/${patientId}`,
  PATIENT_CLINICAL_EXISTS_BY_PATIENT_ID: (patientId: string) => `/api/v1/patient-clinicals/exists/patient/${patientId}`,
  
  REPRODUCTION_SERVICES: "/api/v1/reproduction-services",
  EMBRYO_SERVICES: "/api/v1/embryo-services",
  DISEASE_SERVICES: "/api/v1/disease-services",
  
  PATIENT_METADATA: "/api/v1/patient-metadata",
  PATIENT_METADATA_BY_ID: (labcode: string) => `/api/v1/patient-metadata/${labcode}`,
  PATIENT_METADATA_BY_PATIENT_ID: (patientId: string) => `/api/v1/patient-metadata/patient/${patientId}`,
  PATIENT_METADATA_BY_SPECIFY_ID: (specifyId: string) => `/api/v1/patient-metadata/specify/${specifyId}`,

  PATIENT_APPENDICES: "/api/v1/patient-appendices",
  PATIENT_TEST_RESULTS: "/api/v1/patient-test-results",
  
  NOTIFICATIONS: "/api/v1/notifications",
  NOTIFICATION_REGISTER_TOKEN: "/api/v1/notifications/register-token",

  HOSPITALS: "/api/v1/hospitals",
  HOSPITAL_BY_ID: (id: string | number) => `/api/v1/hospitals/${id}`,
  HOSPITALS_SEARCH: "/api/v1/hospitals/search",
  
  SYSTEM_LOGS: "/api/v1/logs",
  SYSTEM_LOGS_HEALTH: "/api/v1/logs/health",
  SYSTEM_LOGS_QUERY: "/api/v1/logs/query",
  SYSTEM_LOGS_STATISTICS: "/api/v1/logs/statistics",
  
  AUDIT_LOGS: "/api/v1/audit/logs",
  AUDIT_LOGS_STATISTICS: "/api/v1/audit/statistics",
  
  SECURITY_LOGS: "/api/v1/security/logs",
  SECURITY_LOGS_ALERTS: "/api/v1/security/alerts",
  SECURITY_LOGS_STATISTICS: "/api/v1/security/statistics",
  SECURITY_LOGS_SUSPICIOUS_IPS: "/api/v1/security/suspicious-ips",
  
  METRICS_HEALTH: "/api/v1/metrics/health",
  METRICS_HEALTH_DATABASE: "/api/v1/metrics/health/database",
  METRICS_HEALTH_REDIS: "/api/v1/metrics/health/redis",
  METRICS_HEALTH_JVM: "/api/v1/metrics/health/jvm",
  METRICS_HEALTH_DISK: "/api/v1/metrics/health/disk",
  METRICS_OVERVIEW: "/api/v1/metrics/overview",
  METRICS_HTTP: "/api/v1/metrics/http",
  METRICS_JVM: "/api/v1/metrics/jvm",
  METRICS_DATABASE: "/api/v1/metrics/database",
  
  STATISTICS_REVENUE: "/api/v1/statistics/revenue",
  STATISTICS_PAYMENT_HISTORY: "/api/v1/statistics/payment-history",
  STATISTICS_SERVICES: "/api/v1/statistics/services",
  STATISTICS_HOSPITALS: "/api/v1/statistics/hospitals",
  
  ROLES: "/api/v1/roles",
  ROLE_BY_ID: (id: string) => `/api/v1/roles/${id}`,
  ROLE_BY_NAME: (name: string) => `/api/v1/roles/name/${name}`,
  
  PERMISSIONS: "/api/v1/permissions",
  PERMISSION_BY_ID: (id: string) => `/api/v1/permissions/${id}`,
  
  ROLE_PERMISSIONS: "/api/v1/role-permissions",
  ROLE_PERMISSION_BY_ID: (id: string) => `/api/v1/role-permissions/${id}`,
  ROLE_PERMISSIONS_BY_ROLE_ID: (roleId: string) => `/api/v1/role-permissions/role/${roleId}`,
  ROLE_PERMISSIONS_BY_ROLE_NAME: (roleName: string) => `/api/v1/role-permissions/role-name/${roleName}`,
  ROLE_PERMISSIONS_BY_PERMISSION_ID: (permissionId: string) => `/api/v1/role-permissions/permission/${permissionId}`,
  ROLE_PERMISSION_DELETE_BY_ROLE_AND_PERMISSION: (roleId: string, permissionId: string) => `/api/v1/role-permissions/role/${roleId}/permission/${permissionId}`,
  ROLE_PERMISSIONS_DELETE_ALL_FOR_ROLE: (roleId: string) => `/api/v1/role-permissions/role/${roleId}`,
  
  SYSTEM_CONFIGS: "/api/v1/admin/system-configs",
  SYSTEM_CONFIG_BY_ID: (id: string) => `/api/v1/admin/system-configs/${id}`,
  SYSTEM_CONFIG_METADATA: (configName: string) => `/api/v1/admin/system-configs/metadata/${configName}`,
  SYSTEM_CONFIG_NAMES: "/api/v1/admin/system-configs/names",
  SYSTEM_CONFIG_TEST: (configName: string) => `/api/v1/admin/system-configs/test/${configName}`,
  SYSTEM_CONFIG_CACHE_CLEAR: "/api/v1/admin/system-configs/cache/clear-all",
  SYSTEM_CONFIG_CACHE_INVALIDATE: (configName: string) => `/api/v1/admin/system-configs/cache/${configName}`,
};
