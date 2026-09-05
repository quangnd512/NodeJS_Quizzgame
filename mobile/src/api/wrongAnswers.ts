// Goi API On cau sai (Wrong Answers) - Premium gate - khop 1-1 voi frontend/src/lib/api.ts.
// Backend: backend/src/routes/wrong-answers.route.ts
import { request } from './client';

export type WrongAnswerQuestionType = 'MCQ_4' | 'TRUE_FALSE_4' | 'FILL_BLANK';

export interface WrongAnswerQuestion {
  id: string;
  content: string;
  type: WrongAnswerQuestionType;
  subjectId: string;
  options: unknown;
  correctAnswer: unknown;
  explanation: string | null;
}

export interface WrongAnswerItem {
  id: number;
  wrongCount: number;
  lastWrongAt: string;
  expiresAt: string;
  source: 'practice' | 'exam';
  question: WrongAnswerQuestion;
}

export interface WrongAnswerListResponse {
  data: WrongAnswerItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RetryResult {
  isCorrect: boolean;
  correctAnswer: unknown;
  explanation: string | null;
}

/** GET /api/wrong-answers?subjectId=&page=&pageSize= */
export async function getWrongAnswers(
  token: string,
  subjectId?: string,
  page = 1,
  pageSize = 20,
): Promise<WrongAnswerListResponse> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (subjectId) params.set('subjectId', subjectId);
  return request<WrongAnswerListResponse>(`/api/wrong-answers?${params.toString()}`, token);
}

/** POST /api/wrong-answers/:id/retry */
export async function retryWrongAnswer(
  token: string,
  id: number,
  answer: unknown,
): Promise<RetryResult> {
  return request<RetryResult>(`/api/wrong-answers/${id}/retry`, token, {
    method: 'POST',
    body: JSON.stringify({ answer }),
  });
}
