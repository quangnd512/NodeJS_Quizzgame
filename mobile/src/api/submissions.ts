// Goi API Lich su bai thi da nop (Exam History) - dung cho man hinh SubmissionsScreen.
// "Bai nop" = phien thi da nop, khac voi "Ket qua" (ExamResultScreen chi hien 1 bai vua thi).
// Backend: GET /api/progress/exam-history + GET /api/exam/:id/result
// Premium gate: Free xem duoc lich su (danh sach), nhung khong xem duoc chi tiet dap an (ExamResult).
import { request } from './client';
import type { ExamResult } from './exam';

export interface ExamHistoryItem {
  id: string;
  examPaperId: string;
  title: string;
  subject: string;
  score: number | null;
  pointsAwarded: number;
  completedAt: string;
}

export interface PaginatedExamHistory {
  items: ExamHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}

/** GET /api/progress/exam-history?limit=&offset= */
export async function getExamHistory(
  token: string,
  limit = 10,
  offset = 0,
): Promise<PaginatedExamHistory> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return request<PaginatedExamHistory>(`/api/progress/exam-history?${params.toString()}`, token);
}

/** GET /api/exam/:id/result - Premium: xem chi tiet dap an; Free: backend tra loi 403 PREMIUM_REQUIRED */
export async function getExamResultDetail(
  token: string,
  sessionId: string,
): Promise<ExamResult> {
  return request<ExamResult>(`/api/exam/${sessionId}/result`, token);
}
