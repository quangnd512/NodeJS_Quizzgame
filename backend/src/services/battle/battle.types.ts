// Cac kieu du lieu va hang so dung chung cho module Thi dau doi khang (PvP Battle) — Feature 016 Dot 1/MVP.

/** Danh sach muc cuoc hop le — CHUNG cho moi nguoi o Dot 1 (chua phan biet Free/Premium). */
export const BATTLE_STAKES: readonly number[] = [50, 100, 200, 500];

/** So cau hoi moi tran. */
export const BATTLE_QUESTIONS_PER_MATCH = 10;

/** Thoi gian toi da (giay) de tra loi 1 cau. */
export const BATTLE_QUESTION_TIME_LIMIT_SECONDS = 20;
export const BATTLE_QUESTION_TIME_LIMIT_MS = BATTLE_QUESTION_TIME_LIMIT_SECONDS * 1000;

/** So diem co ban khi tra loi DUNG 1 cau (chua tinh bonus toc do). */
export const BATTLE_BASE_POINTS_PER_QUESTION = 10;

/** Bonus toc do toi da (0-3 diem) — cang tra loi nhanh cang duoc nhieu. */
export const BATTLE_MAX_SPEED_BONUS = 3;

/** Thoi gian (giay) cho doi thu ket noi lai truoc khi xu thang ky thuat. */
export const BATTLE_DISCONNECT_GRACE_SECONDS = 30;
export const BATTLE_DISCONNECT_GRACE_MS = BATTLE_DISCONNECT_GRACE_SECONDS * 1000;

/** Xac suat bot tra loi DUNG moi cau (~65%). */
export const BATTLE_BOT_CORRECT_RATE = 0.65;

/** Khoang thoi gian (ms) bot "suy nghi" truoc khi tra loi — ngau nhien deu 3-18s (duoi 20s de khong timeout). */
export const BATTLE_BOT_MIN_ANSWER_MS = 3000;
export const BATTLE_BOT_MAX_ANSWER_MS = 18000;

/** Cac moc thoi gian (giay) noi long tieu chi ghep tran. */
export const QUEUE_STRICT_UNTIL_SECONDS = 10;
export const QUEUE_SUBJECT_ONLY_UNTIL_SECONDS = 20;
export const QUEUE_ANY_UNTIL_SECONDS = 30;

/** Muc do noi long tieu chi ghep tran tai 1 thoi diem. */
export type QueueCriteria = 'STRICT' | 'SUBJECT_ONLY' | 'ANY';

/** Trang thai 1 tran dau (khop voi cot `status` trong BattleMatch). */
export type BattleMatchStatus = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';

/** Ket qua tran dau tu goc nhin 1 nguoi choi — gui qua `battle:match-ended`. */
export type BattleMatchResult = 'WIN' | 'LOSE' | 'DRAW' | 'OPPONENT_LEFT_WIN' | 'CANCELLED_BOTH_LEFT';

/** Response cua GET /api/battle/config. */
export interface BattleConfigResponse {
  stakes: readonly number[];
  currentPoints: number;
}

/** 1 dong trong lich su tran dau — GET /api/battle/history. */
export interface BattleHistoryItem {
  id: string;
  subject: string;
  stake: number;
  isBotMatch: boolean;
  /** null neu doi thu la bot. */
  opponentName: string | null;
  myScore: number;
  opponentScore: number;
  result: 'WIN' | 'LOSE' | 'DRAW';
  /** Am/duong — so diem thay doi tu tran nay (khong tinh so du truoc do). */
  pointsChange: number;
  completedAt: string;
}

/** Response phan trang cho GET /api/battle/history. */
export interface PaginatedBattleHistory {
  items: BattleHistoryItem[];
  total: number;
}

/**
 * Snapshot 1 tran ĐANG DIỄN RA của user (nếu có) — dùng để FE tự động đưa
 * người dùng vào lại đúng trận sau khi tải lại trang/đăng nhập lại (Fix S5:
 * trước đây phải tự bấm vào lại "Thi đấu", không có tín hiệu gì báo có trận
 * đang dở). Đọc trực tiếp từ state in-memory `liveMatches` (battle.engine.service.ts)
 * — CHỈ đúng khi trận thực sự còn sống trên process backend hiện tại.
 */
export interface ActiveBattleMatchSnapshot {
  matchId: string;
  subject: string;
  stake: number;
  opponentName: string;
  isBotMatch: boolean;
  myScore: number;
  opponentScore: number;
  opponentDisconnected: boolean;
  /** null nếu mình VỪA trả lời câu hiện tại (đang chờ câu tiếp theo/đối thủ). */
  question: {
    questionIndex: number;
    questionText: string;
    options: [string, string, string, string];
    /** Số giây còn lại ước tính của câu hiện tại — để FE không reset về 20s "ảo". */
    secondsLeft: number;
  } | null;
}

/** Response cua GET /api/battle/active. */
export interface ActiveBattleMatchResponse {
  active: boolean;
  match: ActiveBattleMatchSnapshot | null;
}

// ---------------------------------------------------------------------------
// Payload cac su kien Socket.io (namespace /battle) — khop voi docs/api/drafts/battle-mvp.yaml
// ---------------------------------------------------------------------------

export interface JoinQueuePayload {
  subject: string;
  stake: number;
}

export interface CreateRoomPayload {
  subject: string;
  stake: number;
}

export interface JoinRoomPayload {
  roomCode: string;
}

export interface SubmitAnswerPayload {
  matchId: string;
  questionIndex: number;
  selectedOption: number;
  /** Chi dung de hien thi/chong gian lan — KHONG dung de tinh diem. */
  clientTimeMs: number;
}

export interface QueueStatusEvent {
  waitingSeconds: number;
  currentCriteria: QueueCriteria;
}

export interface RoomCreatedEvent {
  roomCode: string;
}

export interface MatchFoundEvent {
  matchId: string;
  subject: string;
  stake: number;
  opponentName: string;
  isBotMatch: boolean;
}

export interface BattleQuestionEvent {
  questionIndex: number;
  questionText: string;
  options: [string, string, string, string];
}

export interface OpponentProgressEvent {
  questionIndex: number;
  opponentScore: number;
}

export interface QuestionResultEvent {
  questionIndex: number;
  correctOption: number;
  myPointsEarned: number;
  myTotalScore: number;
}

export interface MatchEndedEvent {
  result: BattleMatchResult;
  myScore: number;
  opponentScore: number;
  pointsChange: number;
  newBalance: number;
}

export interface OpponentDisconnectedEvent {
  gracePeriodSeconds: 30;
}

export interface BattleErrorEvent {
  code: string;
  message: string;
}
