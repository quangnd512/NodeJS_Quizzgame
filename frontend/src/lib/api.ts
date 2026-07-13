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
  avatarUrl: string | null;
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
  // selectedAnswer dùng `unknown` để chứa cả sentinel {} (câu bỏ trắng)
  answers: { examQuestionId: string; selectedAnswer: unknown }[],
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

/** Thong tin phien thi dang do (GET /api/exam/active). */
export interface ActiveExamSession {
  id: string;
  subject: string;
  title: string;
  durationMinutes: number;
  startedAt: string;
  remainingSeconds: number;
}

/** GET /api/exam/active — lay phien thi dang IN_PROGRESS (neu co). */
export async function getActiveExamSession(token: string): Promise<{ session: ActiveExamSession | null }> {
  return request('/api/exam/active', token);
}

/** POST /api/exam/:id/abandon — huy phien thi dang IN_PROGRESS. */
export async function abandonExam(token: string, sessionId: string): Promise<{ success: boolean }> {
  return request(`/api/exam/${sessionId}/abandon`, token, { method: 'POST' });
}

// ─── Admin: Bao cao cau hoi ─────────────────────────────────────────────────

/** Noi dung day du cau hoi kem theo 1 bao cao (JOIN tu bang questions). */
export interface QuestionReportQuestionDto {
  subject: string;
  chapter: string | null;
  difficulty: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string | null;
  isActive: boolean;
}

export interface QuestionReportDto {
  id: string;
  questionId: string;
  userId: string;
  reason: string;
  description: string | null;
  status: string;
  createdAt: string;
  question: QuestionReportQuestionDto;
}

/** Tach ro 2 so lieu: pendingReports (so DONG bao cao) vs pendingQuestions (so CAU HOI khac nhau). */
export interface ReportsSummary {
  pendingReports: number;
  pendingQuestions: number;
  fixed: number;
  dismissed: number;
  topReportedQuestions: { questionId: string; count: number }[];
}

export type ReportStatus = 'PENDING' | 'REVIEWED' | 'FIXED' | 'DISMISSED';

/** Trang thai duoc phep ghi qua endpoint resolve moi — CHI FIXED|DISMISSED. */
export type ResolvableReportStatus = 'FIXED' | 'DISMISSED';

/** Du lieu sua noi dung cau hoi kem theo luc resolve bao cao (tuy chon). */
export interface ResolveReportQuestionUpdate {
  subject?: string;
  chapter?: string | null;
  difficulty?: number;
  question?: string;
  options?: [string, string, string, string];
  correctAnswer?: number;
  explanation?: string | null;
}

export interface ResolveReportResult {
  id: string;
  status: ResolvableReportStatus;
  batchResolvedCount: number;
  reactivated: boolean;
}

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

/** GET /api/admin/questions/reports?status=&subject=&reason=&page=&limit= */
export async function adminListReports(
  secret: string,
  params: { status?: string; subject?: string; reason?: string; page?: number; limit?: number } = {},
): Promise<{ items: QuestionReportDto[]; total: number }> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.subject) query.set('subject', params.subject);
  if (params.reason) query.set('reason', params.reason);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return adminRequest(`/api/admin/questions/reports${qs ? `?${qs}` : ''}`, secret);
}

/** PATCH /api/admin/questions/reports/:id/resolve — thay the PATCH cu (chi FIXED|DISMISSED). */
export async function adminResolveReport(
  secret: string,
  reportId: string,
  status: ResolvableReportStatus,
  questionUpdate?: ResolveReportQuestionUpdate,
): Promise<ResolveReportResult> {
  return adminRequest(`/api/admin/questions/reports/${reportId}/resolve`, secret, {
    method: 'PATCH',
    body: JSON.stringify({ status, ...(questionUpdate ? { questionUpdate } : {}) }),
  });
}

/** GET /api/admin/questions/reports/summary */
export async function adminGetReportsSummary(secret: string): Promise<ReportsSummary> {
  return adminRequest('/api/admin/questions/reports/summary', secret);
}

