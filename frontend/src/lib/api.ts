// API client – boc cac cuoc goi den backend Express.
// Tat ca request deu dinh kem session token (JWT noi bo) vao header.

export interface UserProfile {
  id: string;
  firebaseUid: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  school: string | null;
  province: string | null;
  subjects: { id: string; name: string }[];
  createdAt: string;
  lastLoginAt: string | null;
  points: number;
}

export interface LoginResult {
  token: string;
  isNewUser: boolean;
  user: UserProfile;
}

export interface SubjectEntry {
  id: string;
  name: string;
}

/** Loi tra ve tu API (co truong `error` va `message`). */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/** Doc body response an toan: tra ve {} neu body rong (vd. 204, loi proxy). */
async function parseJsonBody<T>(res: Response): Promise<{ error?: string; message?: string } & T> {
  const text = await res.text();
  if (!text) return {} as { error?: string; message?: string } & T;
  return JSON.parse(text) as { error?: string; message?: string } & T;
}

async function request<T>(
  path: string,
  sessionToken: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
      ...options.headers,
    },
  });

  const body = await parseJsonBody<T>(res);

  if (!res.ok) {
    throw new ApiError(
      body.error ?? 'UNKNOWN_ERROR',
      body.message ?? `Loi HTTP ${res.status}`,
      res.status,
    );
  }

  return body;
}

/** POST /api/auth/login — doi Firebase ID Token lay session token noi bo. */
export async function loginWithFirebaseToken(firebaseIdToken: string): Promise<LoginResult> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { Authorization: `Bearer ${firebaseIdToken}` },
  });

  const body = await parseJsonBody<LoginResult>(res);

  if (!res.ok) {
    throw new ApiError(body.error ?? 'UNKNOWN_ERROR', body.message ?? `Loi HTTP ${res.status}`, res.status);
  }

  return body;
}

/** GET /api/users/me */
export async function getMyProfile(sessionToken: string): Promise<UserProfile> {
  return request<UserProfile>('/api/users/me', sessionToken);
}

/** POST /api/users/subjects */
export async function updateSubjects(
  sessionToken: string,
  subjectIds: string[],
): Promise<{ subjects: SubjectEntry[] }> {
  return request('/api/users/subjects', sessionToken, {
    method: 'POST',
    body: JSON.stringify({ subjects: subjectIds.map((id) => ({ id })) }),
  });
}

