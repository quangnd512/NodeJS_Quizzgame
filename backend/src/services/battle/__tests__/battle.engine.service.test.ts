// Test tự động cho tầng ĐIỀU PHỐI REALTIME (BattleEngine — battle.engine.service.ts).
//
// BỐI CẢNH (S8 trả lại yêu cầu bổ sung — xem workflow/handoff/PENDING/S3.md): trước vòng
// này CHỈ có test cho battle.match.service (thanh toán điểm), battle.queue.service (ghép
// cặp) và battle.utils (hàm thuần) — CHƯA có test nào cho battle.engine.service.ts, dù đây
// chính là nơi 5/11 bug S5 tìm thấy BẰNG TAY nằm ở đó: đếm 30s mất kết nối, đồng bộ giữa
// questionTimer (20.5s/câu) và disconnectTimer (30s), chặn 1 user vào 2 trận cùng lúc.
// Các test ở battle.match.service.test.ts (dòng có DISCONNECT_WIN/CANCELLED) chỉ test tầng
// THANH TOÁN sau khi outcome đã được xác định sẵn — KHÔNG test tầng QUYẾT ĐỊNH khi nào một
// outcome như vậy xảy ra, đó là lỗ hổng cụ thể mà file này lấp vào.
//
// CHIẾN LƯỢC: registerBattleEventHandlers() là điểm vào duy nhất được export (ngoài
// getActiveMatchSnapshot) — toàn bộ state (Map liveMatches, các timer) nằm private trong
// module. Thay vì export thêm nội bộ, ta giả lập tối thiểu 1 `Namespace` + các `Socket`
// (chỉ cần đúng những gì battle.engine.service.ts thực sự dùng: `id`, `data.user`,
// `on/emit/join`) và dùng `vi.useFakeTimers()` để điều khiển chính xác mốc 30s (mất kết
// nối) + 20.5s (hết giờ 1 câu) mà không phải chờ thật. Mock hoàn toàn battle.match.service.js
// (đã có test riêng ở battle.match.service.test.ts — ở đây chỉ cần biết nó ĐƯỢC GỌI đúng,
// không test lại logic DB/tiền bên trong) + prisma.user.findUnique (getDisplayName) +
// pointsService.getBalance (hiển thị số dư lúc kết thúc trận). KHÔNG mock battleQueueService
// — dùng thẳng singleton thật (thuần in-memory, không đụng DB) qua luồng tạo phòng/vào
// phòng (bỏ qua vòng lặp hàng đợi 1 giây để test đơn giản, dễ điều khiển hơn).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { User } from '@prisma/client';
import type { Namespace } from 'socket.io';

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

vi.mock('../../points/points.service.js', () => ({
  pointsService: {
    getBalance: vi.fn(),
  },
}));

vi.mock('../battle.match.service.js', () => ({
  assertSufficientPoints: vi.fn(),
  validateSubjectAndStake: vi.fn(),
  createAndStartMatch: vi.fn(),
  recordAnswer: vi.fn(),
  settleMatch: vi.fn(),
}));

import { prisma } from '../../../lib/prisma.js';
import { pointsService } from '../../points/points.service.js';
import {
  assertSufficientPoints,
  createAndStartMatch,
  recordAnswer,
  settleMatch,
} from '../battle.match.service.js';
import { registerBattleEventHandlers, getActiveMatchSnapshot } from '../battle.engine.service.js';
import type { AuthenticatedBattleSocket } from '../battle.socket.js';
import { BATTLE_DISCONNECT_GRACE_MS, BATTLE_QUESTION_TIME_LIMIT_MS } from '../battle.types.js';

const prismaMock = prisma as unknown as { user: { findUnique: ReturnType<typeof vi.fn> } };
const pointsMock = pointsService as unknown as { getBalance: ReturnType<typeof vi.fn> };
const assertSufficientPointsMock = assertSufficientPoints as unknown as ReturnType<typeof vi.fn>;
const createAndStartMatchMock = createAndStartMatch as unknown as ReturnType<typeof vi.fn>;
const recordAnswerMock = recordAnswer as unknown as ReturnType<typeof vi.fn>;
const settleMatchMock = settleMatch as unknown as ReturnType<typeof vi.fn>;

