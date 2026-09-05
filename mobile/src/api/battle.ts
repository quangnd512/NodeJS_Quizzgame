// API module cho Thi dau doi khang (PvP Battle) — mobile.
// REST endpoints: config, active match, history.
// Realtime qua Socket.io: xem src/battle/battleSocket.ts.
import { request } from './client';

// ---------------------------------------------------------------------------
// Types (khop voi backend/src/services/battle/battle.types.ts)
// ---------------------------------------------------------------------------

export type BattleMatchResult = 'WIN' | 'LOSE' | 'DRAW' | 'OPPONENT_LEFT_WIN' | 'CANCELLED_BOTH_LEFT';

export interface BattleConfigResponse {
  stakes: number[];
  currentPoints: number;
}

export interface BattleHistoryItem {
  id: string;
  subject: string;
  stake: number;
  isBotMatch: boolean;
  opponentName: string | null;
  myScore: number;
  opponentScore: number;
  result: 'WIN' | 'LOSE' | 'DRAW';
  pointsChange: number;
  completedAt: string;
}

export interface PaginatedBattleHistory {
  items: BattleHistoryItem[];
  total: number;
}

export interface ActiveBattleMatchSnapshot {
  matchId: string;
  subject: string;
  stake: number;
  opponentName: string;
  isBotMatch: boolean;
  currentQuestionIndex: number;
  totalQuestions: number;
}

export interface ActiveBattleMatchResponse {
  active: boolean;
  match: ActiveBattleMatchSnapshot | null;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** GET /api/battle/config — muc cuoc hop le + so du diem hien tai. */
export async function getBattleConfig(token: string): Promise<BattleConfigResponse> {
  return request<BattleConfigResponse>('/api/battle/config', token);
}

/** GET /api/battle/active — tran dang dien ra (neu co). */
export async function getActiveBattle(token: string): Promise<ActiveBattleMatchResponse> {
  return request<ActiveBattleMatchResponse>('/api/battle/active', token);
}

/** GET /api/battle/history?limit=<n>&offset=<n> — lich su tran da dau. */
export async function getBattleHistory(
  token: string,
  limit = 20,
  offset = 0,
): Promise<PaginatedBattleHistory> {
  return request<PaginatedBattleHistory>(
    `/api/battle/history?limit=${limit}&offset=${offset}`,
    token,
  );
}
