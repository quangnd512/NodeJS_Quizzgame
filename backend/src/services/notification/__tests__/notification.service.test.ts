// Unit test cho NotificationService — mock Prisma, không cần DB thật.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma trước khi import service
vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    notification: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { prisma } from '../../../lib/prisma.js';
import { NotificationService } from '../notification.service.js';
import { NotificationNotFoundError, NotificationNotOwnedError } from '../notification.errors.js';

const mock = prisma as unknown as {
  notification: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
};

const MOCK_NOTIFICATION = {
  id: 'notif-1',
  userId: 'user-1',
  type: 'STREAK_MILESTONE' as const,
  title: '🔥 Streak 7 ngày!',
  body: 'Bạn đã học liên tiếp 7 ngày.',
  isRead: false,
  targetScreen: 'progress',
  metadata: { streakDays: 7 },
  createdAt: new Date('2026-07-09T10:00:00Z'),
};

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationService();
  });

  // ─── createNotification ───────────────────────────────────────────────────

  describe('createNotification', () => {
    it('tạo thông báo với đầy đủ tham số', async () => {
      mock.notification.create.mockResolvedValue(MOCK_NOTIFICATION);

      await service.createNotification({
        userId: 'user-1',
        type: 'STREAK_MILESTONE',
        title: '🔥 Streak 7 ngày!',
        body: 'Bạn đã học liên tiếp 7 ngày.',
        targetScreen: 'progress',
        metadata: { streakDays: 7 },
      });

      expect(mock.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          type: 'STREAK_MILESTONE',
          title: '🔥 Streak 7 ngày!',
          body: 'Bạn đã học liên tiếp 7 ngày.',
          isRead: false,
          targetScreen: 'progress',
          metadata: { streakDays: 7 },
        },
      });
    });

    it('targetScreen mặc định null khi không truyền', async () => {
      mock.notification.create.mockResolvedValue({});

      await service.createNotification({
        userId: 'user-1',
        type: 'REPORT_RESOLVED',
        title: 'Báo cáo được xử lý',
        body: 'Báo cáo câu hỏi đã được duyệt.',
      });

      expect(mock.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ targetScreen: null }) }),
      );
    });
  });

  // ─── getNotifications ─────────────────────────────────────────────────────

  describe('getNotifications', () => {
    it('trả danh sách kèm total và unreadCount', async () => {
      mock.notification.findMany.mockResolvedValue([MOCK_NOTIFICATION]);
      mock.notification.count
        .mockResolvedValueOnce(5)  // total
        .mockResolvedValueOnce(2); // unreadCount

      const result = await service.getNotifications('user-1', 1, 20);

      expect(result.notifications).toHaveLength(1);
      expect(result.total).toBe(5);
      expect(result.unreadCount).toBe(2);
      expect(result.notifications[0].createdAt).toBe('2026-07-09T10:00:00.000Z');
    });

    it('giới hạn limit tối đa 50', async () => {
      mock.notification.findMany.mockResolvedValue([]);
      mock.notification.count.mockResolvedValue(0);

      await service.getNotifications('user-1', 1, 999);

      expect(mock.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });

    it('tính skip đúng theo page', async () => {
      mock.notification.findMany.mockResolvedValue([]);
      mock.notification.count.mockResolvedValue(0);

      await service.getNotifications('user-1', 3, 20);

      expect(mock.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40 }),
      );
    });
  });

  // ─── getUnreadCount ───────────────────────────────────────────────────────

  describe('getUnreadCount', () => {
    it('trả count chính xác', async () => {
      mock.notification.count.mockResolvedValue(7);

      const result = await service.getUnreadCount('user-1');

      expect(result.count).toBe(7);
      expect(mock.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
      });
    });
  });

  // ─── markAsRead ───────────────────────────────────────────────────────────

  describe('markAsRead', () => {
    it('đánh dấu đã đọc thành công khi đúng owner', async () => {
      mock.notification.findUnique.mockResolvedValue(MOCK_NOTIFICATION);
      mock.notification.update.mockResolvedValue({});

      await service.markAsRead('user-1', 'notif-1');

      expect(mock.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { isRead: true },
      });
    });

    it('throw NotificationNotFoundError khi không tìm thấy', async () => {
      mock.notification.findUnique.mockResolvedValue(null);

      await expect(service.markAsRead('user-1', 'notif-x')).rejects.toThrow(
        NotificationNotFoundError,
      );
    });

    it('throw NotificationNotOwnedError khi sai owner', async () => {
      mock.notification.findUnique.mockResolvedValue({ ...MOCK_NOTIFICATION, userId: 'user-2' });

      await expect(service.markAsRead('user-1', 'notif-1')).rejects.toThrow(
        NotificationNotOwnedError,
      );
    });
  });

  // ─── markAllAsRead ────────────────────────────────────────────────────────

  describe('markAllAsRead', () => {
    it('trả updatedCount đúng', async () => {
      mock.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAllAsRead('user-1');

      expect(result.updatedCount).toBe(5);
      expect(mock.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
        data: { isRead: true },
      });
    });

    it('trả 0 khi không có thông báo chưa đọc', async () => {
      mock.notification.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.markAllAsRead('user-1');

      expect(result.updatedCount).toBe(0);
    });
  });
});
