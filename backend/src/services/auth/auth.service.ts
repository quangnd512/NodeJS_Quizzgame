// AuthService - xu ly nghiep vu dang nhap: dong bo user tu Firebase sang
// PostgreSQL ("tao moi neu chua co, lay ve neu da co"), va phat hanh JWT noi bo.
import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma as defaultPrismaClient } from '../../lib/prisma.js';
import { signAppToken } from '../../lib/jwt.js';
import { AccountConflictError } from './auth.errors.js';
import type { FirebaseAuthenticatedUser, LoginResult } from './auth.types.js';
import { toUserProfileDto } from './auth.types.js';

/** Ma loi Prisma "Unique constraint failed" - co the xay ra khi 2 request dang nhap dau tien chay dong thoi. */
const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

function isUniqueConstraintError(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION
  );
}

/**
 * Doc ten truong (column) gay vi pham UNIQUE tu metadata cua loi Prisma P2002.
 * Prisma tra ve `meta.target` la mang ten cot - ham nay mang tinh chat
 * "best effort", tra ve `null` neu khong doc duoc (vi du driver khac tra
 * dinh dang khac) de noi goi tu quyet dinh xu ly du phong phu hop.
 */
function getViolatedUniqueField(err: Prisma.PrismaClientKnownRequestError): string | null {
  const target = err.meta?.['target'];
  if (Array.isArray(target) && typeof target[0] === 'string') {
    return target[0];
  }
  if (typeof target === 'string') {
    return target;
  }
  return null;
}

export class AuthService {
  private readonly prisma: PrismaClient;

  constructor(prismaClient: PrismaClient = defaultPrismaClient) {
    this.prisma = prismaClient;
  }

  /**
   * Dang nhap: nhan thong tin user da duoc xac thuc tu Firebase (qua middleware
   * `verifyFirebaseToken`), tim ban ghi `User` tuong ung trong PostgreSQL -
   * neu chua co thi TAO MOI, neu da co thi DONG BO CO CHON LOC - roi phat hanh
   * 1 JWT noi bo (session token) cho client su dung trong cac request tiep theo.
   *
   * QUYET DINH THIET KE - "DONG BO CO CHON LOC" (selective sync, theo dung
   * huong da thong nhat - chuan cua hau het app mobile hien nay):
   *   - Moi lan dang nhap THANH CONG, CHI cap nhat lai 2 truong tu Firebase:
   *     `email` (vi Firebase la "nguon su that" cho danh tinh dang nhap - email
   *     co the doi neu user lien ket lai phuong thuc dang nhap) va `lastLoginAt`
   *     (= thoi diem hien tai, phuc vu thong ke "user hoat dong").
   *   - KHONG ghi de `displayName`/`phone` moi lan dang nhap - 2 truong nay do
   *     NGUOI DUNG TU QUAN LY qua `PUT /api/users/profile` (xem `UsersService.
   *     updateProfile`); neu dong bo lai tu Firebancel moi lan login se XOA mat
   *     tuy chinh ca nhan cua ho (vi du ho doi ten hien thi trong app khac voi
   *     ten tren Google).
   *   - `school`/`province`/`subjects` hoan toan do nguoi dung dien trong
   *     onboarding - Firebase khong co cac truong nay nen khong lien quan.
   *
   * XU LY RACE CONDITION: neu user dang nhap LAN DAU TIEN tu 2 thiet bi gan
   * nhu dong thoi (vi du mo app tren dien thoai va may tinh bang cung luc),
   * ca 2 request co the cung thay "chua co user" va cung co tao moi -> 1 trong
   * 2 se vi pham rang buoc UNIQUE. Ta bat loi nay va xu ly trong
   * `findCreateOrSyncUser` (xem chi tiet trong do).
   */
  public async login(firebaseUser: FirebaseAuthenticatedUser): Promise<LoginResult> {
    const { user, isNewUser } = await this.findCreateOrSyncUser(firebaseUser);

    const token = signAppToken({ userId: user.id, firebaseUid: user.firebaseUid });

    return {
      token,
      isNewUser,
      user: toUserProfileDto(user),
    };
  }

