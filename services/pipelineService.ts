
const PIPELINE_API_URL = 'https://api.htgen.io.vn/api/pipeline';

export interface PipelineInfo {
  name: string;
  label: string;
  description?: string;
}

export interface QueueStats {
  queue: string;
  pipeline: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  total: number;
}

export interface AnalyzeJobRequest {
  patientId: string;
  patientName: string;
  sampleName: string;
  hospitalName: string;
  labcode: string;
  priority?: number;
  hpoIds?: string[];
}

export const pipelineService = {
  listPipelines: async (): Promise<PipelineInfo[]> => {
    const res = await fetch(`${PIPELINE_API_URL}/list`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.pipelines || [];
  },

  getQueueStats: async (pipeline: string): Promise<QueueStats | null> => {
    const res = await fetch(`${PIPELINE_API_URL}/${pipeline}/queue/stats`);
    if (!res.ok) return null;
    return res.json();
  },

  analyze: async (
    pipeline: string,
    body: AnalyzeJobRequest
  ): Promise<{ jobId?: string; error?: string }> => {
    const res = await fetch(`${PIPELINE_API_URL}/${pipeline}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        priority: body.priority ?? 2,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: data.error || `HTTP ${res.status}` };
    }
    return { jobId: data.jobId };
  },
};
