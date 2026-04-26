import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export const INVOICE_WIDTH = 600;

export interface InvoiceData {
  orderId: string;
  orderName?: string;
  transactionId?: string;
  transactionDate?: string | Date;
  genomeTest?: {
    testId?: string;
    testName?: string;
    code?: string;
    price?: number;
    taxRate?: number;
    finalPrice?: number;
  };
  patient?: {
    patientId?: string;
    patientName?: string;
    patientPhone?: string;
    patientDob?: string;
    gender?: string;
    patientAddress?: string;
  };
  amountPaid?: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

const formatDate = (date?: string | Date) => {
  if (!date) return new Date().toLocaleString('vi-VN');
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('vi-VN');
};

interface InvoiceViewProps {
  data: InvoiceData;
  collapsable?: boolean;
  preview?: boolean;
  width?: number;
}

export function InvoiceView({ data, collapsable = false, preview = false, width }: InvoiceViewProps) {
  const basePrice = data.genomeTest?.price || 0;
  const taxRate = data.genomeTest?.taxRate ?? 10;
  const vatAmount = basePrice * (taxRate / 100);
  const finalPrice = data.genomeTest?.finalPrice ?? basePrice + vatAmount;
  const total = data.amountPaid ?? finalPrice;

  const layoutWidth = width ?? INVOICE_WIDTH;

  return (
    <View style={[styles.container, { width: layoutWidth }]} collapsable={collapsable}>
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>HT GENETIC LAB</Text>
          <Text style={styles.logoSub}>Xét nghiệm di truyền chất lượng cao</Text>
        </View>
        <View style={styles.invoiceId}>
          <Text style={styles.invoiceIdLabel}>Mã hóa đơn</Text>
          <Text style={styles.invoiceIdValue}>{data.orderId}</Text>
        </View>
      </View>
      <View style={styles.content}>
        {preview ? (
          <View style={styles.previewBanner}>
            <Text style={styles.previewBannerText}>Xem trước — chưa lưu / chưa ghi nhận thanh toán</Text>
          </View>
        ) : null}
        <View style={styles.title}>
          <Text style={styles.titleH2}>HÓA ĐƠN THANH TOÁN</Text>
          <Text style={styles.titleDate}>Ngày: {formatDate(data.transactionDate)}</Text>
        </View>
        {data.patient && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thông tin bệnh nhân</Text>
            <View style={styles.infoGrid}>
              <Text style={styles.infoRow}>
                <Text style={styles.infoLabel}>Họ tên: </Text>
                <Text style={styles.infoValue}>{data.patient.patientName || '-'}</Text>
              </Text>
              <Text style={styles.infoRow}>
                <Text style={styles.infoLabel}>Mã BN: </Text>
                <Text style={styles.infoValue}>{data.patient.patientId || '-'}</Text>
              </Text>
              <Text style={styles.infoRow}>
                <Text style={styles.infoLabel}>Ngày sinh: </Text>
                <Text style={styles.infoValue}>
                  {data.patient.patientDob
                    ? new Date(data.patient.patientDob).toLocaleDateString('vi-VN')
                    : '-'}
                </Text>
              </Text>
              <Text style={styles.infoRow}>
                <Text style={styles.infoLabel}>Điện thoại: </Text>
                <Text style={styles.infoValue}>{data.patient.patientPhone || '-'}</Text>
              </Text>
            </View>
          </View>
        )}
        {data.genomeTest && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dịch vụ xét nghiệm</Text>
            <Text style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tên xét nghiệm: </Text>
              <Text style={styles.infoValue}>{data.genomeTest.testName || '-'}</Text>
            </Text>
            {data.genomeTest.code && (
              <Text style={styles.infoRow}>
                <Text style={styles.infoLabel}>Mã: </Text>
                <Text style={styles.infoValue}>{data.genomeTest.code}</Text>
              </Text>
            )}
          </View>
        )}
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>
              {data.genomeTest?.testName || data.orderName || 'Dịch vụ xét nghiệm'}
            </Text>
            <Text style={[styles.tableCell, styles.tableCellRight]}>
              {formatCurrency(basePrice)}
            </Text>
          </View>
          <View style={[styles.tableRow, styles.vatRow]}>
            <Text style={styles.tableCell}>Thuế VAT ({taxRate}%)</Text>
            <Text style={[styles.tableCell, styles.tableCellRight]}>
              {formatCurrency(vatAmount)}
            </Text>
          </View>
          <View style={[styles.tableRow, styles.footerRow]}>
            <Text style={styles.footerCell}>TỔNG CỘNG</Text>
            <Text style={[styles.footerCell, styles.footerCellRight]}>{formatCurrency(total)}</Text>
          </View>
        </View>
        {data.transactionId && (
          <View style={styles.successBox}>
            <Text style={styles.successTitle}>Đã thanh toán</Text>
            <Text style={styles.successInfo}>
              Mã giao dịch: {data.transactionId}
              {'\n'}
              Thời gian: {formatDate(data.transactionDate)}
            </Text>
          </View>
        )}
        <View style={styles.footer}>
          <Text style={styles.footerCompany}>HT GENETIC LAB</Text>
          <Text style={styles.footerText}>
            Địa chỉ: Tòa nhà FPT, Khu CNC Hòa Lạc, Thạch Thất, Hà Nội
          </Text>
          <Text style={styles.footerText}>Hotline: 1900-xxxx | Email: support@htgenetic.io.vn</Text>
          <Text style={styles.footerThanks}>Cảm ơn quý khách đã sử dụng dịch vụ của chúng tôi</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#0284c7',
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logo: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  logoSub: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 4 },
  invoiceId: { alignItems: 'flex-end' },
  invoiceIdLabel: { fontSize: 12, color: 'rgba(255,255,255,0.9)' },
  invoiceIdValue: { fontFamily: 'monospace', fontWeight: '600', color: '#fff', fontSize: 14 },
  content: { padding: 24, backgroundColor: '#fff' },
  previewBanner: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  previewBannerText: {
    color: '#92400e',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  title: { alignItems: 'center', marginBottom: 24 },
  titleH2: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 },
  titleDate: { color: '#64748b', fontSize: 14 },
  section: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: { fontWeight: '600', color: '#475569', marginBottom: 12 },
  infoGrid: { gap: 8 },
  infoRow: { fontSize: 14, marginBottom: 4 },
  infoLabel: { color: '#64748b' },
  infoValue: { fontWeight: '500' },
  table: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 20,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableCell: { flex: 1, fontSize: 14, color: '#334155' },
  tableCellRight: { textAlign: 'right', fontWeight: '500' },
  vatRow: { backgroundColor: '#f8fafc' },
  footerRow: { backgroundColor: '#0284c7', borderBottomWidth: 0 },
  footerCell: { flex: 1, color: '#fff', fontWeight: '600', fontSize: 14 },
  footerCellRight: { textAlign: 'right', fontSize: 18, fontWeight: 'bold' },
  successBox: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  successTitle: { color: '#166534', fontWeight: '600', marginBottom: 8 },
  successInfo: { color: '#15803d', fontSize: 14 },
  footer: { alignItems: 'center', paddingTop: 20, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  footerCompany: { fontWeight: '600', color: '#475569', marginBottom: 4 },
  footerText: { color: '#64748b', fontSize: 12, marginBottom: 2 },
  footerThanks: { color: '#94a3b8', fontSize: 12, marginTop: 8 },
});
