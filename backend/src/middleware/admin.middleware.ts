// Middleware xac thuc admin bang header X-Admin-Secret.
// Don gian hon verifyAppToken — khong can user trong DB, chi kiem tra secret.
import type { NextFunction, Request, Response } from 'express';

/** Loi xac thuc admin — app.ts anh xa sang HTTP 401. */
export class AdminUnauthorizedError extends Error {
  public readonly code = 'ADMIN_UNAUTHORIZED';

  constructor() {
    super('Thieu hoac sai X-Admin-Secret header.');
    this.name = 'AdminUnauthorizedError';
    Object.setPrototypeOf(this, AdminUnauthorizedError.prototype);
  }
}

/**
 * Kiem tra header `X-Admin-Secret` khop voi bien moi truong `ADMIN_SECRET`.
 * Thieu/sai → nem `AdminUnauthorizedError` (→ 401).
 */
export function verifyAdminSecret(req: Request, _res: Response, next: NextFunction): void {
  const adminSecret = process.env.ADMIN_SECRET;

  // Neu chua cau hinh ADMIN_SECRET thi khong cho phep bat ky ai truy cap.
  if (!adminSecret) {
    console.error('[Admin] ADMIN_SECRET chua duoc cau hinh trong .env');
    next(new AdminUnauthorizedError());
    return;
  }

  const provided = req.headers['x-admin-secret'];
  if (typeof provided !== 'string' || provided !== adminSecret) {
    next(new AdminUnauthorizedError());
    return;
  }

  next();
}
