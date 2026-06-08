// Routes lien quan den User profile & Onboarding (chon mon hoc).
import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireRegisteredUser, verifyFirebaseToken } from '../middleware/auth.middleware.js';
import { UsersError } from '../services/users/users.errors.js';
import { usersService, type SubjectInput } from '../services/users/users.service.js';
import type { SubjectCatalogEntry, UserMeDto } from '../services/users/users.types.js';

export const usersRouter = Router();

/** Tat ca route trong file nay deu yeu cau: da xac thuc Firebase + da dang ky trong he thong. */
usersRouter.use(verifyFirebaseToken, requireRegisteredUser);

interface UpdateSubjectsRequestBody {
  subjects?: unknown;
}

interface UpdateSubjectsResponse {
  subjects: SubjectCatalogEntry[];
}

/**
 * POST /api/users/subjects
 *
 * Body: `{ "subjects": [{ "id": "TOAN", "name": "Toán" }, ...] }`
 *
 * Luu lai danh sach mon hoc nguoi dung dang ky on thi (buoc quan trong trong
 * qua trinh "onboarding"). Validate: phai co tu 1-7 mon, ma mon phai hop le,
 * khong trung lap (xem chi tiet trong `usersService.updateSubjects`).
 */
usersRouter.post(
  '/subjects',
  async (
    req: Request<unknown, UpdateSubjectsResponse, UpdateSubjectsRequestBody>,
    res: Response<UpdateSubjectsResponse>,
    next: NextFunction,
  ) => {
    try {
      const { subjects } = req.body;

      // Kiem tra dinh dang co ban truoc khi dua xuong service - tranh truong hop
      // client gui sai kieu hoan toan (vi du gui 1 string thay vi mang).
      if (!Array.isArray(subjects)) {
        throw new UsersError('Truong "subjects" phai la mot mang cac doi tuong { id, name }.', 'INVALID_REQUEST_BODY');
      }

      const normalizedInput: SubjectInput[] = subjects.map((item) => assertSubjectInputShape(item));

      // `requireRegisteredUser` da dam bao `req.currentUser` ton tai.
      const updatedSubjects = await usersService.updateSubjects(req.currentUser!.id, normalizedInput);

      res.status(200).json({ subjects: updatedSubjects });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/users/me
 *
 * Tra ve thong tin profile day du cua nguoi dung dang dang nhap, kem theo
 * so diem tich luy hien tai (lay tu PointsService - bang `user_points`).
 */
usersRouter.get(
  '/me',
  async (req: Request, res: Response<UserMeDto>, next: NextFunction) => {
    try {
      // `requireRegisteredUser` da dam bao `req.currentUser` ton tai.
      const profile = await usersService.getProfile(req.currentUser!.id);
      res.status(200).json(profile);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Kiem tra "hinh dang" (shape) toi thieu cua 1 phan tu trong mang `subjects` gui len.
 * Chi yeu cau truong `id` la chuoi - truong `name` la tuy chon (server se tu
 * tra ve ten chuan tu danh muc, khong tin tuong "name" do client gui len).
 *
 * Nem `UsersError` (KHONG dung `any`) neu sai dinh dang - duoc middleware loi
 * tap trung chuyen thanh HTTP 400 voi thong bao ro rang.
 */
function assertSubjectInputShape(item: unknown): SubjectInput {
  if (
    typeof item !== 'object' ||
    item === null ||
    !('id' in item) ||
    typeof (item as { id: unknown }).id !== 'string'
  ) {
    throw new UsersError(
      'Moi phan tu trong "subjects" phai la doi tuong co dang { id: string, name?: string }.',
      'INVALID_REQUEST_BODY',
    );
  }

  const candidate = item as { id: string; name?: unknown };
  return {
    id: candidate.id,
    name: typeof candidate.name === 'string' ? candidate.name : undefined,
  };
}
