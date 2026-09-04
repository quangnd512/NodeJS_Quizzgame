// API module cho Dong gop cau hoi (Student Question Submissions) — mobile.
import { request } from './client.js';

// ---------------------------------------------------------------------------
// Types (khop voi backend/src/services/submission/submission.types.ts)
// ---------------------------------------------------------------------------

export type ExamQuestionType = 'MCQ_4' | 'TRUE_FALSE_4' | 'FILL_BLANK';
export type SubmissionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type SubmissionCorrectAnswer = number | boolean[] | string[];

export interface SubmissionDto {
  id: string;
  userId: string;
  subject: string;
  chapter: string | null;
  questionType: ExamQuestionType;
  questionText: string;
  options: string[] | null;
  correctAnswer: SubmissionCorrectAnswer;
  status: SubmissionStatus;
  adminNote: string | null;
  questionBankId: string | null;
  usageCount: number;
  usagePointsEarned: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedSubmissions {
  data: SubmissionDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateSubmissionInput {
  subject: string;
  chapter?: string;
  questionType: ExamQuestionType;
  questionText: string;
  options?: string[];
  correctAnswer: SubmissionCorrectAnswer;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** GET /api/submissions — danh sach cau hoi da gui (cua user hien tai). */
export async function listMySubmissions(
  token: string,
  page = 1,
  pageSize = 20,
): Promise<PaginatedSubmissions> {
  return request<PaginatedSubmissions>(
    `/api/submissions?page=${page}&pageSize=${pageSize}`,
    token,
  );
}

/** POST /api/submissions — gui cau hoi moi. */
export async function createSubmission(
  token: string,
  input: CreateSubmissionInput,
): Promise<SubmissionDto> {
  return request<SubmissionDto>('/api/submissions', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** DELETE /api/submissions/:id — xoa cau hoi chua duoc duyet. */
export async function deleteSubmission(token: string, id: string): Promise<void> {
  await request<void>(`/api/submissions/${id}`, token, { method: 'DELETE' });
}
