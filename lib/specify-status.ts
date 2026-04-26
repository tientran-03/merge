export type SpecifyUiLocale = 'vi' | 'en';

const LABELS_VI: Record<string, string> = {
  initation: 'Khởi tạo',
  initiation: 'Khởi tạo',
  payment_failed: 'Thanh toán thất bại',
  waiting_receive_sample: 'Chờ nhận mẫu',
  forward_analysis: 'Chuyển phân tích',
  accepted: 'Đã chấp nhận',
  analyze_in_progress: 'Đang phân tích',
  rerun_testing: 'Chạy lại xét nghiệm',
  awaiting_results_approval: 'Chờ duyệt kết quả',
  results_approved: 'Đã duyệt kết quả',
  canceled: 'Đã hủy',
  cancelled: 'Đã hủy',
  rejected: 'Từ chối',
  sample_addition: 'Bổ sung mẫu',
  sample_error: 'Lỗi mẫu',
  completed: 'Hoàn thành',
  sample_received: 'Đã nhận mẫu',
};

const LABELS_EN: Record<string, string> = {
  initation: 'Initiated',
  initiation: 'Initiated',
  payment_failed: 'Payment failed',
  waiting_receive_sample: 'Awaiting sample',
  forward_analysis: 'Forwarded for analysis',
  accepted: 'Accepted',
  analyze_in_progress: 'Analysis in progress',
  rerun_testing: 'Rerun testing',
  awaiting_results_approval: 'Awaiting results approval',
  results_approved: 'Results approved',
  canceled: 'Canceled',
  cancelled: 'Canceled',
  rejected: 'Rejected',
  sample_addition: 'Sample add-on',
  sample_error: 'Sample error',
  completed: 'Completed',
  sample_received: 'Sample received',
};

function statusLabelsForLocale(locale: SpecifyUiLocale): Record<string, string> {
  return locale === 'en' ? LABELS_EN : LABELS_VI;
}

const CANONICAL_SPECIFY_STATUS_KEYS = [
  'initation',
  'payment_failed',
  'waiting_receive_sample',
  'forward_analysis',
  'accepted',
  'analyze_in_progress',
  'rerun_testing',
  'awaiting_results_approval',
  'results_approved',
  'canceled',
  'rejected',
  'sample_addition',
  'sample_error',
  'completed',
] as const;

export type SpecifyStatusPresentation = {
  label: string;
  accent: string;
  bg: string;
  fg: string;
  bd: string;
};

const PRESET: Record<string, Omit<SpecifyStatusPresentation, 'label'>> = {
  initation: {
    accent: 'border-l-blue-500',
    bg: 'bg-blue-50',
    fg: 'text-blue-800',
    bd: 'border-blue-200',
  },
  initiation: {
    accent: 'border-l-blue-500',
    bg: 'bg-blue-50',
    fg: 'text-blue-800',
    bd: 'border-blue-200',
  },
  payment_failed: {
    accent: 'border-l-red-500',
    bg: 'bg-red-50',
    fg: 'text-red-800',
    bd: 'border-red-200',
  },
  waiting_receive_sample: {
    accent: 'border-l-cyan-500',
    bg: 'bg-cyan-50',
    fg: 'text-cyan-800',
    bd: 'border-cyan-200',
  },
  forward_analysis: {
    accent: 'border-l-teal-500',
    bg: 'bg-teal-50',
    fg: 'text-teal-800',
    bd: 'border-teal-200',
  },
  accepted: {
    accent: 'border-l-green-500',
    bg: 'bg-green-50',
    fg: 'text-green-800',
    bd: 'border-green-200',
  },
  analyze_in_progress: {
    accent: 'border-l-violet-500',
    bg: 'bg-violet-50',
    fg: 'text-violet-800',
    bd: 'border-violet-200',
  },
  rerun_testing: {
    accent: 'border-l-amber-500',
    bg: 'bg-amber-50',
    fg: 'text-amber-800',
    bd: 'border-amber-200',
  },
  awaiting_results_approval: {
    accent: 'border-l-orange-500',
    bg: 'bg-orange-50',
    fg: 'text-orange-800',
    bd: 'border-orange-200',
  },
  results_approved: {
    accent: 'border-l-lime-500',
    bg: 'bg-lime-50',
    fg: 'text-lime-800',
    bd: 'border-lime-200',
  },
  canceled: {
    accent: 'border-l-slate-400',
    bg: 'bg-slate-100',
    fg: 'text-slate-800',
    bd: 'border-slate-200',
  },
  cancelled: {
    accent: 'border-l-slate-400',
    bg: 'bg-slate-100',
    fg: 'text-slate-800',
    bd: 'border-slate-200',
  },
  rejected: {
    accent: 'border-l-red-600',
    bg: 'bg-red-50',
    fg: 'text-red-800',
    bd: 'border-red-200',
  },
  sample_addition: {
    accent: 'border-l-orange-500',
    bg: 'bg-orange-50',
    fg: 'text-orange-800',
    bd: 'border-orange-200',
  },
  sample_error: {
    accent: 'border-l-red-600',
    bg: 'bg-red-50',
    fg: 'text-red-800',
    bd: 'border-red-200',
  },
  completed: {
    accent: 'border-l-emerald-500',
    bg: 'bg-emerald-50',
    fg: 'text-emerald-800',
    bd: 'border-emerald-200',
  },
  sample_received: {
    accent: 'border-l-cyan-500',
    bg: 'bg-cyan-50',
    fg: 'text-cyan-800',
    bd: 'border-cyan-200',
  },
};

