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
