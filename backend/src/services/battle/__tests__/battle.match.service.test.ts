// Unit test cho BattleMatchService — trọng tâm phần TIỀN BẠC (khoá cược/thanh toán,
// atomic transaction, chống thanh toán 2 lần) và getBattleHistory (tính đúng
// WIN/LOSE/DRAW từ `winnerId` cho trận thắng kỹ thuật do đối thủ mất kết nối —
// KHÔNG được suy từ so sánh điểm số đơn thuần, xem giải thích trong code).
// Mock Prisma + pointsService hoàn toàn, không cần DB thật — cùng pattern với
// submission.service.test.ts (mock `$transaction` bằng cách gọi thẳng callback
// với 1 `txMock`).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    battleMatch: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
    },
    questionBank: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../points/points.service.js', () => ({
  pointsService: {
    getBalance: vi.fn(),
    deductPointsInTx: vi.fn(),
    addPointsInTx: vi.fn(),
  },
}));

import { prisma } from '../../../lib/prisma.js';
import { pointsService } from '../../points/points.service.js';
import { PointsInsufficientError, OptimisticLockRetryableError, OptimisticLockError } from '../../points/points.errors.js';
import {
  createAndStartMatch,
  settleMatch,
  getBattleHistory,
  validateSubjectAndStake,
  assertSufficientPoints,
  selectMatchQuestions,
} from '../battle.match.service.js';
import { pickBotDisplayName } from '../battle.utils.js';
import {
  BattleInsufficientPointsError,
  BattleInvalidStakeError,
  BattleInvalidSubjectError,
  BattleMatchNotInProgressError,
  BattleNotEnoughQuestionsError,
} from '../battle.errors.js';

const mock = prisma as unknown as {
  battleMatch: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  questionBank: { findMany: ReturnType<typeof vi.fn> };
  user: { findMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

const pointsMock = pointsService as unknown as {
  getBalance: ReturnType<typeof vi.fn>;
  deductPointsInTx: ReturnType<typeof vi.fn>;
  addPointsInTx: ReturnType<typeof vi.fn>;
};

/** questionBank giả — dùng riêng cho các test gọi tới selectMatchQuestions bên trong createAndStartMatch. */
function makeQuestionPool(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `q-${i}`,
    questionText: `Câu ${i}?`,
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 0,
  }));
}

