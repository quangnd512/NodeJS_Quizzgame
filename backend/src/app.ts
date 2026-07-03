// Cau hinh Express app: middleware, routes, xu ly loi tap trung
import express, { type Application, type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { helloRouter } from './routes/hello.route.js';
import { authRouter } from './routes/auth.route.js';
import { usersRouter } from './routes/users.route.js';
import { practiceRouter } from './routes/practice.route.js';
import { adminRouter } from './routes/admin.route.js';
import { examRouter } from './routes/exam.route.js';
import { examAdminRouter } from './routes/exam-admin.route.js';
import type { ZodIssue } from 'zod';

/**
 * Anh xa ma loi nghiep vu (`code` tren cac custom error class) sang HTTP status
 * code phu hop. Tap trung tai 1 noi de de bao tri va dam bao nhat quan giua
 * cac module (Auth, Users, Points, ...).
 */
const ERROR_CODE_TO_HTTP_STATUS: Readonly<Record<string, number>> = {
  // Auth
  MISSING_AUTH_TOKEN: 401,
  INVALID_FIREBASE_TOKEN: 401,
  USER_NOT_REGISTERED: 403,
  ACCOUNT_CONFLICT: 409,
  INVALID_SESSION_TOKEN: 401,
  SESSION_USER_NOT_FOUND: 401,
  // Users / Onboarding
  INVALID_REQUEST_BODY: 400,
  INVALID_SUBJECTS: 400,
  INVALID_PROFILE_INPUT: 400,
  USER_NOT_FOUND: 404,
  // Points
  POINTS_INSUFFICIENT: 409,
  INVALID_POINTS_AMOUNT: 400,
  OPTIMISTIC_LOCK_CONFLICT: 409,
  // Practice (On tap)
  PRACTICE_SESSION_NOT_FOUND: 404,
  PRACTICE_SESSION_EXPIRED: 410,
  PRACTICE_SESSION_ALREADY_COMPLETED: 409,
  PRACTICE_SESSION_NOT_OWNED: 403,
  PRACTICE_RATE_LIMIT_EXCEEDED: 429,
  SUBJECT_NOT_REGISTERED: 403,
  SUBJECT_HAS_NO_QUESTIONS: 404,
  QUESTION_NOT_FOUND: 404,
  QUESTION_NOT_ATTEMPTED: 403,
  QUESTION_NOT_ATTEMPTED_FOR_REPORT: 403,
  QUESTION_NOT_IN_SESSION: 400,
  // Admin
  ADMIN_UNAUTHORIZED: 401,
  // Reports
  REPORT_ALREADY_SUBMITTED: 409,
  // Thi thu (Exam)
  EXAM_PAPER_NOT_FOUND: 404,
  EXAM_QUESTION_NOT_FOUND: 404,
  EXAM_INVALID_SUBJECT: 400,
  EXAM_PAPER_EMPTY: 404,
  EXAM_INSUFFICIENT_POINTS: 409,
  EXAM_SESSION_NOT_FOUND: 404,
  EXAM_SESSION_NOT_OWNED: 403,
  EXAM_SESSION_ALREADY_COMPLETED: 409,
  EXAM_SESSION_NOT_COMPLETED: 409,
  EXAM_EXPIRED: 410,
  EXAM_QUESTION_INVALID: 400,
  EXAM_IMPORT_FILE_INVALID: 400,
};

/** Kiem tra 1 gia tri loi co phai la "custom error" co truong `code` (string) hay khong. */
function getErrorCode(err: unknown): string | null {
  if (err instanceof Error && 'code' in err && typeof (err as { code?: unknown }).code === 'string') {
    return (err as { code: string }).code;
  }
  return null;
}

/** Lay chi tiet loi validate Zod neu co (truong `details: ZodIssue[]`). */
function getValidationDetails(err: unknown): ZodIssue[] | null {
  if (
    err instanceof Error &&
    'details' in err &&
    Array.isArray((err as { details?: unknown }).details)
  ) {
    return (err as { details: ZodIssue[] }).details;
  }
  return null;
}

/**
 * Tao va cau hinh Express application.
 * Tach rieng ra khoi server.ts de de dang viet test sau nay.
 */
export function createApp(): Application {
  const app = express();

  // Cho phep frontend (Vite dev server) goi sang backend khac origin
  app.use(cors());
  app.use(express.json());

  // Gan cac route API
  app.use('/api/hello', helloRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/practice', practiceRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/admin/exam-papers', examAdminRouter);
  app.use('/api/exam', examRouter);

  // Route kiem tra suc khoe server
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // Bat request den route khong ton tai -> tra ve 404 ro rang
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: `Khong tim thay duong dan: ${req.method} ${req.originalUrl}`,
    });
  });

  // Middleware xu ly loi tap trung - bat moi loi nem ra tu cac route phia tren
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const code = getErrorCode(err);
    const status = (code && ERROR_CODE_TO_HTTP_STATUS[code]) || 500;
    const message = err instanceof Error ? err.message : 'Da xay ra loi khong xac dinh';

    if (status >= 500) {
      console.error('[QuizzGame Backend] Loi khong xac dinh:', err);
      res.status(status).json({ error: 'INTERNAL_SERVER_ERROR', message });
      return;
    }

    // Loi validate body (Zod): tra ve them `details` de client hien thi loi cu the theo field.
    const details = getValidationDetails(err);
    res.status(status).json({ error: code, message, ...(details ? { details } : {}) });
  });

  return app;
}
