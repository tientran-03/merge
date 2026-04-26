import { EncodingType, writeAsStringAsync } from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import * as XLSX from 'xlsx';

import { diseaseService } from '@/services/diseaseService';
import { embryoService } from '@/services/embryoService';
import type { GenomeTestResponse } from '@/services/genomeTestService';
import {
  patientClinicalService,
  type PatientClinicalRequest,
} from '@/services/patientClinicalService';
import { patientService } from '@/services/patientService';
import { reproductionService } from '@/services/reproductionService';
import type { ServiceEntityResponse } from '@/services/serviceEntityService';
import {
  specifyVoteTestService,
  type SpecifyVoteTestRequest,
} from '@/services/specifyVoteTestService';

export type ServiceGroup = 'reproduction' | 'embryo' | 'disease';

export interface SpecifyExcelRowResult {
  rowIndex: number;
  success: boolean;
  patientName: string;
  testName: string;
  errorMessage?: string;
}

export const SPECIFY_EXCEL_HEADERS: Record<string, string> = {
  patientPhone: 'Số điện thoại BN (*)',
  patientName: 'Họ tên BN (*)',
  patientDob: 'Ngày sinh (yyyy-MM-dd)',
  gender: 'Giới tính (male/female)',
  patientEmail: 'Email BN',
  patientJob: 'Nghề nghiệp',
  patientContactName: 'Tên người liên hệ',
  patientContactPhone: 'SĐT người liên hệ',
  patientAddress: 'Địa chỉ',
  height: 'Chiều cao (cm)',
  weight: 'Cân nặng (kg)',
  patientHistory: 'Tiền sử bệnh nhân',
  familyHistory: 'Tiền sử gia đình',
  medicalHistory: 'Tiền sử y khoa',
  acuteDisease: 'Bệnh cấp tính',
  chronicDisease: 'Bệnh mạn tính',
  medication: 'Thuốc đang dùng (phẩy phân cách)',
  toxicExposure: 'Tiếp xúc độc hại',
  testName: 'Tên xét nghiệm (*)',
  samplingSite: 'Nơi lấy mẫu',
  sampleCollectDate: 'Ngày lấy mẫu (yyyy-MM-dd)',
  geneticTestResults: 'Kết quả XN di truyền',
  geneticTestResultsRelationship: 'Quan hệ kết quả XN',
  specifyNote: 'Ghi chú',
  sendEmailPatient: 'Gửi email (true/false)',
  embryoNumber: 'Số phôi',
  fetusesNumber: 'Số thai',
  fetusesWeek: 'Tuần thai',
  fetusesDay: 'Ngày thai',
  ultrasoundDay: 'Ngày siêu âm (yyyy-MM-dd)',
  headRumpLength: 'Chiều dài đầu mông (mm)',
  neckLength: 'Độ mờ da gáy (mm)',
  combinedTestResult: 'KQ Combined test',
  ultrasoundResult: 'KQ siêu âm',
  biospy: 'Sinh thiết',
  biospyDate: 'Ngày sinh thiết (yyyy-MM-dd)',
  cellContainingSolution: 'Dung dịch chứa tế bào',
  embryoCreate: 'Ngày tạo phôi',
  embryoStatus: 'Trạng thái phôi',
  morphologicalAssessment: 'Đánh giá hình thái',
  cellNucleus: 'Nhân tế bào (true/false)',
  negativeControl: 'Đối chứng âm',
  symptom: 'Triệu chứng',
  diagnose: 'Chẩn đoán',
  diagnoseImage: 'Hình ảnh chẩn đoán',
  testRelated: 'XN liên quan',
  treatmentMethods: 'Phương pháp điều trị',
  treatmentTimeDay: 'Số ngày điều trị',
  drugResistance: 'Kháng thuốc',
  relapse: 'Tái phát',
};

const PATIENT_COLUMNS = [
  'patientPhone',
  'patientName',
  'patientDob',
  'gender',
  'patientEmail',
  'patientJob',
  'patientContactName',
  'patientContactPhone',
  'patientAddress',
];

const CLINICAL_COLUMNS = [
  'height',
  'weight',
  'patientHistory',
  'familyHistory',
  'medicalHistory',
  'acuteDisease',
  'chronicDisease',
  'medication',
  'toxicExposure',
];

