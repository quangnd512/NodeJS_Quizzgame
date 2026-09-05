// API module cho Thi thu (Exam) — mobile.
// Goi cac endpoint /api/exam/*.
import { request } from './client';

// ---------------------------------------------------------------------------
// Types (khop voi backend/src/services/exam/exam.types.ts)
// ---------------------------------------------------------------------------

export type ExamQuestionType = 'MCQ_4' | 'TRUE_FALSE_4' | 'FILL_BLANK';
export type ExamSessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED' | 'ABANDONED';

export interface ExamQuestionPublicDto {
  id: string;
  questionType: ExamQuestionType;
  questionText: string;
  /** null voi FILL_BLANK. */
  options: string[] | null;
  points: number;
  chapter: string | null;
}

export interface ExamPaperPublicDto {
  id: string;
  subject: string;
  title: string;
  durationMinutes: number;
  questionCount: number;
}

export interface StartExamResponse {
  sessionId: string;
  examPaperId: string;
  subject: string;
  title: string;
  durationMinutes: number;
  startedAt: string;
  questions: ExamQuestionPublicDto[];
}

export interface ActiveExamSessionResponse {
  session: {
    id: string;
    subject: string;
    title: string;
    durationMinutes: number;
    startedAt: string;
    remainingSeconds: number;
  } | null;
}

export interface SubmitExamResponse {
  sessionId: string;
  score: number;
  pointsAwarded: number;
}

export interface ExamChapterAnalysis {
  chapter: string;
  correctCount: number;
  totalCount: number;
  pointsEarned: number;
  pointsTotal: number;
}

export interface ExamWrongAnswerItem {
  examQuestionId: string;
  questionText: string;
  questionType: ExamQuestionType;
  chapter: string | null;
  options: unknown;
  correctAnswer: unknown;
  selectedAnswer: unknown;
  explanation: string | null;
  points: number;
  pointsEarned: number;
}

export interface ExamResultResponse {
  sessionId: string;
  status: ExamSessionStatus;
  score: number;
  pointsAwarded: number;
  totalQuestions: number;
  chapterAnalysis: ExamChapterAnalysis[];
  wrongAnswers: ExamWrongAnswerItem[];
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** GET /api/exam/papers?subject=<id>&page=<n> — danh sach de thi co the tham gia. */
export async function listExamPapers(
  token: string,
  subject?: string,
  page = 1,
): Promise<{ data: ExamPaperPublicDto[]; total: number; page: number; pageSize: number }> {
  const params = new URLSearchParams({ page: String(page) });
  if (subject) params.set('subject', subject);
  return request(`/api/exam/papers?${params.toString()}`, token);
}

/** GET /api/exam/active — lay phien thi dang IN_PROGRESS (neu co). */
export async function getActiveExamSession(token: string): Promise<ActiveExamSessionResponse> {
  return request<ActiveExamSessionResponse>('/api/exam/active', token);
}

/** POST /api/exam/start — bat dau phien thi thu moi. */
export async function startExam(token: string, examPaperId: string): Promise<StartExamResponse> {
  return request<StartExamResponse>('/api/exam/start', token, {
    method: 'POST',
    body: JSON.stringify({ examPaperId }),
  });
}

/** POST /api/exam/submit — nop bai thi. */
export async function submitExam(
  token: string,
  sessionId: string,
  answers: { examQuestionId: string; selectedAnswer: unknown }[],
): Promise<SubmitExamResponse> {
  return request<SubmitExamResponse>('/api/exam/submit', token, {
    method: 'POST',
    body: JSON.stringify({ sessionId, answers }),
  });
}

/** POST /api/exam/:id/abandon — huy phien thi. */
export async function abandonExam(token: string, sessionId: string): Promise<void> {
  await request<void>(`/api/exam/${sessionId}/abandon`, token, { method: 'POST' });
}

/** GET /api/exam/:id/result — ket qua chi tiet phien thi. */
export async function getExamResult(token: string, sessionId: string): Promise<ExamResultResponse> {
  return request<ExamResultResponse>(`/api/exam/${sessionId}/result`, token);
}
