// Tien ich ky (sign) va xac thuc (verify) JWT noi bo cua he thong (KHAC voi
// Firebase ID Token). Sau khi user dang nhap thanh cong qua Firebase (xac
// thuc bang `verifyFirebaseToken`), backend phat hanh 1 JWT rieng de:
//   - Cac request sau khong can goi lai Firebase de xac thuc (giam do tre + chi phi).
//   - Du dung cho ca HTTP API lan Socket.io (PvP real-time) voi cung 1 co che.
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';

/** Loi nem ra khi cau hinh JWT_SECRET bi thieu - loi cau hinh he thong, can sua ngay. */
export class JwtConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JwtConfigError';
    Object.setPrototypeOf(this, JwtConfigError.prototype);
  }
}

/** Loi nem ra khi token khong hop le: sai chu ky, het han, sai dinh dang... */
export class InvalidAppTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAppTokenError';
    Object.setPrototypeOf(this, InvalidAppTokenError.prototype);
  }
}

/** Payload duoc nhung trong JWT noi bo cua he thong. */
export interface AppTokenPayload extends JwtPayload {
  /** ID nguoi dung trong PostgreSQL (bang `users`). */
  userId: string;
  /** UID tu Firebase - giu lai de tien doi chieu/debug khi can. */
  firebaseUid: string;
}

/** Thoi gian song mac dinh cua JWT - 7 ngay (phu hop ung dung mobile, tranh dang nhap lai lien tuc). */
const DEFAULT_EXPIRES_IN: SignOptions['expiresIn'] = '7d';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new JwtConfigError(
      'Thieu bien moi truong JWT_SECRET. Vui long dat 1 chuoi bi mat du dai ' +
        '(khuyen nghi >= 32 ky tu ngau nhien) trong file .env truoc khi chay server.',
    );
  }
  return secret;
}

/**
 * Ky (tao moi) 1 JWT noi bo cho user da xac thuc thanh cong.
 *
 * @throws JwtConfigError neu thieu JWT_SECRET
 */
export function signAppToken(payload: { userId: string; firebaseUid: string }): string {
  const secret = getJwtSecret();
  return jwt.sign(payload, secret, { expiresIn: DEFAULT_EXPIRES_IN });
}

/**
 * Xac thuc va giai ma 1 JWT noi bo.
 *
 * @throws JwtConfigError neu thieu JWT_SECRET
 * @throws InvalidAppTokenError neu token sai chu ky / het han / sai dinh dang / thieu truong bat buoc
 */
export function verifyAppToken(token: string): AppTokenPayload {
  const secret = getJwtSecret();

  let decoded: string | JwtPayload;
  try {
    decoded = jwt.verify(token, secret);
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'khong xac dinh';
    throw new InvalidAppTokenError(`Token khong hop le hoac da het han (chi tiet: ${reason}).`);
  }

  if (typeof decoded === 'string' || !decoded.userId || !decoded.firebaseUid) {
    throw new InvalidAppTokenError('Token thieu thong tin bat buoc (userId / firebaseUid).');
  }

  return decoded as AppTokenPayload;
}
