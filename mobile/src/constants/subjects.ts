// Danh muc mon hoc - PHAI khop 1-1 voi `SUBJECT_CATALOG` phia backend
// (backend/src/services/users/users.types.ts) va voi hang so `SUBJECTS` ben frontend web
// (frontend/src/App.tsx) - day KHONG phai nguon "su that" (backend moi la nguon that su validate),
// chi la ban sao de hien thi UI onboarding. Neu backend them/bot mon hoc, phai cap nhat lai o day.
import type { SubjectCatalogEntry } from '../api/users';

export interface SubjectOption extends SubjectCatalogEntry {
  emoji: string;
}

export const SUBJECT_CATALOG: readonly SubjectOption[] = [
  { id: 'TOAN', name: 'Toán', emoji: '📐' },
  { id: 'VAN', name: 'Ngữ văn', emoji: '📖' },
  { id: 'ANH', name: 'Tiếng Anh', emoji: '🌐' },
  { id: 'LY', name: 'Vật lý', emoji: '⚛️' },
  { id: 'HOA', name: 'Hóa học', emoji: '🧪' },
  { id: 'SINH', name: 'Sinh học', emoji: '🧬' },
  { id: 'SU', name: 'Lịch sử', emoji: '🏛️' },
  { id: 'DIA', name: 'Địa lý', emoji: '🗺️' },
  { id: 'GDCD', name: 'Giáo dục công dân', emoji: '⚖️' },
] as const;

/** So mon toi thieu/toi da duoc phep chon - khop voi backend (MIN_SUBJECTS=1, MAX_SUBJECTS=7). */
export const MIN_SUBJECTS = 1;
export const MAX_SUBJECTS = 7;
