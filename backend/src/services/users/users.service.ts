// UsersService - quan ly profile nguoi dung va qua trinh "onboarding"
// (chon mon hoc dang ky on thi).
import fs from 'node:fs';
import path from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrismaClient } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { PointsService, pointsService } from '../points/points.service.js';
import { AvatarError, InvalidProfileInputError, InvalidSubjectsError, UserNotFoundError } from './users.errors.js';
import {
  MAX_PROFILE_FIELD_LENGTH,
  MAX_SUBJECTS,
  MIN_SUBJECTS,
  SUBJECT_CATALOG,
  getSubjectDisplayName,
  isValidSubjectId,
  type SubjectCatalogEntry,
  type UserMeDto,
} from './users.types.js';

/** Du lieu dau vao cho 1 mon hoc gui len tu client (theo dung dinh dang trong yeu cau: `{ id, name }`). */
export interface SubjectInput {
  id: string;
  name?: string;
}

/**
 * Du lieu cap nhat ho so ca nhan (`PUT /api/users/profile`).
 *
 * QUY UOC "PATCH BAN PHAN": chi cac truong CO MAT (key ton tai) trong object
 * nay moi duoc cap nhat; truong vang mat (khong co key) giu nguyen gia tri cu
 * trong DB; truong duoc gui voi gia tri `null` se XOA du lieu cu (cho phep
 * "bo trong" lai).
 *
 * LUU Y: KHONG co `email`/`subjects` o day - 2 truong nay duoc quan ly rieng
 * (xem comment chi tiet trong `users.route.ts` tai endpoint `PUT /profile`).
 */
export interface ProfileUpdateInput {
  displayName?: string | null;
  phone?: string | null;
  school?: string | null;
  province?: string | null;
}

/**
 * TTL (giay) cua token mo khoa doi mon hoc cho Free (Feature 015 — Free/Premium).
 * Dung khop voi thoi luong "quang cao" gia lap ~5s o FE + du du an toan.
 */
const AD_UNLOCK_TTL_SECONDS = 300;

/** Key Redis danh dau user da "xem quang cao" xong, con hieu luc de doi mon 1 lan. */
function adUnlockRedisKey(userId: string): string {
  return `premium:ad-unlock:${userId}`;
}

export class UsersService {
  private readonly prisma: PrismaClient;
  private readonly pointsService: PointsService;

  constructor(prismaClient: PrismaClient = defaultPrismaClient, pointsSvc: PointsService = pointsService) {
    this.prisma = prismaClient;
    this.pointsService = pointsSvc;
  }