// ─── Hạ tầng giả lập Socket.io tối thiểu (chỉ đủ field registerBattleEventHandlers dùng tới) ──

interface FakeSocket {
  id: string;
  data: { user: User };
  rooms: Set<string>;
  emitted: Array<{ event: string; payload: unknown }>;
  on: (event: string, handler: (payload?: unknown) => void) => void;
  emit: (event: string, payload?: unknown) => void;
  join: (room: string) => void;
  trigger: (event: string, payload?: unknown) => void;
}

function makeUser(id: string): User {
  return { id, displayName: `Người dùng ${id}`, email: `${id}@test.local` } as User;
}

function makeFakeSocket(id: string, user: User): FakeSocket {
  const handlers = new Map<string, Array<(payload?: unknown) => void>>();
  const emitted: Array<{ event: string; payload: unknown }> = [];
  const rooms = new Set<string>();
  return {
    id,
    data: { user },
    rooms,
    emitted,
    on(event, handler) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
    emit(event, payload) {
      emitted.push({ event, payload });
    },
    join(room) {
      rooms.add(room);
    },
    trigger(event, payload) {
      for (const h of handlers.get(event) ?? []) h(payload);
    },
  };
}

function makeFakeNamespace() {
  const sockets = new Map<string, FakeSocket>();
  return {
    sockets,
    to(room: string) {
      return {
        emit(event: string, payload?: unknown) {
          for (const s of sockets.values()) {
            if (s.rooms.has(room)) s.emit(event, payload);
          }
        },
      };
    },
  };
}

type FakeNamespace = ReturnType<typeof makeFakeNamespace>;

function makeQuestions(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    questionBankId: `qb-${i}`,
    questionText: `Câu hỏi số ${i}?`,
    options: ['A', 'B', 'C', 'D'],
    correctOptionIndex: 0,
  }));
}

/** Xả hết microtask/promise đang chờ xử lý xong (KHÔNG chờ thật vì đang dùng fake timers). */
async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

function lastEventPayload(socket: FakeSocket, event: string): unknown {
  const found = [...socket.emitted].reverse().find((e) => e.event === event);
  return found?.payload;
}

function countEvent(socket: FakeSocket, event: string): number {
  return socket.emitted.filter((e) => e.event === event).length;
}

/**
 * Tạo 1 trận THẬT (2 người thật) qua luồng tạo-phòng/vào-phòng — luồng này gọi thẳng
 * `startRealMatch` (không phải chờ vòng lặp hàng đợi 1 giây) nên dễ điều khiển bằng
 * fake timers hơn, phù hợp mục tiêu test tầng disconnect/reconnect.
 */
async function setupRealMatch(
  namespace: FakeNamespace,
  opts: { matchId: string; userAId: string; userBId: string; questionCount?: number },
): Promise<{ socketA: FakeSocket; socketB: FakeSocket }> {
  const userA = makeUser(opts.userAId);
  const userB = makeUser(opts.userBId);
  const socketA = makeFakeSocket(`sock-${opts.userAId}`, userA);
  const socketB = makeFakeSocket(`sock-${opts.userBId}`, userB);
  namespace.sockets.set(socketA.id, socketA);
  namespace.sockets.set(socketB.id, socketB);

  registerBattleEventHandlers(namespace as unknown as Namespace, socketA as unknown as AuthenticatedBattleSocket);
  registerBattleEventHandlers(namespace as unknown as Namespace, socketB as unknown as AuthenticatedBattleSocket);

  createAndStartMatchMock.mockResolvedValueOnce({
    matchId: opts.matchId,
    questions: makeQuestions(opts.questionCount ?? 10),
  });

  socketA.trigger('battle:create-room', { subject: 'TOAN', stake: 100 });
  await flush();
  const roomCreated = lastEventPayload(socketA, 'battle:room-created') as { roomCode: string } | undefined;
  if (!roomCreated) throw new Error('battle:room-created không được emit - setup thất bại');

  socketB.trigger('battle:join-room', { roomCode: roomCreated.roomCode });
  await flush();

  if (!lastEventPayload(socketA, 'battle:match-found')) {
    throw new Error('battle:match-found không được emit - setup thất bại');
  }

  return { socketA, socketB };
}

