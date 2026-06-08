// Routes lien quan den User profile & Onboarding (chon mon hoc).
import { Router, type NextFunction, type Request, type Response } from 'express';
import { verifyAppToken } from '../middleware/auth.middleware.js';
import { UsersError } from '../services/users/users.errors.js';
import { usersService, type ProfileUpdateInput, type SubjectInput } from '../services/users/users.service.js';
import type { SubjectCatalogEntry, UserMeDto } from '../services/users/users.types.js';

export const usersRouter = Router();

/**
 * Tat ca route trong file nay deu yeu cau da dang nhap (co session token noi
 * bo hop le). `verifyAppToken` luon dam bao `req.currentUser` ton tai truoc
 * khi goi `next()` (neu khong se nem loi 401 truoc khi den day) - vi vay cac
 * handler ben duoi co the dung `req.currentUser!` an toan ve mat logic
 * (van kiem tra lai tuong minh de tranh non-null assertion - xem ben duoi).
 */
usersRouter.use(verifyAppToken);

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

      // `verifyAppToken` da dam bao `req.currentUser` ton tai.
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
      // `verifyAppToken` da dam bao `req.currentUser` ton tai.
      const profile = await usersService.getProfile(req.currentUser!.id);
      res.status(200).json(profile);
    } catch (err) {
      next(err);
    }
  },
);

interface UpdateProfileRequestBody {
  displayName?: unknown;
  phone?: unknown;
  school?: unknown;
  province?: unknown;
}

/**
 * PUT /api/users/profile
 *
 * Cho phep nguoi dung tu chinh sua cac truong ho so CA NHAN: `displayName`,
 * `phone`, `school`, `province`.
 *
 * QUY UOC DONG BO QUAN TRONG (theo dung quyet dinh thiet ke da thong nhat):
 *   - `email` KHONG duoc sua o day - day la du lieu dong bo TU FIREBASE va
 *     duoc cap nhat tu dong moi lan dang nhap (xem `AuthService.login`).
 *   - `subjects` co endpoint rieng (`POST /api/users/subjects`) vi co luat
 *     validate khac han (danh muc, so luong toi thieu/toi da).
 *   - Cac truong KHONG duoc gui len (hoac gui `null`) se duoc XOA (set ve
 *     `null`) - cho phep nguoi dung "xoa" thong tin da dien truoc do. Truong
 *     hoan toan VANG MAT trong body se KHONG bi thay doi (giu nguyen gia tri cu) -
 *     cho phep client chi gui truong muon sua (kieu PATCH "ban phan", quen
 *     thuoc voi cac app mobile hien dai dung React Query/SWR).
 */
usersRouter.put(
  '/profile',
  async (
    req: Request<unknown, UserMeDto, UpdateProfileRequestBody>,
    res: Response<UserMeDto>,
    next: NextFunction,
  ) => {
    try {
      const update: ProfileUpdateInput = {};
      const { displayName, phone, school, province } = req.body;

      if ('displayName' in req.body) update.displayName = assertNullableStringField('displayName', displayName);
      if ('phone' in req.body) update.phone = assertNullableStringField('phone', phone);
      if ('school' in req.body) update.school = assertNullableStringField('school', school);
      if ('province' in req.body) update.province = assertNullableStringField('province', province);

      // `verifyAppToken` da dam bao `req.currentUser` ton tai.
      const profile = await usersService.updateProfile(req.currentUser!.id, update);
      res.status(200).json(profile);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Kiem tra 1 truong ho so dau vao phai la `string` hoac `null`/`undefined`
 * (KHONG chap nhan number/boolean/object...). Tra ve `null` cho `null`/`undefined`
 * (cho phep "xoa" gia tri), hoac chuoi da `trim()`.
 *
 * Nem `UsersError` (`INVALID_REQUEST_BODY`) neu sai kieu - dong nhat voi cach
 * validate `subjects` o tren, KHONG dung `any`.
 */
function assertNullableStringField(fieldName: string, value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new UsersError(`Truong "${fieldName}" phai la chuoi (string) hoac null.`, 'INVALID_REQUEST_BODY');
  }
  return value.trim();
}

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
