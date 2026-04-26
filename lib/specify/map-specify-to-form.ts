import { specifyFormDefaultValues, type SpecifyFormData } from '@/lib/schemas/specify-form-schema';
import type { SpecifyVoteTestResponse } from '@/services/specifyVoteTestService';

export const formatDateToInput = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (dateStr.includes('T')) return dateStr.split('T')[0];
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  } catch {}
  return '';
};

export const scalarToFormString = (v: unknown): string => {
  if (v == null) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  if (typeof v === 'string') return v.trim();
  return '';
};

export const pickScalar = (
  obj: Record<string, unknown> | undefined,
  ...keys: string[]
): unknown => {
  if (!obj) return undefined;
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      const x = obj[k];
      if (x !== undefined && x !== null && x !== '') return x;
    }
  }
  return undefined;
};
export function applyReproductionPayloadToValues(values: Partial<SpecifyFormData>, rs: unknown) {
  if (!rs || typeof rs !== 'object') return;
  const r = rs as Record<string, unknown>;
  const loose = rs as {
    id?: string;
    fetusesNumber?: number;
    fetusesWeek?: number;
    fetusesDay?: number;
    ultrasoundDay?: string;
    headRumpLength?: number;
    neckLength?: number;
    combinedTestResult?: string;
    ultrasoundResult?: string;
  };
  values.reproductionServiceId = String(
    pickScalar(r, 'id', 'reproduction_service_id') ?? loose.id ?? values.reproductionServiceId ?? ''
  );
  values.fetusesNumber = scalarToFormString(
    pickScalar(r, 'fetusesNumber', 'fetuses_number') ?? loose.fetusesNumber
  );
  values.fetusesWeek = scalarToFormString(
    pickScalar(r, 'fetusesWeek', 'fetuses_week') ?? loose.fetusesWeek
  );
  values.fetusesDay = scalarToFormString(
    pickScalar(r, 'fetusesDay', 'fetuses_day') ?? loose.fetusesDay
  );
  const uDay = pickScalar(r, 'ultrasoundDay', 'ultrasound_day') ?? loose.ultrasoundDay;
  values.ultrasoundDay = uDay ? formatDateToInput(String(uDay)) : (values.ultrasoundDay ?? '');
  const h = scalarToFormString(
    pickScalar(r, 'headRumpLength', 'head_rump_length', 'crl') ?? loose.headRumpLength
  );
  if (h) values.headRumpLength = h;
  const n = scalarToFormString(
    pickScalar(r, 'neckLength', 'neck_length', 'nuchalTranslucency', 'nt') ?? loose.neckLength
  );
  if (n) values.neckLength = n;
  const combined =
    pickScalar(r, 'combinedTestResult', 'combined_test_result') ?? loose.combinedTestResult;
  values.combinedTestResult =
    combined != null && combined !== '' ? String(combined) : (values.combinedTestResult ?? '');
  const uRes = pickScalar(r, 'ultrasoundResult', 'ultrasound_result') ?? loose.ultrasoundResult;
  values.ultrasoundResult =
    uRes != null && uRes !== '' ? String(uRes) : (values.ultrasoundResult ?? '');
}

export function applyEmbryoPayloadToValues(values: Partial<SpecifyFormData>, es: unknown) {
  if (!es || typeof es !== 'object') return;
  const r = es as Record<string, unknown>;
  const loose = es as {
    id?: string;
    biospy?: string;
    biospyDate?: string;
    cellContainingSolution?: string;
    embryoCreate?: number;
    embryoStatus?: string;
    morphologicalAssessment?: string;
    cellNucleus?: boolean;
    negativeControl?: string;
  };
  values.embryoServiceId = String(
    pickScalar(r, 'id', 'embryo_service_id') ?? loose.id ?? values.embryoServiceId ?? ''
  );
  const bio = pickScalar(r, 'biospy') ?? loose.biospy;
  values.biospy = bio != null && bio !== '' ? String(bio) : (values.biospy ?? '');
  const bDate = pickScalar(r, 'biospyDate', 'biospy_date') ?? loose.biospyDate;
  values.biospyDate = bDate ? formatDateToInput(String(bDate)) : (values.biospyDate ?? '');
  const cellSol =
    pickScalar(r, 'cellContainingSolution', 'cell_containing_solution') ??
    loose.cellContainingSolution;
  values.cellContainingSolution =
    cellSol != null && cellSol !== '' ? String(cellSol) : (values.cellContainingSolution ?? '');
  const ec = pickScalar(r, 'embryoCreate', 'embryo_create') ?? loose.embryoCreate;
  values.embryoCreate = ec != null && ec !== '' ? String(ec) : (values.embryoCreate ?? '');
  const est = pickScalar(r, 'embryoStatus', 'embryo_status') ?? loose.embryoStatus;
  values.embryoStatus = est != null && est !== '' ? String(est) : (values.embryoStatus ?? '');
  const morph =
    pickScalar(r, 'morphologicalAssessment', 'morphological_assessment') ??
    loose.morphologicalAssessment;
  values.morphologicalAssessment =
    morph != null && morph !== '' ? String(morph) : (values.morphologicalAssessment ?? '');
  const neg = pickScalar(r, 'negativeControl', 'negative_control') ?? loose.negativeControl;
  values.negativeControl = neg != null && neg !== '' ? String(neg) : (values.negativeControl ?? '');

  if (
    Object.prototype.hasOwnProperty.call(r, 'cellNucleus') ||
    Object.prototype.hasOwnProperty.call(r, 'cell_nucleus')
  ) {
    const cn = r.cellNucleus ?? r.cell_nucleus ?? loose.cellNucleus;
    values.cellNucleus = cn === true || cn === 'true' || cn === 1;
  }
}

