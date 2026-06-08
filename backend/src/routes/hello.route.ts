// Route Hello World - dung de kiem tra ket noi Frontend <-> Backend
import { Router, type Request, type Response, type NextFunction } from 'express';

export const helloRouter = Router();

interface HelloResponse {
  message: string;
  servedAt: string;
}

helloRouter.get('/', (_req: Request, res: Response<HelloResponse>, next: NextFunction) => {
  try {
    const payload: HelloResponse = {
      message: 'Xin chao tu QuizzGame Backend! Ket noi thanh cong.',
      servedAt: new Date().toISOString(),
    };
    res.json(payload);
  } catch (err) {
    // Chuyen loi cho middleware xu ly loi tap trung trong app.ts
    next(err);
  }
});
