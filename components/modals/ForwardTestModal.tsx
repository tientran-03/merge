import { COLORS } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { presentFeedbackError, presentFeedbackSuccess } from '@/lib/feedbackModal';
import { OrderStatus, PaymentStatus, SpecifyStatus } from '@/lib/schemas/order-form-schema';
import { orderService } from '@/services/orderService';
import { specifyVoteTestService } from '@/services/specifyVoteTestService';
import { PaymentType } from '@/types';
import { X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export interface ForwardSpecifyItem {
  specifyVoteID: string;
  fullSpecifyData?: any;
}

interface ForwardTestModalProps {
  visible: boolean;
  onClose: () => void;
  specifyDataList: ForwardSpecifyItem[];
  onSuccess?: () => void;

  onNavigateToPayment?: (params: {
    orderId: string;
    orderName: string;
    amount: number;
    specifyId: string;
    hasFastq?: boolean;
    allOrderIds?: string;
    allSpecifyIds?: string;
  }) => void;
  onNavigateToOrders?: () => void;
  onNavigateToPatientMetadatas?: () => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

export const ForwardTestModal: React.FC<ForwardTestModalProps> = ({
  visible,
  onClose,
  specifyDataList,
  onSuccess,
  onNavigateToPayment,
  onNavigateToOrders,
  onNavigateToPatientMetadatas,
}) => {
  const { user } = useAuth();
  const [hasFastq, setHasFastq] = useState(false);
  const [paymentType, setPaymentType] = useState<PaymentType>('CASH');
  const [orderName, setOrderName] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [isForwarding, setIsForwarding] = useState(false);

  const isBatch = specifyDataList.length > 1;
  const totalPaymentAmount = useMemo(
    () =>
      specifyDataList.reduce((sum, item) => {
        const gt = item.fullSpecifyData?.genomeTest;
        return sum + (gt?.finalPrice ?? gt?.price ?? 0);
      }, 0),
    [specifyDataList]
  );

  useEffect(() => {
    if (visible) {
      setHasFastq(false);
      setPaymentType('CASH');
      setOrderName('');
      setOrderNote('');
    }
  }, [visible]);

  const handleFastqChange = (checked: boolean) => {
    setHasFastq(checked);
    setPaymentType(checked ? 'ONLINE_PAYMENT' : 'CASH');
  };

  const handleForward = async () => {
    if (specifyDataList.length === 0 || !user?.id) {
      presentFeedbackError({ title: 'Lỗi', message: 'Không thể xác định thông tin người dùng' });
      return;
    }

    if (!orderName.trim()) {
      presentFeedbackError({ title: 'Lỗi', message: 'Vui lòng nhập tên đơn hàng' });
      return;
    }

    setIsForwarding(true);

    try {
      const createdOrders: Array<{ orderId: string; specifyId: string; amount: number }> = [];

      for (const specifyData of specifyDataList) {
        const genomeTest = specifyData.fullSpecifyData?.genomeTest;
        const paymentAmount = genomeTest?.finalPrice ?? genomeTest?.price ?? 0;
        const initialOrderStatus =
          !hasFastq && paymentType === 'CASH'
            ? OrderStatus.FORWARD_ANALYSIS
            : OrderStatus.INITIATION;

        const singleOrderName =
          specifyDataList.length === 1
            ? orderName.trim()
            : `${orderName.trim()} - ${specifyData.specifyVoteID}`;

        const orderRequest: any = {
          orderName: singleOrderName,
          ...(user.role === 'ROLE_CUSTOMER' && { customerId: user.id }),
          specifyId: specifyData.specifyVoteID,
          paymentType: paymentType,
          paymentAmount: paymentAmount > 0 ? paymentAmount : undefined,
          orderStatus: initialOrderStatus,
          paymentStatus: paymentType === 'ONLINE_PAYMENT' ? PaymentStatus.PENDING : PaymentStatus.UNPAID,
          ...(orderNote.trim() && { orderNote: orderNote.trim() }),
        };

        const orderResult = await orderService.create(orderRequest);

        if (orderResult.success && orderResult.data) {
          const order = orderResult.data;
          const orderId = order.orderId;
          const amountVal = paymentAmount > 0 ? paymentAmount : (order.paymentAmount ?? 0);
          createdOrders.push({
            orderId,
            specifyId: specifyData.specifyVoteID,
            amount: amountVal,
          });
        } else {
          throw new Error(
            orderResult.error || `Không thể tạo đơn hàng cho phiếu ${specifyData.specifyVoteID}`
          );
        }
      }

      if (paymentType === 'ONLINE_PAYMENT') {
        if (hasFastq) {
          for (const o of createdOrders) {
            await specifyVoteTestService.updateStatus(o.specifyId, SpecifyStatus.WAITING_RECEIVE_SAMPLE);
          }
        }
        const totalAmount = createdOrders.reduce((s, o) => s + o.amount, 0);
        const first = createdOrders[0]!;
        if (totalAmount > 0 && onNavigateToPayment) {
          onClose();
          onSuccess?.();
          onNavigateToPayment({
            orderId: first.orderId,
            orderName: orderName.trim(),
            amount: totalAmount,
            specifyId: first.specifyId,
            hasFastq,
            ...(createdOrders.length > 1 && {
              allOrderIds: createdOrders.map(o => o.orderId).join(','),
              allSpecifyIds: createdOrders.map(o => o.specifyId).join(','),
            }),
          });
        } else {
          presentFeedbackError({ title: 'Lỗi', message: 'Không thể khởi tạo thanh toán online' });
        }
      } else if (paymentType === 'CASH') {
        if (!hasFastq) {
          for (const o of createdOrders) {
            await specifyVoteTestService.updateStatus(o.specifyId, SpecifyStatus.FORWARD_ANALYSIS);
          }
          onClose();
          onSuccess?.();
          presentFeedbackSuccess({
            title: 'Thành công',
            message: 'Đã tạo đơn hàng! Staff sẽ phê duyệt và thông báo khi sẵn sàng.',
            onAfterClose: () => onNavigateToOrders?.(),
          });
        } else {
          for (const o of createdOrders) {
            await specifyVoteTestService.updateStatus(o.specifyId, SpecifyStatus.FORWARD_ANALYSIS);
          }
          onClose();
          onSuccess?.();
          const msg =
            specifyDataList.length === 1
              ? 'Chuyển tiếp xét nghiệm thành công!'
              : `Chuyển tiếp ${specifyDataList.length} phiếu xét nghiệm thành công!`;
          presentFeedbackSuccess({
            title: 'Thành công',
            message: msg,
            onAfterClose: () => onNavigateToPatientMetadatas?.(),
          });
        }
      } else {
        presentFeedbackSuccess({
          title: 'Thành công',
          message: 'Đã chuyển phiếu chỉ định thành đơn hàng thành công!',
          onAfterClose: () => {
            onSuccess?.();
            onClose();
          },
        });
      }
    } catch (error: any) {
      console.error('Error forwarding test:', error);

      const errorMessage = error?.message || error?.toString() || '';
      if (
        errorMessage.includes('duplicate key') ||
        errorMessage.includes('uk66b7ribqen473vde5ay62u050') ||
        errorMessage.includes('already exists')
      ) {
        presentFeedbackError({
          title: 'Lỗi',
          message:
            'Một hoặc nhiều phiếu đã được chuyển thành đơn hàng. Vui lòng làm mới danh sách và thử lại.',
        });
      } else {
        presentFeedbackError({
          title: 'Lỗi',
          message: errorMessage || 'Không thể chuyển phiếu chỉ định. Vui lòng thử lại.',
        });
      }
    } finally {
      setIsForwarding(false);
    }
  };

  const title = isBatch ? 'Chuyển tiếp xét nghiệm' : 'Chuyển phiếu chỉ định';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 items-center justify-center px-4">
        <View className="bg-white rounded-2xl w-full max-w-md p-6">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-extrabold text-slate-900">{title}</Text>
            <TouchableOpacity onPress={onClose} disabled={isForwarding} className="w-8 h-8 items-center justify-center">
              <X size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {specifyDataList.length === 0 ? (
              <Text className="text-sm text-slate-600 mb-4">Không có phiếu nào được chọn.</Text>
            ) : isBatch ? (
              <View className="mb-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
                <Text className="text-[13px] text-slate-600 mb-2">
                  Số phiếu đã chọn:{' '}
                  <Text className="font-extrabold text-slate-900">{specifyDataList.length}</Text>
                </Text>
                <View className="max-h-36">
                  {specifyDataList.map(item => {
                    const gt = item.fullSpecifyData?.genomeTest;
                    const price = gt?.finalPrice ?? gt?.price ?? 0;
                    return (
                      <View
                        key={item.specifyVoteID}
                        className="flex-row justify-between py-1.5 border-b border-slate-100 last:border-b-0"
                      >
                        <Text className="text-[12px] font-semibold text-slate-700 flex-1 pr-2" numberOfLines={2}>
                          {item.specifyVoteID}
                          {gt?.testName ? ` · ${gt.testName}` : ''}
                        </Text>
                        <Text className="text-[12px] font-bold text-sky-700">{formatCurrency(price)}</Text>
                      </View>
                    );
                  })}
                </View>
                <View className="flex-row justify-between mt-2 pt-2 border-t border-slate-200">
                  <Text className="text-[13px] font-semibold text-slate-600">Tổng cộng</Text>
                  <Text className="text-[14px] font-extrabold text-sky-700">{formatCurrency(totalPaymentAmount)}</Text>
                </View>
              </View>
            ) : (
              <View className="mb-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
                <Text className="text-[12px] text-slate-500">Mã phiếu</Text>
                <Text className="text-[14px] font-bold text-slate-900">{specifyDataList[0]?.specifyVoteID}</Text>
                {specifyDataList[0]?.fullSpecifyData?.genomeTest?.testName ? (
                  <Text className="text-[12px] text-slate-600 mt-1">
                    {specifyDataList[0].fullSpecifyData.genomeTest.testName}
                  </Text>
                ) : null}
              </View>
            )}

            <View className="mb-4">
              <Text className="text-[13px] font-semibold text-slate-700 mb-2">
                Tên đơn hàng <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-[14px] text-slate-900 font-semibold"
                placeholder={isBatch ? 'Tên chung cho các đơn (mỗi đơn sẽ thêm mã phiếu)' : 'Nhập tên đơn hàng'}
                placeholderTextColor="#94A3B8"
                value={orderName}
                onChangeText={setOrderName}
                editable={!isForwarding}
              />
            </View>

            <View className="mb-4">
              <Text className="text-[13px] font-semibold text-slate-700 mb-2">Phương thức thanh toán</Text>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => !hasFastq && setPaymentType('CASH')}
                  disabled={isForwarding || hasFastq}
                  className={`flex-1 rounded-xl py-3 px-4 items-center border-2 ${paymentType === 'CASH'
                    ? 'bg-sky-50 border-sky-500'
                    : hasFastq
                      ? 'bg-slate-100 border-slate-200 opacity-60'
                      : 'bg-white border-slate-200'
                    }`}
                >
                  <Text
                    className={`font-bold text-[13px] ${paymentType === 'CASH' ? 'text-sky-700' : 'text-slate-600'}`}
                  >
                    Tiền mặt
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPaymentType('ONLINE_PAYMENT')}
                  disabled={isForwarding}
                  className={`flex-1 rounded-xl py-3 px-4 items-center border-2 ${paymentType === 'ONLINE_PAYMENT' ? 'bg-sky-50 border-sky-500' : 'bg-white border-slate-200'
                    }`}
                >
                  <Text
                    className={`font-bold text-[13px] ${paymentType === 'ONLINE_PAYMENT' ? 'text-sky-700' : 'text-slate-600'
                      }`}
                  >
                    Online
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View className="mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-[13px] font-semibold text-slate-700">Có FASTQ file</Text>
                <Switch
                  value={hasFastq}
                  onValueChange={handleFastqChange}
                  disabled={isForwarding}
                  trackColor={{ false: '#E2E8F0', true: COLORS.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <Text className="text-xs text-slate-500 mt-1">
                Nếu chọn có FASTQ file, phương thức thanh toán tự động chuyển sang Online
              </Text>
            </View>

            <View className="mb-4">
              <Text className="text-[13px] font-semibold text-slate-700 mb-2">Ghi chú</Text>
              <TextInput
                className="min-h-[80px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] text-slate-900 font-semibold"
                placeholder="Nhập ghi chú (nếu có)"
                placeholderTextColor="#94A3B8"
                value={orderNote}
                onChangeText={setOrderNote}
                multiline
                textAlignVertical="top"
                editable={!isForwarding}
              />
            </View>

            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity
                onPress={onClose}
                disabled={isForwarding}
                className="flex-1 rounded-xl py-3 px-4 bg-slate-100 items-center"
              >
                <Text className="text-slate-700 font-bold text-[14px]">Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleForward}
                disabled={isForwarding || !orderName.trim() || specifyDataList.length === 0}
                className={`flex-1 rounded-xl py-3 px-4 items-center ${isForwarding || !orderName.trim() || specifyDataList.length === 0 ? 'bg-slate-300' : 'bg-sky-600'
                  }`}
              >
                {isForwarding ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-white font-bold text-[14px]">
                    {isBatch ? `Chuyển tiếp (${specifyDataList.length})` : 'Chuyển'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
