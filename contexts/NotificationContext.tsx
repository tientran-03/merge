import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Notification } from "@/components/notification/Notification";

export type NotificationType = "success" | "error" | "warning" | "info";

export interface NotificationData {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  onPress?: () => void;
}

interface NotificationContextType {
  showNotification: (notification: Omit<NotificationData, "id">) => void;
  hideNotification: (id: string) => void;
  showSuccess: (title: string, message?: string, duration?: number) => void;
  showError: (title: string, message?: string, duration?: number) => void;
  showWarning: (title: string, message?: string, duration?: number) => void;
  showInfo: (title: string, message?: string, duration?: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);

  const showNotification = useCallback((notification: Omit<NotificationData, "id">) => {
    const id = `notification-${Date.now()}-${Math.random()}`;
    const newNotification: NotificationData = {
      ...notification,
      id,
      duration: notification.duration ?? 3000,
    };

    setNotifications((prev) => [...prev, newNotification]);

    // Auto hide after duration
    if (newNotification.duration > 0) {
      setTimeout(() => {
        hideNotification(id);
      }, newNotification.duration);
    }
  }, []);

  const hideNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const showSuccess = useCallback(
    (title: string, message?: string, duration?: number) => {
      showNotification({ type: "success", title, message, duration });
    },
    [showNotification]
  );

  const showError = useCallback(
    (title: string, message?: string, duration?: number) => {
      showNotification({ type: "error", title, message, duration });
    },
    [showNotification]
  );

  const showWarning = useCallback(
    (title: string, message?: string, duration?: number) => {
      showNotification({ type: "warning", title, message, duration });
    },
    [showNotification]
  );

  const showInfo = useCallback(
    (title: string, message?: string, duration?: number) => {
      showNotification({ type: "info", title, message, duration });
    },
    [showNotification]
  );

  return (
    <NotificationContext.Provider
      value={{
        showNotification,
        hideNotification,
        showSuccess,
        showError,
        showWarning,
        showInfo,
      }}
    >
      {children}
      <NotificationContainer notifications={notifications} onHide={hideNotification} />
    </NotificationContext.Provider>
  );
};

const NotificationContainer: React.FC<{
  notifications: NotificationData[];
  onHide: (id: string) => void;
}> = ({ notifications, onHide }) => {
  // Only show the latest notification (or can be configured to show multiple)
  const latestNotification = notifications[notifications.length - 1];
  
  if (!latestNotification) return null;

  return (
    <Notification
      key={latestNotification.id}
      notification={latestNotification}
      onHide={() => onHide(latestNotification.id)}
    />
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within NotificationProvider");
  }
  return context;
};
