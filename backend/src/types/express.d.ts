// Mo rong (augment) kieu `Request` cua Express de them cac truong duoc gan boi
// middleware xac thuc (`verifyFirebaseToken`). Nho do, cac route handler co
// the dung `req.firebaseUser` / `req.currentUser` voi day du kieu du lieu,
// khong can ep kieu (cast) thu cong = tranh dung `any`.
import type { User } from '@prisma/client';
import type { FirebaseAuthenticatedUser } from '../services/auth/auth.types.js';

declare global {
  namespace Express {
    interface Request {
      /**
       * Thong tin user da duoc xac thuc tu Firebase ID Token.
       * Duoc gan boi middleware `verifyFirebaseToken`. LUON ton tai sau khi
       * middleware nay chay thanh cong (khong nem loi).
       */
      firebaseUser?: FirebaseAuthenticatedUser;

      /**
       * Ban ghi `User` tuong ung trong PostgreSQL - CHI ton tai neu user nay
       * da tung dang nhap qua `POST /api/auth/login` (da co ban ghi trong bang `users`).
       * Middleware `verifyFirebaseToken` se co gang tra ve ban ghi nay neu co,
       * nhung KHONG tao moi (viec tao moi thuoc trach nhiem cua endpoint /login).
       */
      currentUser?: User;
    }
  }
}

export {};
