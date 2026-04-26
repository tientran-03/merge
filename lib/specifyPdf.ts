import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { SpecifyVoteTestResponse } from '@/services/specifyVoteTestService';

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateSafe(dateString?: string): string {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleString('vi-VN');
  } catch {
    return dateString;
  }
}

function genderLabel(g?: string): string {
  if (!g) return '—';
  const raw = String(g).toLowerCase();
  if (raw === 'male') return 'Nam';
  if (raw === 'female') return 'Nữ';
  return g;
}

function serviceTypeLabel(type?: string): string {
  if (!type) return '—';
  if (type === 'disease') return 'Bệnh lý di truyền';
  if (type === 'embryo') return 'Phôi thai';
  if (type === 'reproduction') return 'Sinh sản';
  return type;
}

function row(label: string, value?: string | number | boolean | null): string {
  const text =
    value === null || value === undefined || value === ''
      ? '—'
      : typeof value === 'boolean'
        ? value
          ? 'Có'
          : 'Không'
        : String(value);
  return `<tr><td class="label">${escapeHtml(label)}</td><td>${escapeHtml(text)}</td></tr>`;
}

function buildHtml(specify: SpecifyVoteTestResponse): string {
  const patient = specify.patient;
  const doctor = specify.doctor;
  const hospital = specify.hospital;
  const genomeTest = specify.genomeTest;

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; color: #0f172a; padding: 18px; }
    .title { font-size: 22px; font-weight: 700; color: #0369a1; margin: 0 0 4px 0; }
    .subtitle { margin: 0 0 16px 0; font-size: 12px; color: #334155; }
    .section { margin-top: 16px; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
    .section h3 { margin: 0; padding: 10px 12px; background: #f0f9ff; color: #075985; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; }
    td { border-top: 1px solid #f1f5f9; padding: 8px 12px; font-size: 12px; vertical-align: top; }
    td.label { width: 38%; color: #475569; font-weight: 600; }
  </style>
</head>
<body>
  <p class="title">Phiếu chỉ định xét nghiệm</p>
  <p class="subtitle">Mã phiếu: ${escapeHtml(specify.specifyVoteID || '—')}</p>

  <div class="section">
    <h3>Thông tin phiếu</h3>
    <table>
      ${row('Mã phiếu', specify.specifyVoteID)}
      ${row('Loại dịch vụ', serviceTypeLabel(specify.serviceType))}
      ${row('Trạng thái', specify.specifyStatus)}
      ${row('Ngày tạo', formatDateSafe(specify.createdAt))}
      ${row('Ngày lấy mẫu', formatDateSafe(specify.sampleCollectDate))}
      ${row('Vị trí lấy mẫu', specify.samplingSite)}
      ${row('Số lượng phôi', specify.embryoNumber)}
      ${row('Ghi chú', specify.specifyNote)}
    </table>
  </div>

  <div class="section">
    <h3>Thông tin bệnh nhân</h3>
    <table>
      ${row('Họ tên', patient?.patientName)}
      ${row('Giới tính', genderLabel(patient?.gender))}
      ${row('Ngày sinh', formatDateSafe(patient?.patientDob))}
      ${row('Số điện thoại', patient?.patientPhone)}
      ${row('Email', patient?.patientEmail)}
      ${row('Địa chỉ', patient?.patientAddress)}
    </table>
  </div>

  <div class="section">
    <h3>Thông tin chỉ định</h3>
    <table>
      ${row('Bác sĩ chỉ định', doctor?.doctorName)}
      ${row('Bệnh viện', hospital?.hospitalName)}
      ${row('Xét nghiệm', genomeTest?.testName)}
      ${row('Mô tả xét nghiệm', genomeTest?.testDescription)}
    </table>
  </div>
</body>
</html>`;
}

export async function downloadSpecifyPdf(specify: SpecifyVoteTestResponse): Promise<void> {
  const html = buildHtml(specify);
  const file = await Print.printToFileAsync({
    html,
    base64: false,
  });
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Thiết bị không hỗ trợ lưu/chia sẻ PDF.');
  }
  await Sharing.shareAsync(file.uri, {
    UTI: 'com.adobe.pdf',
    mimeType: 'application/pdf',
    dialogTitle: `Lưu PDF phiếu ${specify.specifyVoteID}`,
  });
}
