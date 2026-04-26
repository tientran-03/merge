import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { OrderResponse } from '@/services/orderService';

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

function formatMoney(amount?: number | null): string {
  if (amount === undefined || amount === null) return '—';
  return new Intl.NumberFormat('vi-VN').format(amount) + ' VND';
}

function row(label: string, value?: string | number | null): string {
  const text =
    value === null || value === undefined || value === ''
      ? '—'
      : typeof value === 'number'
        ? String(value)
        : String(value);
  return `<tr><td class="label">${escapeHtml(label)}</td><td>${escapeHtml(text)}</td></tr>`;
}

function paymentTypeLabel(type?: string): string {
  if (!type) return '—';
  const u = type.toUpperCase();
  if (u === 'CASH') return 'Tiền mặt';
  if (u === 'ONLINE_PAYMENT') return 'Chuyển khoản';
  return type;
}

function paymentStatusLabel(status?: string): string {
  if (!status) return '—';
  const u = status.toUpperCase();
  if (u === 'COMPLETED') return 'Đã thanh toán';
  if (u === 'PENDING') return 'Chờ thanh toán';
  return status;
}

function buildHtml(order: OrderResponse): string {
  const sp = order.specifyId;
  const patientLine =
    order.patientMetadata && order.patientMetadata.length > 0
      ? order.patientMetadata.map((m) => m.patientId || m.labcode || '—').join(', ')
      : sp?.patientId || '—';

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
  <p class="title">Thông tin đơn hàng</p>
  <p class="subtitle">Mã đơn: ${escapeHtml(order.orderId || '—')}</p>

  <div class="section">
    <h3>Đơn hàng</h3>
    <table>
      ${row('Tên đơn', order.orderName)}
      ${row('Trạng thái đơn', order.orderStatus)}
      ${row('Thanh toán', paymentStatusLabel(order.paymentStatus))}
      ${row('Hình thức TT', paymentTypeLabel(order.paymentType))}
      ${row('Số tiền', formatMoney(order.paymentAmount))}
      ${row('Khách hàng', order.customerName)}
      ${row('Ngày tạo', formatDateSafe(order.createdAt))}
      ${row('Ngày trả KQ', formatDateSafe(order.resultDate))}
      ${row('Ghi chú', order.orderNote)}
    </table>
  </div>

  <div class="section">
    <h3>Phiếu chỉ định & dịch vụ</h3>
    <table>
      ${row('Mã phiếu', sp?.specifyVoteID || (sp as { specifyVoteId?: string } | undefined)?.specifyVoteId)}
      ${row('Bệnh viện / PK', sp?.hospital?.hospitalName)}
      ${row('Xét nghiệm', sp?.genomeTest?.testName)}
      ${row('BN / mã lab', patientLine)}
    </table>
  </div>
</body>
</html>`;
}

export async function downloadOrderPdf(order: OrderResponse): Promise<void> {
  const html = buildHtml(order);
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
    dialogTitle: `Lưu PDF đơn ${order.orderId}`,
  });
}
