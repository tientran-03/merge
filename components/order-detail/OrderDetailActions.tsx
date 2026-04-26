import { Edit, Trash2 } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { COLORS } from '@/constants/colors';
import { ConfirmModal } from '@/components/modals';

interface OrderDetailActionsProps {
  orderId: string;
  onEdit: () => void;
  onDelete: () => void;
  deleteLoading?: boolean;
}

export function OrderDetailActions({
  orderId,
  onEdit,
  onDelete,
  deleteLoading = false,
}: OrderDetailActionsProps) {
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);

  const handleDeleteConfirm = () => {
    setShowDeleteModal(false);
    onDelete();
  };

  return (
    <>
      <View
        className="flex-row gap-3 px-4 py-3 border-t"
        style={{
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
        }}
      >
        <TouchableOpacity
          className="flex-1 flex-row items-center justify-center py-3 rounded-xl gap-2 border"
          style={{
            backgroundColor: COLORS.primarySoft,
            borderColor: COLORS.primary,
          }}
          onPress={onEdit}
          activeOpacity={0.8}
        >
          <Edit size={18} color={COLORS.primary} />
          <Text
            className="text-[15px] font-bold"
            style={{ color: COLORS.primary }}
          >
            Chỉnh sửa
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="flex-1 flex-row items-center justify-center py-3 rounded-xl gap-2 border"
          style={{
            backgroundColor: `${COLORS.danger}15`,
            borderColor: COLORS.danger,
          }}
          onPress={() => setShowDeleteModal(true)}
          disabled={deleteLoading}
          activeOpacity={0.8}
        >
          <Trash2 size={18} color={COLORS.danger} />
          <Text
            className="text-[15px] font-bold"
            style={{ color: COLORS.danger }}
          >
            Xóa đơn
          </Text>
        </TouchableOpacity>
      </View>

      <ConfirmModal
        visible={showDeleteModal}
        title="Xác nhận xóa"
        message={`Bạn có chắc muốn xóa đơn hàng #${orderId} không? Hành động này không thể hoàn tác.`}
        confirmText="Xóa"
        cancelText="Hủy"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteModal(false)}
        destructive
      />
    </>
  );
}