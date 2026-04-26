import { CheckCircle, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { approvePatientMetadataResultsOutput } from '@/lib/approveResultsOutput';

interface ApproveResultsModalProps {
  visible: boolean;
  onClose: () => void;
  labcode: string;
  specifyId?: string;
  patientName?: string;
  onSuccess?: () => void;
}

export const ApproveResultsModal: React.FC<ApproveResultsModalProps> = ({
  visible,
  onClose,
  labcode,
  specifyId,
  patientName,
  onSuccess,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await approvePatientMetadataResultsOutput({ labcode, specifyId });

      onClose();
      onSuccess?.();
      Alert.alert('Thành công', `Đã duyệt kết quả đầu ra cho mẫu ${labcode}`);
    } catch (error: any) {
      Alert.alert('Lỗi', error?.message || 'Không thể duyệt kết quả. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black/50 items-center justify-center px-4">
        <View className="bg-white rounded-2xl w-full max-w-md p-6">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-2">
              <CheckCircle size={24} color="#16a34a" />
              <Text className="text-lg font-extrabold text-slate-900">Duyệt kết quả đầu ra</Text>
            </View>
            <TouchableOpacity onPress={onClose} disabled={isSubmitting} className="w-8 h-8 items-center justify-center">
              <X size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <Text className="text-sm text-slate-600 mb-4">
            Xác nhận duyệt kết quả phân tích cho mẫu bệnh nhân.
          </Text>

          <View className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
            <View className="flex-row justify-between mb-2">
              <Text className="text-slate-600 text-sm">Labcode:</Text>
              <Text className="font-semibold text-slate-800">{labcode}</Text>
            </View>
            {patientName && (
              <View className="flex-row justify-between mb-2">
                <Text className="text-slate-600 text-sm">Bệnh nhân:</Text>
                <Text className="font-semibold text-slate-800">{patientName}</Text>
              </View>
            )}
            {specifyId && (
              <View className="flex-row justify-between">
                <Text className="text-slate-600 text-sm">Mã phiếu XN:</Text>
                <Text className="font-semibold text-slate-800">{specifyId}</Text>
              </View>
            )}
          </View>

          <View className="bg-slate-50 rounded-xl p-3 mb-6">
            <Text className="font-semibold text-slate-700 mb-1 text-sm">Khi duyệt kết quả:</Text>
            <Text className="text-slate-600 text-xs">
              • Trạng thái mẫu → Hoàn thành{'\n'}
              • Phiếu XN và đơn hàng → Chờ duyệt kết quả{'\n'}
              • Thông báo gửi tới bác sĩ và khách hàng
            </Text>
          </View>

          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={onClose}
              disabled={isSubmitting}
              className="flex-1 rounded-xl py-3 bg-slate-100 items-center"
            >
              <Text className="text-slate-700 font-bold">Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleApprove}
              disabled={isSubmitting}
              className={`flex-1 rounded-xl py-3 flex-row items-center justify-center gap-2 ${isSubmitting ? 'bg-slate-300' : 'bg-emerald-600'}`}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <CheckCircle size={18} color="#fff" />
                  <Text className="text-white font-bold">Xác nhận duyệt</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
