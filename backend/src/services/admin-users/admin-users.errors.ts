// Cac loai loi cho module Admin User Management.

export class AdminUsersError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Khong tim thay user voi id cho truoc. */
export class AdminUserNotFoundError extends AdminUsersError {
  constructor(userId: string) {
    super(`Khong tim thay nguoi dung voi id='${userId}'.`, 'ADMIN_USER_NOT_FOUND');
  }
}

/** User khong co email — khong the gui reset password link. */
export class AdminUserNoEmailError extends AdminUsersError {
  constructor() {
    super(
      'Tai khoan nay khong co dia chi email, khong the tao link dat lai mat khau.',
      'ADMIN_USER_NO_EMAIL',
    );
  }
}

/** Gia tri role khong hop le. */
export class AdminInvalidRoleError extends AdminUsersError {
  constructor(role: string) {
    super(`Role '${role}' khong hop le. Chi chap nhan: STUDENT, ADMIN.`, 'ADMIN_INVALID_ROLE');
  }
}
