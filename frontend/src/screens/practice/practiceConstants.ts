export const DIFF_LABEL: Record<number, string> = { 1: 'Dễ', 2: 'Trung bình', 3: 'Khó' };
export const SESSION_SECONDS = 17 * 60;
export const OPTION_LABELS = ['A', 'B', 'C', 'D'];
export const REPORT_REASONS = [
  { value: 'WRONG_ANSWER', label: 'Đáp án sai' },
  { value: 'BAD_CONTENT',  label: 'Nội dung không phù hợp' },
  { value: 'TYPO',         label: 'Lỗi chính tả' },
  { value: 'OTHER',        label: 'Lý do khác' },
] as const;
