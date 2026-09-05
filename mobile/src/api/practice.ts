// Goi API Luyen tap - khop 1-1 voi frontend/src/lib/api.ts (phan Practice).
// Backend: backend/src/routes/practice.route.ts
import { request } from './client';

export interface PracticeQuestion {
  id: string;
  subject: string;
  chapter: string | null;
  difficulty: number;
  question: string;
  options: string[];
}

export interface StartSessionResult {
  sessionId: string;
  subject: string;
  questions: PracticeQuestion[];
}

export interface AnswerResult {
  isCorrect: boolean;
  correctAnswer: number;
  explanation: string | null;
  answeredCount: number;
  totalQuestions: number;
}

export interface CompleteResult {
  sessionId: string;
  score: number;
  pointsEarned: number;
  totalQuestions: number;
}

export interface PracticeHistoryItem {
  sessionId: string;
  subjectId: string;
  score: number;
  pointsEarned: number;
  totalQuestions: number;
  startedAt: string;
  completedAt: string;
}

export interface SubjectStat {
  subject: string;
  totalSessions: number;
  avgScore: number;
  bestScore: number;
}

/** GET /api/practice/start?subject=TOAN */
export async function startPracticeSession(
  token: string,
  subject: string,
): Promise<StartSessionResult> {
  return request<StartSessionResult>(`/api/practice/start?subject=${subject}`, token);
}

/** POST /api/practice/answer */
export async function answerQuestion(
  token: string,
  sessionId: string,
  questionId: string,
  selectedOption: number,
): Promise<AnswerResult> {
  return request<AnswerResult>('/api/practice/answer', token, {
    method: 'POST',
    body: JSON.stringify({ sessionId, questionId, selectedOption }),
  });
}

/** POST /api/practice/complete */
export async function completeSession(
  token: string,
  sessionId: string,
): Promise<CompleteResult> {
  return request<CompleteResult>('/api/practice/complete', token, {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

/** GET /api/practice/history */
export async function getPracticeHistory(
  token: string,
): Promise<{ items: PracticeHistoryItem[]; total: number }> {
  return request<{ items: PracticeHistoryItem[]; total: number }>('/api/practice/history', token);
}

/** GET /api/practice/stats */
export async function getPracticeStats(token: string): Promise<SubjectStat[]> {
  return request<SubjectStat[]>('/api/practice/stats', token);
}