describe('BattleEngineService — điều phối realtime (disconnect/reconnect/chặn trùng trận)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-27T00:00:00.000Z'));
    vi.clearAllMocks();
    prismaMock.user.findUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) => ({ id: where.id, displayName: `Người dùng ${where.id}`, email: null }),
    );
    assertSufficientPointsMock.mockResolvedValue(undefined);
    pointsMock.getBalance.mockResolvedValue({ currentPoints: 1000 });
    recordAnswerMock.mockResolvedValue(undefined);
    settleMatchMock.mockResolvedValue({ winnerId: null, status: 'COMPLETED' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── 1. Mất kết nối 1 bên, KHÔNG quay lại trong 30s -> xử thắng kỹ thuật ─────────────

  it('❌ Mất kết nối (player1) và KHÔNG reconnect trong 30s -> player2 được xử thắng kỹ thuật (OPPONENT_LEFT_WIN)', async () => {
    const namespace = makeFakeNamespace();
    const { socketA, socketB } = await setupRealMatch(namespace, {
      matchId: 'm-dc-1', userAId: 'u-dc1-a', userBId: 'u-dc1-b',
    });

    socketA.trigger('disconnect');
    await flush();

    expect(lastEventPayload(socketB, 'battle:opponent-disconnected')).toEqual({ gracePeriodSeconds: 30 });
    expect(settleMatchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(BATTLE_DISCONNECT_GRACE_MS + 100);

    expect(settleMatchMock).toHaveBeenCalledTimes(1);
    expect(settleMatchMock.mock.calls[0]![0]).toMatchObject({
      matchId: 'm-dc-1',
      outcome: { type: 'DISCONNECT_WIN', winnerIsPlayer1: false },
    });
    const ended = lastEventPayload(socketB, 'battle:match-ended') as { result: string; pointsChange: number };
    expect(ended.result).toBe('OPPONENT_LEFT_WIN');
    expect(ended.pointsChange).toBe(100);
    // Người đã mất kết nối (còn giữ socket cũ) KHÔNG nhận được sự kiện kết thúc (socketId đã bị gỡ về null).
    expect(countEvent(socketA, 'battle:match-ended')).toBe(0);
  });

  it('❌ Mất kết nối (player2) và KHÔNG reconnect trong 30s -> player1 được xử thắng kỹ thuật (kiểm tra chiều ngược lại của winnerIsPlayer1)', async () => {
    const namespace = makeFakeNamespace();
    const { socketA, socketB } = await setupRealMatch(namespace, {
      matchId: 'm-dc-2', userAId: 'u-dc2-a', userBId: 'u-dc2-b',
    });

    socketB.trigger('disconnect');
    await flush();
    await vi.advanceTimersByTimeAsync(BATTLE_DISCONNECT_GRACE_MS + 100);

    expect(settleMatchMock.mock.calls[0]![0]).toMatchObject({
      outcome: { type: 'DISCONNECT_WIN', winnerIsPlayer1: true },
    });
    const ended = lastEventPayload(socketA, 'battle:match-ended') as { result: string };
    expect(ended.result).toBe('OPPONENT_LEFT_WIN');
  });

  // ─── 2. Mất kết nối rồi RECONNECT trước 30s -> trận tiếp tục, không mất điểm, timer khởi động lại ──

  it('⚠️ Mất kết nối (player2) rồi reconnect TRƯỚC 30s -> KHÔNG xử thua, điểm đã tích lũy giữ nguyên, questionTimer được khởi động lại', async () => {
    const namespace = makeFakeNamespace();
    const { socketA, socketB } = await setupRealMatch(namespace, {
      matchId: 'm-rc-1', userAId: 'u-rc1-a', userBId: 'u-rc1-b', questionCount: 2,
    });

    // player1 (socketA) trả lời ĐÚNG câu 0 ngay lập tức (elapsedMs=0 -> 10 cơ bản + 3 bonus tốc độ = 13 điểm).
    socketA.trigger('battle:submit-answer', { matchId: 'm-rc-1', questionIndex: 0, selectedOption: 0 });
    await flush();
    const firstResult = lastEventPayload(socketA, 'battle:question-result') as { myTotalScore: number };
    expect(firstResult.myTotalScore).toBe(13);

    // player2 mất kết nối giữa chừng (chưa trả lời câu 0).
    socketB.trigger('disconnect');
    await flush();

    // Chờ 10s (< 30s grace) - CHƯA reconnect.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(settleMatchMock).not.toHaveBeenCalled();

    // player2 quay lại bằng 1 socket MỚI cùng user (giả lập tải lại trang/kết nối lại).
    const userB = socketB.data.user;
    const socketB2 = makeFakeSocket('sock-u-rc1-b-v2', userB);
    namespace.sockets.set(socketB2.id, socketB2);
    registerBattleEventHandlers(namespace as unknown as Namespace, socketB2 as unknown as AuthenticatedBattleSocket);
    await flush();

    // Điểm của player1 phải được giữ nguyên (không bị reset do đối thủ reconnect).
    const snapshotAfterReconnect = getActiveMatchSnapshot('u-rc1-a');
    expect(snapshotAfterReconnect?.myScore).toBe(13);
    expect(snapshotAfterReconnect?.opponentDisconnected).toBe(false);

    // Chờ THÊM cho đủ > 30s kể từ lúc mất kết nối ban đầu - KHÔNG được xử thua vì đã reconnect
    // (chứng minh đếm 30s đã bị huỷ đúng lúc, không chỉ "trì hoãn").
    await vi.advanceTimersByTimeAsync(BATTLE_DISCONNECT_GRACE_MS);
    expect(settleMatchMock).not.toHaveBeenCalled();

    // questionTimer phải được "khởi động lại" (fresh) lúc reconnect - không bị "treo" mãi mãi:
    // chờ đủ BATTLE_QUESTION_TIME_LIMIT_MS (+buffer) TÍNH TỪ LÚC RECONNECT sẽ tự động sang câu tiếp theo.
    await vi.advanceTimersByTimeAsync(BATTLE_QUESTION_TIME_LIMIT_MS + 600);
    const nextQuestion = lastEventPayload(socketB2, 'battle:question') as { questionIndex: number } | undefined;
    expect(nextQuestion?.questionIndex).toBe(1);
  });

  // ─── 3. questionTimer PHẢI tạm dừng trong lúc chờ 30s (bug #9 S5 tìm thấy bằng tay) ──────

  it('⚠️ Trong lúc chờ 30s mất kết nối, questionTimer KHÔNG được tự "nhảy câu" ở mốc 20.5s cũ (bug #9)', async () => {
    const namespace = makeFakeNamespace();
    const { socketA, socketB } = await setupRealMatch(namespace, {
      matchId: 'm-timer-1', userAId: 'u-t1-a', userBId: 'u-t1-b', questionCount: 3,
    });

    socketA.trigger('disconnect');
    await flush();

    // Vượt qua mốc giới hạn 1 câu (20s + buffer) NHƯNG vẫn còn trong 30s grace mất kết nối.
    await vi.advanceTimersByTimeAsync(BATTLE_QUESTION_TIME_LIMIT_MS + 600);

    // KHÔNG được có câu hỏi mới nào được gửi trong lúc này (vẫn đang chờ, chưa hết 30s).
    expect(countEvent(socketB, 'battle:question')).toBe(1); // chỉ 1 lần (lúc bắt đầu trận)
    expect(settleMatchMock).not.toHaveBeenCalled();

    // Chờ hết nốt 30s -> mới được xử thắng kỹ thuật (chứng minh disconnect timer vẫn chạy đúng độc lập).
    await vi.advanceTimersByTimeAsync(BATTLE_DISCONNECT_GRACE_MS);
    expect(settleMatchMock).toHaveBeenCalledTimes(1);
  });

  // ─── 4. Cả 2 cùng mất kết nối trong lúc chờ -> huỷ trận NGAY, không chờ hết 30s của bên thứ 2 ──

  it('❌ Cả 2 người cùng mất kết nối (bên thứ 2 mất kết nối khi bên 1 đang trong 30s chờ) -> huỷ trận NGAY LẬP TỨC (CANCELLED)', async () => {
    const namespace = makeFakeNamespace();
    const { socketA, socketB } = await setupRealMatch(namespace, {
      matchId: 'm-cancel-1', userAId: 'u-c1-a', userBId: 'u-c1-b',
    });

    socketA.trigger('disconnect');
    await flush();
    await vi.advanceTimersByTimeAsync(5_000); // mới trong grace, còn xa 30s

    socketB.trigger('disconnect');
    await flush(); // KHÔNG cần chờ thêm - phải huỷ NGAY, không chờ hết 30s của bên B.

    expect(settleMatchMock).toHaveBeenCalledTimes(1);
    expect(settleMatchMock.mock.calls[0]![0]).toMatchObject({ outcome: { type: 'CANCELLED' } });

    // Trận đã bị xoá khỏi bộ nhớ - không còn "active" cho ai cả.
    expect(getActiveMatchSnapshot('u-c1-a')).toBeNull();
    expect(getActiveMatchSnapshot('u-c1-b')).toBeNull();

    // Chờ hết phần 30s còn lại của cả 2 - KHÔNG được gọi settleMatch thêm lần nào nữa (chống huỷ 2 lần).
    await vi.advanceTimersByTimeAsync(BATTLE_DISCONNECT_GRACE_MS);
    expect(settleMatchMock).toHaveBeenCalledTimes(1);
  });

  // ─── 5. hasActiveMatch() chặn vào trận thứ 2 (bug #10 S5 tìm thấy bằng tay) ──────────────

  it('❌ User đang có 1 trận đang diễn ra -> bị chặn khi thử join-queue/create-room/join-room trận thứ 2 (BATTLE_ALREADY_IN_MATCH)', async () => {
    const namespace = makeFakeNamespace();
    const { socketA } = await setupRealMatch(namespace, {
      matchId: 'm-block-1', userAId: 'u-b1-a', userBId: 'u-b1-b',
    });

    socketA.trigger('battle:join-queue', { subject: 'TOAN', stake: 100 });
    await flush();
    let err = lastEventPayload(socketA, 'battle:error') as { code: string } | undefined;
    expect(err?.code).toBe('BATTLE_ALREADY_IN_MATCH');

    socketA.trigger('battle:create-room', { subject: 'TOAN', stake: 100 });
    await flush();
    err = lastEventPayload(socketA, 'battle:error') as { code: string } | undefined;
    expect(err?.code).toBe('BATTLE_ALREADY_IN_MATCH');

    // Mở 1 socket THỨ 2 (giả lập tab/thiết bị khác) cùng đúng user đang trong trận -> vào phòng cũng phải bị chặn.
    const userA = socketA.data.user;
    const socketA2 = makeFakeSocket('sock-u-b1-a-tab2', userA);
    namespace.sockets.set(socketA2.id, socketA2);
    registerBattleEventHandlers(namespace as unknown as Namespace, socketA2 as unknown as AuthenticatedBattleSocket);

    socketA2.trigger('battle:join-room', { roomCode: 'ZZZZZZ' });
    await flush();
    const err2 = lastEventPayload(socketA2, 'battle:error') as { code: string } | undefined;
    expect(err2?.code).toBe('BATTLE_ALREADY_IN_MATCH');

    // KHÔNG được tạo thêm trận nào cả (createAndStartMatch chỉ được gọi 1 lần lúc setup ban đầu).
    expect(createAndStartMatchMock).toHaveBeenCalledTimes(1);
  });
});