const TEST_COLUMNS = [
  'testName',
  'samplingSite',
  'sampleCollectDate',
  'geneticTestResults',
  'geneticTestResultsRelationship',
  'specifyNote',
  'sendEmailPatient',
  'embryoNumber',
];

const REPRODUCTION_COLUMNS = [
  'fetusesNumber',
  'fetusesWeek',
  'fetusesDay',
  'ultrasoundDay',
  'headRumpLength',
  'neckLength',
  'combinedTestResult',
  'ultrasoundResult',
];

const EMBRYO_COLUMNS = [
  'biospy',
  'biospyDate',
  'cellContainingSolution',
  'embryoCreate',
  'embryoStatus',
  'morphologicalAssessment',
  'cellNucleus',
  'negativeControl',
];

const DISEASE_COLUMNS = [
  'symptom',
  'diagnose',
  'diagnoseImage',
  'testRelated',
  'treatmentMethods',
  'treatmentTimeDay',
  'drugResistance',
  'relapse',
];

export const SERVICE_GROUP_LABELS: Record<ServiceGroup, string> = {
  reproduction: 'Sản khoa',
  embryo: 'Phôi',
  disease: 'Bệnh',
};

export function getColumnsForServiceGroup(sg: ServiceGroup): string[] {
  const base = [...PATIENT_COLUMNS, ...CLINICAL_COLUMNS, ...TEST_COLUMNS];
  switch (sg) {
    case 'reproduction':
      return [...base, ...REPRODUCTION_COLUMNS];
    case 'embryo':
      return [...base, ...EMBRYO_COLUMNS];
    case 'disease':
      return [...base, ...DISEASE_COLUMNS];
  }
}

export function getFieldValue(row: Record<string, string>, field: string): string {
  if (row[field] !== undefined && row[field] !== '') return String(row[field]).trim();
  const viHeader = SPECIFY_EXCEL_HEADERS[field];
  if (viHeader && row[viHeader] !== undefined && row[viHeader] !== '')
    return String(row[viHeader]).trim();
  return '';
}

