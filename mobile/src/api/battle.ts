// Goi API Thi dau doi khang (REST portion) - khop 1-1 voi frontend/src/lib/api.ts (phan Battle).
// Luong choi realtime (ghep tran, cau hoi, nop dap an) dung Socket.io — xem ../battle/battleSocket.ts.
// Backend: backend/src/routes/battle.route.ts
import { request } from './client';

export interface BattleConfig {
  stakes: number[];
  currentPoints: number;
}

/** Alias tương thích cho BattleConfig (dùng trong BattleLobbyScreen). */
export type BattleConfigResponse = BattleConfig;

export type BattleResult = 'WIN' | 'LOSE' | 'DRAW';

export interface BattleHistoryItem {
  id: string;
  subject: string;
  stake: number;
  isBotMatch: boolean;
  opponentName: string | null;
  myScore: number;
  opponentScore: number;
  result: BattleResult;
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
  myScore: number;
  opponentScore: number;
  opponentDisconnected: boolean;
  question: {
    questionIndex: number;
    questionText: string;
    options: [string, string, string, string];
    secondsLeft: number;
  } | null;
}

export interface ActiveBattleMatchResponse {
  active: boolean;
  match: ActiveBattleMatchSnapshot | null;
}

/** GET /api/battle/config — muc cuoc hop le + so du diem hien tai */
export async function getBattleConfig(token: string): Promise<BattleConfig> {
  return request<BattleConfig>('/api/battle/config', token);
}

/** GET /api/battle/history?limit=&offset= */
export async function getBattleHistory(
  token: string,
  limit = 20,
  offset = 0,
): Promise<PaginatedBattleHistory> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return request<PaginatedBattleHistory>(`/api/battle/history?${params.toString()}`, token);
}

/** GET /api/battle/active — tran dang dien ra (neu co) */
export async function getActiveBattleMatch(token: string): Promise<ActiveBattleMatchResponse> {
  return request<ActiveBattleMatchResponse>('/api/battle/active', token);
}
