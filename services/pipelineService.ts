/**
 * Htgen pipeline API (phân tích gen) — cùng base với web `analyze-modal`.
 * Gọi trực tiếp https://api.htgen.io.vn/api/pipeline (không qua Java backend app).
 */
const PIPELINE_API_BASE = "https://api.htgen.io.vn/api/pipeline";

export type PipelineInfo = {
  name: string;
  label: string;
  description: string;
};

export type QueueStats = {
  queue: string;
  pipeline: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  total: number;
};

export type AnalyzeJobBody = {
  patientId: string;
  patientName: string;
  sampleName: string;
  hospitalName: string;
  labcode: string;
  priority: number;
  hpoIds?: string[];
};

export type AnalyzeJobResponse = { jobId?: string; error?: string };

async function parseJsonSafe(res: Response): Promise<Record<string, unknown>> {
  const t = await res.text();
  try {
    return t ? (JSON.parse(t) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const pipelineService = {
  listPipelines: async (): Promise<PipelineInfo[]> => {
    const res = await fetch(`${PIPELINE_API_BASE}/list`);
    if (!res.ok) return [];
    const data = await parseJsonSafe(res);
    const raw = data.pipelines;
    return Array.isArray(raw) ? (raw as PipelineInfo[]) : [];
  },

  getQueueStats: async (pipelineName: string): Promise<QueueStats | null> => {
    const res = await fetch(
      `${PIPELINE_API_BASE}/${encodeURIComponent(pipelineName)}/queue/stats`,
    );
    if (!res.ok) return null;
    return (await res.json()) as QueueStats;
  },

  submitAnalyze: async (
    pipelineName: string,
    body: AnalyzeJobBody,
  ): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> => {
    const res = await fetch(`${PIPELINE_API_BASE}/${encodeURIComponent(pipelineName)}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) {
      const err = data.error;
      return {
        ok: false,
        error: typeof err === "string" ? err : `HTTP ${res.status}`,
      };
    }
    const jobId = data.jobId;
    return {
      ok: true,
      jobId: typeof jobId === "string" ? jobId : String(jobId ?? ""),
    };
  },
};
