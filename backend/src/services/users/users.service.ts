// UsersService - quan ly profile nguoi dung va qua trinh "onboarding"
// (chon mon hoc dang ky on thi).
import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrismaClient } from '../../lib/prisma.js';
import { PointsService, pointsService } from '../points/points.service.js';
import { InvalidSubjectsError, UserNotFoundError } from './users.errors.js';
import {
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
    const balance = await this.pointsService.getBalance(user.firebaseUid);

    return {
      id: user.id,
      firebaseUid: user.firebaseUid,
      displayName: user.displayName,
      email: user.email,
      phone: user.phone,
      school: user.school,
      province: user.province,
      subjects: user.subjects.map((id) => ({ id, name: getSubjectDisplayName(id) })),
      createdAt: user.createdAt,
      points: balance.currentPoints,
    };
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
