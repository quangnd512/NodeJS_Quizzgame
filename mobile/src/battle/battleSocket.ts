// Socket.io client cho Thi dau doi khang (PvP Battle).
// Ket noi den namespace "/battle" voi session token.
// Xem backend/src/services/battle/battle.socket.ts de biet cac event.
import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config/env.js';

// ---------------------------------------------------------------------------
// Types cho cac socket event
// ---------------------------------------------------------------------------

export interface BattleQueueStatusEvent {
  waitingSeconds: number;
  currentCriteria: 'STRICT' | 'SUBJECT_ONLY' | 'ANY';
}

export interface BattleMatchFoundEvent {
  matchId: string;
  subject: string;
  stake: number;
  opponentName: string;
  isBotMatch: boolean;
}

export interface BattleQuestionEvent {
  matchId: string;
  questionIndex: number;
  questionText: string;
  options: string[] | null;
  timeLimit: number; // giay
}

export interface BattleQuestionResultEvent {
  isCorrect: boolean;
  myScore: number;
  correctAnswer: number | null;
}

export interface BattleOpponentProgressEvent {
  questionIndex: number;
  opponentScore: number;
}

export interface BattleMatchEndedEvent {
  matchId: string;
  myScore: number;
  opponentScore: number;
  result: string;
  pointsChange: number;
}

export interface BattleErrorEvent {
  code: string;
  message: string;
}

export interface BattleOpponentDisconnectedEvent {
  gracePeriodSeconds: number;
}

export interface BattleRoomCreatedEvent {
  roomCode: string;
}

// ---------------------------------------------------------------------------
// Socket manager
// ---------------------------------------------------------------------------

let _socket: Socket | null = null;

/** Tao + tra ve socket instance ket noi den /battle namespace. */
export function getBattleSocket(sessionToken: string): Socket {
  if (_socket && _socket.connected) return _socket;

  // Danh sach URL co the tra ve (co the la absolute URL hoac chi /path)
  // API_BASE_URL vi du: 'http://192.168.1.x:4000' hoac '' (khi dung proxy)
  const serverUrl = API_BASE_URL || 'http://localhost:4000';

  _socket = io(`${serverUrl}/battle`, {
    auth: { token: sessionToken },
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  return _socket;
}

/** Ngat ket noi socket va xoa instance. */
export function disconnectBattleSocket(): void {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}
