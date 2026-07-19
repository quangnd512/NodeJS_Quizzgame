// Cac loai loi (custom error classes) rieng cho module Free/Premium.

export class PremiumError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Nem ra khi so thang cap Premium khong hop le (khong phai so nguyen duong,
 * hoac ngoai khoang cho phep 1-24 thang).
 *
 * Luu y: trong thuc te route `PATCH /api/admin/users/:id/grant-premium` da
 * validate truoc bang Zod schema (xem admin-users.route.ts) nen loi nay chi
 * dong vai tro "phong thu tang cuong" (defense in depth) o tang service -
 * dam bao premiumService.grantPremiumMonths() KHONG BAO GIO tinh toan sai
 * ngay cho du duoc goi truc tiep tu noi khac (vi du script, test) ma bo qua
 * buoc validate o route.
 */
export class InvalidPremiumMonthsError extends PremiumError {
  constructor(months: unknown) {
    super(`So thang cap Premium khong hop le: '${String(months)}'. Phai la so nguyen tu 1 den 24.`, 'INVALID_PREMIUM_MONTHS');
  }
}

/**
 * Nem ra (cuc hiem) neu user bien mat giua luc grantPremiumMonths dang doc lai
 * du lieu de tinh CAS (vi du vua bi admin khac xoa tai khoan dung luc nay).
 * Truong hop binh thuong da duoc chan tu truoc boi AdminUserNotFoundError
 * (kiem tra ton tai truoc khi goi ham nay) - loi nay chi xay ra trong khoang
 * thoi gian cuc ngan giua 2 lan doc cua vong lap CAS retry.
 */
export class PremiumUserNotFoundError extends PremiumError {
  constructor(userId: string) {
    super(`User '${userId}' khong con ton tai.`, 'PREMIUM_USER_NOT_FOUND');
  }
}

/**
 * Nem ra neu grantPremiumMonths() xung dot dong thoi (CAS that bai) qua
 * MAX_GRANT_CAS_RETRY lan lien tiep - cuc ky hiem trong thuc te (chi xay ra
 * neu co RAT NHIEU request cap Premium cho CUNG 1 user trong cung 1 khoanh
 * khac gan nhu tuyet doi dong thoi).
 */
export class PremiumGrantConflictError extends PremiumError {
  constructor() {
    super(
      'Qua nhieu xung dot dong thoi khi cap Premium cho user nay, vui long thu lai.',
      'PREMIUM_GRANT_CONFLICT',
    );
  }
}