export function applyDiseasePayloadToValues(values: Partial<SpecifyFormData>, ds: unknown) {
  if (!ds || typeof ds !== 'object') return;
  const r = ds as Record<string, unknown>;
  const loose = ds as {
    id?: string;
    symptom?: string;
    diagnose?: string;
    diagnoseImage?: string;
    testRelated?: string;
    treatmentMethods?: string;
    treatmentTimeDay?: number;
    drugResistance?: string;
    relapse?: string;
  };
  values.diseaseServiceId = String(
    pickScalar(r, 'id', 'disease_service_id') ?? loose.id ?? values.diseaseServiceId ?? ''
  );
  const sym = pickScalar(r, 'symptom') ?? loose.symptom;
  values.symptom = sym != null && sym !== '' ? String(sym) : (values.symptom ?? '');
  const diag = pickScalar(r, 'diagnose') ?? loose.diagnose;
  values.diagnose = diag != null && diag !== '' ? String(diag) : (values.diagnose ?? '');
  const diagImg = pickScalar(r, 'diagnoseImage', 'diagnose_image') ?? loose.diagnoseImage;
  values.diagnoseImage =
    diagImg != null && diagImg !== '' ? String(diagImg) : (values.diagnoseImage ?? '');
  const tr = pickScalar(r, 'testRelated', 'test_related') ?? loose.testRelated;
  values.testRelated = tr != null && tr !== '' ? String(tr) : (values.testRelated ?? '');
  const tm = pickScalar(r, 'treatmentMethods', 'treatment_methods') ?? loose.treatmentMethods;
  values.treatmentMethods = tm != null && tm !== '' ? String(tm) : (values.treatmentMethods ?? '');
  const ttd = pickScalar(r, 'treatmentTimeDay', 'treatment_time_day') ?? loose.treatmentTimeDay;
  values.treatmentTimeDay =
    ttd != null && ttd !== '' ? String(ttd) : (values.treatmentTimeDay ?? '');
  const dr = pickScalar(r, 'drugResistance', 'drug_resistance') ?? loose.drugResistance;
  values.drugResistance = dr != null && dr !== '' ? String(dr) : (values.drugResistance ?? '');
  const rel = pickScalar(r, 'relapse') ?? loose.relapse;
  values.relapse = rel != null && rel !== '' ? String(rel) : (values.relapse ?? '');
}

function patientClinicalFromRecord(pc: Record<string, unknown>): {
  patientHeight?: string;
  patientWeight?: string;
  patientHistory: string;
  familyHistory: string;
  medicalHistory: string;
  acuteDisease: string;
  chronicDisease: string;
  toxicExposure: string;
  medicalUsing: string;
  patientClinicalId: string;
} {
  return {
    patientClinicalId: String(
      pickScalar(pc, 'id', 'patientClinicalId', 'patient_clinical_id') ?? ''
    ),
    patientHeight: scalarToFormString(pickScalar(pc, 'patientHeight', 'patient_height')),
    patientWeight: scalarToFormString(pickScalar(pc, 'patientWeight', 'patient_weight')),
    patientHistory: String(pickScalar(pc, 'patientHistory', 'patient_history') ?? ''),
    familyHistory: String(pickScalar(pc, 'familyHistory', 'family_history') ?? ''),
    medicalHistory: String(pickScalar(pc, 'medicalHistory', 'medical_history') ?? ''),
    acuteDisease: String(pickScalar(pc, 'acuteDisease', 'acute_disease') ?? ''),
    chronicDisease: String(pickScalar(pc, 'chronicDisease', 'chronic_disease') ?? ''),
    toxicExposure: String(pickScalar(pc, 'toxicExposure', 'toxic_exposure') ?? ''),
    medicalUsing: Array.isArray(pc.medicalUsing)
      ? (pc.medicalUsing as string[]).join(', ')
      : Array.isArray(pc.medical_using)
        ? (pc.medical_using as string[]).join(', ')
        : typeof pc.medicalUsing === 'string'
          ? pc.medicalUsing
          : typeof pc.medical_using === 'string'
            ? (pc.medical_using as string)
            : '',
  };
}

