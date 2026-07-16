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
