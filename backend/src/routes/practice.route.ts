// Routes cho module On tap (Practice).
// Tat ca route deu yeu cau verifyAppToken (da dang nhap).
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { verifyAppToken } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { practiceService } from '../services/practice/practice.service.js';
import { REPORT_REASONS } from '../services/practice/practice.types.js';

export const practiceRouter = Router();

// Tat ca route deu can xac thuc
practiceRouter.use(verifyAppToken);

// ---------------------------------------------------------------------------
// Zod schemas cho request body
// ---------------------------------------------------------------------------

const answerSchema = z.object({
  sessionId: z.string().uuid('sessionId phai la UUID hop le'),
  questionId: z.string().uuid('questionId phai la UUID hop le'),
  selectedOption: z.number().int().min(0).max(3),
});

const completeSchema = z.object({
  sessionId: z.string().uuid('sessionId phai la UUID hop le'),
});

const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  description: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// GET /api/practice/start?subject=TOAN
// ---------------------------------------------------------------------------

practiceRouter.get(
  '/start',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const subjectId = req.query['subject'];
      if (typeof subjectId !== 'string' || !subjectId) {
        res.status(400).json({ error: 'INVALID_REQUEST_BODY', message: 'Thieu query param "subject".' });
        return;
      }
      const result = await practiceService.startSession(req.currentUser!.id, subjectId);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/practice/answer
// ---------------------------------------------------------------------------

practiceRouter.post(
  '/answer',
  validateBody(answerSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId, questionId, selectedOption } = req.body as z.infer<typeof answerSchema>;
      const result = await practiceService.submitAnswer(
        req.currentUser!.id,
        sessionId,
        questionId,
        selectedOption,
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/practice/complete
// ---------------------------------------------------------------------------

practiceRouter.post(
  '/complete',
  validateBody(completeSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = req.body as z.infer<typeof completeSchema>;
      const result = await practiceService.completeSession(req.currentUser!.id, sessionId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/practice/session/:id
// ---------------------------------------------------------------------------

practiceRouter.get(
  '/session/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await practiceService.getSessionDetail(req.currentUser!.id, req.params['id']!);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/practice/history?limit=&offset=
// ---------------------------------------------------------------------------

practiceRouter.get(
  '/history',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = parseInt(String(req.query['limit'] ?? '20'), 10);
      const offset = parseInt(String(req.query['offset'] ?? '0'), 10);
      const result = await practiceService.getHistory(
        req.currentUser!.id,
        isNaN(limit) ? 20 : limit,
        isNaN(offset) ? 0 : offset,
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/practice/stats?subject=
// ---------------------------------------------------------------------------

practiceRouter.get(
  '/stats',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const subject = typeof req.query['subject'] === 'string' ? req.query['subject'] : undefined;
      const result = await practiceService.getStats(req.currentUser!.id, subject);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/practice/questions/:id/explain
// ---------------------------------------------------------------------------

practiceRouter.get(
  '/questions/:id/explain',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await practiceService.getExplanation(req.currentUser!.id, req.params['id']!);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/practice/questions/:id/report
// ---------------------------------------------------------------------------

practiceRouter.post(
  '/questions/:id/report',
  validateBody(reportSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { reason, description } = req.body as z.infer<typeof reportSchema>;
      await practiceService.reportQuestion(
        req.currentUser!.id,
        req.params['id']!,
        reason,
        description,
      );
      res.status(201).json({ message: 'Da gui bao cao thanh cong.' });
    } catch (err) {
      next(err);
    }
  },
);
