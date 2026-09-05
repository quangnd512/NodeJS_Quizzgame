// Goi API Thong bao - khop 1-1 voi frontend/src/lib/api.ts (phan Notifications).
// Backend: backend/src/routes/notifications.route.ts
import { request } from './client';

export type NotificationType =
  | 'STREAK_MILESTONE'
  | 'RANK_UP'
  | 'RANK_DOWN'
  | 'REPORT_RESOLVED'
  | 'NEW_EXAM_PAPER';

export type NotificationTargetScreen = 'progress' | 'leaderboard' | 'exam' | null;

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  targetScreen: NotificationTargetScreen;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface NotificationListResponse {
  notifications: NotificationItem[];
  total: number;
  unreadCount: number;
}

/** GET /api/notifications?page=N&limit=N */
export async function getNotifications(
  token: string,
  page = 1,
  limit = 20,
): Promise<NotificationListResponse> {
  return request<NotificationListResponse>(
    `/api/notifications?page=${page}&limit=${limit}`,
    token,
  );
}

/** GET /api/notifications/unread-count */
export async function getUnreadCount(token: string): Promise<{ count: number }> {
  return request<{ count: number }>('/api/notifications/unread-count', token);
}

/** PATCH /api/notifications/:id/read */
export async function markNotificationAsRead(
  token: string,
  notificationId: string,
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(
    `/api/notifications/${notificationId}/read`,
    token,
    { method: 'PATCH' },
  );
}

/** PATCH /api/notifications/read-all */
export async function markAllNotificationsAsRead(
  token: string,
): Promise<{ updatedCount: number }> {
  return request<{ updatedCount: number }>(
    '/api/notifications/read-all',
    token,
    { method: 'PATCH' },
  );
}
