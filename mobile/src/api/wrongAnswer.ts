// API module cho On cau sai (Wrong Answer Review) — mobile.
// Luu y: backend yeu cau Premium de truy cap endpoint nay.
import { request } from './client.js';

// ---------------------------------------------------------------------------
// Types (khop voi backend/src/services/wrongAnswer/wrongAnswer.types.ts)
// ---------------------------------------------------------------------------

export type WrongAnswerSource = 'practice' | 'exam';
export type ExamQuestionType = 'MCQ_4' | 'TRUE_FALSE_4' | 'FILL_BLANK';

export interface WrongAnswerQuestionDetail {
  id: string;
  content: string;
  type: ExamQuestionType;
  subjectId: string;
  options: unknown;
  correctAnswer: unknown;
  explanation: string | null;
}

export interface WrongAnswerListItem {
  id: number;
  wrongCount: number;
  lastWrongAt: string;
  expiresAt: string;
  source: WrongAnswerSource;
  question: WrongAnswerQuestionDetail;
}

export interface WrongAnswerListResponse {
  data: WrongAnswerListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RetryResult {
  isCorrect: boolean;
  correctAnswer: unknown;
  explanation: string | null;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** GET /api/wrong-answers?subjectId=<id>&page=<n>&pageSize=<n> — danh sach cau sai. */
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

/** POST /api/wrong-answers/:id/retry — nop dap an on lai 1 cau sai. */
export async function retryWrongAnswer(
  token: string,
  id: number,
  selectedAnswer: unknown,
): Promise<RetryResult> {
  return request<RetryResult>(`/api/wrong-answers/${id}/retry`, token, {
    method: 'POST',
    body: JSON.stringify({ selectedAnswer }),
  });
}
