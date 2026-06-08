// Cac kieu du lieu dung chung cho luong xac thuc & onboarding.
import type { User } from '@prisma/client';

/**
 * Thong tin toi thieu trich xuat tu Firebase ID Token SAU KHI da xac thuc thanh cong.
 * Day la du lieu "tam thoi" - chua chac da co ban ghi tuong ung trong PostgreSQL
 * (truong hop user dang nhap LAN DAU TIEN, chua tung goi /api/auth/login).
 */
export interface FirebaseAuthenticatedUser {
  /** UID duy nhat do Firebase cap - dung lam khoa lien ket voi bang `users`. */
  uid: string;
  email: string | null;
  /** Da xac thuc email hay chua (Firebase tra ve - huu ich de canh bao user xac minh email). */
  emailVerified: boolean;
  phoneNumber: string | null;
  displayName: string | null;
}

/** Du lieu user profile tra ve cho client (khong lo cac truong noi bo nhay cam). */
export interface UserProfileDto {
  id: string;
  firebaseUid: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  school: string | null;
  province: string | null;
  subjects: string[];
  createdAt: Date;
  /** Thoi diem dang nhap gan nhat (cap nhat moi lan goi POST /api/auth/login thanh cong). */
  lastLoginAt: Date | null;
}

/** Ket qua tra ve cho client sau khi dang nhap thanh cong. */
export interface LoginResult {
  /** JWT noi bo - client luu lai va dinh kem vao cac request tiep theo. */
  token: string;
  /** Co phai lan dau user nay xuat hien trong he thong hay khong (phuc vu FE quyet dinh co dan vao luong "onboarding chon mon hoc" hay khong). */
  isNewUser: boolean;
  user: UserProfileDto;
}

/** Chuyen 1 ban ghi `User` (Prisma) thanh DTO an toan de tra ve cho client. */
export function toUserProfileDto(user: User): UserProfileDto {
  return {
    id: user.id,
    firebaseUid: user.firebaseUid,
    displayName: user.displayName,
    email: user.email,
    phone: user.phone,
    school: user.school,
    province: user.province,
    subjects: user.subjects,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}
