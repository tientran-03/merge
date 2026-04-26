import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { barcodeService, BarcodeResponse } from '@/services/barcodeService';
import { customerService, CustomerResponse } from '@/services/customerService';
import { doctorService, DoctorResponse } from '@/services/doctorService';
import {
  hospitalStaffService,
  HospitalStaffResponse,
} from '@/services/hospitalStaffService';
import { orderService, OrderResponse } from '@/services/orderService';
import { collectUsedBarcodeStringsFromOrders } from '@/utils/order-barcode';

interface UseOrderDataResult {
  customers: CustomerResponse[];
  doctors: DoctorResponse[];
  staffs: HospitalStaffResponse[];
  barcodes: BarcodeResponse[];
  barcodeOptions: { value: string; label: string; raw: BarcodeResponse }[];
  isLoading: boolean;
}

/**
 * Hook for fetching all data needed for order forms
 * Returns customers, doctors, staffs, barcodes, and computed barcode options
 */
export function useOrderData(): UseOrderDataResult {
  const { data: customersResponse } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customerService.getAll(),
    retry: false,
  });

  const { data: doctorsResponse } = useQuery({
    queryKey: ['doctors'],
    queryFn: () => doctorService.getAll(),
    retry: false,
  });

  const { data: staffResponse } = useQuery({
    queryKey: ['hospital-staffs'],
    queryFn: () => hospitalStaffService.getAll(),
    retry: false,
  });

  const { data: barcodesResponse } = useQuery({
    queryKey: ['barcodes'],
    queryFn: () => barcodeService.getAll(),
    retry: false,
  });

  const { data: ordersResponse } = useQuery({
    queryKey: ['orders'],
    queryFn: () => orderService.getAll(),
    retry: false,
  });

  const customers = (customersResponse as any)?.success
    ? ((customersResponse as any).data as CustomerResponse[]) ?? []
    : [];

  const doctors = (doctorsResponse as any)?.success
    ? ((doctorsResponse as any).data as DoctorResponse[]) ?? []
    : [];

  const staffs = (staffResponse as any)?.success
    ? ((staffResponse as any).data as HospitalStaffResponse[]) ?? []
    : [];

  const barcodes = (barcodesResponse as any)?.success
    ? ((barcodesResponse as any).data as BarcodeResponse[]) ?? []
    : [];

  // Compute barcode options (excluding already used ones)
  const barcodeOptions = useMemo(() => {
    let orders: unknown[] = [];
    if ((ordersResponse as any)?.success && (ordersResponse as any).data) {
      const raw = (ordersResponse as any).data as unknown;
      // Endpoint may return array OR page-like shape { content: [...] }
      if (Array.isArray(raw)) {
        orders = raw;
      } else if (raw && typeof raw === 'object' && Array.isArray((raw as any).content)) {
        orders = (raw as any).content as unknown[];
      }
    }

    // Robust: handle both `barcodeId` and nested `barcode.barcode`
    const used = collectUsedBarcodeStringsFromOrders(orders);

    const normalized = (barcodes as BarcodeResponse[])
      .map((b) => {
        const barcodeString = b?.barcode?.trim() || '';
        if (!barcodeString) return null;

        return {
          value: barcodeString,
          label: barcodeString,
          raw: b,
        };
      })
      .filter(
        (x): x is { value: string; label: string; raw: BarcodeResponse } => x !== null,
      )
      .filter((x) => !used.has(x.value));

    return normalized;
  }, [barcodes, ordersResponse]);

  const isLoading =
    !customersResponse || !doctorsResponse || !staffResponse || !barcodesResponse;

  return {
    customers,
    doctors,
    staffs,
    barcodes,
    barcodeOptions,
    isLoading,
  };
}
