// API module cho On tap (Practice) — mobile.
// Goi cac endpoint POST /api/practice/* va GET /api/practice/*.
import { request } from './client';

// ---------------------------------------------------------------------------
// Types (khop voi backend/src/services/practice/practice.types.ts)
// ---------------------------------------------------------------------------

export interface QuestionPublicDto {
  id: string;
  subject: string;
  chapter: string | null;
  difficulty: number;
  question: string;
  options: string[];
}

export interface StartSessionResponse {
  sessionId: string;
  subjectId: string;
  questions: QuestionPublicDto[];
  timeLimitSeconds: number;
  startedAt: string;
}

export interface AnswerResponse {
  isCorrect: boolean;
  correctAnswer: number;
  explanation: string | null;
  answeredCount: number;
  totalQuestions: number;
}

export interface AnswerSummary {
  questionId: string;
  selectedOption: number | null;
  isCorrect: boolean;
  correctAnswer: number;
  explanation: string | null;
}

export interface CompleteSessionResponse {
  sessionId: string;
  score: number;
  pointsEarned: number;
  totalQuestions: number;
  answers: AnswerSummary[];
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** GET /api/practice/start?subject=<subjectId> — bat dau phien on tap moi. */
export async function startPracticeSession(
  token: string,
  subjectId: string,
): Promise<StartSessionResponse> {
  return request<StartSessionResponse>(
    `/api/practice/start?subject=${encodeURIComponent(subjectId)}`,
    token,
  );
}

/** POST /api/practice/answer — nop dap an 1 cau. */
export async function submitPracticeAnswer(
  token: string,
  sessionId: string,
  questionId: string,
  selectedOption: number,
): Promise<AnswerResponse> {
  return request<AnswerResponse>('/api/practice/answer', token, {
    method: 'POST',
    body: JSON.stringify({ sessionId, questionId, selectedOption }),
  });
}

/** POST /api/practice/complete — hoan thanh phien on tap. */
export async function completePracticeSession(
  token: string,
  sessionId: string,
): Promise<CompleteSessionResponse> {
  return request<CompleteSessionResponse>('/api/practice/complete', token, {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}
