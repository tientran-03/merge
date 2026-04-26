
import { getApiResponseData, getApiResponseSingle } from '@/lib/types/api-types';
import { orderService, type OrderResponse } from '@/services/orderService';
import { patientMetadataService } from '@/services/patientMetadataService';
import { specifyVoteTestService } from '@/services/specifyVoteTestService';

function getSpecifyVoteId(order: OrderResponse): string | null {
  const s = order.specifyId as unknown;
  if (!s) return null;
  if (typeof s === 'string') return s.trim() || null;
  if (typeof s === 'object' && s !== null) {
    const row = s as { specifyVoteID?: string; specifyVoteId?: string };
    const id = row.specifyVoteID || row.specifyVoteId;
    return id?.trim() || null;
  }
  return null;
}

function isPaymentCompleted(order: OrderResponse): boolean {
  return String(order.paymentStatus || '').toUpperCase() === 'COMPLETED';
}

function orderHasNoLinkedMetadata(order: OrderResponse): boolean {
  const pm = order.patientMetadata;
  return !pm || !Array.isArray(pm) || pm.length === 0;
}

function sameHospital(
  specifyHospitalId: string | number | null | undefined,
  staffHospitalId: string
): boolean {
  // Some customer-created orders have missing hospital on specify payload.
  // In that case, allow metadata creation and rely on staff access scope.
  if (specifyHospitalId == null || specifyHospitalId === '') return true;
  return String(specifyHospitalId) === String(staffHospitalId);
}

export type EnsurePaidOrderMetadataResult = {
  createdLabRows: number;
  linkedOrders: number;
};

async function ensureSingleOrderMetadataLikeWeb(
  order: OrderResponse,
  staffHospitalId: string,
  options?: { forceCreate?: boolean }
): Promise<EnsurePaidOrderMetadataResult> {
  const specifyId = getSpecifyVoteId(order);
  if (!specifyId) return { createdLabRows: 0, linkedOrders: 0 };
  const orderStatusLower = String(order.orderStatus || '').toLowerCase();
  const shouldCreateWhenAcceptedNoFastq = orderStatusLower === 'accepted' && !Boolean(order.customerFastq);
  const isEligibleToCreate = isPaymentCompleted(order) || shouldCreateWhenAcceptedNoFastq;
  const forceCreate = Boolean(options?.forceCreate);
  if ((!isEligibleToCreate && !forceCreate) || !orderHasNoLinkedMetadata(order)) {
    return { createdLabRows: 0, linkedOrders: 0 };
  }

  const specRes = await specifyVoteTestService.getById(specifyId);
  if (!specRes.success || !specRes.data) return { createdLabRows: 0, linkedOrders: 0 };

  const spec = specRes.data;
  const specifyStatusLower = String(spec.specifyStatus || '').toLowerCase();
  const shouldSetWaitingAnalyzeStatus =
    orderStatusLower === 'accepted' || specifyStatusLower === 'accepted';
  if (!sameHospital(spec.hospital?.hospitalId, staffHospitalId)) {
    return { createdLabRows: 0, linkedOrders: 0 };
  }

  const patient = spec.patient;
  const gt = spec.genomeTest;
  const fallbackPatientId =
    typeof order.specifyId === 'object' && order.specifyId
      ? (order.specifyId as { patientId?: string }).patientId
      : undefined;
  const patientId = patient?.patientId || fallbackPatientId;
  const patientName = patient?.patientName || '';
  if (!patientId) return { createdLabRows: 0, linkedOrders: 0 };

  const customerFastq = Boolean(order.customerFastq);
  let sampleNames: string[] = [];
  if (customerFastq && Array.isArray(gt?.testSample) && gt.testSample.length > 0) {
    sampleNames = gt.testSample.map(s => String(s).trim()).filter(Boolean);
  }
  if (sampleNames.length === 0) {
    const name = (gt?.testName || '').trim() || 'Mẫu xét nghiệm';
    sampleNames = [name];
  }

  const newLabcodes: string[] = [];
  for (const sampleName of sampleNames) {
    try {
      const createRes = await patientMetadataService.create({
        specifyId,
        patientId,
        patientName,
        sampleName,
      });
      if (createRes.success && createRes.data?.labcode) {
        const createdLabcode = createRes.data.labcode;
        newLabcodes.push(createdLabcode);
        if (shouldSetWaitingAnalyzeStatus) {
          await patientMetadataService
            .updateStatus(createdLabcode, 'sample_waiting_analyze')
            .catch(() => {
            // best-effort: do not break linking flow when status patch transiently fails
          });
        }
      }
    } catch {
      // no-op: duplicate sample name or transient API failure
    }
  }
  if (newLabcodes.length === 0) return { createdLabRows: 0, linkedOrders: 0 };

  const freshRes = await orderService.getById(order.orderId);
  const freshOrder = getApiResponseSingle<OrderResponse>(freshRes as unknown);
  const existing = (freshOrder?.patientMetadata || [])
    .map(m => m.labcode)
    .filter(Boolean) as string[];
  const merged = [...existing, ...newLabcodes];

  const patchRes = await orderService.updateWithMergedPatch(order.orderId, {
    patientMetadataIds: merged,
  });

  return {
    createdLabRows: newLabcodes.length,
    linkedOrders: patchRes.success ? 1 : 0,
  };
}

export async function ensureSinglePaidOrderPatientMetadataLikeWeb(
  orderId: string,
  staffHospitalId: string | null
): Promise<EnsurePaidOrderMetadataResult> {
  if (!staffHospitalId) return { createdLabRows: 0, linkedOrders: 0 };
  const one = await orderService.getById(orderId);
  const order = getApiResponseSingle<OrderResponse>(one as unknown);
  if (!order) return { createdLabRows: 0, linkedOrders: 0 };
  return ensureSingleOrderMetadataLikeWeb(order, staffHospitalId);
}

export async function ensureSingleOrderPatientMetadataAlwaysLikeWeb(
  orderId: string,
  staffHospitalId: string | null
): Promise<EnsurePaidOrderMetadataResult> {
  if (!staffHospitalId) return { createdLabRows: 0, linkedOrders: 0 };
  const one = await orderService.getById(orderId);
  const order = getApiResponseSingle<OrderResponse>(one as unknown);
  if (!order) return { createdLabRows: 0, linkedOrders: 0 };
  return ensureSingleOrderMetadataLikeWeb(order, staffHospitalId, { forceCreate: true });
}


export async function ensurePaidOrderPatientMetadataLikeWeb(
  staffHospitalId: string | null
): Promise<EnsurePaidOrderMetadataResult> {
  if (!staffHospitalId) {
    return { createdLabRows: 0, linkedOrders: 0 };
  }

  const listRes = await orderService.getAll({ page: 0, size: 500 });
  const orders = getApiResponseData<OrderResponse>(listRes as unknown) as OrderResponse[];

  let createdLabRows = 0;
  let linkedOrders = 0;

  const candidates = orders.filter(
    o => isPaymentCompleted(o) && orderHasNoLinkedMetadata(o) && getSpecifyVoteId(o)
  );

  for (const order of candidates) {
    const r = await ensureSingleOrderMetadataLikeWeb(order, staffHospitalId);
    createdLabRows += r.createdLabRows;
    linkedOrders += r.linkedOrders;
  }

  return { createdLabRows, linkedOrders };
}
