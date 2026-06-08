// Cac kieu du lieu va hang so dung chung cho module quan ly User / Onboarding.

/** Mot mon hoc trong "danh muc" cac mon duoc phep dang ky on thi. */
export interface SubjectCatalogEntry {
  /** Ma mon hoc - duoc LUU trong DB (cot `subjects: String[]`). Vi du: "TOAN". */
  id: string;
  /** Ten hien thi day du - CHI dung de tra ve cho client, KHONG luu trong DB. */
  name: string;
}

/**
 * Danh muc CHINH THUC cac mon hoc duoc phep dang ky - tuong ung voi cac mon
 * thi tot nghiep THPT Quoc gia. Day la nguon "su that" duy nhat (single source
 * of truth): moi noi can hien thi ten mon hoc deu nen tra cuu tu day thay vi
 * hardcode rai rac, tranh sai chinh ta / khong nhat quan.
 *
 * QUAN TRONG: khi validate input tu client, ta CHI chap nhan cac `id` co trong
 * danh sach nay - chan moi gia tri la (typo, ma khong ton tai, du lieu rac...).
 */
export const SUBJECT_CATALOG: readonly SubjectCatalogEntry[] = [
  { id: 'TOAN', name: 'Toán' },
  { id: 'VAN', name: 'Ngữ văn' },
  { id: 'ANH', name: 'Tiếng Anh' },
  { id: 'LY', name: 'Vật lý' },
  { id: 'HOA', name: 'Hóa học' },
  { id: 'SINH', name: 'Sinh học' },
  { id: 'SU', name: 'Lịch sử' },
  { id: 'DIA', name: 'Địa lý' },
  { id: 'GDCD', name: 'Giáo dục công dân' },
] as const;

/** Tap hop cac ma mon hop le - dung de tra cuu nhanh (O(1)) khi validate. */
const VALID_SUBJECT_IDS: ReadonlySet<string> = new Set(SUBJECT_CATALOG.map((s) => s.id));

/** Kiem tra 1 ma mon co nam trong danh muc hop le hay khong. */
export function isValidSubjectId(id: string): boolean {
  return VALID_SUBJECT_IDS.has(id);
}

/** Tra ve ten hien thi day du cua 1 ma mon (hoac chinh ma do neu khong tim thay - phong thu). */
export function getSubjectDisplayName(id: string): string {
  return SUBJECT_CATALOG.find((s) => s.id === id)?.name ?? id;
}

/** So mon hoc toi thieu / toi da duoc phep dang ky - dung theo dung yeu cau nghiep vu. */
export const MIN_SUBJECTS = 1;
export const MAX_SUBJECTS = 7;

/** Du lieu tra ve cho `GET /api/users/me` - profile + so du diem hien tai. */
export interface UserMeDto {
  id: string;
  firebaseUid: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  school: string | null;
  province: string | null;
  /** Danh sach mon hoc DAY DU thong tin (ca id lan ten hien thi) - tien loi cho FE render truc tiep. */
  subjects: SubjectCatalogEntry[];
  createdAt: Date;
  /** So diem tich luy hien tai - lay tu PointsService (bang `user_points`). */
  points: number;
}
