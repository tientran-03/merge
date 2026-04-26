
export const MINIO_API_BASE = 'https://api.htgen.io.vn/api/minio';

export function buildDownloadReportUrl(params: {
  hospitalName: string;
  patientName: string;
  phoneNumber: string;
  labcode: string;
}): string {
  const { hospitalName, patientName, phoneNumber, labcode } = params;
  return (
    `${MINIO_API_BASE}/download-report?` +
    `hospitalName=${encodeURIComponent(hospitalName)}` +
    `&patientName=${encodeURIComponent(patientName)}` +
    `&phoneNumber=${encodeURIComponent(phoneNumber)}` +
    `&labcode=${encodeURIComponent(labcode)}`
  );
}
