import type { ExamQuestionType, ExamAnswerValue } from '../../lib/api.js';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

export function defaultAnswerFor(type: ExamQuestionType): ExamAnswerValue {
  if (type === 'TRUE_FALSE_4') return [];
  if (type === 'FILL_BLANK') return '';
  return -1;
}

/**
 * Chuyển giá trị "chưa trả lời" (mặc định từ defaultAnswerFor) thành
 * sentinel {} trước khi gửi lên server.
 * Backend dùng {} để phát hiện câu bỏ trắng và ẩn đáp án đúng.
 */
export function toSubmitAnswer(type: ExamQuestionType, value: ExamAnswerValue): unknown {
  if (type === 'MCQ_4' && value === -1) return {};
  if (type === 'TRUE_FALSE_4' && Array.isArray(value) && value.length === 0) return {};
  if (type === 'FILL_BLANK' && value === '') return {};
  return value;
}

/** Hien thi mot dap an (da chon hoac dung) o man ket qua, theo dang cau hoi. */
export function describeExamAnswer(type: ExamQuestionType, options: string[] | null, value: unknown): string {
  if (type === 'MCQ_4') {
    if (typeof value === 'number' && value >= 0 && value <= 3) {
      const text = options?.[value];
      return text ? `${OPTION_LABELS[value]}. ${text}` : OPTION_LABELS[value];
    }
    return 'Chưa trả lời';
  }
  if (type === 'TRUE_FALSE_4') {
    if (Array.isArray(value) && value.length === 4) {
      return value
        .map((v, idx) => `${OPTION_LABELS[idx]}: ${v === true ? 'Đúng' : v === false ? 'Sai' : 'Chưa trả lời'}`)
        .join(', ');
    }
    return 'Chưa trả lời';
  }
  // FILL_BLANK
  if (typeof value === 'string' && value.trim()) return value;
  if (Array.isArray(value) && value.length > 0) return value.join(' / ');
  return 'Chưa trả lời';
}

/** Key lưu draft đáp án trong localStorage theo sessionId. */
export function examDraftKey(sessionId: string) {
  return `exam_draft_${sessionId}`;
}

/** Lưu Map đáp án vào localStorage. Lỗi lưu bị bỏ qua (storage đầy). */
export function saveDraftAnswers(sessionId: string, answers: Map<string, ExamAnswerValue>) {
  try {
    const obj: Record<string, ExamAnswerValue> = {};
    answers.forEach((v, k) => { obj[k] = v; });
    localStorage.setItem(examDraftKey(sessionId), JSON.stringify(obj));
  } catch {
    // Bỏ qua nếu localStorage đầy hoặc bị chặn
  }
}

/** Đọc draft đáp án từ localStorage. Trả về Map rỗng nếu không có. */
export function loadDraftAnswers(sessionId: string): Map<string, ExamAnswerValue> {
  try {
    const raw = localStorage.getItem(examDraftKey(sessionId));
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, ExamAnswerValue>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

/** Xóa draft đáp án khỏi localStorage sau khi nộp/huỷ. */
export function clearDraftAnswers(sessionId: string) {
  try { localStorage.removeItem(examDraftKey(sessionId)); } catch { /* bỏ qua */ }
}
