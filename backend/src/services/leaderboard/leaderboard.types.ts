// Cac kieu du lieu cho module Leaderboard (Bang xep hang).

/** Xu huong thay doi hang so voi 30 ngay truoc. */
export type Trend = 'up' | 'down' | 'same' | 'new';

/** 1 hang trong bang xep hang. */
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

/** Response cua GET /api/leaderboard */
export interface LeaderboardResponse {
  data: LeaderboardEntry[];
  total: number;
  page: number;
  pageSize: number;
}

/** Response cua GET /api/leaderboard/me */
export interface MyRankResponse {
  rank: number | null;
  reputationScore: number | null;
  avgScore: number | null;
  examCount: number;
  trend: Trend | null;
}

/** Kieu raw row tra ve tu Prisma $queryRaw (truoc khi chuyen doi). */
export interface RawLeaderboardRow {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  avgScore: number;
  examCount: number;
  reputationScore: number;
  rank: number;
  trend: Trend;
}
