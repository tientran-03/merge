/**
 * Centralized error handling for order operations
 * Converts API errors into user-friendly Vietnamese messages
 */

import { Alert } from 'react-native';

export interface OrderErrorHandlerOptions {
  silent?: boolean; // If true, returns message instead of showing alert
}

/**
 * Handle order-related API errors and display appropriate messages
 */
export function handleOrderError(
  error: unknown,
  options: OrderErrorHandlerOptions = {},
): string {
  const { silent = false } = options;

  // Extract error message
  let msg =
    (error as { message?: string })?.message ||
    (error as { error?: string })?.error ||
    'Không thể thực hiện thao tác. Vui lòng thử lại.';

  // Parse and convert to user-friendly message
  msg = parseOrderErrorMessage(msg);

  if (!silent) {
    Alert.alert('Lỗi', msg);
  }

  return msg;
}

/**
 * Parse order-specific error messages into Vietnamese
 */
function parseOrderErrorMessage(message: string): string {
  // Entity not found errors
  if (message.includes('not found')) {
    if (message.includes('Customer') || message.includes('customerId'))
      return 'Khách hàng không tồn tại. Vui lòng chọn lại khách hàng.';
    if (message.includes('Sample collector') || message.includes('sampleCollectorId'))
      return 'Nhân viên thu mẫu không tồn tại. Vui lòng chọn lại.';
    if (message.includes('Staff analyst') || message.includes('staffAnalystId'))
      return 'Nhân viên phân tích không tồn tại. Vui lòng chọn lại.';
    if (message.includes('Barcode') || message.includes('barcodeId'))
      return 'Mã barcode không tồn tại hoặc đã được sử dụng.';
    if (message.includes('Doctor') || message.includes('doctorId'))
      return 'Bác sĩ không tồn tại. Vui lòng chọn lại bác sĩ.';
    if (message.includes('Patient') || message.includes('patientId'))
      return 'Bệnh nhân không tồn tại.';
    if (message.includes('Service') || message.includes('serviceId'))
      return 'Dịch vụ không tồn tại.';
    if (message.includes('Order') || message.includes('orderId'))
      return 'Đơn hàng không tồn tại.';
    return 'Dữ liệu không tồn tại. Vui lòng kiểm tra lại.';
  }

  // Duplicate/already exists errors
  if (message.includes('already exists')) {
    if (message.includes('orderName') || message.includes('order_name'))
      return 'Tên đơn hàng đã tồn tại. Vui lòng chọn tên khác.';
    if (message.includes('Barcode'))
      return 'Mã barcode đã được sử dụng. Vui lòng chọn mã khác.';
    return 'Giá trị này đã tồn tại. Vui lòng chọn giá trị khác.';
  }

  if (message.includes('already in use')) {
    if (message.includes('Barcode'))
      return 'Mã barcode đã được sử dụng. Vui lòng chọn mã khác.';
    return 'Giá trị này đã được sử dụng. Vui lòng chọn giá trị khác.';
  }

  // Validation errors
  if (message.includes('validation') || message.includes('valid')) {
    if (message.includes('email'))
      return 'Email không hợp lệ.';
    if (message.includes('phone'))
      return 'Số điện thoại không hợp lệ.';
    if (message.includes('required'))
      return 'Vui lòng điền đầy đủ các trường bắt buộc.';
    return 'Dữ liệu nhập không hợp lệ. Vui lòng kiểm tra lại.';
  }

  // Server errors
  if (message.includes('500') || message.includes('Internal Server Error')) {
    return 'Lỗi máy chủ. Vui lòng thử lại sau hoặc liên hệ quản trị viên.';
  }

  if (message.includes('503') || message.includes('Service Unavailable')) {
    return 'Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.';
  }

  if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
    return 'Kết nối quá hạn. Vui lòng kiểm tra mạng và thử lại.';
  }

  if (message.includes('network') || message.includes('fetch')) {
    return 'Lỗi kết nối mạng. Vui lòng kiểm tra kết nối internet.';
  }

  // Unauthorized
  if (message.includes('401') || message.includes('Unauthorized') || message.includes('token')) {
    return 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.';
  }

  // Forbidden
  if (message.includes('403') || message.includes('Forbidden')) {
    return 'Bạn không có quyền thực hiện thao tác này.';
  }

  // Return original message if no specific pattern matched
  return message;
}

/**
 * Show alert with loading state handling
 */
export function showAlertWithError(
  title: string,
  error: unknown,
  onRetry?: () => void,
): void {
  const message = handleOrderError(error, { silent: true });

  if (onRetry) {
    Alert.alert(
      title,
      message,
      [
        { text: 'Đóng', style: 'cancel' },
        { text: 'Thử lại', onPress: onRetry },
      ],
    );
  } else {
    Alert.alert(title, message);
  }
}
