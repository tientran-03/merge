import { z } from 'zod';
import { ORDER_STATUS_ON_CREATE } from '@/lib/constants/order-status';

export const simpleOrderSchema = z.object({
  orderName: z.string().min(1, 'Tên đơn hàng là bắt buộc'),
  customerId: z.string().optional(),
  sampleCollectorId: z.string().optional(),
  staffAnalystId: z.string().optional(),
  barcodeId: z.string().optional(),
  orderStatus: z.enum([
    'initiation',
    'forward_analysis',
    'accepted',
    'rejected',
    'in_progress',
    'sample_error',
    'rerun_testing',
    'completed',
    'sample_addition',
  ]),
  paymentStatus: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'UNPAID']),
  paymentType: z.enum(['CASH', 'ONLINE_PAYMENT']),
  paymentAmount: z.string().optional(),
  orderNote: z.string().optional(),
});

export type SimpleOrderFormData = z.infer<typeof simpleOrderSchema>;

export const simpleOrderDefaultValues: SimpleOrderFormData = {
  orderName: '',
  customerId: '',
  sampleCollectorId: '',
  staffAnalystId: '',
  barcodeId: '',
  orderStatus: ORDER_STATUS_ON_CREATE,
  paymentStatus: 'PENDING',
  paymentType: 'CASH',
  paymentAmount: '',
  orderNote: '',
};
