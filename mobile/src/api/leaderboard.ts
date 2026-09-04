// API module cho Leaderboard (Bang xep hang) — mobile.
import { request } from './client.js';

// ---------------------------------------------------------------------------
// Types (khop voi backend/src/services/leaderboard/leaderboard.types.ts)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** GET /api/leaderboard?subject=<id>&page=<n> — bang xep hang tong hop hoac theo mon. */
export async function getLeaderboard(
  token: string,
  subject?: string,
  page = 1,
): Promise<LeaderboardResponse> {
  const params = new URLSearchParams({ page: String(page) });
  if (subject) params.set('subject', subject);
  return request<LeaderboardResponse>(`/api/leaderboard?${params.toString()}`, token);
}

/** GET /api/leaderboard/me — hang va diem cua user dang dang nhap. */
export async function getMyRank(token: string): Promise<MyRankResponse> {
  return request<MyRankResponse>('/api/leaderboard/me', token);
}
