// ============================================================================
// BattleQueueService — hang doi ghep tran IN-MEMORY tren process backend.
//
// QUAN TRONG: hang doi nay CHI hoat dong dung khi chay 1 instance backend duy
// nhat (dung voi cach deploy hien tai). Neu sau nay scale nhieu instance, can
// chuyen sang Redis/pub-sub - CHUA can lam viec do ngay bay gio.
//
// Thiet ke thuan (pure state container, KHONG tu dong "tick" - caller/engine
// chiu trach nhiem goi `tick(now)` dinh ky, vd. moi 1 giay bang setInterval)
// de de unit test (truyen `now` tuy y, khong phu thuoc dong ho thuc te).
// ============================================================================
import { BattleAlreadyInQueueError, BattleCannotJoinOwnRoomError, BattleNotInQueueError, BattleRoomNotFoundError } from './battle.errors.js';
import { canMatch, generateRoomCode, getQueueCriteria, shouldFallbackToBot } from './battle.utils.js';
import type { QueueCriteria } from './battle.types.js';

/** 1 nguoi dang cho trong hang doi ghep tran thuong. */
export interface WaitingPlayer {
  userId: string;
  socketId: string;
  subject: string;
  stake: number;
  /** Epoch ms luc vao hang doi - dung `now` truyen vao tu ben ngoai (de test duoc). */
  joinedAtMs: number;
}

/** 1 phong rieng (moi ban be) dang cho nguoi thu 2 vao bang ma. */
export interface PendingRoom {
  roomCode: string;
  creatorUserId: string;
  creatorSocketId: string;
  subject: string;
  stake: number;
  createdAtMs: number;
}

/** Trang thai hang doi cua 1 nguoi choi - dung de emit `battle:queue-status`. */
export interface QueueStatusUpdate {
  player: WaitingPlayer;
  waitingSeconds: number;
  criteria: QueueCriteria;
}

/** Ket qua 1 lan "tick" hang doi - engine dua vao day de tao tran / bao trang thai. */
export interface QueueTickResult {
  /** Cac cap da du dieu kien ghep voi nhau ngay bay gio (da bi loai khoi hang doi). */
  matchedPairs: Array<[WaitingPlayer, WaitingPlayer]>;
  /** Nguoi cho >= 30s ma khong ghep duoc ai - can tao tran voi bot (da bi loai khoi hang doi). */
  botFallbacks: WaitingPlayer[];
  /** Nguoi con lai trong hang doi sau tick nay - dung de emit cap nhat dem gio. */
  statusUpdates: QueueStatusUpdate[];
}

export class BattleQueueService {
  private waiting: WaitingPlayer[] = [];
  private roomsByCode = new Map<string, PendingRoom>();

  // --------------------------------------------------------------------
  // Hang doi thuong (ghep ngau nhien, noi long tieu chi theo thoi gian)
  // --------------------------------------------------------------------

  /** Them 1 nguoi vao hang doi. @throws BattleAlreadyInQueueError neu userId da co trong hang doi. */
  public join(player: WaitingPlayer): void {
    if (this.waiting.some((p) => p.userId === player.userId)) {
      throw new BattleAlreadyInQueueError();
    }
    this.waiting.push(player);
  }

  /** Huy tim tran, roi khoi hang doi. @throws BattleNotInQueueError neu khong (con) trong hang doi. */
  public cancel(userId: string): WaitingPlayer {
    const idx = this.waiting.findIndex((p) => p.userId === userId);
    if (idx === -1) throw new BattleNotInQueueError();
    return this.waiting.splice(idx, 1)[0]!;
  }

  /** Xoa 1 nguoi khoi hang doi theo socketId - dung khi socket ngat ket noi giua luc dang cho (khong nem loi neu khong tim thay). */
  public removeBySocketId(socketId: string): WaitingPlayer | null {
    const idx = this.waiting.findIndex((p) => p.socketId === socketId);
    if (idx === -1) return null;
    return this.waiting.splice(idx, 1)[0]!;
  }

  public isWaiting(userId: string): boolean {
    return this.waiting.some((p) => p.userId === userId);
  }

  public get waitingCount(): number {
    return this.waiting.length;
  }

