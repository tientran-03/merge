import { API_ENDPOINTS } from "@/config/api";

import { apiClient, ApiResponse } from "./api";

/** Khớp web `notificationApi.sendToUser` — POST `/api/v1/notifications/send/user/{receiverId}` */
export type SendNotificationPayload = {
  title: string;
  body: string;
  senderId?: string;
  senderRole?: string;
  senderName?: string;
  notificationType?: string;
  data?: Record<string, string>;
};

export const notificationService = {
  sendToUser: async (
    receiverId: string,
    payload: SendNotificationPayload,
    receiverRole?: string,
  ): Promise<ApiResponse<unknown>> => {
    const q = receiverRole ? `?receiverRole=${encodeURIComponent(receiverRole)}` : "";
    return apiClient.post<unknown>(
      `${API_ENDPOINTS.NOTIFICATIONS}/send/user/${encodeURIComponent(receiverId)}${q}`,
      payload,
    );
  },
};
