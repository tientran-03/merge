import { z } from 'zod';
import { ORDER_STATUS_DEFAULT } from '@/lib/constants/order-status';

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
    'awaiting_results_approval',
    'results_approved',
    'completed',
    'sample_addition',
  ]),
  paymentStatus: z.enum(['COMPLETED', 'UNPAID']),
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
  orderStatus: ORDER_STATUS_DEFAULT,
  paymentStatus: 'UNPAID',
  paymentType: 'CASH',
  paymentAmount: '',
  orderNote: '',
};
