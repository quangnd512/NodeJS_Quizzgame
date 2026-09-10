// Routes lien quan den XAC THUC (Authentication).
import { Router, type NextFunction, type Request, type Response } from 'express';
import { verifyFirebaseToken } from '../middleware/auth.middleware.js';
import { authService } from '../services/auth/auth.service.js';
import type { LoginResult } from '../services/auth/auth.types.js';

export const authRouter = Router();

/**
 * POST /api/auth/login
 *
 * Luong xu ly:
 *   1. Middleware `verifyFirebaseToken` xac thuc Firebase ID Token gui kem
 *      trong header "Authorization: Bearer <token>", gan ket qua vao `req.firebaseUser`.
 *   2. Goi `authService.login(...)`: tim user theo `firebaseUid` trong PostgreSQL,
 *      neu chua co thi TAO MOI (dong bo thong tin co ban tu Firebase).
 *   3. Phat hanh JWT noi bo va tra ve cho client cung profile user.
 *
 * Client SE DUNG JWT NAY (KHONG dung lai Firebase token) cho TAT CA cac
 * request tiep theo can dang nhap - vi du `GET /api/users/me`,
 * `POST /api/users/subjects`, `PUT /api/users/profile`, va ca cac su kien
 * Socket.io trong PvP real-time sau nay. Middleware `verifyAppToken`
 * (xem `middleware/auth.middleware.ts`) chiu trach nhiem xac thuc JWT nay -
 * giam phu thuoc + do tre goi lai Firebase tren moi request.
 */
authRouter.post(
  '/login',
  verifyFirebaseToken,
  async (req: Request, res: Response<LoginResult>, next: NextFunction) => {
    try {
      // `verifyFirebaseToken` luon gan `req.firebaseUser` truoc khi goi `next()`
      // (neu xac thuc that bai, no se goi `next(err)` va khong di den day).
      // Van kiem tra lai o day de TypeScript khong yeu cau dung non-null assertion (`!`)
      // va de phong truong hop thu tu middleware bi thay doi nham trong tuong lai.
      if (!req.firebaseUser) {
        throw new Error('Khong tim thay thong tin xac thuc Firebase tren request (loi cau hinh middleware).');
      }

      const result = await authService.login(req.firebaseUser);

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/auth/dev-login — CHI DUNG DE TEST CUC BO (S5-ThuNghiem), KHONG BAO GIO
 * duoc bat o production.
 *
 * Tao/dang nhap mot user test KHONG can Firebase/Google that - giai quyet dung nhu
 * cau "S5 tu tao tai khoan test" ma KHONG vi pham gioi han "khong tu tao tai khoan
 * that/nhap mat khau thay nguoi dung" (day la du lieu NOI BO cua chinh he thong,
 * khong phai tai khoan Google/ben thu 3 nao ca).
 *
 * KHOA BOI 2 LOP - CA HAI DIEU KIEN PHAI DUNG:
 *   1. `NODE_ENV !== 'production'`
 *   2. Bien moi truong `DEV_LOGIN_ENABLED === 'true'` phai duoc dat RO RANG
 *      (mac dinh KHONG bat, kem ca khi dev - phai chu dong bat trong .env)
 * Neu thieu 1 trong 2 -> tra ve 404 (khong phai 403) de KHONG lo ra rang endpoint
 * nay ton tai trong build production.
 */
authRouter.post(
  '/dev-login',
  async (req: Request, res: Response<LoginResult>, next: NextFunction) => {
    try {
      const isDevLoginAllowed = process.env.NODE_ENV !== 'production' && process.env.DEV_LOGIN_ENABLED === 'true';
      if (!isDevLoginAllowed) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Not found' } as unknown as LoginResult);
        return;
      }

      const { email, displayName } = req.body as { email?: unknown; displayName?: unknown };
      if (typeof email !== 'string' || !email.includes('@')) {
        res.status(400).json({ error: 'INVALID_EMAIL', message: 'Thieu hoac sai dinh dang "email".' } as unknown as LoginResult);
        return;
      }
      const safeDisplayName = typeof displayName === 'string' && displayName.trim() ? displayName : email.split('@')[0]!;

      const result = await authService.devLogin(email, safeDisplayName);

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);
