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