export function generatePatientIdForImport(): string {
  return `PAT-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function resolvePatientIdFromResponse(p: unknown): string {
  if (!p || typeof p !== 'object') return '';
  const o = p as Record<string, unknown>;
  const raw = o.patientId ?? o.id;
  return raw != null && String(raw).trim() !== '' ? String(raw).trim() : '';
}

export function resolveServiceIdForGroup(
  sg: ServiceGroup,
  services: ServiceEntityResponse[]
): string | undefined {
  for (const s of services) {
    const name = (s.name || '').toLowerCase();
    if (sg === 'reproduction' && (name.includes('sinh sản') || name.includes('reproduction'))) {
      return s.serviceId;
    }
    if (sg === 'embryo' && (name.includes('phôi') || name.includes('embryo'))) {
      return s.serviceId;
    }
    if (sg === 'disease' && (name.includes('bệnh lý') || name.includes('disease'))) {
      return s.serviceId;
    }
  }
  return undefined;
}

export function parseExcelBase64(b64: string): Record<string, string>[] {
  const wb = XLSX.read(b64, { type: 'base64' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('File Excel không có dữ liệu');
  return XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, string>[];
}

export function validateSpecifyExcelRows(
  rows: Record<string, string>[]
): { ok: true } | { ok: false; message: string } {
  if (rows.length === 0) return { ok: false, message: 'File Excel không có dữ liệu' };
  const invalid: { idx: number; missing: string[] }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const missing: string[] = [];
    if (!getFieldValue(row, 'patientPhone')) missing.push('Số điện thoại BN');
    if (!getFieldValue(row, 'patientName')) missing.push('Họ tên BN');
    if (!getFieldValue(row, 'testName')) missing.push('Tên xét nghiệm');
    if (missing.length) invalid.push({ idx: i, missing });
  }
  if (invalid.length > 0) {
    const details = invalid
      .slice(0, 5)
      .map(r => `Dòng ${r.idx + 2}: thiếu ${r.missing.join(', ')}`)
      .join('\n');
    return {
      ok: false,
      message: `Có ${invalid.length} dòng thiếu trường bắt buộc:\n${details}${invalid.length > 5 ? `\n... và ${invalid.length - 5} dòng khác` : ''}`,
    };
  }
  return { ok: true };
}

function errMsg(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

async function upsertPatientClinical(patientId: string, clinicalRequest: PatientClinicalRequest) {
  const existing = await patientClinicalService.getByPatientId(patientId);
  if (existing.success && existing.data) {
    const d = existing.data as { id?: string; patientClinicalId?: string };
    const cid = d.id || d.patientClinicalId;
    if (cid) {
      const up = await patientClinicalService.update(cid, clinicalRequest);
      if (!up.success) throw new Error(up.error || 'Không cập nhật được lâm sàng');
    } else {
      const cr = await patientClinicalService.create(clinicalRequest);
      if (!cr.success) throw new Error(cr.error || 'Không tạo được lâm sàng');
    }
  } else {
    const cr = await patientClinicalService.create(clinicalRequest);
    if (!cr.success) throw new Error(cr.error || 'Không tạo được lâm sàng');
  }
}

export interface RunSpecifyExcelImportParams {
  rows: Record<string, string>[];
  selectedServiceGroup: ServiceGroup;
  genomeTests: GenomeTestResponse[];
  serviceId: string;
  hospitalId?: string;
  doctorId?: string;
  onRowComplete?: (partial: SpecifyExcelRowResult[], progressPct: number) => void;
}

export async function runSpecifyExcelImport(
  params: RunSpecifyExcelImportParams
): Promise<SpecifyExcelRowResult[]> {
  const {
    rows,
    selectedServiceGroup,
    genomeTests,
    serviceId,
    hospitalId,
    doctorId,
    onRowComplete,
  } = params;

  const rowResults: SpecifyExcelRowResult[] = [];
  const n = rows.length;

  for (let i = 0; i < n; i++) {
    const row = rows[i];
    const get = (f: string) => getFieldValue(row, f);
    const rowPatientName = get('patientName');
    const rowTestName = get('testName');

    try {
      const genomeTest = genomeTests.find(
        t => t.testName.toLowerCase() === rowTestName.toLowerCase()
      );
      if (!genomeTest) {
        rowResults.push({
          rowIndex: i,
          success: false,
          patientName: rowPatientName,
          testName: rowTestName,
          errorMessage: `Không tìm thấy xét nghiệm "${rowTestName}"`,
        });
        onRowComplete?.(rowResults.slice(), Math.round(((i + 1) / n) * 100));
        continue;
      }

      const patientPhone = get('patientPhone');
      let patientId = '';
      let isExistingPatient = false;

      const patientRes = await patientService.getByPhone(patientPhone);
      if (patientRes.success && patientRes.data) {
        const pid = resolvePatientIdFromResponse(patientRes.data);
        if (pid) {
          patientId = pid;
          isExistingPatient = true;
        }
      }

      const newId = generatePatientIdForImport();
      const patientPayload: Record<string, unknown> = {
        patientId: patientId || newId,
        patientPhone,
        patientName: rowPatientName,
        patientDob: get('patientDob') ? new Date(get('patientDob')).toISOString() : null,
        gender: get('gender') === 'male' || get('gender') === 'female' ? get('gender') : null,
        patientEmail: get('patientEmail') || null,
        patientJob: get('patientJob') || null,
        patientContactName: get('patientContactName') || null,
        patientContactPhone: get('patientContactPhone') || null,
        patientAddress: get('patientAddress') || null,
        hospitalId: hospitalId || undefined,
      };

      if (isExistingPatient) {
        const updateRes = await patientService.update(patientId, patientPayload);
        if (!updateRes.success) {
          throw new Error(updateRes.error || updateRes.message || 'Không cập nhật được bệnh nhân');
        }
      } else {
        const createRes = await patientService.create(patientPayload);
        if (!createRes.success) {
          throw new Error(createRes.error || createRes.message || 'Không tạo được bệnh nhân');
        }
        patientId =
          resolvePatientIdFromResponse(createRes.data) || String(patientPayload.patientId);
      }

      const clinicalRequest: PatientClinicalRequest = {
        patientId,
        patientHeight: get('height') ? parseFloat(get('height')) : undefined,
        patientWeight: get('weight') ? parseFloat(get('weight')) : undefined,
        patientHistory: get('patientHistory') || undefined,
        familyHistory: get('familyHistory') || undefined,
        medicalHistory: get('medicalHistory') || undefined,
        acuteDisease: get('acuteDisease') || undefined,
        chronicDisease: get('chronicDisease') || undefined,
        medicalUsing: get('medication')
          ? get('medication')
              .split(',')
              .map(m => m.trim())
              .filter(Boolean)
          : undefined,
        toxicExposure: get('toxicExposure') || undefined,
      };

      await upsertPatientClinical(patientId, clinicalRequest);

      if (selectedServiceGroup === 'reproduction') {
        const reproductionRequest = {
          serviceId,
          patientId,
          fetusesNumber: get('fetusesNumber') ? parseInt(get('fetusesNumber'), 10) : undefined,
          fetusesWeek: get('fetusesWeek') ? parseInt(get('fetusesWeek'), 10) : undefined,
          fetusesDay: get('fetusesDay') ? parseInt(get('fetusesDay'), 10) : undefined,
          ultrasoundDay: get('ultrasoundDay') || undefined,
          headRumpLength: get('headRumpLength') ? parseFloat(get('headRumpLength')) : undefined,
          neckLength: get('neckLength') ? parseFloat(get('neckLength')) : undefined,
          combinedTestResult: get('combinedTestResult') || undefined,
          ultrasoundResult: get('ultrasoundResult') || undefined,
        };
        const repRes = await reproductionService.create(reproductionRequest);
        if (!repRes.success) throw new Error(repRes.error || 'Không tạo được dữ liệu sản khoa');
      } else if (selectedServiceGroup === 'embryo') {
        const embryoRequest = {
          serviceId,
          patientId,
          biospy: get('biospy') || undefined,
          biospyDate: get('biospyDate') || undefined,
          cellContainingSolution: get('cellContainingSolution') || undefined,
          embryoCreate: get('embryoCreate') ? parseInt(get('embryoCreate'), 10) : undefined,
          embryoStatus: get('embryoStatus') || undefined,
          morphologicalAssessment: get('morphologicalAssessment') || undefined,
          cellNucleus: get('cellNucleus') === 'true',
          negativeControl: get('negativeControl') || undefined,
        };
        const embRes = await embryoService.create(embryoRequest);
        if (!embRes.success) throw new Error(embRes.error || 'Không tạo được dữ liệu phôi');
      } else if (selectedServiceGroup === 'disease') {
        const diseaseRequest = {
          serviceId,
          patientId,
          symptom: get('symptom') || undefined,
          diagnose: get('diagnose') || undefined,
          diagnoseImage: get('diagnoseImage') || undefined,
          testRelated: get('testRelated') || undefined,
          treatmentMethods: get('treatmentMethods') || undefined,
          treatmentTimeDay: get('treatmentTimeDay')
            ? parseInt(get('treatmentTimeDay'), 10)
            : undefined,
          drugResistance: get('drugResistance') || undefined,
          relapse: get('relapse') || undefined,
        };
        const disRes = await diseaseService.create(diseaseRequest);
        if (!disRes.success) throw new Error(disRes.error || 'Không tạo được dữ liệu bệnh lý');
      }

      const specifyRequest: SpecifyVoteTestRequest = {
        serviceId,
        patientId,
        genomeTestId: genomeTest.testId,
        embryoNumber: get('embryoNumber') ? parseInt(get('embryoNumber'), 10) : undefined,
        hospitalId: hospitalId || undefined,
        doctorId: doctorId || undefined,
        samplingSite: get('samplingSite') || undefined,
        sampleCollectDate: get('sampleCollectDate')
          ? new Date(get('sampleCollectDate')).toISOString()
          : undefined,
        geneticTestResults: get('geneticTestResults') || undefined,
        geneticTestResultsRelationship: get('geneticTestResultsRelationship') || undefined,
        sendEmailPatient: get('sendEmailPatient') === 'true',
        specifyNote: get('specifyNote') || undefined,
      };

      const specifyRes = await specifyVoteTestService.create(specifyRequest);
      if (!specifyRes.success) {
        throw new Error(specifyRes.error || specifyRes.message || 'Không tạo được phiếu');
      }

      rowResults.push({
        rowIndex: i,
        success: true,
        patientName: rowPatientName,
        testName: rowTestName,
      });
    } catch (e: unknown) {
      rowResults.push({
        rowIndex: i,
        success: false,
        patientName: rowPatientName,
        testName: rowTestName,
        errorMessage: errMsg(e, 'Lỗi không xác định'),
      });
    }

    onRowComplete?.(rowResults.slice(), Math.round(((i + 1) / n) * 100));
  }

  return rowResults;
}

export async function buildAndWriteTemplateXlsx(
  sg: ServiceGroup,
  opts: { fileName: string; cacheDirectory: string | null }
): Promise<{ path: string; base64?: string }> {
  const columns = getColumnsForServiceGroup(sg);
  const headers = columns.map(col => SPECIFY_EXCEL_HEADERS[col] || col);

  const exampleRow = columns.map(col => {
    switch (col) {
      case 'patientPhone':
        return '0901234567';
      case 'patientName':
        return 'Nguyễn Văn A';
      case 'patientDob':
        return '1990-01-15';
      case 'gender':
        return 'male';
      case 'patientEmail':
        return 'nguyenvana@email.com';
      case 'patientJob':
        return 'Công nhân';
      case 'patientContactName':
        return 'Nguyễn Thị B';
      case 'patientContactPhone':
        return '0987654321';
      case 'patientAddress':
        return '123 Nguyễn Huệ, Q1, TP.HCM';
      case 'height':
        return '170';
      case 'weight':
        return '65';
      case 'testName':
        return 'NIPT cơ bản';
      case 'samplingSite':
        return 'Phòng khám ABC';
      case 'sampleCollectDate':
        return '2026-03-10';
      case 'sendEmailPatient':
        return 'false';
      case 'fetusesNumber':
        return '1';
      case 'fetusesWeek':
        return '12';
      case 'fetusesDay':
        return '3';
      case 'ultrasoundDay':
        return '2026-03-08';
      case 'headRumpLength':
        return '55';
      case 'neckLength':
        return '1.5';
      case 'embryoNumber':
        return '2';
      case 'cellNucleus':
        return 'false';
      case 'treatmentTimeDay':
        return '30';
      default:
        return '';
    }
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
  ws['!cols'] = columns.map(col => ({
    wch: Math.max((SPECIFY_EXCEL_HEADERS[col] || col).length + 5, 20),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');

  const instructionData: string[][] = [
    ['HƯỚNG DẪN IMPORT PHIẾU XÉT NGHIỆM'],
    [''],
    [`Loại dịch vụ: ${SERVICE_GROUP_LABELS[sg]}`],
    [''],
    ['[THÔNG TIN BỆNH NHÂN]'],
    ['- Số điện thoại BN (*): Bắt buộc. Dùng để kiểm tra BN đã tồn tại'],
    ['- Họ tên BN (*): Bắt buộc'],
    ['- Ngày sinh: Định dạng yyyy-MM-dd'],
    ['- Giới tính: male hoặc female'],
    [''],
    ['[THÔNG TIN XÉT NGHIỆM]'],
    ['- Tên xét nghiệm (*): Bắt buộc, phải khớp chính xác tên trong hệ thống'],
    ['- Mã bác sĩ, mã bệnh viện, mã dịch vụ tự động điền từ tài khoản (giống web admin)'],
  ];
  const wsInst = XLSX.utils.aoa_to_sheet(instructionData);
  wsInst['!cols'] = [{ wch: 70 }];
  XLSX.utils.book_append_sheet(wb, wsInst, 'Hướng dẫn');

  const fileName = opts.fileName;
  if (Platform.OS === 'web') {
    XLSX.writeFile(wb, fileName);
    return { path: fileName };
  }

  const b64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  if (!opts.cacheDirectory) {
    return { path: fileName, base64: b64 };
  }
  const path = `${opts.cacheDirectory}${fileName}`;
  await writeAsStringAsync(path, b64, { encoding: EncodingType.Base64 });
  return { path };
}