  /**
   * Xu ly 1 "nhip" cua hang doi tai thoi diem `nowMs`:
   *   1. Ai da cho >= 30s ma chua ghep duoc -> "vot" ra ghep bot.
   *   2. Trong so con lai, ghep cap dau tien thoa dieu kien noi long cua CA HAI ben.
   *   3. Ai con lai (chua ghep, chua qua 30s) -> tra ve de emit cap nhat dem gio.
   *
   * Tat ca nguoi da duoc ghep/vot bot deu bi loai khoi hang doi ngay trong lan goi nay.
   */
  public tick(nowMs: number): QueueTickResult {
    const withWait = this.waiting.map((p) => ({ p, waitedSeconds: (nowMs - p.joinedAtMs) / 1000 }));

    const botFallbacks: WaitingPlayer[] = [];
    const remaining: typeof withWait = [];
    for (const item of withWait) {
      if (shouldFallbackToBot(item.waitedSeconds)) botFallbacks.push(item.p);
      else remaining.push(item);
    }

    const matchedPairs: Array<[WaitingPlayer, WaitingPlayer]> = [];
    const usedIndices = new Set<number>();
    for (let i = 0; i < remaining.length; i++) {
      if (usedIndices.has(i)) continue;
      for (let j = i + 1; j < remaining.length; j++) {
        if (usedIndices.has(j)) continue;
        const a = remaining[i]!;
        const b = remaining[j]!;
        if (canMatch({ ...a.p, waitedSeconds: a.waitedSeconds }, { ...b.p, waitedSeconds: b.waitedSeconds })) {
          matchedPairs.push([a.p, b.p]);
          usedIndices.add(i);
          usedIndices.add(j);
          break;
        }
      }
    }

    const statusUpdates: QueueStatusUpdate[] = remaining
      .filter((_, idx) => !usedIndices.has(idx))
      .map(({ p, waitedSeconds }) => ({
        player: p,
        waitingSeconds: Math.floor(waitedSeconds),
        criteria: getQueueCriteria(waitedSeconds),
      }));

    const removedUserIds = new Set<string>([
      ...botFallbacks.map((p) => p.userId),
      ...matchedPairs.flatMap(([a, b]) => [a.userId, b.userId]),
    ]);
    if (removedUserIds.size > 0) {
      this.waiting = this.waiting.filter((p) => !removedUserIds.has(p.userId));
    }

    return { matchedPairs, botFallbacks, statusUpdates };
  }

  // --------------------------------------------------------------------
  // Phong rieng (moi ban be qua ma 6 ky tu) - BO QUA hang doi thuong
  // --------------------------------------------------------------------

  /** Tao 1 phong rieng, tra ve ma phong 6 ky tu (dam bao khong trung voi phong dang cho khac). */
  public createRoom(creatorUserId: string, creatorSocketId: string, subject: string, stake: number, nowMs: number): string {
    let roomCode = generateRoomCode();
    while (this.roomsByCode.has(roomCode)) {
      roomCode = generateRoomCode();
    }
    this.roomsByCode.set(roomCode, { roomCode, creatorUserId, creatorSocketId, subject, stake, createdAtMs: nowMs });
    return roomCode;
  }

  /**
   * Vao 1 phong rieng bang ma - neu hop le se XOA phong khoi danh sach cho (chi 2 nguoi/phong)
   * va tra ve thong tin phong (bao gom nguoi tao) de engine bat dau tran ngay.
   *
   * @throws BattleRoomNotFoundError neu ma khong ton tai (chua tung tao / da bi dung / da huy)
   * @throws BattleCannotJoinOwnRoomError neu tu vao phong cua chinh minh
   */
  public joinRoom(roomCode: string, joinerUserId: string): PendingRoom {
    const room = this.roomsByCode.get(roomCode);
    if (!room) throw new BattleRoomNotFoundError(roomCode);
    if (room.creatorUserId === joinerUserId) throw new BattleCannotJoinOwnRoomError();

    this.roomsByCode.delete(roomCode);
    return room;
  }

  /** Xoa phong theo socketId cua nguoi tao - dung khi ho ngat ket noi truoc khi co ai vao (tranh ro ri bo nho). */
  public removeRoomByCreatorSocketId(socketId: string): void {
    for (const [code, room] of this.roomsByCode) {
      if (room.creatorSocketId === socketId) {
        this.roomsByCode.delete(code);
        return;
      }
    }
  }

  public get pendingRoomCount(): number {
    return this.roomsByCode.size;
  }
}

/** Instance dung chung (singleton) cho toan bo backend - hang doi la trang thai TOAN CUC tren 1 process. */
export const battleQueueService = new BattleQueueService();
