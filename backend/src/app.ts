// Cau hinh Express app: middleware, routes, xu ly loi tap trung
import express, { type Application, type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { helloRouter } from './routes/hello.route.js';
import { authRouter } from './routes/auth.route.js';
import { usersRouter } from './routes/users.route.js';

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
  // Users / Onboarding
  INVALID_REQUEST_BODY: 400,
  INVALID_SUBJECTS: 400,
  USER_NOT_FOUND: 404,
  // Points (du phong cho cac route su dung sau nay)
  POINTS_INSUFFICIENT: 409,
  INVALID_POINTS_AMOUNT: 400,
  OPTIMISTIC_LOCK_CONFLICT: 409,
};

/** Kiem tra 1 gia tri loi co phai la "custom error" co truong `code` (string) hay khong. */
function getErrorCode(err: unknown): string | null {
  if (err instanceof Error && 'code' in err && typeof (err as { code?: unknown }).code === 'string') {
    return (err as { code: string }).code;
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

    // Loi nghiep vu (4xx): tra ve `code` cu the de client/FE xu ly chinh xac
    // (vi du: hien thi thong bao rieng cho "het han token" vs "chua dang ky").
    res.status(status).json({ error: code, message });
  });

  return app;
}
