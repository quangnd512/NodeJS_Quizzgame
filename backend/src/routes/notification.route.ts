// Routes cho module Thông báo (Notifications).
// Tất cả route đều yêu cầu verifyAppToken (đã đăng nhập).
import { Router, type NextFunction, type Request, type Response } from 'express';
import { verifyAppToken } from '../middleware/auth.middleware.js';
import { notificationService } from '../services/notification/notification.service.js';

export const notificationRouter = Router();

notificationRouter.use(verifyAppToken);

// ---------------------------------------------------------------------------
// GET /api/notifications/unread-count
// Đặt TRƯỚC /api/notifications/:id để tránh "unread-count" bị bắt như :id
// ---------------------------------------------------------------------------

notificationRouter.get(
  '/unread-count',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.currentUser!.id;
      const result = await notificationService.getUnreadCount(userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /api/notifications/read-all
// Đặt TRƯỚC /api/notifications/:id để tránh "read-all" bị bắt như :id
// ---------------------------------------------------------------------------

notificationRouter.patch(
  '/read-all',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.currentUser!.id;
      const result = await notificationService.markAllAsRead(userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/notifications
// Query: page? (number, default 1), limit? (number, default 20, max 50)
// ---------------------------------------------------------------------------

notificationRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.currentUser!.id;
      const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query['limit'] ?? '20'), 10) || 20));

      const result = await notificationService.getNotifications(userId, page, limit);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /api/notifications/:id/read
// ---------------------------------------------------------------------------

notificationRouter.patch(
  '/:id/read',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.currentUser!.id;
      const notificationId = req.params['id']!;
      await notificationService.markAsRead(userId, notificationId);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);
