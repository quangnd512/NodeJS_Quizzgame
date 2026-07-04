// Kieu du lieu cho module Progress (Tien do hoc tap).

import type { PracticeStats } from '../practice/practice.types.js';

/** Tong quan hoat dong hoc tap cua user. */
export interface ProgressOverview {
  totalPracticeSessions: number;
  totalExamSessions: number;
  currentPoints: number;
  currentStreak: number;
}

/** So sanh hoat dong giua thang nay va thang truoc. */
export interface MonthStats {
  practiceSessions: number;
  /** Diem thi trung binh thang do (null neu chua co phien thi nao). */
  examAvgScore: number | null;
}

export interface MonthComparison {
  thisMonth: MonthStats;
  lastMonth: MonthStats;
}

/** 1 diem trong bieu do xu huong diem so. */
export interface ScoreTrendPoint {
  date: string;  // ISO date string
  score: number;
  subject: string;
}

/** Ket qua toan bo summary tien do. */
export interface ProgressSummary {
  overview: ProgressOverview;
  bestStreak: number;
  monthComparison: MonthComparison;
  practiceStatsBySubject: PracticeStats[];
  scoreTrend: ScoreTrendPoint[];
}

/** 1 muc trong lich su thi thu (da hoan thanh). */
export interface ExamHistoryItem {
  id: string;
  examPaperId: string;
  title: string;
  subject: string;
  score: number | null;
  pointsAwarded: number;
  completedAt: string;
}

/** Ket qua phan trang lich su thi thu. */
export interface PaginatedExamHistory {
  items: ExamHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}
