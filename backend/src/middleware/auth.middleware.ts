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
// Doi ten khi import de tranh trung voi ten middleware `verifyAppToken` o duoi.
import { InvalidAppTokenError, verifyAppToken as decodeAppToken } from '../lib/jwt.js';
import {
  InvalidFirebaseTokenError,
  InvalidSessionTokenError,
  MissingAuthTokenError,
  SessionUserNotFoundError,
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
    // QUAN TRONG: dung try/catch RIENG (long ben trong) cho buoc nay vi day
    // chi la buoc "lam giau du lieu" (enrichment) - khong phai dieu kien bat
    // buoc de request di tiep. Neu DB tam thoi loi (mat ket noi, timeout...),
    // ta KHONG muon lam that bai NHUNG request co xac thuc Firebase hop le
    // (vi du cac route khong can `currentUser`). Cac endpoint thuc su can
    // `currentUser` da co `requireRegisteredUser` tu kiem tra va bao loi phu hop.
    try {
      req.currentUser = (await prisma.user.findUnique({ where: { firebaseUid: firebaseUser.uid } })) ?? undefined;
    } catch (lookupErr) {
      console.error(
        '[verifyFirebaseToken] Khong the tra cuu User trong DB (bo qua, tiep tuc xu ly request):',
        lookupErr,
      );
      req.currentUser = undefined;
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware Express: xac thuc bang JWT NOI BO (session token do
 * `POST /api/auth/login` phat hanh) - thay vi Firebase ID Token.
 *
 * ĐÂY LÀ PHƯƠNG THỨC XÁC THỰC CHÍNH cho MỌI request SAU khi đã đăng nhập
 * (bao gồm cả các sự kiện Socket.io trong PvP real-time sau này), vì:
 *   - Không cần gọi lại Firebase ở mỗi request → giảm độ trễ + chi phí.
 *   - JWT noi bo chua san `userId` (khoa chinh trong PostgreSQL) → tra cuu
 *     truc tiep, khong can "vong" qua `firebaseUid` nhu `verifyFirebaseToken`.
 *
 * LUONG HOAT DONG:
 *   1. Doc header "Authorization: Bearer <app-jwt-token>".
 *   2. Giai ma + xac thuc chu ky/han dung qua `verifyAppToken` (lib/jwt.ts).
 *      Token sai/het han/sai dinh dang → `InvalidSessionTokenError` (401).
 *   3. Tra cuu `User` theo `userId` trong payload. Khong tim thay (vi du tai
 *      khoan da bi xoa sau khi token duoc cap) → `SessionUserNotFoundError` (401).
 *   4. Gan `req.currentUser`, goi `next()`.
 *
 * Cach dung trong route (THAY THE cho `verifyFirebaseToken` + `requireRegisteredUser`
 * o moi noi CAN dang nhap - ngoai tru chinh endpoint `/api/auth/login`):
 * ```ts
 * router.get('/me', verifyAppToken, async (req, res, next) => { ... });
 * ```
 */
export async function verifyAppToken(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      throw new MissingAuthTokenError();
    }

    let payload;
    try {
      payload = decodeAppToken(token);
    } catch (err) {
      // `verifyAppToken` (lib/jwt.ts) co the nem `InvalidAppTokenError` (token
      // sai/het han/thieu truong) hoac `JwtConfigError` (thieu JWT_SECRET - loi
      // CAU HINH he thong, KHONG phai loi cua client). Chi bien doi truong hop
      // dau thanh loi nghiep vu 401; loi cau hinh duoc nem nguyen ven de
      // middleware xu ly loi tap trung tra ve 500 (dung ban chat - can sua server).
      if (err instanceof InvalidAppTokenError) {
        throw new InvalidSessionTokenError(err.message);
      }
      throw err;
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      throw new SessionUserNotFoundError(payload.userId);
    }

    req.currentUser = user;
    next();
  } catch (err) {
    next(err);
  }
}
