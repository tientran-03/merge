export type FastqPipelinePill = { bg: string; text: string; border: string };

export function getFastqPresenceLabel(loading: boolean, hasPair: boolean): string {
  if (loading) return 'Đang kiểm tra…';
  return hasPair ? 'Đã có FASTQ' : 'Chưa có FASTQ';
}

export function getFastqPresencePillClass(loading: boolean, hasPair: boolean): FastqPipelinePill {
  if (loading) {
    return { bg: 'bg-slate-500/10', text: 'text-slate-600', border: 'border-slate-200' };
  }
  if (hasPair) {
    return { bg: 'bg-emerald-500/12', text: 'text-emerald-800', border: 'border-emerald-200' };
  }
  return { bg: 'bg-amber-500/12', text: 'text-amber-800', border: 'border-amber-200' };
}

export function getFastqPipelineStatusLabel(status?: string): string {
  const s = (status || '').toLowerCase().trim();
  const map: Record<string, string> = {
    sample_run: 'Mẫu khởi chạy',
    sample_waiting_analyze: 'Mẫu chờ phân tích',
    sample_in_analyze: 'Mẫu đang phân tích',
    sample_completed: 'Mẫu hoàn thành',
    sample_error: 'Mẫu lỗi',
    sample_added: 'Mẫu bổ sung',
    sample_rerun: 'Mẫu chạy lại',
    initiation: 'Khởi tạo',
    pending: 'Chờ xử lý',
    processing: 'Đang xử lý',
    completed: 'Hoàn thành',
    error: 'Lỗi',
    canceled: 'Hủy',
  };
  return map[s] || status || '—';
}

export function getFastqPipelinePillClass(status?: string): FastqPipelinePill {
  const s = (status || '').toLowerCase();
  if (s === 'sample_completed' || s === 'sample_added') {
    return { bg: 'bg-emerald-500/12', text: 'text-emerald-800', border: 'border-emerald-200' };
  }
  if (s === 'sample_waiting_analyze' || s === 'sample_rerun') {
    return { bg: 'bg-amber-500/12', text: 'text-amber-800', border: 'border-amber-200' };
  }
  if (s === 'sample_in_analyze') {
    return { bg: 'bg-violet-500/12', text: 'text-violet-800', border: 'border-violet-200' };
  }
  if (s === 'sample_run') {
    return { bg: 'bg-sky-500/12', text: 'text-sky-800', border: 'border-sky-200' };
  }
  if (s === 'sample_error') {
    return { bg: 'bg-red-500/12', text: 'text-red-800', border: 'border-red-200' };
  }
  if (s === 'completed') {
    return { bg: 'bg-emerald-500/12', text: 'text-emerald-700', border: 'border-emerald-200' };
  }
  if (s === 'processing' || s === 'pending') {
    return { bg: 'bg-sky-500/12', text: 'text-sky-700', border: 'border-sky-200' };
  }
  if (s === 'error' || s === 'canceled') {
    return { bg: 'bg-red-500/12', text: 'text-red-700', border: 'border-red-200' };
  }
  return { bg: 'bg-slate-500/10', text: 'text-slate-800', border: 'border-slate-200' };
}
