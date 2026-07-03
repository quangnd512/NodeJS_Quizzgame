// Routes cho module Thi thu (Exam) - danh cho hoc sinh.
// Tat ca route deu yeu cau verifyAppToken (da dang nhap).
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { verifyAppToken } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { examService } from '../services/exam/exam.service.js';

export const examRouter = Router();

// Tat ca route deu can xac thuc
examRouter.use(verifyAppToken);

// ---------------------------------------------------------------------------
// Zod schemas cho request body
// ---------------------------------------------------------------------------

const startExamSchema = z.object({
  subject: z.string().min(1),
});

const submitExamSchema = z.object({
  sessionId: z.string().uuid('sessionId phai la UUID hop le'),
  answers: z.array(
    z.object({
      examQuestionId: z.string().uuid('examQuestionId phai la UUID hop le'),
      // TRUE_FALSE_4: null = y chua tra loi (gradeQuestion tinh la sai).
      selectedAnswer: z.union([z.number(), z.string(), z.array(z.union([z.boolean(), z.null()]))]),
    }),
  ),
});

// ---------------------------------------------------------------------------
// POST /api/exam/start — bat dau phien thi thu moi cho 1 mon hoc
// ---------------------------------------------------------------------------

examRouter.post(
  '/start',
  validateBody(startExamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { subject } = req.body as z.infer<typeof startExamSchema>;
      const result = await examService.startExam(req.currentUser!.id, subject);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/exam/submit — nop bai thi thu
// ---------------------------------------------------------------------------

examRouter.post(
  '/submit',
  validateBody(submitExamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId, answers } = req.body as z.infer<typeof submitExamSchema>;
      const result = await examService.submitExam(req.currentUser!.id, sessionId, answers);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/exam/:id/result — xem ket qua chi tiet 1 phien thi thu
// ---------------------------------------------------------------------------

examRouter.get(
  '/:id/result',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await examService.getExamResult(req.currentUser!.id, req.params['id']!);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);
