// Middleware validate request body bang Zod schema.
// Ap dung cho tat ca POST/PUT/PATCH endpoint de dam bao du lieu dau vao
// hop le truoc khi xuong service layer.
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

/** Loi validate body — app.ts anh xa sang HTTP 400. */
export class RequestValidationError extends Error {
  public readonly code = 'INVALID_REQUEST_BODY';
  public readonly details: z.ZodIssue[];

  constructor(issues: z.ZodIssue[]) {
    super('Du lieu dau vao khong hop le.');
    this.name = 'RequestValidationError';
    this.details = issues;
    Object.setPrototypeOf(this, RequestValidationError.prototype);
  }
}

/**
 * Tao middleware validate `req.body` theo `schema` Zod.
 * Neu parse that bai → nem `RequestValidationError` (→ 400 qua error handler trung tam).
 * Neu hop le → gan ket qua da parse vao `req.body` (da qua transform/default).
 */
export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new RequestValidationError(result.error.issues));
      return;
    }
    req.body = result.data as z.infer<T>;
    next();
  };
}
