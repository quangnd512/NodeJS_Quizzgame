// Middleware xac thuc nguoi dung bang Firebase ID Token.
//
// LUONG HOAT DONG:
//   1. Doc header "Authorization: Bearer <firebase-id-token>".
//   2. Goi Firebase Admin SDK de XAC THUC token (kiem tra chu ky, han su dung,
//      du an Firebase co khop hay khong...).
//   3. Neu hop le: gan thong tin user (tu token) vao `req.firebaseUser`.
//   4. Tra cuu THEM (khong bat buoc phai co) ban ghi `User` trong PostgreSQL
//      tuong ung voi `firebaseUid` -> gan vao `req.currentUser` neu tim thay.
//      (User co the chua ton tai trong DB neu day la lan dang nhap dau tien -
//      luc nay endpoint /api/auth/login se chiu trach nhiem tao moi.)
//   5. Goi `next()` de chuyen sang handler tiep theo.
//
// Moi loi xac thuc deu duoc chuyen cho middleware xu ly loi tap trung trong
// app.ts thong qua `next(err)` - dam bao tra ve dinh dang JSON nhat quan.
import type { NextFunction, Request, Response } from 'express';
import { FirebaseAuthError } from 'firebase-admin/auth';
import { getFirebaseAuth } from '../lib/firebase-admin.js';
import { prisma } from '../lib/prisma.js';
import {
  InvalidFirebaseTokenError,
  MissingAuthTokenError,
  UserNotRegisteredError,
} from '../services/auth/auth.errors.js';
import type { FirebaseAuthenticatedUser } from '../services/auth/auth.types.js';

const BEARER_PREFIX = 'Bearer ';

/** Trich xuat token tu header `Authorization: Bearer <token>`. Tra ve `null` neu sai dinh dang. */
function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader || !authorizationHeader.startsWith(BEARER_PREFIX)) {
    return null;
  }

  const token = authorizationHeader.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Middleware Express: xac thuc Firebase ID Token va gan thong tin user vao `req`.
 *
 * Cach dung trong route:
 * ```ts
 * router.get('/me', verifyFirebaseToken, async (req, res, next) => { ... });
 * ```
 */
export async function verifyFirebaseToken(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      throw new MissingAuthTokenError();
    }

    let decodedToken;
    try {
      decodedToken = await getFirebaseAuth().verifyIdToken(token);
    } catch (err) {
      // Chuyen loi tu Firebase Admin SDK thanh loi nghiep vu cua he thong,
      // kem theo ly do cu the (het han, sai chu ky, token bi thu hoi...) de
      // de debug nhung KHONG lo chi tiet ky thuat nhay cam ra ngoai.
      const reason = err instanceof FirebaseAuthError ? err.code : 'khong xac dinh';
      throw new InvalidFirebaseTokenError(reason);
    }

    const firebaseUser: FirebaseAuthenticatedUser = {
      uid: decodedToken.uid,
      email: decodedToken.email ?? null,
      emailVerified: decodedToken.email_verified ?? false,
      phoneNumber: decodedToken.phone_number ?? null,
      displayName: (decodedToken.name as string | undefined) ?? null,
    };

    req.firebaseUser = firebaseUser;

    // Tra cuu them ban ghi User trong DB (khong bat buoc phai ton tai).
    // Dung try/catch rieng vi day la buoc "lam giau du lieu" - neu DB tam thoi
    // loi, ta van uu tien cho qua middleware (cac endpoint can `currentUser`
    // se tu kiem tra va bao loi UserNotRegisteredError phu hop hon).
    req.currentUser = (await prisma.user.findUnique({ where: { firebaseUid: firebaseUser.uid } })) ?? undefined;

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware "chot chan" - dat SAU `verifyFirebaseToken` cho cac endpoint
 * BAT BUOC user da hoan tat dang ky trong he thong (da co ban ghi `users`),
 * vi du `GET /api/users/me`, `POST /api/users/subjects`.
 *
 * Neu `req.currentUser` chua duoc gan (user moi xac thuc Firebase thanh cong
 * nhung CHUA TUNG goi `/api/auth/login`) -> nem `UserNotRegisteredError`
 * (HTTP 403) huong dan client goi /login truoc.
 *
 * Cach dung:
 * ```ts
 * router.get('/me', verifyFirebaseToken, requireRegisteredUser, handler);
 * ```
 */
export function requireRegisteredUser(req: Request, _res: Response, next: NextFunction): void {
  if (!req.currentUser || !req.firebaseUser) {
    next(new UserNotRegisteredError(req.firebaseUser?.uid ?? 'unknown'));
    return;
  }
  next();
}
