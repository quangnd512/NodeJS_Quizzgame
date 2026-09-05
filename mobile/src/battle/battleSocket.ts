// Wrapper Socket.io namespace "/battle" cho mobile - phan anh frontend/src/lib/battleSocket.ts.
// Xac thuc bang session token noi bo (auth: { token }) qua handshake - khong can co che rieng.
import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config/env';

// ─── Kieu payload su kien server → client ─────────────────────────────────────

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
 * Tao ket noi Socket.io toi namespace "/battle", xac thuc bang session token.
 * KHONG tu dong ket noi (autoConnect: false) — caller chu dong goi .connect()
 * trong useEffect de kiem soat vong doi ro rang.
 */
export function createBattleSocket(sessionToken: string): BattleSocket {
  return io(`${API_BASE_URL}/battle`, {
    autoConnect: false,
    auth: { token: sessionToken },
    transports: ['websocket', 'polling'],
  });
}