// ─── Hoc sinh dong gop cau hoi (Submissions) ────────────────────────────────

export type SubmissionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface SubmissionDto {
  id: string;
  userId: string;
  subject: string;
  chapter: string | null;
  questionText: string;
  options: [string, string, string, string];
  correctOptionIndex: number;
  status: SubmissionStatus;
  adminNote: string | null;
  questionBankId: string | null;
  usageCount: number;
  usagePointsEarned: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubmissionInput {
  subject: string;
  chapter?: string;
  questionText: string;
  options: [string, string, string, string];
  correctOptionIndex: number;
}

export type UpdateSubmissionInput = Partial<CreateSubmissionInput>;

/** POST /api/submissions */
export async function createSubmission(
  sessionToken: string,
  input: CreateSubmissionInput,
): Promise<{ id: string; status: SubmissionStatus; createdAt: string }> {
  return request('/api/submissions', sessionToken, { method: 'POST', body: JSON.stringify(input) });
}

/** GET /api/submissions?status=&page=&limit= */
export async function getMySubmissions(
  sessionToken: string,
  params: { status?: string; page?: number; limit?: number } = {},
): Promise<{ items: SubmissionDto[]; total: number }> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return request(`/api/submissions${qs ? `?${qs}` : ''}`, sessionToken);
}

/** PUT /api/submissions/:id */
export async function updateSubmission(
  sessionToken: string,
  id: string,
  input: UpdateSubmissionInput,
): Promise<SubmissionDto> {
  return request(`/api/submissions/${id}`, sessionToken, { method: 'PUT', body: JSON.stringify(input) });
}

/** DELETE /api/submissions/:id */
export async function deleteSubmission(sessionToken: string, id: string): Promise<{ message: string }> {
  return request(`/api/submissions/${id}`, sessionToken, { method: 'DELETE' });
}

// ─── Admin: Duyet cau hoi hoc sinh gui ──────────────────────────────────────

export interface DuplicateWarning {
  questionBankId: string;
  similarity: number;
}

export type AdminSubmissionListItem = SubmissionDto & { duplicateWarning: DuplicateWarning | null };

/** GET /api/admin/submissions?status=&page=&limit= */
export async function adminListSubmissions(
  secret: string,
  params: { status?: string; page?: number; limit?: number } = {},
): Promise<{ items: AdminSubmissionListItem[]; total: number }> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return adminRequest(`/api/admin/submissions${qs ? `?${qs}` : ''}`, secret);
}

/** POST /api/admin/submissions/:id/approve */
export async function adminApproveSubmission(
  secret: string,
  id: string,
): Promise<{ id: string; status: 'APPROVED'; questionBankId: string }> {
  return adminRequest(`/api/admin/submissions/${id}/approve`, secret, { method: 'POST' });
}

