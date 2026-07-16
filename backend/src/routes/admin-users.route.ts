// Routes quan ly nguoi dung danh cho admin.
// Xac thuc bang header X-Admin-Secret (khong can Firebase/JWT user).
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { verifyAdminSecret } from '../middleware/admin.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { adminUsersService } from '../services/admin-users/admin-users.service.js';
import { premiumService } from '../services/premium/premium.service.js';
import type {
  AdminUserListResult,
  AdminUserDetail,
  DashboardStats,
  GrantPremiumResultDto,
} from '../services/admin-users/admin-users.types.js';

export const adminUsersRouter = Router();

// Tat ca route trong file nay deu can X-Admin-Secret.
adminUsersRouter.use(verifyAdminSecret);

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const blockSchema = z.object({
  isBlocked: z.boolean(),
});

const roleSchema = z.object({
  role: z.enum(['STUDENT', 'ADMIN']),
});

const grantPremiumSchema = z.object({
  months: z.number().int().min(1).max(24),
});

const premiumDefaultSettingSchema = z.object({
  enabled: z.boolean(),
});

// ---------------------------------------------------------------------------
// GET /api/admin/dashboard — thong ke tong quan he thong
// ---------------------------------------------------------------------------

adminUsersRouter.get(
  '/dashboard',
  async (_req: Request, res: Response<DashboardStats>, next: NextFunction): Promise<void> => {
    try {
      const stats = await adminUsersService.getDashboardStats();
      res.status(200).json(stats);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/admin/users?search=&role=&isBlocked=&page=&limit=
// ---------------------------------------------------------------------------

adminUsersRouter.get(
  '/users',
  async (req: Request, res: Response<AdminUserListResult>, next: NextFunction): Promise<void> => {
    try {
      const search = typeof req.query['search'] === 'string' && req.query['search'] !== ''
        ? req.query['search']
        : undefined;

      const role = typeof req.query['role'] === 'string' && req.query['role'] !== ''
        ? req.query['role']
        : undefined;

      const isBlockedRaw = req.query['isBlocked'];
      const isBlocked =
        isBlockedRaw === 'true' ? true : isBlockedRaw === 'false' ? false : undefined;

      const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '10'), 10) || 10));

      const result = await adminUsersService.listUsers({ search, role, isBlocked, page, limit });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/admin/users/:id — chi tiet user + stats + lich su thi
// ---------------------------------------------------------------------------

adminUsersRouter.get(
  '/users/:id',
  async (req: Request, res: Response<AdminUserDetail>, next: NextFunction): Promise<void> => {
    try {
      const detail = await adminUsersService.getUserDetail(req.params['id']!);
      res.status(200).json(detail);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/:id/block — khoa / mo khoa tai khoan
// ---------------------------------------------------------------------------

adminUsersRouter.patch(
  '/users/:id/block',
  validateBody(blockSchema),
  async (
    req: Request,
    res: Response<{ id: string; isBlocked: boolean }>,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { isBlocked } = req.body as z.infer<typeof blockSchema>;
      const result = await adminUsersService.setUserBlocked(req.params['id']!, isBlocked);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/admin/users/:id/reset-password — tao Firebase reset link
// ---------------------------------------------------------------------------

adminUsersRouter.post(
  '/users/:id/reset-password',
  async (
    req: Request,
    res: Response<{ resetLink: string }>,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await adminUsersService.resetUserPassword(req.params['id']!);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/:id/role — doi quyen
// ---------------------------------------------------------------------------

adminUsersRouter.patch(
  '/users/:id/role',
  validateBody(roleSchema),
  async (
    req: Request,
    res: Response<{ id: string; role: string }>,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { role } = req.body as z.infer<typeof roleSchema>;
      const result = await adminUsersService.setUserRole(req.params['id']!, role);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/:id/grant-premium — cap Premium thu cong theo thang (Feature 015)
// ---------------------------------------------------------------------------

adminUsersRouter.patch(
  '/users/:id/grant-premium',
  validateBody(grantPremiumSchema),
  async (
    req: Request,
    res: Response<GrantPremiumResultDto>,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { months } = req.body as z.infer<typeof grantPremiumSchema>;
      const result = await adminUsersService.grantPremium(req.params['id']!, months);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET/PATCH /api/admin/settings/premium-default — cong tac toan cuc
// "Mac dinh Premium cho tat ca" (Feature 015). Doc/ghi truc tiep qua
// premiumService (co cache in-memory, invalidate ngay khi PATCH).
// ---------------------------------------------------------------------------

adminUsersRouter.get(
  '/settings/premium-default',
  async (
    _req: Request,
    res: Response<{ enabled: boolean }>,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const setting = await premiumService.getGlobalPremiumSetting();
      res.status(200).json({ enabled: setting.defaultPremiumForAll });
    } catch (err) {
      next(err);
    }
  },
);

adminUsersRouter.patch(
  '/settings/premium-default',
  validateBody(premiumDefaultSettingSchema),
  async (
    req: Request,
    res: Response<{ enabled: boolean }>,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { enabled } = req.body as z.infer<typeof premiumDefaultSettingSchema>;
      const setting = await premiumService.setGlobalPremiumSetting(enabled);
      res.status(200).json({ enabled: setting.defaultPremiumForAll });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /api/admin/users/:id — xoa tai khoan (Firebase + DB)
// ---------------------------------------------------------------------------

adminUsersRouter.delete(
  '/users/:id',
  async (
    req: Request,
    res: Response<{ message: string }>,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await adminUsersService.deleteUser(req.params['id']!);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);