describe('BattleMatchService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── validateSubjectAndStake ────────────────────────────────────────────

  describe('validateSubjectAndStake', () => {
    it('✅ Happy: subject + stake hợp lệ -> không throw', () => {
      expect(() => validateSubjectAndStake('TOAN', 100)).not.toThrow();
    });

    it('❌ Error: subject không nằm trong SUBJECT_CATALOG', () => {
      expect(() => validateSubjectAndStake('KHONG_TON_TAI', 100)).toThrow(BattleInvalidSubjectError);
    });

    it('❌ Error: stake không nằm trong [50,100,200,500]', () => {
      expect(() => validateSubjectAndStake('TOAN', 999)).toThrow(BattleInvalidStakeError);
    });
  });

  // ─── assertSufficientPoints ─────────────────────────────────────────────

  describe('assertSufficientPoints', () => {
    it('✅ Happy: đủ điểm -> không throw', async () => {
      pointsMock.getBalance.mockResolvedValue({ currentPoints: 500 });
      await expect(assertSufficientPoints('user-1', 100)).resolves.toBeUndefined();
    });

    it('❌ Error: không đủ điểm -> throw BattleInsufficientPointsError', async () => {
      pointsMock.getBalance.mockResolvedValue({ currentPoints: 40 });
      await expect(assertSufficientPoints('user-1', 100)).rejects.toThrow(BattleInsufficientPointsError);
    });

    it('⚠️ Edge: đúng bằng stake (biên) -> không throw', async () => {
      pointsMock.getBalance.mockResolvedValue({ currentPoints: 100 });
      await expect(assertSufficientPoints('user-1', 100)).resolves.toBeUndefined();
    });
  });

  // ─── selectMatchQuestions ───────────────────────────────────────────────

  describe('selectMatchQuestions', () => {
    it('❌ Error: không đủ 10 câu MCQ_4 active -> throw BattleNotEnoughQuestionsError, KHÔNG đụng transaction/điểm', async () => {
      mock.questionBank.findMany.mockResolvedValue(makeQuestionPool(5)); // chỉ 5 < 10
      await expect(selectMatchQuestions('TOAN')).rejects.toThrow(BattleNotEnoughQuestionsError);
      expect(mock.$transaction).not.toHaveBeenCalled();
    });
  });

  // ─── createAndStartMatch ────────────────────────────────────────────────

  describe('createAndStartMatch', () => {
    function setupQuestionPool() {
      mock.questionBank.findMany.mockResolvedValue(makeQuestionPool(20));
    }

    it('✅ Happy: người thật vs người thật -> tạo match + khoá cược CẢ 2 + status IN_PROGRESS, TRONG 1 transaction duy nhất', async () => {
      setupQuestionPool();
      const txMock = {
        battleMatch: {
          create: vi.fn().mockResolvedValue({ id: 'match-1' }),
          update: vi.fn().mockResolvedValue({}),
        },
      };
      mock.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));
      pointsMock.deductPointsInTx.mockResolvedValue(undefined);

      const result = await createAndStartMatch({
        subject: 'TOAN',
        stake: 100,
        player1Id: 'p1',
        player2Id: 'p2',
        isBotMatch: false,
      });

      expect(result.matchId).toBe('match-1');
      expect(result.questions).toHaveLength(10);
      expect(txMock.battleMatch.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'WAITING', player1Id: 'p1', player2Id: 'p2' }) }),
      );
      expect(pointsMock.deductPointsInTx).toHaveBeenCalledTimes(2);
      expect(pointsMock.deductPointsInTx).toHaveBeenNthCalledWith(
        1, txMock, 'p1', 100, 'PVP_LOCK_BET', expect.objectContaining({ matchId: 'match-1' }),
      );
      expect(pointsMock.deductPointsInTx).toHaveBeenNthCalledWith(
        2, txMock, 'p2', 100, 'PVP_LOCK_BET', expect.objectContaining({ matchId: 'match-1' }),
      );
      expect(txMock.battleMatch.update).toHaveBeenCalledWith({ where: { id: 'match-1' }, data: { status: 'IN_PROGRESS' } });
    });

    it('✅ Happy: trận với bot -> CHỈ khoá cược player1, KHÔNG đụng player2 (null)', async () => {
      setupQuestionPool();
      const txMock = {
        battleMatch: { create: vi.fn().mockResolvedValue({ id: 'match-bot' }), update: vi.fn().mockResolvedValue({}) },
      };
      mock.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));
      pointsMock.deductPointsInTx.mockResolvedValue(undefined);

      const result = await createAndStartMatch({
        subject: 'TOAN', stake: 50, player1Id: 'p1', player2Id: null, isBotMatch: true,
      });

      expect(result.matchId).toBe('match-bot');
      expect(pointsMock.deductPointsInTx).toHaveBeenCalledTimes(1);
      expect(pointsMock.deductPointsInTx).toHaveBeenCalledWith(txMock, 'p1', 50, 'PVP_LOCK_BET', expect.anything());
    });

    it('❌ Error: player2 không đủ điểm -> BattleInsufficientPointsError, KHÔNG "chốt" status IN_PROGRESS (transaction coi như thất bại toàn bộ)', async () => {
      setupQuestionPool();
      const txMock = {
        battleMatch: { create: vi.fn().mockResolvedValue({ id: 'match-2' }), update: vi.fn().mockResolvedValue({}) },
      };
      mock.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));
      pointsMock.deductPointsInTx
        .mockResolvedValueOnce(undefined) // player1 OK
        .mockRejectedValueOnce(new PointsInsufficientError('p2', 100, 30)); // player2 thiếu điểm

      await expect(
        createAndStartMatch({ subject: 'TOAN', stake: 100, player1Id: 'p1', player2Id: 'p2', isBotMatch: false }),
      ).rejects.toThrow(BattleInsufficientPointsError);

      // Khong duoc "chot" trang thai IN_PROGRESS khi khoa cuoc that bai giua chung.
      expect(txMock.battleMatch.update).not.toHaveBeenCalled();
    });

    it('❌ Error: optimistic lock retryable -> thử lại rồi thành công (không lộ lỗi retry ra ngoài)', async () => {
      setupQuestionPool();
      const txMock = {
        battleMatch: { create: vi.fn().mockResolvedValue({ id: 'match-3' }), update: vi.fn().mockResolvedValue({}) },
      };
      let call = 0;
      mock.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) => {
        call += 1;
        if (call === 1) throw new OptimisticLockRetryableError();
        return cb(txMock);
      });
      pointsMock.deductPointsInTx.mockResolvedValue(undefined);

      const result = await createAndStartMatch({
        subject: 'TOAN', stake: 100, player1Id: 'p1', player2Id: 'p2', isBotMatch: false,
      });
      expect(result.matchId).toBe('match-3');
      expect(mock.$transaction).toHaveBeenCalledTimes(2);
    });
  });

  // ─── settleMatch ────────────────────────────────────────────────────────

  describe('settleMatch', () => {
    function txMockWithClose(count = 1) {
      return {
        battleMatch: { updateMany: vi.fn().mockResolvedValue({ count }) },
      };
    }

    it('✅ Happy: NORMAL — player1 thắng người thật -> +2*stake cho player1, winnerId=player1, status COMPLETED', async () => {
      const txMock = txMockWithClose();
      mock.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));
      pointsMock.addPointsInTx.mockResolvedValue(undefined);

      const result = await settleMatch({
        matchId: 'm1', player1Id: 'p1', player2Id: 'p2', isBotMatch: false, stake: 100,
        player1Score: 80, player2Score: 50, outcome: { type: 'NORMAL' },
      });

      expect(result).toEqual({ winnerId: 'p1', status: 'COMPLETED' });
      expect(pointsMock.addPointsInTx).toHaveBeenCalledTimes(1);
      expect(pointsMock.addPointsInTx).toHaveBeenCalledWith(txMock, 'p1', 200, 'PVP_WIN', expect.anything());
      expect(txMock.battleMatch.updateMany).toHaveBeenCalledWith({
        where: { id: 'm1', status: 'IN_PROGRESS' },
        data: { status: 'COMPLETED', winnerId: 'p1', player1Score: 80, player2Score: 50, completedAt: expect.any(Date) },
      });
    });

    it('✅ Happy: NORMAL — hoà giữa 2 người thật -> hoàn CẢ 2, winnerId=null', async () => {
      const txMock = txMockWithClose();
      mock.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));
      pointsMock.addPointsInTx.mockResolvedValue(undefined);

      const result = await settleMatch({
        matchId: 'm2', player1Id: 'p1', player2Id: 'p2', isBotMatch: false, stake: 100,
        player1Score: 60, player2Score: 60, outcome: { type: 'NORMAL' },
      });

      expect(result.winnerId).toBeNull();
      expect(pointsMock.addPointsInTx).toHaveBeenCalledTimes(2);
      expect(pointsMock.addPointsInTx).toHaveBeenCalledWith(txMock, 'p1', 100, 'PVP_DRAW_REFUND', expect.anything());
      expect(pointsMock.addPointsInTx).toHaveBeenCalledWith(txMock, 'p2', 100, 'PVP_DRAW_REFUND', expect.anything());
    });

    it('⚠️ Edge: NORMAL — thua BOT (player2Score > player1Score, isBotMatch) -> KHÔNG addPointsInTx nào cả, winnerId=null (bot không có ví)', async () => {
      const txMock = txMockWithClose();
      mock.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));

      const result = await settleMatch({
        matchId: 'm3', player1Id: 'p1', player2Id: null, isBotMatch: true, stake: 100,
        player1Score: 30, player2Score: 90, outcome: { type: 'NORMAL' },
      });

      expect(result.winnerId).toBeNull();
      expect(pointsMock.addPointsInTx).not.toHaveBeenCalled();
    });

    it('⚠️ Edge: NORMAL — thắng BOT -> +2*stake cho player1, winnerId=player1', async () => {
      const txMock = txMockWithClose();
      mock.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));
      pointsMock.addPointsInTx.mockResolvedValue(undefined);

      const result = await settleMatch({
        matchId: 'm4', player1Id: 'p1', player2Id: null, isBotMatch: true, stake: 100,
        player1Score: 90, player2Score: 30, outcome: { type: 'NORMAL' },
      });

      expect(result.winnerId).toBe('p1');
      expect(pointsMock.addPointsInTx).toHaveBeenCalledWith(txMock, 'p1', 200, 'PVP_WIN', expect.anything());
    });

    it('✅ Happy: DISCONNECT_WIN — xử thắng kỹ thuật cho người còn lại, BẤT KỂ điểm số lúc đó', async () => {
      const txMock = txMockWithClose();
      mock.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));
      pointsMock.addPointsInTx.mockResolvedValue(undefined);

      // player1 đang DẪN điểm nhưng chính player1 lại là người mất kết nối -> player2 thắng.
      const result = await settleMatch({
        matchId: 'm5', player1Id: 'p1', player2Id: 'p2', isBotMatch: false, stake: 100,
        player1Score: 90, player2Score: 20, outcome: { type: 'DISCONNECT_WIN', winnerIsPlayer1: false },
      });

      expect(result.winnerId).toBe('p2');
      expect(pointsMock.addPointsInTx).toHaveBeenCalledWith(
        txMock, 'p2', 200, 'PVP_WIN', expect.objectContaining({ viaDisconnect: true }),
      );
    });

    it('✅ Happy: CANCELLED — hoàn cược CẢ 2 người thật, status ABANDONED', async () => {
      const txMock = txMockWithClose();
      mock.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));
      pointsMock.addPointsInTx.mockResolvedValue(undefined);

      const result = await settleMatch({
        matchId: 'm6', player1Id: 'p1', player2Id: 'p2', isBotMatch: false, stake: 100,
        player1Score: 10, player2Score: 20, outcome: { type: 'CANCELLED' },
      });

      expect(result).toEqual({ winnerId: null, status: 'ABANDONED' });
      expect(pointsMock.addPointsInTx).toHaveBeenCalledTimes(2);
      expect(pointsMock.addPointsInTx).toHaveBeenCalledWith(txMock, 'p1', 100, 'PVP_CANCELLED_REFUND', expect.anything());
      expect(pointsMock.addPointsInTx).toHaveBeenCalledWith(txMock, 'p2', 100, 'PVP_CANCELLED_REFUND', expect.anything());
      expect(txMock.battleMatch.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'ABANDONED' }) }),
      );
    });

    it('❌ Race condition: settleMatch bị gọi 2 lần cho CÙNG 1 trận -> lần 2 nhận count=0 -> throw BattleMatchNotInProgressError (chống trả điểm 2 lần)', async () => {
      const txMock = txMockWithClose(0); // "claim" thất bại — trận đã được chốt bởi lần gọi khác
      mock.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));
      pointsMock.addPointsInTx.mockResolvedValue(undefined);

      await expect(
        settleMatch({
          matchId: 'm7', player1Id: 'p1', player2Id: 'p2', isBotMatch: false, stake: 100,
          player1Score: 80, player2Score: 50, outcome: { type: 'NORMAL' },
        }),
      ).rejects.toThrow(BattleMatchNotInProgressError);
    });

    it('❌ Error: hết lượt retry optimistic lock -> throw OptimisticLockError', async () => {
      mock.$transaction.mockImplementation(async () => {
        throw new OptimisticLockRetryableError();
      });

      await expect(
        settleMatch({
          matchId: 'm8', player1Id: 'p1', player2Id: 'p2', isBotMatch: false, stake: 100,
          player1Score: 80, player2Score: 50, outcome: { type: 'NORMAL' },
        }),
      ).rejects.toThrow(OptimisticLockError);
    }, 10_000);
  });

  // ─── getBattleHistory ───────────────────────────────────────────────────

  describe('getBattleHistory', () => {
    it('✅ Happy: trận người thật vs người thật, thắng bình thường -> result=WIN lấy từ winnerId, pointsChange=+stake', async () => {
      mock.battleMatch.findMany.mockResolvedValue([
        {
          id: 'h1', subject: 'TOAN', stake: 100, isBotMatch: false,
          player1Id: 'me', player2Id: 'opp', player1Score: 80, player2Score: 50,
          winnerId: 'me', completedAt: new Date('2026-07-20T00:00:00Z'), createdAt: new Date('2026-07-20T00:00:00Z'),
        },
      ]);
      mock.battleMatch.count.mockResolvedValue(1);
      mock.user.findMany.mockResolvedValue([{ id: 'opp', displayName: 'Đối thủ', email: null }]);

      const result = await getBattleHistory('me', 20, 0);
      expect(result.items[0]!.result).toBe('WIN');
      expect(result.items[0]!.pointsChange).toBe(100);
    });

    it('⚠️ Edge (bug đã sửa): trận kết thúc do đối thủ mất kết nối (thắng kỹ thuật) — điểm số THẤP HƠN đối thủ nhưng vẫn phải hiện WIN vì winnerId=mình (KHÔNG được suy từ so sánh điểm số)', async () => {
      mock.battleMatch.findMany.mockResolvedValue([
        {
          id: 'h2', subject: 'TOAN', stake: 100, isBotMatch: false,
          player1Id: 'me', player2Id: 'opp',
          player1Score: 20, player2Score: 90, // mình đang thua điểm...
          winnerId: 'me', // ...nhưng thắng kỹ thuật vì đối thủ mất kết nối
          completedAt: new Date('2026-07-20T00:00:00Z'), createdAt: new Date('2026-07-20T00:00:00Z'),
        },
      ]);
      mock.battleMatch.count.mockResolvedValue(1);
      mock.user.findMany.mockResolvedValue([{ id: 'opp', displayName: 'Đối thủ', email: null }]);

      const result = await getBattleHistory('me', 20, 0);
      expect(result.items[0]!.result).toBe('WIN');
      expect(result.items[0]!.pointsChange).toBe(100);
    });

    it('⚠️ Edge (bug đã sửa): thua kỹ thuật dù điểm số CAO HƠN đối thủ -> vẫn phải hiện LOSE theo winnerId', async () => {
      mock.battleMatch.findMany.mockResolvedValue([
        {
          id: 'h3', subject: 'TOAN', stake: 100, isBotMatch: false,
          player1Id: 'me', player2Id: 'opp',
          player1Score: 90, player2Score: 20, // mình đang dẫn điểm...
          winnerId: 'opp', // ...nhưng chính mình là người mất kết nối -> thua kỹ thuật
          completedAt: new Date('2026-07-20T00:00:00Z'), createdAt: new Date('2026-07-20T00:00:00Z'),
        },
      ]);
      mock.battleMatch.count.mockResolvedValue(1);
      mock.user.findMany.mockResolvedValue([{ id: 'opp', displayName: 'Đối thủ', email: null }]);

      const result = await getBattleHistory('me', 20, 0);
      expect(result.items[0]!.result).toBe('LOSE');
      expect(result.items[0]!.pointsChange).toBe(-100);
    });

    it('⚠️ Edge: trận với BOT mà mình thua (winnerId luôn null vì bot không có userId) -> phải suy từ điểm số ra LOSE, KHÔNG được hiểu nhầm thành DRAW', async () => {
      mock.battleMatch.findMany.mockResolvedValue([
        {
          id: 'h4', subject: 'TOAN', stake: 100, isBotMatch: true,
          player1Id: 'me', player2Id: null,
          player1Score: 30, player2Score: 90,
          winnerId: null,
          completedAt: new Date('2026-07-20T00:00:00Z'), createdAt: new Date('2026-07-20T00:00:00Z'),
        },
      ]);
      mock.battleMatch.count.mockResolvedValue(1);
      mock.user.findMany.mockResolvedValue([]);

      const result = await getBattleHistory('me', 20, 0);
      expect(result.items[0]!.result).toBe('LOSE');
      // Fix S5 (quyết định sản phẩm): ẩn hoàn toàn danh tính bot khỏi người chơi —
      // opponentName giờ trả về 1 tên giả GIỐNG NGƯỜI THẬT (deterministic theo matchId,
      // xem pickBotDisplayName), KHÔNG còn null/"Máy" như trước.
      expect(result.items[0]!.opponentName).toBe(pickBotDisplayName('h4'));
    });

    it('✅ Happy: hoà thật giữa 2 người (winnerId=null, điểm bằng nhau) -> DRAW, pointsChange=0', async () => {
      mock.battleMatch.findMany.mockResolvedValue([
        {
          id: 'h5', subject: 'TOAN', stake: 100, isBotMatch: false,
          player1Id: 'me', player2Id: 'opp', player1Score: 60, player2Score: 60,
          winnerId: null, completedAt: new Date('2026-07-20T00:00:00Z'), createdAt: new Date('2026-07-20T00:00:00Z'),
        },
      ]);
      mock.battleMatch.count.mockResolvedValue(1);
      mock.user.findMany.mockResolvedValue([{ id: 'opp', displayName: 'Đối thủ', email: null }]);

      const result = await getBattleHistory('me', 20, 0);
      expect(result.items[0]!.result).toBe('DRAW');
      expect(result.items[0]!.pointsChange).toBe(0);
    });

    it('⚠️ Edge: mảng rỗng -> total=0, không gọi user.findMany (không có opponentId nào cần tra)', async () => {
      mock.battleMatch.findMany.mockResolvedValue([]);
      mock.battleMatch.count.mockResolvedValue(0);

      const result = await getBattleHistory('me', 20, 0);
      expect(result).toEqual({ items: [], total: 0 });
      expect(mock.user.findMany).not.toHaveBeenCalled();
    });

    it('⚠️ Edge: limit/offset không hợp lệ (âm, NaN) -> dùng giá trị mặc định an toàn thay vì query lỗi', async () => {
      mock.battleMatch.findMany.mockResolvedValue([]);
      mock.battleMatch.count.mockResolvedValue(0);

      await getBattleHistory('me', Number.NaN, -5);
      expect(mock.battleMatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20, skip: 0 }),
      );
    });

    it('⚠️ Edge: limit vượt MAX_HISTORY_LIMIT (50) -> bị chặn về 50', async () => {
      mock.battleMatch.findMany.mockResolvedValue([]);
      mock.battleMatch.count.mockResolvedValue(0);

      await getBattleHistory('me', 9999, 0);
      expect(mock.battleMatch.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
    });
  });
});
