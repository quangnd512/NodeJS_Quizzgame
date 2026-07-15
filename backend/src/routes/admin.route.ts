// Routes quan ly cau hoi danh cho admin.
// Xac thuc bang header X-Admin-Secret (khong can Firebase/JWT user).
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { verifyAdminSecret } from '../middleware/admin.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { practiceService } from '../services/practice/practice.service.js';
import { RESOLVABLE_REPORT_STATUSES } from '../services/practice/practice.types.js';
import { SUBJECT_CATALOG } from '../services/users/users.types.js';

export const adminRouter = Router();

// Tat ca route admin deu can X-Admin-Secret
adminRouter.use(verifyAdminSecret);

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const validSubjectIds = SUBJECT_CATALOG.map((s) => s.id) as [string, ...string[]];

const questionSchema = z.object({
  subject: z.enum(validSubjectIds),
  chapter: z.string().max(200).optional(),
  difficulty: z.number().int().min(1).max(3),
  question: z.string().min(5).max(2000),
  options: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1), z.string().min(1)]),
  correctAnswer: z.number().int().min(0).max(3),
  explanation: z.string().max(2000).optional(),
  examYear: z.number().int().min(2000).max(2100).optional(),
  examCode: z.string().max(50).optional(),
});

const updateQuestionSchema = questionSchema.partial();

const bulkSchema = z.object({
  questions: z.array(questionSchema).min(1).max(500),
});

const resolveReportQuestionUpdateSchema = z.object({
  subject: z.enum(validSubjectIds).optional(),
  chapter: z.string().max(200).nullable().optional(),
  difficulty: z.number().int().min(1).max(3).optional(),
  question: z.string().min(5).max(2000).optional(),
  options: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1), z.string().min(1)]).optional(),
  correctAnswer: z.number().int().min(0).max(3).optional(),
  explanation: z.string().max(2000).nullable().optional(),
});

const resolveReportSchema = z.object({
  // Chi chap nhan FIXED|DISMISSED — KHONG cho phep ghi lai REVIEWED qua endpoint nay.
  status: z.enum(RESOLVABLE_REPORT_STATUSES),
  questionUpdate: resolveReportQuestionUpdateSchema.optional(),
});

// ---------------------------------------------------------------------------
// POST /api/admin/questions — tao 1 cau hoi
// ---------------------------------------------------------------------------

adminRouter.post(
  '/questions',
  validateBody(questionSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await practiceService.createQuestion(req.body as z.infer<typeof questionSchema>);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/admin/questions/bulk — nhap hang loat (all-or-nothing)
// ---------------------------------------------------------------------------

adminRouter.post(
  '/questions/bulk',
  validateBody(bulkSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { questions } = req.body as z.infer<typeof bulkSchema>;
      const results = await practiceService.bulkCreateQuestions(questions);
      res.status(201).json({ inserted: results.length, questions: results });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// PUT /api/admin/questions/:id — cap nhat cau hoi
// ---------------------------------------------------------------------------

adminRouter.put(
  '/questions/:id',
  validateBody(updateQuestionSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await practiceService.updateQuestion(
        req.params['id']!,
        req.body as z.infer<typeof updateQuestionSchema>,
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /api/admin/questions/:id — soft delete (isActive = false)
// ---------------------------------------------------------------------------

adminRouter.delete(
  '/questions/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await practiceService.deleteQuestion(req.params['id']!);
      res.status(200).json({ message: 'Da an cau hoi thanh cong.' });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/admin/questions?subject=&difficulty=&isActive=&page=&limit=
// ---------------------------------------------------------------------------

adminRouter.get(
  '/questions',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const subject = typeof req.query['subject'] === 'string' ? req.query['subject'] : undefined;
      const diffRaw = req.query['difficulty'];
      const difficulty =
        typeof diffRaw === 'string' && diffRaw !== '' ? parseInt(diffRaw, 10) : undefined;
      const isActiveRaw = req.query['isActive'];
      const isActive =
        isActiveRaw === 'true' ? true : isActiveRaw === 'false' ? false : undefined;
      const page = parseInt(String(req.query['page'] ?? '1'), 10);
      const limit = parseInt(String(req.query['limit'] ?? '20'), 10);

      const result = await practiceService.listQuestions({
        subject,
        difficulty: difficulty !== undefined && !isNaN(difficulty) ? difficulty : undefined,
        isActive,
        page: isNaN(page) ? 1 : page,
        limit: isNaN(limit) ? 20 : limit,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/admin/questions/reports?status=&subject=&reason=&page=&limit=
// ---------------------------------------------------------------------------

adminRouter.get(
  '/questions/reports',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = typeof req.query['status'] === 'string' ? req.query['status'] : undefined;
      const subject = typeof req.query['subject'] === 'string' ? req.query['subject'] : undefined;
      const reason = typeof req.query['reason'] === 'string' ? req.query['reason'] : undefined;
      const page = parseInt(String(req.query['page'] ?? '1'), 10);
      const limit = parseInt(String(req.query['limit'] ?? '20'), 10);

      const result = await practiceService.listReports({
        status,
        subject,
        reason,
        page: isNaN(page) ? 1 : page,
        limit: isNaN(limit) ? 20 : limit,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/admin/questions/reports/summary — tong hop thong ke bao cao
// ---------------------------------------------------------------------------

adminRouter.get(
  '/questions/reports/summary',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await practiceService.getReportsSummary();
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/admin/questions/reports/facets?status=&subject=&reason= — loc lien dong:
// tra ve cac gia tri con kha dung cho tung dropdown, tinh theo 2 dieu kien loc
// con lai dang duoc chon. PHAI dang ky truoc /:id/resolve (path tinh truoc path
// dong) de tranh Express hieu nham "facets" la 1 :id.
// ---------------------------------------------------------------------------

adminRouter.get(
  '/questions/reports/facets',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = typeof req.query['status'] === 'string' ? req.query['status'] : undefined;
      const subject = typeof req.query['subject'] === 'string' ? req.query['subject'] : undefined;
      const reason = typeof req.query['reason'] === 'string' ? req.query['reason'] : undefined;

      const result = await practiceService.getReportFilterFacets({ status, subject, reason });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /api/admin/questions/reports/:id/resolve — xu ly bao cao (gop, thay
// the endpoint PATCH cu). Chi nhan FIXED|DISMISSED; ho tro sua noi dung cau
// hoi ngay tai cho (questionUpdate); tu dong dong het cac bao cao PENDING
// khac cung cau hoi trong cung 1 lan.
// ---------------------------------------------------------------------------

adminRouter.patch(
  '/questions/reports/:id/resolve',
  validateBody(resolveReportSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status, questionUpdate } = req.body as z.infer<typeof resolveReportSchema>;
      const result = await practiceService.resolveReport(req.params['id']!, status, questionUpdate);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);
