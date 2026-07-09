// ============================================================================
// NotificationService — Thông báo hệ thống
//   - createNotification: tạo thông báo mới cho user
//   - getNotifications: danh sách thông báo phân trang (mới nhất trước)
//   - getUnreadCount: đếm thông báo chưa đọc (dùng cho badge chuông)
//   - markAsRead: đánh dấu 1 thông báo đã đọc
//   - markAllAsRead: đánh dấu tất cả thông báo của user là đã đọc
// ============================================================================
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { NotificationNotFoundError, NotificationNotOwnedError } from './notification.errors.js';
import type {
  CreateNotificationParams,
  NotificationItem,
  NotificationListResponse,
  UnreadCountResponse,
  MarkAllReadResponse,
} from './notification.types.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Helper: chuyển Prisma record → NotificationItem
// ---------------------------------------------------------------------------
function toItem(n: {
  id: string;
  type: import('@prisma/client').NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  targetScreen: string | null;
  metadata: import('@prisma/client').Prisma.JsonValue;
  createdAt: Date;
}): NotificationItem {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    isRead: n.isRead,
    targetScreen: n.targetScreen as NotificationItem['targetScreen'],
    metadata: n.metadata as NotificationItem['metadata'],
    createdAt: n.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Service class
// ---------------------------------------------------------------------------

export class NotificationService {
  /**
   * Tạo thông báo mới cho 1 user.
   * Được gọi fire-and-forget từ các service khác (void, không await).
   */
  async createNotification(params: CreateNotificationParams): Promise<void> {
    const { userId, type, title, body, targetScreen = null, metadata } = params;
    await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        isRead: false,
        targetScreen,
        // Prisma yêu cầu Prisma.JsonNull thay vì null thuần cho nullable Json column.
        // Cast qua unknown vì NotificationMetadata chứa Record<string,unknown>
        // — đủ an toàn vì tất cả variant đều là plain JSON object.
        metadata: metadata != null
          ? (metadata as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
  }

  /**
   * Danh sách thông báo của user, mới nhất trước, phân trang.
   * Trả kèm tổng số và số chưa đọc để frontend cập nhật badge ngay.
   */
  async getNotifications(
    userId: string,
    page = 1,
    limit = DEFAULT_PAGE_SIZE,
  ): Promise<NotificationListResponse> {
    const safeLimit = Math.min(limit, MAX_PAGE_SIZE);
    const skip = (page - 1) * safeLimit;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      notifications: notifications.map(toItem),
      total,
      unreadCount,
    };
  }

  /**
   * Đếm số thông báo chưa đọc của user.
   * Dùng cho polling badge chuông mỗi 30 giây.
   */
  async getUnreadCount(userId: string): Promise<UnreadCountResponse> {
    const count = await prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  /**
   * Đánh dấu 1 thông báo cụ thể là đã đọc.
   * Kiểm tra ownership — trả lỗi nếu thông báo không thuộc user.
   */
  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) throw new NotificationNotFoundError(notificationId);
    if (notification.userId !== userId) throw new NotificationNotOwnedError();

    await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  /**
   * Đánh dấu tất cả thông báo của user là đã đọc.
   * Trả về số bản ghi đã cập nhật.
   */
  async markAllAsRead(userId: string): Promise<MarkAllReadResponse> {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { updatedCount: result.count };
  }
}

export const notificationService = new NotificationService();
