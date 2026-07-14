// Cac kieu du lieu (types/interfaces) dung chung cho module On tap.
// Tach rieng de cac route handler co the import ma khong phu thuoc vao service logic.

/** Cau hoi duoc tra ve cho user (KHONG chua correctAnswer / explanation). */
export interface QuestionPublicDto {
  id: string;
  subject: string;
  chapter: string | null;
  difficulty: number;
  question: string;
  options: string[];
}

/** Cau hoi day du (danh cho admin hoac sau khi user da nop dap an). */
export interface QuestionFullDto extends QuestionPublicDto {
  correctAnswer: number;
  explanation: string | null;
  examYear: number | null;
  examCode: string | null;
  isActive: boolean;
  createdAt: Date;
}

/** Ket qua tra ve khi bat dau phien on tap (GET /practice/start). */
export interface StartSessionResponse {
  sessionId: string;
  subjectId: string;
  questions: QuestionPublicDto[];
  /** Thoi gian gioi han (giay) - 15 phut = 900 giay. */
  timeLimitSeconds: number;
  startedAt: Date;
}

/** Ket qua tra ve sau khi nop dap an 1 cau (POST /practice/answer). */
export interface AnswerResponse {
  isCorrect: boolean;
  correctAnswer: number;
  explanation: string | null;
  /** So cau da tra loi trong phien nay. */
  answeredCount: number;
  totalQuestions: number;
}

/** Tom tat 1 cau tra loi trong ket qua hoan thanh. */
export interface AnswerSummary {
  questionId: string;
  selectedOption: number | null;
  isCorrect: boolean;
  correctAnswer: number;
  explanation: string | null;
}

/** Ket qua tra ve sau khi hoan thanh phien (POST /practice/complete). */
export interface CompleteSessionResponse {
  sessionId: string;
  score: number;
  pointsEarned: number;
  totalQuestions: number;
  answers: AnswerSummary[];
}

/** Ket qua tra ve khi lay chi tiet phien dang do (GET /practice/session/:id). */
export interface SessionDetailResponse {
  sessionId: string;
  subjectId: string;
  questions: QuestionPublicDto[];
  /** Cac cau da tra loi trong phien nay. */
  answers: Array<{
    questionId: string;
    selectedOption: number | null;
    isCorrect: boolean;
  }>;
  /** Thoi gian con lai (giay). Co the am neu da qua gio nhung chua complete. */
  timeRemainingSeconds: number;
  startedAt: Date;
}

/** 1 don vi trong lich su phien on tap (GET /practice/history). */
export interface HistoryItem {
  sessionId: string;
  subjectId: string;
  score: number;
  pointsEarned: number;
  totalQuestions: number;
  startedAt: Date;
  completedAt: Date;
}

/** Ket qua phan trang lich su. */
export interface PaginatedHistory {
  items: HistoryItem[];
  total: number;
  limit: number;
  offset: number;
}

/** Thong ke on tap cua user (GET /practice/stats). */
export interface PracticeStats {
  subject: string;
  totalSessions: number;
  avgScore: number;
  bestScore: number;
  /** Do chinh xac theo do kho: { 1: 0.75, 2: 0.6, 3: 0.4 } (ti le 0.0 - 1.0). */
  accuracyByDifficulty: Record<number, number>;
}

/** Input tao moi cau hoi (admin). */
export interface CreateQuestionInput {
  subject: string;
  chapter?: string;
  difficulty: number;
  question: string;
  options: [string, string, string, string];
  correctAnswer: number;
  explanation?: string;
  examYear?: number;
  examCode?: string;
}

/** Input cap nhat cau hoi (admin) - moi truong deu tuy chon. */
export type UpdateQuestionInput = Partial<CreateQuestionInput>;

/** Noi dung cau hoi day du kem theo 1 bao cao (JOIN tu bang questions). */
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

