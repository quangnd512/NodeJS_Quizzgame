// Goi API Tien do hoc tap - khop 1-1 voi frontend/src/lib/api.ts (phan Progress).
// Backend: backend/src/routes/progress.route.ts
import { request } from './client';

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

/** So the bao hiem chuoi - chi co y nghia khi isPremium=true; Free luon 0/0/0. */
export interface StreakFreezeInfo {
  granted: number;
  used: number;
  remaining: number;
}

export interface ProgressSummary {
  overview: ProgressOverview;
  bestStreak: number;
  monthComparison: MonthComparison;
  practiceStatsBySubject: PracticeStatItem[];
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

export interface PaginatedExamHistory {
  items: ExamHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}

/** GET /api/progress/summary */
export async function getProgressSummary(token: string): Promise<ProgressSummary> {
  return request<ProgressSummary>('/api/progress/summary', token);
}

/** GET /api/progress/exam-history?limit=&offset= */
export async function getExamHistory(
  token: string,
  limit = 10,
  offset = 0,
): Promise<PaginatedExamHistory> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return request<PaginatedExamHistory>(`/api/progress/exam-history?${params.toString()}`, token);
}
