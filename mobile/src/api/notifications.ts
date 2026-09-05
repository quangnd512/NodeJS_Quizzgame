// API module cho Notifications (Thong bao) — mobile.
import { request } from './client';

// ---------------------------------------------------------------------------
// Types (khop voi backend/src/services/notification/notification.types.ts)
// ---------------------------------------------------------------------------

export type TargetScreen = 'progress' | 'leaderboard' | 'exam' | null;

export type NotificationMetadata =
  | { streakDays: number }
  | { rankBefore: number; rankAfter: number; subject: string | null }
  | { reportId: string; status: string; questionPreview: string }
  | { subject: string; examPaperTitle: string }
  | { submissionId: string; questionBankId: string; pointsAwarded: number }
  | { submissionId: string; note: string }
  | { submissionId: string; pointsAwarded: number; totalUsagePoints: number }
  | { months: number; premiumExpiresAt: string }
  | { premiumExpiresAt: string }
  | Record<string, unknown>;

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  targetScreen: TargetScreen;
  metadata: NotificationMetadata | null;
  createdAt: string;
}

export interface NotificationListResponse {
  notifications: NotificationItem[];
  total: number;
  unreadCount: number;
}

export interface UnreadCountResponse {
  count: number;
}

export interface MarkAllReadResponse {
  updatedCount: number;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** GET /api/notifications/unread-count — so thong bao chua doc. */
export async function getUnreadCount(token: string): Promise<UnreadCountResponse> {
  return request<UnreadCountResponse>('/api/notifications/unread-count', token);
}

/** GET /api/notifications?page=<n>&limit=<n> — danh sach thong bao phan trang. */
export async function listNotifications(
  token: string,
  page = 1,
  limit = 20,
): Promise<NotificationListResponse> {
  return request<NotificationListResponse>(
    `/api/notifications?page=${page}&limit=${limit}`,
    token,
  );
}

/** PATCH /api/notifications/read-all — danh dau tat ca la da doc. */
export async function markAllAsRead(token: string): Promise<MarkAllReadResponse> {
  return request<MarkAllReadResponse>('/api/notifications/read-all', token, { method: 'PATCH' });
}

/** PATCH /api/notifications/:id/read — danh dau 1 thong bao la da doc. */
export async function markAsRead(token: string, id: string): Promise<void> {
  await request<void>(`/api/notifications/${id}/read`, token, { method: 'PATCH' });
}
