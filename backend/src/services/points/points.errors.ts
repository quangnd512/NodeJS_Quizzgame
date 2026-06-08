// Cac loai loi (custom error classes) rieng cho he thong diem tich luy.
//
// Dinh nghia error class rieng giup:
//   - Phan biet ro rang loi nghiep vu (vi du: khong du diem) voi loi he thong
//     (vi du: mat ket noi DB), tu do xu ly/tra HTTP status code phu hop.
//   - De viet test va kiem tra bang `instanceof`.

/** Lop loi co so cho moi loi lien quan den he thong diem - de cac noi khac co the bat chung 1 loai. */
export class PointsError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    // Dam bao "instanceof" hoat dong dung khi bien dich xuong ES5/CommonJS (an toan cho moi cau hinh TS).
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Nem ra khi user khong du diem de thuc hien giao dich tru/chuyen diem. */
export class PointsInsufficientError extends PointsError {
  constructor(userId: string, required: number, available: number) {
    super(
      `User '${userId}' khong du diem: can ${required}, hien co ${available}.`,
      'POINTS_INSUFFICIENT',
    );
    this.userId = userId;
    this.required = required;
    this.available = available;
  }

  public readonly userId: string;
  public readonly required: number;
  public readonly available: number;
}

/** Nem ra khi tham so dau vao khong hop le (vi du: amount <= 0). */
export class InvalidPointsAmountError extends PointsError {
  constructor(message: string) {
    super(message, 'INVALID_POINTS_AMOUNT');
  }
}

/**
 * Nem ra khi optimistic locking that bai sau khi da thu lai het so lan cho phep.
 * Nguyen nhan thuong gap: qua nhieu request cung sua 1 ban ghi user_points
 * trong cung 1 thoi diem (tranh chap cao / race condition).
 */
export class OptimisticLockError extends PointsError {
  constructor(userId: string, attempts: number) {
    super(
      `Khong the cap nhat diem cho user '${userId}' do xung dot dong thoi (da thu lai ${attempts} lan). Vui long thu lai.`,
      'OPTIMISTIC_LOCK_CONFLICT',
    );
    this.userId = userId;
    this.attempts = attempts;
  }

  public readonly userId: string;
  public readonly attempts: number;
}

/** Nem ra khi khong tim thay ban ghi diem cua user (truong hop hi huu, vi du du lieu bi xoa nham). */
export class UserPointsNotFoundError extends PointsError {
  constructor(userId: string) {
    super(`Khong tim thay ban ghi diem tich luy cho user '${userId}'.`, 'USER_POINTS_NOT_FOUND');
    this.userId = userId;
  }

  public readonly userId: string;
}
