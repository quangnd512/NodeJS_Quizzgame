// Routes cho module Tien do hoc tap (Progress).
// Tat ca route deu yeu cau verifyAppToken (da dang nhap).
import { Router, type NextFunction, type Request, type Response } from 'express';
import { verifyAppToken } from '../middleware/auth.middleware.js';
import { progressService } from '../services/progress/progress.service.js';

export const progressRouter = Router();

progressRouter.use(verifyAppToken);

// ---------------------------------------------------------------------------
// GET /api/progress/summary
// ---------------------------------------------------------------------------

progressRouter.get(
  '/summary',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await progressService.getSummary(req.currentUser!.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/progress/exam-history?limit=10&offset=0
// ---------------------------------------------------------------------------

progressRouter.get(
  '/exam-history',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit  = parseInt(String(req.query['limit']  ?? '10'), 10);
      const offset = parseInt(String(req.query['offset'] ?? '0'),  10);
      const result = await progressService.getExamHistory(
        req.currentUser!.id,
        isNaN(limit)  ? 10 : limit,
        isNaN(offset) ? 0  : offset,
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);
