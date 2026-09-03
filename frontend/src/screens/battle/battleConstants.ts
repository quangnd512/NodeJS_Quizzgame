import type { BattleQueueStatusPayload, BattleMatchEndedPayload } from '../../lib/battleSocket.js';
import type { BattleResult } from '../../lib/api.js';

/** localStorage key nhớ matchId đang chơi dở — dùng để phát hiện "trận vừa kết thúc
 * trong lúc mình rời app" khi không còn thấy trận đó "sống" ở GET /api/battle/active. */
export const BATTLE_ACTIVE_MATCH_KEY = 'battle_active_match_id';

export const BATTLE_QUEUE_CRITERIA_LABEL: Record<BattleQueueStatusPayload['currentCriteria'], string> = {
  STRICT: 'Đang tìm đúng môn + đúng mức cược…',
  SUBJECT_ONLY: 'Đã nới: tìm cùng môn, mọi mức cược…',
  ANY: 'Đã nới: tìm mọi môn, mọi mức cược…',
};

export const BATTLE_RESULT_LABEL: Record<BattleMatchEndedPayload['result'], { text: string; icon: string; cls: string }> = {
  WIN: { text: 'Chiến thắng!', icon: '🏆', cls: 'battle-result-win' },
  LOSE: { text: 'Thua cuộc', icon: '😢', cls: 'battle-result-lose' },
  DRAW: { text: 'Hoà', icon: '🤝', cls: 'battle-result-draw' },
  OPPONENT_LEFT_WIN: { text: 'Thắng — đối thủ mất kết nối', icon: '🏳️', cls: 'battle-result-win' },
  CANCELLED_BOTH_LEFT: { text: 'Trận đấu bị huỷ', icon: '⚠️', cls: 'battle-result-draw' },
};

export const BATTLE_HISTORY_PAGE_SIZE = 10;

export const BATTLE_HISTORY_RESULT_LABEL: Record<BattleResult, { text: string; cls: string }> = {
  WIN: { text: 'Thắng', cls: 'score-high' },
  LOSE: { text: 'Thua', cls: 'score-low' },
  DRAW: { text: 'Hoà', cls: '' },
};
