// API module cho Progress (Tien do hoc tap) — mobile.
import { request } from './client.js';

// ---------------------------------------------------------------------------
// Types (khop voi backend/src/services/progress/progress.types.ts)
// ---------------------------------------------------------------------------

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

export interface PracticeStats {
  subjectId: string;
  totalSessions: number;
  avgScore: number | null;
  lastPracticeAt: string | null;
}

export interface StreakFreezeInfo {
  granted: number;
  used: number;
  remaining: number;
}

export interface ProgressSummary {
  overview: ProgressOverview;
  bestStreak: number;
  monthComparison: MonthComparison;
  practiceStatsBySubject: PracticeStats[];
  scoreTrend: ScoreTrendPoint[];
  isPremium: boolean;
  premiumExpiresAt: string | null;
  streakFreeze: StreakFreezeInfo;
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

export interface ExamHistoryResponse {
  items: ExamHistoryItem[];
  total: number;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** GET /api/progress/summary — tong quan tien do hoc tap. */
export async function getProgressSummary(token: string): Promise<ProgressSummary> {
  return request<ProgressSummary>('/api/progress/summary', token);
}

/** GET /api/progress/exam-history?limit=<n>&offset=<n> — lich su bai thi. */
export async function getExamHistory(
  token: string,
  limit = 10,
  offset = 0,
): Promise<ExamHistoryResponse> {
  return request<ExamHistoryResponse>(
    `/api/progress/exam-history?limit=${limit}&offset=${offset}`,
    token,
  );
}