  /**
   * Cap nhat danh sach mon hoc dang ky on thi cho user.
   *
   * QUY TAC VALIDATE (theo dung yeu cau nghiep vu):
   *   - Phai co it nhat 1 mon, toi da 7 mon.
   *   - Moi ma mon (`id`) PHAI nam trong danh muc hop le (`SUBJECT_CATALOG`)
   *     - chan du lieu rac / sai chinh ta / gia mao.
   *   - Khong duoc trung lap (vi du gui ["TOAN", "TOAN"]).
   *
   * Chi luu MA mon vao DB (cot `subjects: String[]`) - ten hien thi luon duoc
   * tra cuu tu `SUBJECT_CATALOG` de dam bao nhat quan, tranh du lieu cu/sai lech
   * khi danh muc duoc cap nhat sau nay.
   *
   * @throws InvalidSubjectsError neu danh sach khong hop le
   * @throws UserNotFoundError neu khong tim thay user (hi huu)
   */
  public async updateSubjects(userId: string, subjects: readonly SubjectInput[]): Promise<SubjectCatalogEntry[]> {
    const subjectIds = this.validateAndNormalizeSubjects(subjects);

    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: { subjects: subjectIds },
        select: { subjects: true },
      });

      return updated.subjects.map((id) => ({ id, name: getSubjectDisplayName(id) }));
    } catch (err) {
      // Prisma nem P2025 ("Record to update not found") neu userId khong ton tai.
      if (this.isRecordNotFoundError(err)) {
        throw new UserNotFoundError(userId);
      }
      throw err;
    }
  }

  /**
   * Cap 1 luot mo khoa doi mon hoc cho Free (Feature 015) - goi SAU KHI user
   * da "xem xong" quang cao gia lap phia FE. Set Redis key TTL 300s.
   * Premium goi ham nay cung duoc (khong sai) nhung khong bat buoc, vi
   * Premium khong bi gate o `consumeSubjectsAdUnlock`.
   */
  public async grantSubjectsAdUnlock(userId: string): Promise<{ expiresInSeconds: number }> {
    await redis.set(adUnlockRedisKey(userId), '1', 'EX', AD_UNLOCK_TTL_SECONDS);
    return { expiresInSeconds: AD_UNLOCK_TTL_SECONDS };
  }

  /**
   * Kiem tra + TIEU THU (xoa ngay) token mo khoa doi mon hoc cua 1 user Free.
   * Tra ve `true` neu token dang con hieu luc (va vua bi xoa - single-use),
   * `false` neu khong co / da het han / da dung roi.
   *
   * Dung `redis.del` truc tiep (tra ve so key da xoa: 1 hoac 0) thay vi
   * `get` roi `del` rieng - tranh race condition neu 2 request doi mon toi
   * cung luc (chi 1 trong 2 co the tieu thu thanh cong token duy nhat).
   */
  public async consumeSubjectsAdUnlock(userId: string): Promise<boolean> {
    const deletedCount = await redis.del(adUnlockRedisKey(userId));
    return deletedCount > 0;
  }

  /**
   * Cap nhat cac truong ho so CA NHAN ma nguoi dung tu quan ly:
   * `displayName`, `phone`, `school`, `province`.
   *
   * QUYET DINH THIET KE (dong bo CO CHON LOC): theo dung huong da thong nhat,
   * `email` va `lastLoginAt` la du lieu DONG BO TU FIREBASE (cap nhat tu dong
   * trong `AuthService.login` o moi lan dang nhap) - KHONG cho phep sua qua
   * day. `subjects` co quy trinh validate rieng (`updateSubjects`). Endpoint
   * nay CHI quan ly cac truong con lai - dung "PATCH ban phan": field nao
   * khong co trong `update` thi giu nguyen, field gui `null` thi xoa.
   *
   * @throws InvalidProfileInputError neu gia tri qua dai (vuot `MAX_PROFILE_FIELD_LENGTH`)
   * @throws UserNotFoundError neu khong tim thay user (hi huu)
   */
  public async updateProfile(userId: string, update: ProfileUpdateInput): Promise<UserMeDto> {
    const data: Record<string, string | null> = {};

    for (const [field, value] of Object.entries(update)) {
      if (value === undefined) continue; // Vang mat -> giu nguyen, khong dua vao cau lenh UPDATE.
      data[field] = this.validateProfileField(field, value);
    }

    try {
      await this.prisma.user.update({ where: { id: userId }, data });
    } catch (err) {
      if (this.isRecordNotFoundError(err)) {
        throw new UserNotFoundError(userId);
      }
      throw err;
    }

    // Tra ve profile day du (kem diem) sau khi cap nhat - tan dung lai logic
    // ket hop du lieu da co san trong `getProfile`, tranh trung lap code.
    return this.getProfile(userId);
  }

  /**
   * Validate 1 truong ho so dang chuoi (hoac `null` de xoa): khong duoc
   * vuot qua `MAX_PROFILE_FIELD_LENGTH` ky tu sau khi `trim()`.
   */
  private validateProfileField(fieldName: string, value: string | null): string | null {
    if (value === null) {
      return null;
    }

    const trimmed = value.trim();
    if (trimmed.length > MAX_PROFILE_FIELD_LENGTH) {
      throw new InvalidProfileInputError(
        `Truong "${fieldName}" qua dai (toi da ${MAX_PROFILE_FIELD_LENGTH} ky tu, hien co ${trimmed.length}).`,
      );
    }

    // Chuoi rong sau khi trim -> coi nhu "xoa" (tra ve null) - tranh luu
    // chuoi rong vo nghia vao DB (vi du nguoi dung go khoang trang roi xoa het).
    return trimmed.length > 0 ? trimmed : null;
  }

  /**
   * Lay thong tin profile day du cua user kem so diem tich luy hien tai.
   * Ket hop du lieu tu 2 nguon: bang `users` (profile) va `PointsService` (so du diem).
   *
   * @throws UserNotFoundError neu khong tim thay user
   */
  public async getProfile(userId: string): Promise<UserMeDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    // Goi PointsService de lay so du diem - tach biet ro rang trach nhiem
    // (UsersService khong tu truy van bang user_points truc tiep).
    const balance = await this.pointsService.getBalance(user.id);

    return {
      id: user.id,
      firebaseUid: user.firebaseUid,
      displayName: user.displayName,
      email: user.email,
      phone: user.phone,
      school: user.school,
      province: user.province,
      subjects: user.subjects.map((id) => ({ id, name: getSubjectDisplayName(id) })),
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      points: balance.currentPoints,
    };
  }

  /**
   * Luu anh dai dien moi cho user: cap nhat DB va xoa file cu neu co.
   * `newFilePath` la duong dan tuyet doi den file vua duoc Multer luu.
   * `newRelativeUrl` la URL tuong doi se luu vao DB (vi du `/uploads/avatars/<id>.jpg`).
   *
   * @throws UserNotFoundError neu khong tim thay user
   */
  public async uploadAvatar(userId: string, newFilePath: string, newRelativeUrl: string): Promise<UserMeDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    // Xoa file cu truoc khi luu moi de tranh ron file
    if (user.avatarUrl) {
      this.deleteAvatarFileIfExists(user.avatarUrl);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: newRelativeUrl },
    });

    // Neu file moi cung trung ten voi file cu (userId.jpg), Multer da overwrite roi,
    // khong can xoa rieng. Ket qua getProfile se tra ve url moi.
    void newFilePath; // da xu ly qua Multer diskStorage

    return this.getProfile(userId);
  }

  /**
   * Xoa anh dai dien: xoa file vat ly va dat avatarUrl = null trong DB.
   *
   * @throws UserNotFoundError neu khong tim thay user
   * @throws AvatarError neu user chua co avatar de xoa
   */
  public async removeAvatar(userId: string): Promise<UserMeDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
    if (!user) {
      throw new UserNotFoundError(userId);
    }
    if (!user.avatarUrl) {
      throw new AvatarError('Nguoi dung chua co anh dai dien.', 'AVATAR_NOT_FOUND');
    }

    this.deleteAvatarFileIfExists(user.avatarUrl);

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });

    return this.getProfile(userId);
  }

  /** Xoa file vat ly dua tren URL tuong doi. Neu file khong ton tai thi bo qua (khong nem loi). */
  private deleteAvatarFileIfExists(relativeUrl: string): void {
    try {
      // relativeUrl dang "/uploads/avatars/<file>" -> strip leading "/"
      const relativePath = relativeUrl.startsWith('/') ? relativeUrl.slice(1) : relativeUrl;
      const absPath = path.join(process.cwd(), relativePath);
      if (fs.existsSync(absPath)) {
        fs.unlinkSync(absPath);
      }
    } catch {
      // Loi xoa file khong chan xu ly chinh - ghi log de debug
      console.warn('[UsersService] Khong the xoa file avatar cu:', relativeUrl);
    }
  }

  // --------------------------------------------------------------------
  // NOI BO (PRIVATE HELPERS)
  // --------------------------------------------------------------------

  /**
   * Validate va chuan hoa danh sach mon hoc dau vao thanh mang cac MA mon (string[]).
   * Nem `InvalidSubjectsError` voi thong bao cu the cho tung truong hop sai,
   * giup client/FE hien thi loi ro rang cho nguoi dung.
   */
  private validateAndNormalizeSubjects(subjects: readonly SubjectInput[]): string[] {
    if (!Array.isArray(subjects)) {
      throw new InvalidSubjectsError('Truong "subjects" phai la mot mang.');
    }

    if (subjects.length < MIN_SUBJECTS) {
      throw new InvalidSubjectsError(`Phai chon it nhat ${MIN_SUBJECTS} mon hoc.`);
    }

    if (subjects.length > MAX_SUBJECTS) {
      throw new InvalidSubjectsError(`Chi duoc chon toi da ${MAX_SUBJECTS} mon hoc (da chon ${subjects.length}).`);
    }

    const normalizedIds: string[] = [];
    const seen = new Set<string>();

    for (const subject of subjects) {
      if (!subject || typeof subject.id !== 'string' || subject.id.trim().length === 0) {
        throw new InvalidSubjectsError('Moi mon hoc phai co truong "id" dang chuoi, khong duoc de trong.');
      }

      const id = subject.id.trim().toUpperCase();

      if (!isValidSubjectId(id)) {
        const validIds = SUBJECT_CATALOG.map((s) => s.id).join(', ');
        throw new InvalidSubjectsError(
          `Ma mon hoc "${subject.id}" khong hop le. Cac ma duoc phep: ${validIds}.`,
        );
      }

      if (seen.has(id)) {
        throw new InvalidSubjectsError(`Mon hoc "${id}" bi trung lap trong danh sach.`);
      }

      seen.add(id);
      normalizedIds.push(id);
    }

    return normalizedIds;
  }

  /** Kiem tra loi Prisma "P2025 - Record to update not found". */
  private isRecordNotFoundError(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: unknown }).code === 'P2025'
    );
  }
}

export const usersService = new UsersService();
