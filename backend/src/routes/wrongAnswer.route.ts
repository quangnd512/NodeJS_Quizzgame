// Routes cho module Ôn câu sai (Wrong Answer Review).
// Tất cả route đều yêu cầu verifyAppToken (đã đăng nhập).
import { Router, type NextFunction, type Request, type Response } from 'express';
import { verifyAppToken } from '../middleware/auth.middleware.js';
import { wrongAnswerService } from '../services/wrongAnswer/wrongAnswer.service.js';

export const wrongAnswerRouter = Router();

wrongAnswerRouter.use(verifyAppToken);

// ---------------------------------------------------------------------------
// GET /api/wrong-answers
// Query: subjectId? (string), page? (number), pageSize? (number, default 20)
// ---------------------------------------------------------------------------

wrongAnswerRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.currentUser!.id;
      const subjectId = typeof req.query['subjectId'] === 'string' ? req.query['subjectId'] : undefined;
      const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10) || 1);
      const pageSize = Math.min(50, Math.max(1, parseInt(String(req.query['pageSize'] ?? '20'), 10) || 20));

      const result = await wrongAnswerService.getWrongAnswers(userId, subjectId, page, pageSize);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/wrong-answers/:id/retry
// Param: id (WrongAnswer record ID, số nguyên)
// Body: { answer: unknown }
// ---------------------------------------------------------------------------

wrongAnswerRouter.post(
  '/:id/retry',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.currentUser!.id;
      const id = parseInt(req.params['id'] ?? '', 10);

      if (isNaN(id)) {
        res.status(400).json({ error: 'INVALID_REQUEST_BODY', message: 'id phải là số nguyên.' });
        return;
      }

      const body = req.body as { answer?: unknown };
      if (body.answer === undefined) {
        res.status(400).json({ error: 'INVALID_REQUEST_BODY', message: 'Thiếu trường answer.' });
        return;
      }

      const result = await wrongAnswerService.retryQuestion(userId, id, body.answer);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
