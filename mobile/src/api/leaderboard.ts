// Goi API Bang Xep Hang - khop 1-1 voi frontend/src/lib/api.ts (phan Leaderboard).
// Backend: backend/src/routes/leaderboard.route.ts
import { request } from './client';

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
  token: string,
  page = 1,
  subject?: string,
): Promise<LeaderboardResponse> {
  const params = new URLSearchParams({ page: String(page) });
  if (subject) params.set('subject', subject);
  return request<LeaderboardResponse>(`/api/leaderboard?${params.toString()}`, token);
}

/** GET /api/leaderboard/me?subject=<optional> */
export async function getMyLeaderboardRank(
  token: string,
  subject?: string,
): Promise<MyRankResponse> {
  const params = subject ? `?subject=${subject}` : '';
  return request<MyRankResponse>(`/api/leaderboard/me${params}`, token);
}