export function mapSpecifyToFormValues(specify: SpecifyVoteTestResponse): Partial<SpecifyFormData> {
  const raw = specify as unknown as Record<string, unknown>;
  const p = specify.patient;
  const pcRaw = specify.patientClinical as unknown as Record<string, unknown> | undefined;
  const rs =
    specify.reproductionService ??
    (raw.reproduction_service as SpecifyVoteTestResponse['reproductionService'] | undefined);
  const es =
    specify.embryoService ??
    (raw.embryo_service as SpecifyVoteTestResponse['embryoService'] | undefined);
  const ds =
    specify.diseaseService ??
    (raw.disease_service as SpecifyVoteTestResponse['diseaseService'] | undefined);

  const values: Partial<SpecifyFormData> = {
    ...specifyFormDefaultValues,
    isNewPatient: false,
    selectedPatientId: p?.patientId || '',
    patientName: p?.patientName || '',
    patientPhone: p?.patientPhone || '',
    patientDob: p?.patientDob ? formatDateToInput(p.patientDob) : '',
    patientGender: (p?.gender?.toLowerCase() as 'male' | 'female' | 'other') || undefined,
    patientEmail: p?.patientEmail || '',
    patientJob: p?.patientJob || '',
    patientContactName: p?.patientContactName || '',
    patientContactPhone: p?.patientContactPhone || '',
    patientAddress:
      (p?.patientAddress && String(p.patientAddress).trim()) ||
      (p && typeof (p as unknown as Record<string, unknown>).patient_address === 'string'
        ? String((p as unknown as Record<string, unknown>).patient_address).trim()
        : '') ||
      '',
    serviceId: specify.serviceID || '',
    serviceType: (() => {
      const st = String(specify.serviceType ?? '').toLowerCase();
      if (st === 'reproduction' || st === 'embryo' || st === 'disease')
        return st as SpecifyFormData['serviceType'];
      if (rs) return 'reproduction';
      if (es) return 'embryo';
      if (ds) return 'disease';
      const sid = (specify.serviceID || '').toLowerCase();
      if (sid.includes('reproduction') || sid === 'reproduction') return 'reproduction';
      if (sid.includes('embryo') || sid === 'embryo') return 'embryo';
      if (sid.includes('disease') || sid === 'disease') return 'disease';
      return undefined;
    })(),
    genomeTestId: specify.genomeTestId || specify.genomeTest?.testId || '',
    hospitalId: specify.hospitalId || specify.hospital?.hospitalId?.toString() || '',
    doctorId: specify.doctorId || specify.doctor?.doctorId || '',
    samplingSite: specify.samplingSite || '',
    sampleCollectDate: specify.sampleCollectDate
      ? formatDateToInput(specify.sampleCollectDate)
      : '',
    embryoNumber: specify.embryoNumber != null ? String(specify.embryoNumber) : undefined,
    geneticTestResults: specify.geneticTestResults || '',
    geneticTestResultsRelationship: specify.geneticTestResultsRelationship || '',
    specifyNote: specify.specifyNote || '',
    sendEmailPatient: specify.sendEmailPatient ?? false,
  };

  if (pcRaw && typeof pcRaw === 'object') {
    const c = patientClinicalFromRecord(pcRaw);
    values.patientClinicalId = c.patientClinicalId || values.patientClinicalId;
    values.patientHeight = c.patientHeight || undefined;
    values.patientWeight = c.patientWeight || undefined;
    values.patientHistory = c.patientHistory;
    values.familyHistory = c.familyHistory;
    values.medicalHistory = c.medicalHistory;
    values.acuteDisease = c.acuteDisease;
    values.chronicDisease = c.chronicDisease;
    values.toxicExposure = c.toxicExposure;
    values.medicalUsing = c.medicalUsing;
  }

  const stLower = String(specify.serviceType ?? '').toLowerCase();
  const isRepro = stLower === 'reproduction' || !!rs;
  const isEmbryo = stLower === 'embryo' || !!es;
  const isDisease = stLower === 'disease' || !!ds;

  if (isRepro) {
    if (rs) applyReproductionPayloadToValues(values, rs);
    if (!String(values.headRumpLength ?? '').trim()) {
      const v = scalarToFormString(pickScalar(raw, 'headRumpLength', 'head_rump_length', 'crl'));
      if (v) values.headRumpLength = v;
    }
    if (!String(values.neckLength ?? '').trim()) {
      const v = scalarToFormString(
        pickScalar(raw, 'neckLength', 'neck_length', 'nuchalTranslucency', 'nt')
      );
      if (v) values.neckLength = v;
    }
  } else if (isEmbryo) {
    if (es) applyEmbryoPayloadToValues(values, es);
  } else if (isDisease) {
    if (ds) applyDiseasePayloadToValues(values, ds);
  }

  return values;
}
