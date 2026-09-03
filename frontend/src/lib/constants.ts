// ─── Danh mục môn học — dùng chung toàn app ──────────────────────────────────

export const SUBJECTS = [
  { id: 'TOAN', name: 'Toán',              emoji: '📐' },
  { id: 'VAN',  name: 'Ngữ văn',           emoji: '📖' },
  { id: 'ANH',  name: 'Tiếng Anh',         emoji: '🌐' },
  { id: 'LY',   name: 'Vật lý',            emoji: '⚛️' },
  { id: 'HOA',  name: 'Hóa học',           emoji: '🧪' },
  { id: 'SINH', name: 'Sinh học',          emoji: '🧬' },
  { id: 'SU',   name: 'Lịch sử',           emoji: '🏛️' },
  { id: 'DIA',  name: 'Địa lý',            emoji: '🗺️' },
  { id: 'GDCD', name: 'Giáo dục công dân', emoji: '⚖️' },
];

export const SUBJECTS_MAP: Record<string, { name: string; emoji: string }> = {
  TOAN: { name: 'Toán', emoji: '📐' },
  VAN:  { name: 'Ngữ văn', emoji: '📖' },
  ANH:  { name: 'Tiếng Anh', emoji: '🌐' },
  LY:   { name: 'Vật lý', emoji: '⚛️' },
  HOA:  { name: 'Hóa học', emoji: '🧪' },
  SINH: { name: 'Sinh học', emoji: '🧬' },
  SU:   { name: 'Lịch sử', emoji: '🏛️' },
  DIA:  { name: 'Địa lý', emoji: '🗺️' },
  GDCD: { name: 'GDCD', emoji: '⚖️' },
};
