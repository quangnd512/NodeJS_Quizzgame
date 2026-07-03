// Routes quan ly de thi thu + cau hoi danh cho admin.
// Xac thuc bang header X-Admin-Secret (giong admin.route.ts).
import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { verifyAdminSecret } from '../middleware/admin.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { ExamImportFileInvalidError } from '../services/exam/exam.errors.js';
import { importQuestionsFromExcel } from '../services/exam/exam-import.service.js';
import { examService } from '../services/exam/exam.service.js';
import { EXAM_QUESTION_TYPES } from '../services/exam/exam.types.js';
import { questionBankService } from '../services/exam/question-bank.service.js';
import { SUBJECT_CATALOG } from '../services/users/users.types.js';

export const examAdminRouter = Router();

// Tat ca route admin deu can X-Admin-Secret
examAdminRouter.use(verifyAdminSecret);

// Upload file Excel vao memory (khong luu xuong disk) - file thuong nho (< 5MB).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

/**
 * Boc middleware multer de chuyen MulterError (vi du qua dung luong, sai field)
 * thanh ExamImportFileInvalidError -> tra ve 400 thay vi rot xuong 500 mac dinh
 * (ERROR_CODE_TO_HTTP_STATUS khong biet ma loi cua multer).
 */
function uploadExcelFile(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      next(new ExamImportFileInvalidError(`Loi tai file len: ${err.message}`));
      return;
    }
    if (err) {
      next(err);
      return;
    }
    next();
  });
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const validSubjectIds = SUBJECT_CATALOG.map((s) => s.id) as [string, ...string[]];

const createPaperSchema = z.object({
  subject: z.enum(validSubjectIds),
  title: z.string().min(1).max(300),
  durationMinutes: z.number().int().positive().max(600),
});

const updatePaperSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  durationMinutes: z.number().int().positive().max(600).optional(),
  isActive: z.boolean().optional(),
});

const createQuestionSchema = z.object({
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

const updateQuestionSchema = createQuestionSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// POST /api/admin/exam-papers — tao de thi moi (chua co cau hoi)
// ---------------------------------------------------------------------------

examAdminRouter.post(
  '/',
  validateBody(createPaperSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await examService.createExamPaper(req.body as z.infer<typeof createPaperSchema>);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/admin/exam-papers?subject= — danh sach de thi
// ---------------------------------------------------------------------------

examAdminRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const subject = typeof req.query['subject'] === 'string' ? req.query['subject'] : undefined;
      const result = await examService.listExamPapers(subject);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/admin/exam-papers/:id — chi tiet de thi (kem toan bo cau hoi)
// ---------------------------------------------------------------------------

examAdminRouter.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await examService.getExamPaperDetail(req.params['id']!);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /api/admin/exam-papers/:id — cap nhat de thi
// ---------------------------------------------------------------------------

examAdminRouter.patch(
  '/:id',
  validateBody(updatePaperSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await examService.updateExamPaper(
        req.params['id']!,
        req.body as z.infer<typeof updatePaperSchema>,
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/admin/exam-papers/:id/questions — them 1 cau hoi
// ---------------------------------------------------------------------------

examAdminRouter.post(
  '/:id/questions',
  validateBody(createQuestionSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await examService.createExamQuestion(
        req.params['id']!,
        req.body as z.infer<typeof createQuestionSchema>,
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/admin/exam-papers/:id/questions/import — nhap cau hoi tu file Excel
// Cho phep THANH CONG MOT PHAN: tra ve { inserted, errors: [{ row, message }] }
// ---------------------------------------------------------------------------

examAdminRouter.post(
  '/:id/questions/import',
  uploadExcelFile,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        throw new ExamImportFileInvalidError('Thieu file Excel (field "file").');
      }
      const result = await importQuestionsFromExcel(req.params['id']!, req.file.buffer);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /api/admin/exam-papers/:id/questions/:qid — cap nhat 1 cau hoi
// ---------------------------------------------------------------------------

examAdminRouter.patch(
  '/:id/questions/:qid',
  validateBody(updateQuestionSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await examService.updateExamQuestion(
        req.params['id']!,
        req.params['qid']!,
        req.body as z.infer<typeof updateQuestionSchema>,
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/admin/exam-papers/:id/questions/from-bank — them nhieu cau tu kho
// ---------------------------------------------------------------------------

const addFromBankSchema = z.object({
  questionBankIds: z.array(z.string().uuid()).min(1).max(100),
});

examAdminRouter.post(
  '/:id/questions/from-bank',
  validateBody(addFromBankSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await questionBankService.addFromBank(
        req.params['id']!,
        req.body as z.infer<typeof addFromBankSchema>,
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/admin/exam-papers/:id/questions/auto-fill — lay cau tu dong tu kho
// Chon ngau nhien N cau theo ti le 50% de / 30% tb / 20% kho cung mon voi de.
// ---------------------------------------------------------------------------

const autoFillSchema = z.object({
  count: z.number().int().min(1).max(200),
});

examAdminRouter.post(
  '/:id/questions/auto-fill',
  validateBody(autoFillSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await questionBankService.autoFillFromBank(
        req.params['id']!,
        req.body as z.infer<typeof autoFillSchema>,
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /api/admin/exam-papers/:id/questions/:qid — soft delete cau hoi
// ---------------------------------------------------------------------------

examAdminRouter.delete(
  '/:id/questions/:qid',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await examService.deleteExamQuestion(req.params['id']!, req.params['qid']!);
      res.status(200).json({ message: 'Da an cau hoi thanh cong.' });
    } catch (err) {
      next(err);
    }
  },
);
