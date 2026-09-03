// Goi API lien quan den User profile & Onboarding (chon mon hoc). Xem backend/src/routes/users.route.ts.
import { request } from './client';

export interface SubjectCatalogEntry {
  /** Ma mon hoc - luu trong DB (vd "TOAN"). */
  id: string;
  /** Ten hien thi day du (vd "Toán") - chi de hien thi, khong luu. */
  name: string;
}

/** Du lieu tra ve tu `GET /api/users/me` - profile day du + so du diem hien tai. */
export interface UserMeDto {
  id: string;
  firebaseUid: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  school: string | null;
  province: string | null;
  subjects: SubjectCatalogEntry[];
  avatarUrl: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  points: number;
  isPremium: boolean;
  premiumExpiresAt: string | null;
}

/** `GET /api/users/me` */
export async function getMyProfile(sessionToken: string): Promise<UserMeDto> {
  return request<UserMeDto>('/api/users/me', sessionToken);
}

/**
 * `POST /api/users/subjects` - luu danh sach mon hoc luc Onboarding (hoac doi mon sau nay).
 * Body dung dinh dang backend yeu cau: `{ subjects: [{ id, name }, ...] }`.
 */
export async function updateSubjects(
  sessionToken: string,
  subjects: SubjectCatalogEntry[],
): Promise<{ subjects: SubjectCatalogEntry[] }> {
  return request('/api/users/subjects', sessionToken, {
    method: 'POST',
    body: JSON.stringify({ subjects }),
  });
}
