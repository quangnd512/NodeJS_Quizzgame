// Routes cho module "Học sinh đóng góp câu hỏi" — phía admin.
// Xác thực bằng header X-Admin-Secret (không cần Firebase/JWT user).
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { verifyAdminSecret } from '../middleware/admin.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { submissionService } from '../services/submission/submission.service.js';
import { SUBMISSION_STATUSES } from '../services/submission/submission.types.js';

export const adminSubmissionRouter = Router();

adminSubmissionRouter.use(verifyAdminSecret);

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const rejectSchema = z.object({
  note: z.string().min(1).max(500),
});

// ---------------------------------------------------------------------------
// GET /api/admin/submissions?status=&page=&limit=
// ---------------------------------------------------------------------------

adminSubmissionRouter.get(
  '/submissions',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const statusRaw = req.query['status'];
      const status =
        typeof statusRaw === 'string' && (SUBMISSION_STATUSES as readonly string[]).includes(statusRaw)
          ? statusRaw
          : undefined;
      const page = parseInt(String(req.query['page'] ?? '1'), 10);
      const limit = parseInt(String(req.query['limit'] ?? '20'), 10);

      const result = await submissionService.listSubmissionsAdmin({
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
// POST /api/admin/submissions/:id/approve
// ---------------------------------------------------------------------------

adminSubmissionRouter.post(
  '/submissions/:id/approve',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await submissionService.approveSubmission(req.params['id']!);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /api/admin/submissions/:id/reject
// ---------------------------------------------------------------------------

adminSubmissionRouter.post(
  '/submissions/:id/reject',
  validateBody(rejectSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { note } = req.body as z.infer<typeof rejectSchema>;
      const result = await submissionService.rejectSubmission(req.params['id']!, note);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);
