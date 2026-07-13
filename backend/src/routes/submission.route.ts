// Routes cho module "Học sinh đóng góp câu hỏi" — phía học sinh.
// Tất cả route đều yêu cầu verifyAppToken (đã đăng nhập).
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { verifyAppToken } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { submissionService } from '../services/submission/submission.service.js';
import { SUBMISSION_STATUSES } from '../services/submission/submission.types.js';
import { SUBJECT_CATALOG } from '../services/users/users.types.js';

export const submissionRouter = Router();

submissionRouter.use(verifyAppToken);

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const validSubjectIds = SUBJECT_CATALOG.map((s) => s.id) as [string, ...string[]];

const createSubmissionSchema = z.object({
  subject: z.enum(validSubjectIds),
  chapter: z.string().max(200).optional(),
  questionText: z.string().min(5).max(2000),
  options: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1), z.string().min(1)]),
  correctOptionIndex: z.number().int().min(0).max(3),
});

const updateSubmissionSchema = createSubmissionSchema.partial();

// ---------------------------------------------------------------------------
// POST /api/submissions
// ---------------------------------------------------------------------------

submissionRouter.post(
  '/',
  validateBody(createSubmissionSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await submissionService.createSubmission(
        req.currentUser!.id,
        req.body as z.infer<typeof createSubmissionSchema>,
      );
      res.status(201).json({ id: result.id, status: result.status, createdAt: result.createdAt });
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /api/submissions?status=&page=&limit=
// ---------------------------------------------------------------------------

submissionRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const statusRaw = req.query['status'];
      const status =
        typeof statusRaw === 'string' && (SUBMISSION_STATUSES as readonly string[]).includes(statusRaw)
          ? statusRaw
          : undefined;
      const page = parseInt(String(req.query['page'] ?? '1'), 10);
      const limit = parseInt(String(req.query['limit'] ?? '20'), 10);

      const result = await submissionService.listSubmissions(req.currentUser!.id, {
        status,
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
// GET /api/submissions/:id
// ---------------------------------------------------------------------------

submissionRouter.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await submissionService.getSubmission(req.currentUser!.id, req.params['id']!);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// PUT /api/submissions/:id
// ---------------------------------------------------------------------------

submissionRouter.put(
  '/:id',
  validateBody(updateSubmissionSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await submissionService.updateSubmission(
        req.currentUser!.id,
        req.params['id']!,
        req.body as z.infer<typeof updateSubmissionSchema>,
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /api/submissions/:id
// ---------------------------------------------------------------------------

submissionRouter.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await submissionService.deleteSubmission(req.currentUser!.id, req.params['id']!);
      res.status(200).json({ message: 'Da xoa cau hoi gui thanh cong.' });
    } catch (err) {
      next(err);
    }
  },
);
