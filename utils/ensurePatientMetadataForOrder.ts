import { orderService } from "@/services/orderService";
import { patientMetadataService } from "@/services/patientMetadataService";
import { specifyVoteTestService } from "@/services/specifyVoteTestService";

const WAITING = "sample_waiting_analyze";
const RUN = "sample_run";

/**
 * Đồng bộ mẫu (labcode) sau thanh toán thành công:
 * - Nếu chưa có metadata: tạo qua `POST .../analyze` → `sample_waiting_analyze` (khớp web «chờ phân tích»).
 * - Nếu đã có (vd. tạo lúc lập đơn với `sample_run`): nâng `sample_run` → `sample_waiting_analyze`.
 * - Cho phép truyền `fallbackSpecifyId` từ luồng payment khi order response chưa hydrate `specifyId`.
 */
export async function ensurePatientMetadataForOrder(
  orderId: string,
  fallbackSpecifyId?: string,
): Promise<void> {
  const trimmed = String(orderId || "").trim();
  if (!trimmed) return;

  const ordRes = await orderService.getById(trimmed);
  if (!ordRes.success || !ordRes.data) return;

  const order = ordRes.data;
  const specify = order.specifyId;
  const specifyId = String(specify?.specifyVoteID ?? fallbackSpecifyId ?? "").trim();
  let patientId = String(specify?.patientId ?? specify?.patient?.patientId ?? "").trim();
  let patientName = String(specify?.patient?.patientName ?? "").trim();
  let genomeTest = (specify as { genomeTest?: { testName?: string; testSample?: string[] } } | null)
    ?.genomeTest;

  // Fallback: nhiều response GET /orders/{id} không hydrate đủ patient/genomeTest trong specify.
  // Khi đó lấy lại từ API specify để vẫn tạo metadata sau khi thanh toán thành công.
  if (specifyId && (!patientId || !genomeTest)) {
    try {
      const specifyRes = await specifyVoteTestService.getById(specifyId);
      if (specifyRes.success && specifyRes.data) {
        const fetched = specifyRes.data;
        patientId = String(fetched.patientId ?? fetched.patient?.patientId ?? patientId).trim();
        patientName = String(fetched.patient?.patientName ?? patientName).trim();
        genomeTest = fetched.genomeTest as { testName?: string; testSample?: string[] } | undefined;
      }
    } catch (e) {
      console.warn("[ensurePatientMetadataForOrder] fallback get specify failed:", e);
    }
  }

  if (!specifyId || !patientId) {
    console.warn("[ensurePatientMetadataForOrder] missing specifyId or patientId", {
      specifyId,
      patientId,
    });
    return;
  }

  const listRes = await patientMetadataService.getBySpecifyId(specifyId);
  if (listRes.success && Array.isArray(listRes.data) && listRes.data.length > 0) {
    for (const row of listRes.data) {
      const lab = String(row.labcode ?? "").trim();
      const st = (row.status || "").toLowerCase();
      if (!lab) continue;
      if (st === RUN) {
        const up = await patientMetadataService.updateStatus(lab, WAITING);
        if (!up.success) {
          console.warn("[ensurePatientMetadataForOrder] upgrade sample_run failed:", lab, up.error);
        }
      }
    }
    return;
  }

  /** Giống web invoice: một `createWithAnalyze` cho mỗi phần tử `genomeTest.testSample`. */
  let sampleNames: string[] =
    Array.isArray(genomeTest?.testSample) && genomeTest.testSample.length > 0
      ? genomeTest.testSample.map((s) => String(s).trim()).filter(Boolean)
      : [];

  if (sampleNames.length === 0) {
    const fallback =
      String(specify?.samplingSite ?? "").trim() ||
      String(genomeTest?.testName ?? "").trim() ||
      String(order.orderName ?? "").trim() ||
      "";
    if (fallback) sampleNames = [fallback];
  }

  if (sampleNames.length === 0) {
    const once = await patientMetadataService.createWithAnalyze({
      specifyId,
      patientId,
      ...(patientName ? { patientName } : {}),
    });
    if (!once.success) {
      console.warn("[ensurePatientMetadataForOrder] createWithAnalyze failed:", once.error);
    }
    return;
  }

  for (const sampleName of sampleNames) {
    const created = await patientMetadataService.createWithAnalyze({
      specifyId,
      patientId,
      ...(patientName ? { patientName } : {}),
      sampleName,
    });
    if (!created.success) {
      console.warn("[ensurePatientMetadataForOrder] createWithAnalyze failed:", sampleName, created.error);
    }
  }
}
