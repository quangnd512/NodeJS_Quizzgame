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
   * neu chua co thi TAO MOI ("tao/lay user" theo dung yeu cau) - roi phat hanh
   * 1 JWT noi bo cho client su dung trong cac request tiep theo.
   *
   * XU LY RACE CONDITION: neu user dang nhap LAN DAU TIEN tu 2 thiet bi gan
   * nhu dong thoi (vi du mo app tren dien thoai va may tinh bang cung luc),
   * ca 2 request co the cung thay "chua co user" va cung co tao moi -> 1 trong
   * 2 se vi pham rang buoc UNIQUE(firebaseUid). Ta bat loi nay va THU LAI 1 LAN
   * bang cach doc lai (luc nay ban ghi da ton tai do request kia tao xong).
   */
  public async login(firebaseUser: FirebaseAuthenticatedUser): Promise<LoginResult> {
    const { user, isNewUser } = await this.findOrCreateUser(firebaseUser);

    const token = signAppToken({ userId: user.id, firebaseUid: user.firebaseUid });

    return {
      token,
      isNewUser,
      user: toUserProfileDto(user),
    };
  }

  /**
   * Tim ban ghi `User` theo `firebaseUid`; neu chua co thi tao moi voi thong
   * tin co ban tu Firebase (displayName, email, phone). Cac truong con lai
   * (school, province, subjects) se duoc nguoi dung dien trong qua trinh
   * "onboarding" (qua `POST /api/users/subjects` va cap nhat profile sau nay).
   */
  private async findOrCreateUser(
    firebaseUser: FirebaseAuthenticatedUser,
  ): Promise<{ user: Awaited<ReturnType<PrismaClient['user']['findUniqueOrThrow']>>; isNewUser: boolean }> {
    const existing = await this.prisma.user.findUnique({ where: { firebaseUid: firebaseUser.uid } });
    if (existing) {
      return { user: existing, isNewUser: false };
    }

    try {
      const created = await this.prisma.user.create({
        data: {
          firebaseUid: firebaseUser.uid,
          displayName: firebaseUser.displayName,
          email: firebaseUser.email,
          phone: firebaseUser.phoneNumber,
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
          return { user: createdByOtherRequest, isNewUser: false };
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
}

export const authService = new AuthService();
