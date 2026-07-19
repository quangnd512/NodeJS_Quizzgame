// Cac loai loi (custom error classes) rieng cho module quan ly User / Onboarding.

export class UsersError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Nem ra khi danh sach mon hoc khong hop le: rong, qua nhieu, chua ma khong
 * ton tai trong danh muc, hoac bi trung lap.
 */
export class InvalidSubjectsError extends UsersError {
  constructor(message: string) {
    super(message, 'INVALID_SUBJECTS');
  }
}

/**
 * Nem ra khi du lieu cap nhat ho so (`PUT /api/users/profile`) khong hop le -
 * vi du chuoi qua dai (vuot `MAX_PROFILE_FIELD_LENGTH`).
 */
export class InvalidProfileInputError extends UsersError {
  constructor(message: string) {
    super(message, 'INVALID_PROFILE_INPUT');
  }
}

/** Nem ra khi khong tim thay user (truong hop hi huu - vi du bi xoa giua chung trong luc xu ly request). */
export class UserNotFoundError extends UsersError {
  constructor(identifier: string) {
    super(`Khong tim thay nguoi dung '${identifier}'.`, 'USER_NOT_FOUND');
    this.identifier = identifier;
  }

  public readonly identifier: string;
}

/** Loi lien quan den upload/xoa anh dai dien. */
export class AvatarError extends UsersError {
  constructor(message: string, code: string) {
    super(message, code);
  }
}

/**
 * Nem ra khi user Free doi mon hoc dang on (POST /api/users/subjects) ma
 * CHUA goi POST /api/users/subjects/ad-unlock truoc do (hoac token da het
 * han/da tieu thu) — Feature 015 (Free/Premium).
 */
export class SubjectsChangeLockedError extends UsersError {
  constructor() {
    super(
      'Ban can xem quang cao de mo khoa doi mon hoc (goi POST /api/users/subjects/ad-unlock truoc).',
      'SUBJECTS_CHANGE_LOCKED',
    );
  }
}
