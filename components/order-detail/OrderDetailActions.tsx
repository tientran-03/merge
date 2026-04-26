import { Edit, Trash2 } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
      <View style={styles.container}>
        <TouchableOpacity
          style={[styles.button, styles.editButton]}
          onPress={onEdit}
          activeOpacity={0.8}
        >
          <Edit size={18} color={COLORS.primary} />
          <Text style={styles.editButtonText}>Chỉnh sửa</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.deleteButton]}
          onPress={() => setShowDeleteModal(true)}
          disabled={deleteLoading}
          activeOpacity={0.8}
        >
          <Trash2 size={18} color={COLORS.danger} />
          <Text style={styles.deleteButtonText}>Xóa đơn</Text>
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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  editButton: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  deleteButton: {
    backgroundColor: `${COLORS.danger}15`,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.danger,
  },
});
