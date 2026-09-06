// Goi API Lich su bai thi da nop (Exam History) - dung cho man hinh SubmissionsScreen.
// "Bai nop" = phien thi da nop, khac voi "Ket qua" (ExamResultScreen chi hien 1 bai vua thi).
// Backend: GET /api/progress/exam-history + GET /api/exam/:id/result
// Premium gate: Free xem duoc lich su (danh sach), nhung khong xem duoc chi tiet dap an (ExamResult).
import { request } from './client';
import type { ExamResult } from './exam';

// Re-export tu progress.ts de tranh dinh nghia trung lap - ExamHistoryItem + PaginatedExamHistory
// + getExamHistory dung chung endpoint /api/progress/exam-history.
export type { ExamHistoryItem, PaginatedExamHistory } from './progress';
export { getExamHistory } from './progress';

/** GET /api/exam/:id/result - Premium: xem chi tiet dap an; Free: backend tra loi 403 PREMIUM_REQUIRED */
export async function getExamResultDetail(
  token: string,
  sessionId: string,
): Promise<ExamResult> {
  return request<ExamResult>(`/api/exam/${sessionId}/result`, token);
}
