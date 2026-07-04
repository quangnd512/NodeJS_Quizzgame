// Routes cho Leaderboard — bang xep hang hoc sinh theo Diem Uy Tin.
import { Router, type NextFunction, type Request, type Response } from 'express';
import { verifyAppToken } from '../middleware/auth.middleware.js';
import { leaderboardService } from '../services/leaderboard/leaderboard.service.js';
import type { LeaderboardResponse, MyRankResponse } from '../services/leaderboard/leaderboard.types.js';

export const leaderboardRouter = Router();

leaderboardRouter.use(verifyAppToken);

/**
 * GET /api/leaderboard?subject=<optional>&page=<n>
 *
 * Tra ve danh sach xep hang (20 nguoi/trang), co the loc theo mon hoc.
 */
leaderboardRouter.get(
  '/',
  async (req: Request, res: Response<LeaderboardResponse>, next: NextFunction) => {
    try {
      const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10) || 1);
      const subject = typeof req.query['subject'] === 'string' && req.query['subject'].trim()
        ? req.query['subject'].trim().toUpperCase()
        : undefined;

      const result = await leaderboardService.getLeaderboard(page, subject);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/leaderboard/me
 *
 * Tra ve hang va chi so cua user dang dang nhap.
 * Neu chua thi lan nao -> rank = null.
 */
leaderboardRouter.get(
  '/me',
  async (req: Request, res: Response<MyRankResponse>, next: NextFunction) => {
    try {
      const subject = typeof req.query['subject'] === 'string' && req.query['subject'].trim()
        ? req.query['subject'].trim().toUpperCase()
        : undefined;

      const result = await leaderboardService.getMyRank(req.currentUser!.id, subject);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);