  /**
   * Tim ban ghi `User` theo `firebaseUid`:
   *   - Neu CHUA CO -> tao moi voi thong tin co ban tu Firebase (displayName,
   *     email, phone, lastLoginAt = hien tai). Cac truong con lai (school,
   *     province, subjects) se duoc nguoi dung dien trong qua trinh "onboarding".
   *   - Neu DA CO -> dong bo CO CHON LOC: chi cap nhat `email` (neu Firebase
   *     tra ve gia tri khac) va `lastLoginAt` (luon cap nhat = hien tai).
   */
  private async findCreateOrSyncUser(
    firebaseUser: FirebaseAuthenticatedUser,
  ): Promise<{ user: Awaited<ReturnType<PrismaClient['user']['findUniqueOrThrow']>>; isNewUser: boolean }> {
    const existing = await this.prisma.user.findUnique({ where: { firebaseUid: firebaseUser.uid } });
    if (existing) {
      return { user: await this.syncExistingUser(existing, firebaseUser), isNewUser: false };
    }

    try {
      const created = await this.prisma.user.create({
        data: {
          firebaseUid: firebaseUser.uid,
          displayName: firebaseUser.displayName,
          email: firebaseUser.email,
          phone: firebaseUser.phoneNumber,
          lastLoginAt: new Date(),
        },
      });
      return { user: created, isNewUser: true };
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        const violatedField = getViolatedUniqueField(err);

        // TRUONG HOP 1 - dung "cuoc dua" tao user lan dau (firebaseUid trung):
        // request kia da tao xong truoc -> doc lai de lay ban ghi do, KHONG
        // phai loi that. (Khong dua hoan toan vao `violatedField === 'firebaseUid'`
        // vi ten cot tra ve co the khac nhau giua cac phien ban driver - uu tien
        // doc lai truoc, chi coi la "xung dot that" khi doc lai khong thay gi.)
        const createdByOtherRequest = await this.prisma.user.findUnique({
          where: { firebaseUid: firebaseUser.uid },
        });
        if (createdByOtherRequest) {
          // Van la "dang nhap" tu goc nhin cua request nay - dong bo
          // `lastLoginAt`/`email` nhu binh thuong (xem `syncExistingUser`).
          return { user: await this.syncExistingUser(createdByOtherRequest, firebaseUser), isNewUser: false };
        }

        // TRUONG HOP 2 - xung dot du lieu THAT (vi du `email` da thuoc ve mot
        // tai khoan Firebase khac - 1 nguoi dang ky 2 phuong thuc dang nhap
        // nhung Firebase tra ve cung 1 email). KHONG ném loi Prisma nguyen
        // van ra ngoai (se bi middleware loi tap trung coi la 500 va co the
        // lo cau truc CSDL qua `message`) - thay vao do nem loi nghiep vu ro
        // rang, anh xa sang HTTP 409 Conflict.
        throw new AccountConflictError(violatedField ?? 'email');
      }
      throw err;
    }
  }

  /**
   * Dong bo CO CHON LOC mot user DA TON TAI khi dang nhap lai:
   *   - `lastLoginAt` -> luon cap nhat thanh thoi diem hien tai.
   *   - `email` -> CHI cap nhat neu Firebase tra ve gia tri KHAC voi DB hien
   *     tai (tranh ghi DB khong can thiet khi khong co gi thay doi).
   *
   * KHONG dung cho `displayName`/`phone` - xem giai thich chi tiet trong
   * docblock cua `login()`.
   *
   * Neu cap nhat `email` vi pham UNIQUE (email vua duoc Firebase tra ve da
   * thuoc ve mot tai khoan KHAC trong he thong) -> nem `AccountConflictError`
   * (409) thay vi de lo loi Prisma nguyen van.
   */
  private async syncExistingUser(
    user: Awaited<ReturnType<PrismaClient['user']['findUniqueOrThrow']>>,
    firebaseUser: FirebaseAuthenticatedUser,
  ): Promise<Awaited<ReturnType<PrismaClient['user']['findUniqueOrThrow']>>> {
    const data: { lastLoginAt: Date; email?: string | null } = { lastLoginAt: new Date() };

    if (firebaseUser.email !== user.email) {
      data.email = firebaseUser.email;
    }

    try {
      return await this.prisma.user.update({ where: { id: user.id }, data });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new AccountConflictError(getViolatedUniqueField(err) ?? 'email');
      }
      throw err;
    }
  }
}

export const authService = new AuthService();