/** POST /api/admin/submissions/:id/reject */
export async function adminRejectSubmission(
  secret: string,
  id: string,
  note: string,
): Promise<{ id: string; status: 'REJECTED' }> {
  return adminRequest(`/api/admin/submissions/${id}/reject`, secret, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
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

// ─── Question Bank API ────────────────────────────────────────────────────────

export interface QuestionBankItem {
  id: string;
  subject: string;
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

export interface QuestionBankListResult {
  items: QuestionBankItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface QuestionBankUsage {
  examPapers: Array<{
    paperId: string;
    paperTitle: string;
    subject: string;
    isActive: boolean;
    hasActiveSession: boolean;
  }>;
  totalExamPapers: number;
  hasActiveSession: boolean;
}

export interface QuestionBankFilter {
  subject?: string;
  chapter?: string;
  difficulty?: number;
  search?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

/** GET /api/admin/question-bank */
export async function adminListQuestionBank(
  secret: string,
  filter?: QuestionBankFilter,
): Promise<QuestionBankListResult> {
  const params = new URLSearchParams();
  if (filter?.subject) params.set('subject', filter.subject);
  if (filter?.chapter) params.set('chapter', filter.chapter);
  if (filter?.difficulty !== undefined) params.set('difficulty', String(filter.difficulty));
  if (filter?.search) params.set('search', filter.search);
  if (filter?.isActive !== undefined) params.set('isActive', String(filter.isActive));
  if (filter?.page !== undefined) params.set('page', String(filter.page));
  if (filter?.pageSize !== undefined) params.set('pageSize', String(filter.pageSize));
  const qs = params.toString();
  return adminRequest(`/api/admin/question-bank${qs ? `?${qs}` : ''}`, secret);
}

/** POST /api/admin/question-bank */
export async function adminCreateQuestionBankItem(
  secret: string,
  data: {
    subject: string;
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
  },
): Promise<QuestionBankItem> {
  return adminRequest('/api/admin/question-bank', secret, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** PUT /api/admin/question-bank/:id */
export async function adminUpdateQuestionBankItem(
  secret: string,
  id: string,
  data: {
    subject?: string;
    chapter?: string;
    difficulty?: number;
    questionType?: ExamQuestionType;
    points?: number;
    questionText?: string;
    options?: string[];
    correctAnswer?: unknown;
    explanation?: string;
    examYear?: number;
    examCode?: string;
    isActive?: boolean;
  },
): Promise<QuestionBankItem> {
  return adminRequest(`/api/admin/question-bank/${id}`, secret, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/** GET /api/admin/question-bank/:id/usage */
export async function adminGetQuestionBankUsage(
  secret: string,
  id: string,
): Promise<QuestionBankUsage> {
  return adminRequest(`/api/admin/question-bank/${id}/usage`, secret);
}

/** DELETE /api/admin/question-bank/:id */
export async function adminDeleteQuestionBankItem(
  secret: string,
  id: string,
): Promise<{ message: string }> {
  return adminRequest(`/api/admin/question-bank/${id}`, secret, { method: 'DELETE' });
}

/** POST /api/admin/exam-papers/:id/questions/auto-fill */
export async function adminAutoFillFromBank(
  secret: string,
  paperId: string,
  count: number,
): Promise<{ added: number; skipped: number; shortage: number }> {
  return adminRequest(`/api/admin/exam-papers/${paperId}/questions/auto-fill`, secret, {
    method: 'POST',
    body: JSON.stringify({ count }),
  });
}

/** POST /api/admin/exam-papers/:id/questions/from-bank */
export async function adminAddFromBank(
  secret: string,
  paperId: string,
  questionBankIds: string[],
): Promise<{ added: number; skipped: number }> {
  return adminRequest(`/api/admin/exam-papers/${paperId}/questions/from-bank`, secret, {
    method: 'POST',
    body: JSON.stringify({ questionBankIds }),
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

// ─── Avatar ───────────────────────────────────────────────────────────────────

/** POST /api/users/me/avatar — upload anh dai dien (multipart/form-data). */
export async function uploadAvatar(sessionToken: string, file: File): Promise<UserProfile> {
  const formData = new FormData();
  formData.append('avatar', file);

  const res = await fetch('/api/users/me/avatar', {
    method: 'POST',
    headers: { Authorization: `Bearer ${sessionToken}` },
    body: formData,
  });

  const body = await parseJsonBody<UserProfile>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'UNKNOWN_ERROR', body.message ?? `Loi HTTP ${res.status}`, res.status);
  return body;
}

/** DELETE /api/users/me/avatar — xoa anh dai dien. */
export async function deleteAvatar(sessionToken: string): Promise<UserProfile> {
  return request<UserProfile>('/api/users/me/avatar', sessionToken, { method: 'DELETE' });
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export type Trend = 'up' | 'down' | 'same' | 'new';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  reputationScore: number;
  avgScore: number;
  examCount: number;
  trend: Trend;
}

export interface LeaderboardResponse {
  data: LeaderboardEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MyRankResponse {
  rank: number | null;
  reputationScore: number | null;
  avgScore: number | null;
  examCount: number;
  trend: Trend | null;
}

/** GET /api/leaderboard?subject=<optional>&page=<n> */
export async function getLeaderboard(
  sessionToken: string,
  page = 1,
  subject?: string,
): Promise<LeaderboardResponse> {
  const params = new URLSearchParams({ page: String(page) });
  if (subject) params.set('subject', subject);
  return request<LeaderboardResponse>(`/api/leaderboard?${params.toString()}`, sessionToken);
}

/** GET /api/leaderboard/me */
export async function getMyLeaderboardRank(
  sessionToken: string,
  subject?: string,
): Promise<MyRankResponse> {
  const params = subject ? `?subject=${subject}` : '';
  return request<MyRankResponse>(`/api/leaderboard/me${params}`, sessionToken);
}

// ─── Progress (Tien do hoc tap) ───────────────────────────────────────────────

export interface ProgressOverview {
  totalPracticeSessions: number;
  totalExamSessions: number;
  currentPoints: number;
  currentStreak: number;
}

export interface MonthStats {
  practiceSessions: number;
  examAvgScore: number | null;
}

export interface MonthComparison {
  thisMonth: MonthStats;
  lastMonth: MonthStats;
}

export interface ScoreTrendPoint {
  date: string;
  score: number;
  subject: string;
}

export interface PracticeStatItem {
  subject: string;
  totalSessions: number;
  avgScore: number;
  bestScore: number;
  accuracyByDifficulty: Record<number, number>;
}

export interface ProgressSummary {
  overview: ProgressOverview;
  bestStreak: number;
  monthComparison: MonthComparison;
  practiceStatsBySubject: PracticeStatItem[];
  scoreTrend: ScoreTrendPoint[];
}

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

/** GET /api/progress/summary */
export async function getProgressSummary(sessionToken: string): Promise<ProgressSummary> {
  return request<ProgressSummary>('/api/progress/summary', sessionToken);
}

/** GET /api/progress/exam-history?limit=&offset= */
export async function getExamHistory(
  sessionToken: string,
  limit = 10,
  offset = 0,
): Promise<PaginatedExamHistory> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return request<PaginatedExamHistory>(`/api/progress/exam-history?${params.toString()}`, sessionToken);
}

// ─── Ôn câu sai (Wrong Answer Review) ────────────────────────────────────────

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
  sessionToken: string,
  subjectId?: string,
  page = 1,
  pageSize = 20,
): Promise<WrongAnswerListResponse> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (subjectId) params.set('subjectId', subjectId);
  return request<WrongAnswerListResponse>(`/api/wrong-answers?${params.toString()}`, sessionToken);
}

/** POST /api/wrong-answers/:id/retry */
export async function retryWrongAnswer(
  sessionToken: string,
  id: number,
  answer: unknown,
): Promise<RetryResult> {
  return request<RetryResult>(`/api/wrong-answers/${id}/retry`, sessionToken, {
    method: 'POST',
    body: JSON.stringify({ answer }),
  });
}

// ─── Admin User Management ──────────────────────────────────────────────────

export interface DashboardStats {
  totalUsers: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  totalExamSessions: number;
  examPassRate: number;
  onlineNow: number;
}

export interface AdminUserListItem {
  id: string;
  displayName: string | null;
  email: string | null;
  role: string;
  isBlocked: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  avatarUrl: string | null;
}

export interface AdminUserListResult {
  users: AdminUserListItem[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AdminUserDetail {
  user: {
    id: string;
    displayName: string | null;
    email: string | null;
    phone: string | null;
    school: string | null;
    province: string | null;
    role: string;
    isBlocked: boolean;
    createdAt: string;
    lastLoginAt: string | null;
    avatarUrl: string | null;
    subjects: string[];
  };
  stats: {
    totalPracticeSessions: number;
    totalExamSessions: number;
    avgExamScore: number | null;
  };
  recentExams: {
    id: string;
    examPaperTitle: string;
    score: number | null;
    status: string;
    completedAt: string | null;
  }[];
}

/** GET /api/admin/dashboard */
export async function adminGetDashboard(secret: string): Promise<DashboardStats> {
  return adminRequest<DashboardStats>('/api/admin/dashboard', secret);
}

/** GET /api/admin/users */
export async function adminListUsers(
  secret: string,
  opts: { search?: string; role?: string; isBlocked?: boolean; page?: number; limit?: number } = {},
): Promise<AdminUserListResult> {
  const params = new URLSearchParams();
  if (opts.search) params.set('search', opts.search);
  if (opts.role) params.set('role', opts.role);
  if (opts.isBlocked !== undefined) params.set('isBlocked', String(opts.isBlocked));
  params.set('page', String(opts.page ?? 1));
  params.set('limit', String(opts.limit ?? 20));
  return adminRequest<AdminUserListResult>(`/api/admin/users?${params.toString()}`, secret);
}

/** GET /api/admin/users/:id */
export async function adminGetUserDetail(secret: string, userId: string): Promise<AdminUserDetail> {
  return adminRequest<AdminUserDetail>(`/api/admin/users/${userId}`, secret);
}

/** PATCH /api/admin/users/:id/block */
export async function adminBlockUser(
  secret: string,
  userId: string,
  isBlocked: boolean,
): Promise<{ id: string; isBlocked: boolean }> {
  return adminRequest<{ id: string; isBlocked: boolean }>(
    `/api/admin/users/${userId}/block`,
    secret,
    { method: 'PATCH', body: JSON.stringify({ isBlocked }) },
  );
}

/** POST /api/admin/users/:id/reset-password */
export async function adminResetPassword(
  secret: string,
  userId: string,
): Promise<{ resetLink: string }> {
  return adminRequest<{ resetLink: string }>(
    `/api/admin/users/${userId}/reset-password`,
    secret,
    { method: 'POST' },
  );
}

/** PATCH /api/admin/users/:id/role */
export async function adminSetUserRole(
  secret: string,
  userId: string,
  role: string,
): Promise<{ id: string; role: string }> {
  return adminRequest<{ id: string; role: string }>(
    `/api/admin/users/${userId}/role`,
    secret,
    { method: 'PATCH', body: JSON.stringify({ role }) },
  );
}

/** DELETE /api/admin/users/:id */
export async function adminDeleteUser(
  secret: string,
  userId: string,
): Promise<{ message: string }> {
  return adminRequest<{ message: string }>(
    `/api/admin/users/${userId}`,
    secret,
    { method: 'DELETE' },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications — Thông báo hệ thống
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'STREAK_MILESTONE'
  | 'RANK_UP'
  | 'RANK_DOWN'
  | 'REPORT_RESOLVED'
  | 'NEW_EXAM_PAPER';

export type NotificationTargetScreen = 'progress' | 'leaderboard' | 'exam' | null;

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  targetScreen: NotificationTargetScreen;
  metadata: Record<string, unknown> | null;
  createdAt: string; // ISO 8601
}

export interface NotificationListResponse {
  notifications: NotificationItem[];
  total: number;
  unreadCount: number;
}

/** GET /api/notifications?page=N&limit=N — danh sách thông báo phân trang */
export async function getNotifications(
  sessionToken: string,
  page = 1,
  limit = 20,
): Promise<NotificationListResponse> {
  return request<NotificationListResponse>(
    `/api/notifications?page=${page}&limit=${limit}`,
    sessionToken,
  );
}

/** GET /api/notifications/unread-count — đếm thông báo chưa đọc (dùng cho polling) */
export async function getUnreadCount(sessionToken: string): Promise<{ count: number }> {
  return request<{ count: number }>('/api/notifications/unread-count', sessionToken);
}

/** PATCH /api/notifications/:id/read — đánh dấu 1 thông báo đã đọc */
export async function markNotificationAsRead(
  sessionToken: string,
  notificationId: string,
): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(
    `/api/notifications/${notificationId}/read`,
    sessionToken,
    { method: 'PATCH' },
  );
}

/** PATCH /api/notifications/read-all — đánh dấu tất cả đã đọc */
export async function markAllNotificationsAsRead(
  sessionToken: string,
): Promise<{ updatedCount: number }> {
  return request<{ updatedCount: number }>(
    '/api/notifications/read-all',
    sessionToken,
    { method: 'PATCH' },
  );
}

