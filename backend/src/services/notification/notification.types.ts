// ============================================================================
// Notification types — Thông báo hệ thống
// ============================================================================
import type { NotificationType } from '@prisma/client';

export type { NotificationType };

/// Màn hình đích khi người dùng bấm vào thông báo.
export type TargetScreen = 'progress' | 'leaderboard' | 'exam' | null;

/// Metadata tuỳ loại thông báo.
export type NotificationMetadata =
  | { streakDays: number }                                                    // STREAK_MILESTONE
  | { rankBefore: number; rankAfter: number; subject: string | null }        // RANK_UP / RANK_DOWN
  | { reportId: string; status: string; questionPreview: string }            // REPORT_RESOLVED
  | { subject: string; examPaperTitle: string }                              // NEW_EXAM_PAPER
  | Record<string, unknown>;

/// Item thông báo trả về cho frontend.
export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  targetScreen: TargetScreen;
  metadata: NotificationMetadata | null;
  createdAt: string; // ISO 8601
}

/// Response cho GET /api/notifications.
export interface NotificationListResponse {
  notifications: NotificationItem[];
  total: number;
  unreadCount: number;
}

/// Response cho GET /api/notifications/unread-count.
export interface UnreadCountResponse {
  count: number;
}

/// Response cho PATCH /api/notifications/read-all.
export interface MarkAllReadResponse {
  updatedCount: number;
}

/// Tham số tạo thông báo mới.
export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  targetScreen?: TargetScreen;
  metadata?: NotificationMetadata;
}
