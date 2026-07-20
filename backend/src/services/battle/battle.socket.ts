// Dang ky namespace Socket.io "/battle" cho module Thi dau doi khang (PvP Battle).
//
// ĐÂY LÀ LẦN ĐẦU TIÊN dự án dùng kết nối realtime (Socket.io) — trước đó toàn bộ
// API đều là REST thuần. Xac thuc TAI SU DUNG co che JWT session token noi bo hien
// co (`verifyAppToken` trong lib/jwt.ts) — KHONG tao co che auth rieng cho socket,
// dung theo dung dinh huong da ghi trong lib/jwt.ts:
//   "Du dung cho ca HTTP API lan Socket.io (PvP real-time) voi cung 1 co che."
//
// Client ket noi: `io('/battle', { auth: { token: sessionToken } })`.
import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer, type DefaultEventsMap, type Socket } from 'socket.io';
import { InvalidAppTokenError, verifyAppToken } from '../../lib/jwt.js';
import { prisma } from '../../lib/prisma.js';
import type { User } from '@prisma/client';
import { registerBattleEventHandlers } from './battle.engine.service.js';

/** Du lieu duoc gan vao `socket.data` sau khi xac thuc thanh cong. */
export interface BattleSocketData {
  user: User;
}

/**
 * Kieu socket da xac thuc (dung trong cac handler su kien). Cac su kien (event name +
 * payload) duoc dinh nghia rieng trong battle.types.ts va validate bang zod luc xu ly
 * (xem battle.engine.service.ts) - o day CHU Y DUNG DefaultEventsMap (khong ep kieu tung
 * su kien) de tranh TypeScript suy luan tham so `emit()`/`on()` ve kieu `never`.
 */
export type AuthenticatedBattleSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, BattleSocketData>;

/** Trich token tu handshake — uu tien `auth.token` (chuan Socket.io), fallback header Authorization. */
function extractHandshakeToken(socket: Socket): string | null {
  const authToken = socket.handshake.auth?.['token'];
  if (typeof authToken === 'string' && authToken.trim().length > 0) return authToken.trim();

  const header = socket.handshake.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    const token = header.slice('Bearer '.length).trim();
    if (token.length > 0) return token;
  }
  return null;
}

/**
 * Khoi tao Socket.io Server gan vao HTTP server hien co, dang ky namespace "/battle"
 * voi middleware xac thuc + wiring toan bo su kien game (join-queue, submit-answer...).
 */
export function registerBattleNamespace(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*' }, // giong cau hinh cors() mac dinh (allow all) dang dung cho REST API
  });

  const battleNamespace = io.of('/battle');

  battleNamespace.use(async (socket, next) => {
    try {
      const token = extractHandshakeToken(socket);
      if (!token) {
        next(new Error('MISSING_AUTH_TOKEN: Thieu session token.'));
        return;
      }

      let payload;
      try {
        payload = verifyAppToken(token);
      } catch (err) {
        if (err instanceof InvalidAppTokenError) {
          next(new Error(`INVALID_SESSION_TOKEN: ${err.message}`));
          return;
        }
        throw err;
      }

      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (!user) {
        next(new Error('SESSION_USER_NOT_FOUND: Khong tim thay tai khoan.'));
        return;
      }
      if (user.isBlocked) {
        next(new Error('USER_BLOCKED: Tai khoan da bi khoa.'));
        return;
      }

      (socket.data as BattleSocketData).user = user;
      next();
    } catch (err) {
      console.error('[battle.socket] Loi xac thuc khong xac dinh:', err);
      next(new Error('INTERNAL_ERROR: Loi he thong khi xac thuc.'));
    }
  });

  battleNamespace.on('connection', (socket) => {
    const authedSocket = socket as AuthenticatedBattleSocket;
    const user = authedSocket.data.user;
    console.log(`[battle.socket] User ${user.id} da ket noi (socket ${socket.id}).`);

    registerBattleEventHandlers(battleNamespace, authedSocket);

    socket.on('disconnect', (reason) => {
      console.log(`[battle.socket] User ${user.id} ngat ket noi (socket ${socket.id}, ly do: ${reason}).`);
    });
  });

  return io;
}
