// Routes quan ly Ngan hang cau hoi (Question Bank) danh cho admin.
// Xac thuc bang header X-Admin-Secret (giong exam-admin.route.ts).
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { verifyAdminSecret } from '../middleware/admin.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { questionBankService } from '../services/exam/question-bank.service.js';
import { EXAM_QUESTION_TYPES } from '../services/exam/exam.types.js';
import { SUBJECT_CATALOG } from '../services/users/users.types.js';

export const questionBankRouter = Router();

questionBankRouter.use(verifyAdminSecret);

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const validSubjectIds = SUBJECT_CATALOG.map((s) => s.id) as [string, ...string[]];

const createQuestionBankSchema = z.object({
  subject: z.enum(validSubjectIds),
  chapter: z.string().max(200).optional(),
  difficulty: z.number().int().min(1).max(3),
  questionType: z.enum(EXAM_QUESTION_TYPES),
  points: z.number().positive(),
  questionText: z.string().min(1).max(4000),
  options: z.array(z.string().min(1)).length(4).optional(),
  correctAnswer: z.union([
    z.number().int().min(0).max(3),
    z.array(z.boolean()).length(4),
    z.array(z.string().min(1)).min(1),
  ]),
  explanation: z.string().max(4000).optional(),
  examYear: z.number().int().min(2000).max(2100).optional(),
  examCode: z.string().max(50).optional(),
});

const updateQuestionBankSchema = createQuestionBankSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const listQuerySchema = z.object({
  subject: z.enum(validSubjectIds).optional(),
  chapter: z.string().max(200).optional(),
  difficulty: z.coerce.number().int().min(1).max(3).optional(),
  search: z.string().max(200).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

// ---------------------------------------------------------------------------
// GET /api/admin/question-bank — danh sach cau hoi (filter + phan trang)
// ---------------------------------------------------------------------------

questionBankRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: 'INVALID_REQUEST_BODY', message: 'Tham so query khong hop le.', details: parsed.error.issues });
        return;
      }
      const q = parsed.data;
      const result = await questionBankService.listQuestions({
        subject: q.subject,
        chapter: q.chapter,
        difficulty: q.difficulty,
        search: q.search,
        isActive: q.isActive !== undefined ? q.isActive === 'true' : undefined,
        page: q.page,
        pageSize: q.pageSize,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/admin/question-bank — tao cau hoi moi trong kho
// ---------------------------------------------------------------------------

questionBankRouter.post(
  '/',
  validateBody(createQuestionBankSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await questionBankService.createQuestion(
        req.body as z.infer<typeof createQuestionBankSchema>,
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/admin/question-bank/:id/usage — kiem tra cau hoi dang dung o dau
// ---------------------------------------------------------------------------

questionBankRouter.get(
  '/:id/usage',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await questionBankService.getUsage(req.params['id']!);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// PUT /api/admin/question-bank/:id — cap nhat cau hoi trong kho
// ---------------------------------------------------------------------------

questionBankRouter.put(
  '/:id',
  validateBody(updateQuestionBankSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await questionBankService.updateQuestion(
        req.params['id']!,
        req.body as z.infer<typeof updateQuestionBankSchema>,
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /api/admin/question-bank/:id — hard delete (co guard)
// ---------------------------------------------------------------------------

questionBankRouter.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await questionBankService.deleteQuestion(req.params['id']!);
      res.status(200).json({ message: 'Da xoa cau hoi khoi ngan hang thanh cong.' });
    } catch (err) {
      next(err);
    }
  },
);
