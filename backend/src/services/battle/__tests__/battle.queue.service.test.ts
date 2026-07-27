// Unit test cho BattleQueueService — hang doi ghep tran in-memory + phong rieng.
// Khong dung dong ho thuc, luon truyen `now` (epoch ms) tuy y de kiem soat thoi gian.
import { describe, expect, it, beforeEach } from 'vitest';
import { BattleQueueService, type WaitingPlayer } from '../battle.queue.service.js';
import {
  BattleAlreadyInQueueError,
  BattleCannotJoinOwnRoomError,
  BattleNotInQueueError,
  BattleRoomNotFoundError,
} from '../battle.errors.js';

const T0 = 1_700_000_000_000; // moc thoi gian co dinh bat ky

function makePlayer(overrides: Partial<WaitingPlayer> = {}): WaitingPlayer {
  return {
    userId: 'user-1',
    socketId: 'socket-1',
    subject: 'TOAN',
    stake: 100,
    joinedAtMs: T0,
    ...overrides,
  };
}

describe('BattleQueueService — hang doi thuong', () => {
  let queue: BattleQueueService;

  beforeEach(() => {
    queue = new BattleQueueService();
  });

  it('✅ Happy: 2 nguoi cung mon+cuoc vao cung luc -> ghep ngay trong tick dau tien (< 10 giay)', () => {
    queue.join(makePlayer({ userId: 'A', socketId: 'sA', joinedAtMs: T0 }));
    queue.join(makePlayer({ userId: 'B', socketId: 'sB', joinedAtMs: T0 }));

    const result = queue.tick(T0 + 2_000);

    expect(result.matchedPairs).toHaveLength(1);
    const [a, b] = result.matchedPairs[0]!;
    expect([a.userId, b.userId].sort()).toEqual(['A', 'B']);
    expect(result.botFallbacks).toHaveLength(0);
    expect(queue.waitingCount).toBe(0);
  });

  it('❌ Error: khac mon, chua toi 10s -> khong ghep, van cho trong hang doi', () => {
    queue.join(makePlayer({ userId: 'A', socketId: 'sA', subject: 'TOAN', joinedAtMs: T0 }));
    queue.join(makePlayer({ userId: 'B', socketId: 'sB', subject: 'VAN', joinedAtMs: T0 }));

    const result = queue.tick(T0 + 5_000);

    expect(result.matchedPairs).toHaveLength(0);
    expect(result.statusUpdates).toHaveLength(2);
    expect(queue.waitingCount).toBe(2);
  });

  it('✅ Happy: khac mon nhung ca 2 da cho du 20s (ANY) -> ghep duoc', () => {
    queue.join(makePlayer({ userId: 'A', socketId: 'sA', subject: 'TOAN', stake: 100, joinedAtMs: T0 }));
    queue.join(makePlayer({ userId: 'B', socketId: 'sB', subject: 'VAN', stake: 500, joinedAtMs: T0 }));

    const result = queue.tick(T0 + 21_000);

    expect(result.matchedPairs).toHaveLength(1);
  });

  it('✅ Happy: cho du 30s ma khong co ai -> tu dong roi vao botFallbacks, bi loai khoi hang doi', () => {
    queue.join(makePlayer({ userId: 'A', socketId: 'sA', joinedAtMs: T0 }));

    const result = queue.tick(T0 + 30_000);

    expect(result.botFallbacks).toHaveLength(1);
    expect(result.botFallbacks[0]!.userId).toBe('A');
    expect(queue.waitingCount).toBe(0);
  });

  it('Bien: nguoi moi vao (chua toi 30s) khong bi anh huong boi nguoi da qua 30s trong cung 1 tick', () => {
    queue.join(makePlayer({ userId: 'OLD', socketId: 'sOld', joinedAtMs: T0 })); // se qua 30s
    queue.join(makePlayer({ userId: 'NEW', socketId: 'sNew', joinedAtMs: T0 + 29_000 })); // moi cho 1s

    const result = queue.tick(T0 + 30_000);

    expect(result.botFallbacks.map((p) => p.userId)).toEqual(['OLD']);
    expect(result.statusUpdates.map((s) => s.player.userId)).toEqual(['NEW']);
    expect(queue.waitingCount).toBe(1);
  });

  it('❌ Error: vao hang doi 2 lan lien tiep (cung userId) -> nem BattleAlreadyInQueueError', () => {
    queue.join(makePlayer({ userId: 'A' }));
    expect(() => queue.join(makePlayer({ userId: 'A' }))).toThrow(BattleAlreadyInQueueError);
  });

  it('✅ Happy: huy hang doi thanh cong -> khong con trong hang doi, tick sau khong ghep/bot fallback', () => {
    queue.join(makePlayer({ userId: 'A', joinedAtMs: T0 }));
    const cancelled = queue.cancel('A');
    expect(cancelled.userId).toBe('A');
    expect(queue.waitingCount).toBe(0);

    const result = queue.tick(T0 + 60_000);
    expect(result.botFallbacks).toHaveLength(0);
  });

  it('❌ Error: huy hang doi khi khong (con) trong hang doi -> nem BattleNotInQueueError', () => {
    expect(() => queue.cancel('khong-ton-tai')).toThrow(BattleNotInQueueError);
  });

  it('🔒 Memory-leak guard: socket ngat ket noi giua luc cho -> removeBySocketId don dep khoi hang doi', () => {
    queue.join(makePlayer({ userId: 'A', socketId: 'sA', joinedAtMs: T0 }));
    const removed = queue.removeBySocketId('sA');
    expect(removed?.userId).toBe('A');
    expect(queue.waitingCount).toBe(0);

    // Goi lai lan nua (vd. disconnect event ban hai lan) khong duoc crash, tra ve null.
    expect(queue.removeBySocketId('sA')).toBeNull();
  });

  it('vao roi ra lien tuc nhieu lan khong lam hang doi phinh to (khong ro ri bo nho)', () => {
    for (let i = 0; i < 20; i++) {
      queue.join(makePlayer({ userId: `U${i}`, socketId: `S${i}`, joinedAtMs: T0 }));
      queue.cancel(`U${i}`);
    }
    expect(queue.waitingCount).toBe(0);
  });
});

