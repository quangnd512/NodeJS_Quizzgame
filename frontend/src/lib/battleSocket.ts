// Wrapper ket noi Socket.io namespace "/battle" (Feature 016 - Thi dau doi khang).
// Day la LAN DAU du an dung ket noi realtime - truoc do toan bo API deu la REST
// thuan (xem api.ts). Xac thuc dung LAI session token noi bo hien co (cung token
// dang dung cho moi cuoc goi REST qua header Authorization) - gui qua
// `auth: { token }` luc handshake, KHONG can co che dang nhap rieng cho socket.
import { io, type Socket } from 'socket.io-client';

// ─── Kieu du lieu payload cac su kien — khop voi docs/api/drafts/battle-mvp.yaml ──

export interface BattleQueueStatusPayload {
  waitingSeconds: number;
  currentCriteria: 'STRICT' | 'SUBJECT_ONLY' | 'ANY';
}

export interface BattleRoomCreatedPayload {
  roomCode: string;
}

export interface BattleMatchFoundPayload {
  matchId: string;
  subject: string;
  stake: number;
  opponentName: string;
  isBotMatch: boolean;
}

export interface BattleQuestionPayload {
  questionIndex: number;
  questionText: string;
  options: [string, string, string, string];
}

export interface BattleOpponentProgressPayload {
  questionIndex: number;
  opponentScore: number;
}

export interface BattleQuestionResultPayload {
  questionIndex: number;
  correctOption: number;
  myPointsEarned: number;
  myTotalScore: number;
}

export type BattleMatchResult = 'WIN' | 'LOSE' | 'DRAW' | 'OPPONENT_LEFT_WIN' | 'CANCELLED_BOTH_LEFT';

export interface BattleMatchEndedPayload {
  result: BattleMatchResult;
  myScore: number;
  opponentScore: number;
  pointsChange: number;
  newBalance: number;
}

export interface BattleOpponentDisconnectedPayload {
  gracePeriodSeconds: number;
}

export interface BattleErrorPayload {
  code: string;
  message: string;
}

/** Toan bo su kien server -> client (dung de danh kieu cho `socket.on`). */
export interface BattleServerToClientEvents {
  'battle:queue-status': (payload: BattleQueueStatusPayload) => void;
  'battle:room-created': (payload: BattleRoomCreatedPayload) => void;
  'battle:match-found': (payload: BattleMatchFoundPayload) => void;
  'battle:question': (payload: BattleQuestionPayload) => void;
  'battle:opponent-progress': (payload: BattleOpponentProgressPayload) => void;
  'battle:question-result': (payload: BattleQuestionResultPayload) => void;
  'battle:match-ended': (payload: BattleMatchEndedPayload) => void;
  'battle:opponent-disconnected': (payload: BattleOpponentDisconnectedPayload) => void;
  'battle:error': (payload: BattleErrorPayload) => void;
}

/** Toan bo su kien client -> server. */
export interface BattleClientToServerEvents {
  'battle:join-queue': (payload: { subject: string; stake: number }) => void;
  'battle:create-room': (payload: { subject: string; stake: number }) => void;
  'battle:join-room': (payload: { roomCode: string }) => void;
  'battle:cancel-queue': () => void;
  'battle:submit-answer': (payload: {
    matchId: string;
    questionIndex: number;
    selectedOption: number;
    clientTimeMs: number;
  }) => void;
}

export type BattleSocket = Socket<BattleServerToClientEvents, BattleClientToServerEvents>;

/**
 * Tao 1 ket noi Socket.io moi toi namespace "/battle", xac thuc bang session token
 * noi bo hien co. KHONG tu dong ket noi (`autoConnect: false`) — caller chu dong
 * goi `.connect()` (thuong trong `useEffect`) de kiem soat vong doi ro rang, tranh
 * ket noi "mo coi" khi component unmount truoc khi ket noi kip hoan tat.
 */
export function createBattleSocket(sessionToken: string): BattleSocket {
  return io('/battle', {
    autoConnect: false,
    auth: { token: sessionToken },
    // KHONG dung polling truoc roi upgrade - uu tien websocket ngay vi day la game
    // realtime can do tre thap; polling van la fallback tu dong cua thu vien neu can.
    transports: ['websocket', 'polling'],
  });
}
