// Goi API lien quan den XAC THUC (dang nhap). Xem backend/src/routes/auth.route.ts.
import { postFirebaseLogin } from './client';

/**
 * Ho so user tra ve TU `POST /api/auth/login` - CHU Y: khac voi `UserMeDto` (tra ve tu
 * `GET /api/users/me`) o cho `subjects` o day CHI la mang ma mon hoc (string[]), KHONG kem ten
 * hien thi (xem `backend/src/services/auth/auth.types.ts` -> `UserProfileDto`). Muon lay ten hien
 * thi day du, phai goi `getMyProfile()` (api/users.ts).
 */
export interface LoginUserProfile {
  id: string;
  firebaseUid: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  school: string | null;
  province: string | null;
  /** Ma mon hoc da dang ky (vd ["TOAN", "LY"]) - RONG neu chua onboarding. */
  subjects: string[];
  createdAt: string;
  lastLoginAt: string | null;
}

export interface LoginResult {
  /** JWT noi bo - han 7 ngay. Luu bang expo-secure-store, dinh kem vao moi request sau nay. */
  token: string;
  /** true neu day la lan dau tien user nay xuat hien trong he thong (dua vao Onboarding). */
  isNewUser: boolean;
  user: LoginUserProfile;
}

/**
 * `POST /api/auth/login` - doi Firebase ID Token (co duoc sau khi dang nhap Google/Apple qua
 * Firebase SDK) lay JWT noi bo cua he thong.
 */
export async function loginWithFirebaseToken(firebaseIdToken: string): Promise<LoginResult> {
  return postFirebaseLogin<LoginResult>(firebaseIdToken);
}