/** Bao cao cau hoi (danh cho admin xem) — kem day du noi dung cau hoi, khong chi ma UUID. */
export interface QuestionReportDto {
  id: string;
  questionId: string;
  userId: string;
  reason: string;
  description: string | null;
  status: string;
  createdAt: Date;
  question: QuestionReportQuestionDto;
}

/** Bo loc danh sach bao cao cau hoi (admin). */
export interface ListReportsParams {
  status?: string;
  subject?: string;
  reason?: string;
  page?: number;
  limit?: number;
}

/**
 * Tong hop thong ke bao cao cau hoi (GET /api/admin/questions/reports/summary).
 * Tach ro 2 so lieu de tranh nham lan:
 *   - pendingReports:  tong so DONG bao cao dang PENDING (1 cau co the co nhieu bao cao)
 *   - pendingQuestions: so CAU HOI KHAC NHAU dang co it nhat 1 bao cao PENDING
 */
export interface QuestionReportSummary {
  pendingReports: number;
  pendingQuestions: number;
  fixed: number;
  dismissed: number;
  /** Top 10 cau hoi bi bao cao nhieu nhat (moi trang thai, moi thoi diem). */
  topReportedQuestions: Array<{ questionId: string; count: number }>;
}

/**
 * Cac gia tri loc CON KHA DUNG cho tung dimension (status/subject/reason), tinh
 * theo 2 dimension CON LAI dang duoc chon — dung de lam "loc lien dong": moi
 * dropdown chi hien lua chon nao thuc su co du lieu khop voi cac loc khac.
 */
export interface ReportFilterFacets {
  statuses: string[];
  subjects: string[];
  reasons: string[];
}

/** Trang thai hop le duoc phep ghi qua endpoint resolve moi — CHI FIXED|DISMISSED. */
export const RESOLVABLE_REPORT_STATUSES = ['FIXED', 'DISMISSED'] as const;
export type ResolvableReportStatus = (typeof RESOLVABLE_REPORT_STATUSES)[number];

/** Du lieu cap nhat noi dung cau hoi kem theo luc resolve bao cao (tuy chon). */
export interface ResolveReportQuestionUpdate {
  subject?: string;
  chapter?: string | null;
  difficulty?: number;
  question?: string;
  options?: [string, string, string, string];
  correctAnswer?: number;
  explanation?: string | null;
}

/** Ket qua resolve 1 bao cao (PATCH /api/admin/questions/reports/:id/resolve). */
export interface ResolveReportResult {
  id: string;
  status: ResolvableReportStatus;
  /** So bao cao PENDING khac cung questionId cung duoc dong theo (khong tinh chinh no). */
  batchResolvedCount: number;
  /** true neu Question.isActive duoc set lai true (truoc do dang bi auto-hide). */
  reactivated: boolean;
}

/** Ly do bao cao cau hoi — gia tri hop le. */
export const REPORT_REASONS = ['WRONG_ANSWER', 'BAD_CONTENT', 'TYPO', 'OTHER'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Trang thai bao cao — gia tri hop le. */
export const REPORT_STATUSES = ['PENDING', 'REVIEWED', 'FIXED', 'DISMISSED'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** Thoi gian toi da 1 phien on tap (giay): 15 phut + 2 phut bo dem = 17 phut. */
export const SESSION_TIMEOUT_SECONDS = 17 * 60;

/** So cau hoi moi phien on tap. */
export const QUESTIONS_PER_SESSION = 15;

/** So cau hoi moi nhom do kho (5 cau * 3 do kho = 15 cau). */
export const QUESTIONS_PER_DIFFICULTY = 5;

/** So phien toi da trong 1 gio (rate limit). */
export const MAX_SESSIONS_PER_HOUR = 10;

/** So lan retry toi da khi gap optimistic lock conflict trong complete session. */
export const MAX_COMPLETE_RETRY = 10;

/** Nguong bao cao tu dong an cau hoi (>= N bao cao PENDING). */
export const AUTO_HIDE_REPORT_THRESHOLD = 5;