/** PUT /api/users/profile */
export async function updateProfile(
  sessionToken: string,
  data: { displayName?: string | null; phone?: string | null; school?: string | null; province?: string | null },
): Promise<UserProfile> {
  return request('/api/users/profile', sessionToken, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ─── Practice Module ──────────────────────────────────────────────────────────

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

export interface HistoryItem {
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
export async function startPracticeSession(token: string, subject: string): Promise<StartSessionResult> {
  return request(`/api/practice/start?subject=${subject}`, token);
}

/** POST /api/practice/answer */
export async function answerQuestion(
  token: string,
  sessionId: string,
  questionId: string,
  selectedOption: number,
): Promise<AnswerResult> {
  return request('/api/practice/answer', token, {
    method: 'POST',
    body: JSON.stringify({ sessionId, questionId, selectedOption }),
  });
}

/** POST /api/practice/complete */
export async function completeSession(token: string, sessionId: string): Promise<CompleteResult> {
  return request('/api/practice/complete', token, {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

/** POST /api/practice/questions/:id/report */
export async function reportQuestion(
  token: string,
  questionId: string,
  reason: 'WRONG_ANSWER' | 'BAD_CONTENT' | 'TYPO' | 'OTHER',
  description?: string,
): Promise<{ message: string }> {
  return request(`/api/practice/questions/${questionId}/report`, token, {
    method: 'POST',
    body: JSON.stringify({ reason, description }),
  });
}

/** GET /api/practice/history */
export async function getPracticeHistory(token: string): Promise<{ items: HistoryItem[]; total: number }> {
  return request('/api/practice/history', token);
}

/** GET /api/practice/stats */
export async function getPracticeStats(token: string): Promise<SubjectStat[]> {
  return request('/api/practice/stats', token);
}

// ─── Exam Module (Thi thu) ───────────────────────────────────────────────────

export type ExamQuestionType = 'MCQ_4' | 'TRUE_FALSE_4' | 'FILL_BLANK';
export type ExamSessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED';

/** Dap an hoc sinh chon, theo tung dang: MCQ_4 -> so 0-3; TRUE_FALSE_4 -> 4 gia tri (null = chua tra loi); FILL_BLANK -> chuoi. */
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

/** POST /api/exam/start */
export async function startExam(token: string, subject: string): Promise<StartExamResult> {
  return request('/api/exam/start', token, {
    method: 'POST',
    body: JSON.stringify({ subject }),
  });
}

/** POST /api/exam/submit */
export async function submitExam(
  token: string,
  sessionId: string,
  answers: { examQuestionId: string; selectedAnswer: ExamAnswerValue }[],
): Promise<SubmitExamResult> {
  return request('/api/exam/submit', token, {
    method: 'POST',
    body: JSON.stringify({ sessionId, answers }),
  });
}

/** GET /api/exam/:id/result */
export async function getExamResult(token: string, sessionId: string): Promise<ExamResult> {
  return request(`/api/exam/${sessionId}/result`, token);
}

// ─── Admin: Bao cao cau hoi ─────────────────────────────────────────────────

export interface QuestionReportDto {
  id: string;
  questionId: string;
  userId: string;
  reason: string;
  description: string | null;
  status: string;
  createdAt: string;
}

export interface ReportsSummary {
  pending: number;
  reviewed: number;
  fixed: number;
  dismissed: number;
  topReportedQuestions: { questionId: string; count: number }[];
}

export type ReportStatus = 'PENDING' | 'REVIEWED' | 'FIXED' | 'DISMISSED';

/** Goi API admin voi header X-Admin-Secret (khong dung session token). */
async function adminRequest<T>(path: string, secret: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Secret': secret,
      ...options.headers,
    },
  });

  const body = await parseJsonBody<T>(res);

  if (!res.ok) {
    throw new ApiError(
      body.error ?? 'UNKNOWN_ERROR',
      body.message ?? `Loi HTTP ${res.status}`,
      res.status,
    );
  }

  return body;
}

/** GET /api/admin/questions/reports?status=&page=&limit= */
export async function adminListReports(
  secret: string,
  params: { status?: string; page?: number; limit?: number } = {},
): Promise<{ items: QuestionReportDto[]; total: number }> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return adminRequest(`/api/admin/questions/reports${qs ? `?${qs}` : ''}`, secret);
}

/** PATCH /api/admin/questions/reports/:id */
export async function adminUpdateReportStatus(
  secret: string,
  reportId: string,
  status: ReportStatus,
): Promise<{ id: string; status: string; autoHidden: boolean }> {
  return adminRequest(`/api/admin/questions/reports/${reportId}`, secret, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

/** GET /api/admin/questions/reports/summary */
export async function adminGetReportsSummary(secret: string): Promise<ReportsSummary> {
  return adminRequest('/api/admin/questions/reports/summary', secret);
}

// ─── Admin: Quan ly de thi thu ───────────────────────────────────────────────

export interface ExamPaperSummary {
  id: string;
  subject: string;
  title: string;
  durationMinutes: number;
  isActive: boolean;
  questionCount: number;
  createdAt: string;
}

export interface ExamQuestionFull {
  id: string;
  examPaperId: string;
  chapter: string | null;
  difficulty: number;
  questionType: ExamQuestionType;
  points: number;
  questionText: string;
  options: string[] | null;
  correctAnswer: unknown;
  explanation: string | null;
  examYear: number | null;
  examCode: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ExamPaperDetail extends ExamPaperSummary {
  questions: ExamQuestionFull[];
}

export interface CreateExamQuestionPayload {
  chapter?: string;
  difficulty: number;
  questionType: ExamQuestionType;
  points: number;
  questionText: string;
  options?: string[];
  correctAnswer: unknown;
  explanation?: string;
  examYear?: number;
  examCode?: string;
}

export interface ExamImportResultDto {
  inserted: number;
  errors: { row: number; message: string }[];
}

/** POST /api/admin/exam-papers */
export async function adminCreateExamPaper(
  secret: string,
  data: { subject: string; title: string; durationMinutes: number },
): Promise<ExamPaperSummary> {
  return adminRequest('/api/admin/exam-papers', secret, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** GET /api/admin/exam-papers?subject= */
export async function adminListExamPapers(secret: string, subject?: string): Promise<ExamPaperSummary[]> {
  const qs = subject ? `?subject=${encodeURIComponent(subject)}` : '';
  return adminRequest(`/api/admin/exam-papers${qs}`, secret);
}

/** GET /api/admin/exam-papers/:id */
export async function adminGetExamPaperDetail(secret: string, id: string): Promise<ExamPaperDetail> {
  return adminRequest(`/api/admin/exam-papers/${id}`, secret);
}

/** PATCH /api/admin/exam-papers/:id */
export async function adminUpdateExamPaper(
  secret: string,
  id: string,
  data: { title?: string; durationMinutes?: number; isActive?: boolean },
): Promise<ExamPaperSummary> {
  return adminRequest(`/api/admin/exam-papers/${id}`, secret, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/** POST /api/admin/exam-papers/:id/questions */
export async function adminCreateExamQuestion(
  secret: string,
  paperId: string,
  data: CreateExamQuestionPayload,
): Promise<ExamQuestionFull> {
  return adminRequest(`/api/admin/exam-papers/${paperId}/questions`, secret, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** DELETE /api/admin/exam-papers/:id/questions/:qid — soft delete (isActive=false) */
export async function adminDeleteExamQuestion(
  secret: string,
  paperId: string,
  questionId: string,
): Promise<{ message: string }> {
  return adminRequest(`/api/admin/exam-papers/${paperId}/questions/${questionId}`, secret, {
    method: 'DELETE',
  });
}

/** PATCH /api/admin/exam-papers/:id/questions/:qid — cap nhat noi dung cau hoi (partial) */
export async function adminUpdateExamQuestion(
  secret: string,
  paperId: string,
  questionId: string,
  data: {
    points?: number;
    difficulty?: number;
    chapter?: string;
    questionText?: string;
    options?: string[];
    correctAnswer?: number | boolean[] | string[];
    explanation?: string;
  },
): Promise<ExamQuestionFull> {
  return adminRequest(`/api/admin/exam-papers/${paperId}/questions/${questionId}`, secret, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/** PATCH /api/admin/exam-papers/:id/questions/:qid — khoi phuc cau hoi da an (isActive=true) */
export async function adminRestoreExamQuestion(
  secret: string,
  paperId: string,
  questionId: string,
): Promise<ExamQuestionFull> {
  return adminRequest(`/api/admin/exam-papers/${paperId}/questions/${questionId}`, secret, {
    method: 'PATCH',
    body: JSON.stringify({ isActive: true }),
  });
}

/** POST /api/admin/exam-papers/:id/questions/import (multipart/form-data) */
export async function adminImportExamQuestions(
  secret: string,
  paperId: string,
  file: File,
): Promise<ExamImportResultDto> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`/api/admin/exam-papers/${paperId}/questions/import`, {
    method: 'POST',
    headers: { 'X-Admin-Secret': secret },
    body: formData,
  });

  const body = await parseJsonBody<ExamImportResultDto>(res);

  if (!res.ok) {
    throw new ApiError(body.error ?? 'UNKNOWN_ERROR', body.message ?? `Loi HTTP ${res.status}`, res.status);
  }

  return body;
}