describe('BattleQueueService — phong rieng (moi ban be)', () => {
  let queue: BattleQueueService;

  beforeEach(() => {
    queue = new BattleQueueService();
  });

  it('✅ Happy: tao phong -> nhan ma 6 ky tu; nguoi khac vao dung ma -> nhan duoc thong tin phong, phong bi xoa khoi danh sach cho', () => {
    const code = queue.createRoom('creator', 'sCreator', 'TOAN', 200, T0);
    expect(code).toHaveLength(6);
    expect(queue.pendingRoomCount).toBe(1);

    const room = queue.joinRoom(code, 'joiner');
    expect(room.creatorUserId).toBe('creator');
    expect(room.subject).toBe('TOAN');
    expect(room.stake).toBe(200);
    expect(queue.pendingRoomCount).toBe(0);
  });

  it('❌ Error: vao ma phong khong ton tai -> nem BattleRoomNotFoundError', () => {
    expect(() => queue.joinRoom('ZZZZZZ', 'joiner')).toThrow(BattleRoomNotFoundError);
  });

  it('❌ Error: tu vao phong cua chinh minh -> nem BattleCannotJoinOwnRoomError, phong KHONG bi xoa', () => {
    const code = queue.createRoom('creator', 'sCreator', 'TOAN', 200, T0);
    expect(() => queue.joinRoom(code, 'creator')).toThrow(BattleCannotJoinOwnRoomError);
    expect(queue.pendingRoomCount).toBe(1);
  });

  it('❌ Error: ma phong da duoc dung 1 lan -> lan thu 2 bao khong tim thay (khong dung lai duoc)', () => {
    const code = queue.createRoom('creator', 'sCreator', 'TOAN', 200, T0);
    queue.joinRoom(code, 'joiner1');
    expect(() => queue.joinRoom(code, 'joiner2')).toThrow(BattleRoomNotFoundError);
  });

  it('🔒 Memory-leak guard: nguoi tao phong ngat ket noi truoc khi co ai vao -> phong bi don dep', () => {
    queue.createRoom('creator', 'sCreator', 'TOAN', 200, T0);
    queue.removeRoomByCreatorSocketId('sCreator');
    expect(queue.pendingRoomCount).toBe(0);
  });
});