const FALLBACK: Omit<SpecifyStatusPresentation, 'label'> = {
  accent: 'border-l-slate-400',
  bg: 'bg-slate-50',
  fg: 'text-slate-800',
  bd: 'border-slate-200',
};
export function normalizeSpecifyStatusKey(raw: string | null | undefined): string {
  const k = (raw || '').toLowerCase().trim();
  if (k === 'initiation') return 'initation';
  return k;
}

export function canCancelSpecifyAtInitiation(raw: string | null | undefined): boolean {
  if (raw == null || String(raw).trim() === '') return true;
  return normalizeSpecifyStatusKey(raw) === 'initation';
}

export function getSpecifyStatusFilterOptions(
  locale: SpecifyUiLocale = 'vi'
): { value: string; label: string }[] {
  const labels = statusLabelsForLocale(locale);
  const allLabel = locale === 'en' ? 'All' : 'Tất cả';
  return [
    { value: 'all', label: allLabel },
    ...CANONICAL_SPECIFY_STATUS_KEYS.map(value => ({
      value,
      label: labels[value] || value,
    })),
  ];
}

export const SPECIFY_STATUS_FILTER_OPTIONS: { value: string; label: string }[] =
  getSpecifyStatusFilterOptions('vi');

export type SpecifyStatusPickerCopy = {
  fieldLabel: string;
  modalTitle: string;
  closeA11y: string;
  searchPlaceholder: string;
  emptyPrefix: string;
  emptySuffix: string;
};

export function getSpecifyStatusPickerCopy(locale: SpecifyUiLocale): SpecifyStatusPickerCopy {
  if (locale === 'en') {
    return {
      fieldLabel: 'Status',
      modalTitle: 'Select status',
      closeA11y: 'Close',
      searchPlaceholder: 'Search by name or code (e.g. completed, initiated)…',
      emptyPrefix: 'No status matches ',
      emptySuffix: '',
    };
  }
  return {
    fieldLabel: 'Trạng thái',
    modalTitle: 'Chọn trạng thái',
    closeA11y: 'Đóng',
    searchPlaceholder: 'Tìm theo tên hoặc mã (VD: completed, Khởi tạo)…',
    emptyPrefix: 'Không có trạng thái khớp “',
    emptySuffix: '”',
  };
}

export function getSpecifyStatusLabel(
  raw: string | null | undefined,
  locale: SpecifyUiLocale = 'vi'
): string {
  const k = (raw || '').toLowerCase().trim();
  if (!k) return locale === 'en' ? '—' : '—';
  const labels = statusLabelsForLocale(locale);
  return labels[k] || String(raw);
}

export function specifyMatchesStatusFilter(rawStatus: string | undefined, filter: string): boolean {
  if (!filter || filter === 'all') return true;
  const s = normalizeSpecifyStatusKey(rawStatus);
  const f = normalizeSpecifyStatusKey(filter);
  if (!s) return false;
  return s === f;
}

export function getSpecifyStatusPresentation(
  raw: string | null | undefined,
  locale: SpecifyUiLocale = 'vi'
): SpecifyStatusPresentation {
  const k = (raw || '').toLowerCase().trim();
  const normalized = normalizeSpecifyStatusKey(raw);
  const style = PRESET[k] || PRESET[normalized] || FALLBACK;
  return {
    label: getSpecifyStatusLabel(raw, locale),
    ...style,
  };
}

export function getSpecifyStatusDetailPill(
  raw: string | null | undefined,
  locale: SpecifyUiLocale = 'vi'
): {
  bg: string;
  tx: string;
} {
  const p = getSpecifyStatusPresentation(raw, locale);
  const pillBg = p.bg.includes('-50') ? p.bg.replace('-50', '-100') : p.bg;
  return { bg: pillBg, tx: p.fg };
}
