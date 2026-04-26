import { orderService } from '@/services/orderService';
import { patientMetadataService } from '@/services/patientMetadataService';
import { specifyVoteTestService } from '@/services/specifyVoteTestService';

const SAMPLE_COMPLETED = 'sample_completed';
const AWAITING_RESULTS_APPROVAL = 'awaiting_results_approval';

function normalizeStatus(v: unknown): string {
  return String(v || '').trim().toLowerCase();
}

export async function approvePatientMetadataResultsOutput(params: {
  labcode: string;
  specifyId?: string;
}): Promise<void> {
  const { labcode, specifyId } = params;
  await patientMetadataService.updateStatus(labcode, SAMPLE_COMPLETED);

  if (specifyId) {
    const metadataRes = await patientMetadataService.getBySpecifyId(specifyId);
    const metadataRows =
      metadataRes.success && Array.isArray(metadataRes.data) ? metadataRes.data : [];
    const allSamplesCompleted =
      metadataRows.length > 0 &&
      metadataRows.every(pm => normalizeStatus(pm.status) === SAMPLE_COMPLETED);

    if (!allSamplesCompleted) return;

    await specifyVoteTestService.updateStatus(specifyId, AWAITING_RESULTS_APPROVAL);

    const orderRes = await orderService.getBySpecifyId(specifyId);
    const orders = orderRes.success && orderRes.data ? (orderRes.data as any[]) : [];
    if (orders.length > 0) {
      const order = orders[0];
      await orderService.updateStatus(order.orderId, AWAITING_RESULTS_APPROVAL);
      await orderService.updateResultDate(order.orderId, new Date().toISOString());
    }
  }
}
