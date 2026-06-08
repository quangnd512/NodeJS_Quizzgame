// Cau hinh Express app: middleware, routes, xu ly loi tap trung
import express, { type Application, type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { helloRouter } from './routes/hello.route.js';

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
    console.error('[QuizzGame Backend] Loi khong xac dinh:', err);
    const message = err instanceof Error ? err.message : 'Da xay ra loi khong xac dinh';
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message });
  });

  return app;
}
