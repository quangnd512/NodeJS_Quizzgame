// Goi API Thi thu - khop 1-1 voi frontend/src/lib/api.ts (phan Exam).
// Backend: backend/src/routes/exam.route.ts
import { request } from './client';

export type ExamQuestionType = 'MCQ_4' | 'TRUE_FALSE_4' | 'FILL_BLANK';
export type ExamSessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED';
export type ExamAnswerValue = number | string | (boolean | null)[];

export interface ExamQuestionPublic {
  id: string;
  chapter: string | null;
  difficulty: number;
  questionType: ExamQuestionType;
  points: number;
  questionText: string;
  options: string[] | null;
}

export interface StartExamResult {
  sessionId: string;
  examPaperId: string;
  subject: string;
  title: string;
  durationMinutes: number;
  startedAt: string;
  questions: ExamQuestionPublic[];
}

export interface SubmitExamResult {
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

export interface ExamWrongAnswer {
  examQuestionId: string;
  questionText: string;
  questionType: ExamQuestionType;
  chapter: string | null;
  options: string[] | null;
  correctAnswer: unknown;
  selectedAnswer: unknown;
  explanation: string | null;
  points: number;
  pointsEarned: number;
}

export interface ExamResult {
  sessionId: string;
  status: ExamSessionStatus;
  score: number;
  pointsAwarded: number;
  totalQuestions: number;
  chapterAnalysis: ExamChapterAnalysis[];
  wrongAnswers: ExamWrongAnswer[];
}

export interface ActiveExamSession {
  id: string;
  subject: string;
  title: string;
  durationMinutes: number;
  startedAt: string;
  remainingSeconds: number;
}

export interface ExamPaperSummary {
  id: string;
  subject: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  questionCount: number;
  isActive: boolean;
  createdAt: string;
}

/** POST /api/exam/start */
export async function startExam(
  token: string,
  subject: string,
): Promise<StartExamResult> {
  return request<StartExamResult>('/api/exam/start', token, {
    method: 'POST',
    body: JSON.stringify({ subject }),
  });
}

/** POST /api/exam/submit */
export async function submitExam(
  token: string,
  sessionId: string,
  answers: { examQuestionId: string; selectedAnswer: unknown }[],
): Promise<SubmitExamResult> {
  return request<SubmitExamResult>('/api/exam/submit', token, {
    method: 'POST',
    body: JSON.stringify({ sessionId, answers }),
  });
}

/** GET /api/exam/:id/result */
export async function getExamResult(
  token: string,
  sessionId: string,
): Promise<ExamResult> {
  return request<ExamResult>(`/api/exam/${sessionId}/result`, token);
}

/** GET /api/exam/active */
export async function getActiveExamSession(
  token: string,
): Promise<{ session: ActiveExamSession | null }> {
  return request<{ session: ActiveExamSession | null }>('/api/exam/active', token);
}

/**
 * Lấy lại đầy đủ dữ liệu phiên thi đang dở để resume (có câu hỏi).
 * Khác getActiveExamSession: trả về StartExamResult với questions để navigate ExamTaking.
 * GET /api/exam/resume
 */
export async function resumeExam(
  token: string,
): Promise<{ session: StartExamResult | null }> {
  return request<{ session: StartExamResult | null }>('/api/exam/resume', token);
}

/** POST /api/exam/:id/abandon */
export async function abandonExam(
  token: string,
  sessionId: string,
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/api/exam/${sessionId}/abandon`, token, {
    method: 'POST',
  });
}
