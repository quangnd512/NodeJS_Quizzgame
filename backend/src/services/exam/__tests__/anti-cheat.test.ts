// Unit test cho anti-cheat logic — Exam + Practice module.
// Mock Prisma và Redis, không cần DB thật.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock prisma ─────────────────────────────────────────────────────────────

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    examSession: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// ─── Mock redis ──────────────────────────────────────────────────────────────

vi.mock('../../../lib/redis.js', () => ({
  redis: {
    get: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
  },
}));

// ─── Mock pointsService ──────────────────────────────────────────────────────

vi.mock('../../points/points.service.js', () => ({
  pointsService: { deductPointsInTx: vi.fn(), addPointsInTx: vi.fn() },
}));

// ─── Mock wrongAnswerService ─────────────────────────────────────────────────

vi.mock('../../wrongAnswer/wrongAnswer.service.js', () => ({
  wrongAnswerService: { upsertWrongAnswer: vi.fn() },
}));

import { prisma } from '../../../lib/prisma.js';
import { redis } from '../../../lib/redis.js';
import { isSentinelUnanswered } from '../exam.service.js';
import { ExamSubmitTooEarlyError, ExamSessionAlreadyActiveError } from '../exam.errors.js';
import { EXAM_MIN_SUBMIT_RATIO } from '../exam.types.js';

const prismaMock = prisma as unknown as {
  examSession: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const redisMock = redis as unknown as {
  get: ReturnType<typeof vi.fn>;
  incr: ReturnType<typeof vi.fn>;
  expire: ReturnType<typeof vi.fn>;
};

// ─────────────────────────────────────────────────────────────────────────────
// isSentinelUnanswered
// ─────────────────────────────────────────────────────────────────────────────

describe('isSentinelUnanswered', () => {
  it('✅ Happy: {} (object rỗng) → true', () => {
    expect(isSentinelUnanswered({})).toBe(true);
  });

  it('❌ Error: null → false (chưa có answer trong DB)', () => {
    expect(isSentinelUnanswered(null)).toBe(false);
  });

  it('❌ Error: [] (mảng rỗng) → false', () => {
    expect(isSentinelUnanswered([])).toBe(false);
  });

  it('❌ Error: số (MCQ_4 chọn đáp án 0) → false', () => {
    expect(isSentinelUnanswered(0 as unknown as null)).toBe(false);
  });

  it('❌ Error: object có key → false (TRUE_FALSE_4 một phần)', () => {
    expect(isSentinelUnanswered({ a: true })).toBe(false);
  });

  it('❌ Error: mảng boolean (TRUE_FALSE_4 hợp lệ) → false', () => {
    expect(isSentinelUnanswered([true, false, true, false])).toBe(false);
  });

  it('❌ Error: string (FILL_BLANK) → false', () => {
    expect(isSentinelUnanswered('my answer' as unknown as null)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ExamSubmitTooEarlyError
// ─────────────────────────────────────────────────────────────────────────────

describe('ExamSubmitTooEarlyError', () => {
  it('✅ code đúng', () => {
    const err = new ExamSubmitTooEarlyError(300);
    expect(err.code).toBe('EXAM_SUBMIT_TOO_EARLY');
  });

  it('✅ remainingSeconds được lưu đúng', () => {
    const err = new ExamSubmitTooEarlyError(300);
    expect(err.remainingSeconds).toBe(300);
  });

  it('✅ message chứa số phút làm tròn lên (300s → 5 phút)', () => {
    const err = new ExamSubmitTooEarlyError(300);
    expect(err.message).toContain('5');
  });

  it('⚠️ Edge: remainingSeconds lẻ → làm tròn lên (61s → 2 phút)', () => {
    const err = new ExamSubmitTooEarlyError(61);
    expect(err.message).toContain('2');
  });

  it('⚠️ Edge: remainingSeconds = 60 → chính xác 1 phút', () => {
    const err = new ExamSubmitTooEarlyError(60);
    expect(err.message).toContain('1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ExamSessionAlreadyActiveError
// ─────────────────────────────────────────────────────────────────────────────

describe('ExamSessionAlreadyActiveError', () => {
  it('✅ code đúng', () => {
    const err = new ExamSessionAlreadyActiveError('session-abc');
    expect(err.code).toBe('EXAM_SESSION_ALREADY_ACTIVE');
  });

  it('✅ existingSessionId được lưu đúng', () => {
    const err = new ExamSessionAlreadyActiveError('session-abc');
    expect(err.existingSessionId).toBe('session-abc');
  });

  it('✅ message chứa sessionId', () => {
    const err = new ExamSessionAlreadyActiveError('session-abc');
    expect(err.message).toContain('session-abc');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EXAM_MIN_SUBMIT_RATIO
// ─────────────────────────────────────────────────────────────────────────────

describe('EXAM_MIN_SUBMIT_RATIO', () => {
  it('✅ đúng 0.3 (30%)', () => {
    expect(EXAM_MIN_SUBMIT_RATIO).toBe(0.3);
  });

  it('✅ de 60 phut → min required = 18 phut = 1080 giay', () => {
    const durationMinutes = 60;
    const minRequiredSeconds = durationMinutes * 60 * EXAM_MIN_SUBMIT_RATIO;
    expect(minRequiredSeconds).toBe(1080);
  });

  it('✅ de 30 phut → min required = 9 phut = 540 giay', () => {
    const durationMinutes = 30;
    const minRequiredSeconds = durationMinutes * 60 * EXAM_MIN_SUBMIT_RATIO;
    expect(minRequiredSeconds).toBe(540);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// startExam — Bug 4: Chặn phiên trùng lặp
// ─────────────────────────────────────────────────────────────────────────────

describe('startExam — Bug 4 (multi-tab check)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('❌ Error: có session IN_PROGRESS → findFirst trả về session → throw ExamSessionAlreadyActiveError', async () => {
    // Đây là test logic check: nếu findFirst tìm thấy session → service throw
    prismaMock.examSession.findFirst.mockResolvedValue({ id: 'existing-session-id' });

    // Import service sau khi mock đã được thiết lập
    const { ExamService } = await import('../exam.service.js');
    const service = new ExamService();

    await expect(service.startExam('user-1', 'TOAN')).rejects.toThrow(ExamSessionAlreadyActiveError);
  });

  it('✅ Happy: không có session IN_PROGRESS → findFirst trả null → tiến hành bình thường (hoặc lỗi khác)', async () => {
    prismaMock.examSession.findFirst.mockResolvedValue(null);
    // Prisma findUnique (pickFairExamPaper) → trả null để service throw lỗi khác (không phải AlreadyActive)
    prismaMock.examSession.findUnique.mockResolvedValue(null);

    const { ExamService } = await import('../exam.service.js');
    const service = new ExamService();

    // Service sẽ fail ở bước tiếp theo (pickFairExamPaper), không phải AlreadyActiveError
    await expect(service.startExam('user-1', 'TOAN')).rejects.not.toThrow(ExamSessionAlreadyActiveError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// submitExam — Bug 1a: Nộp quá sớm
// ─────────────────────────────────────────────────────────────────────────────

describe('submitExam — Bug 1a (elapsed time check)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('❌ Error: nộp sau 1 giây (de 60 phut, can 18 phut) → throw ExamSubmitTooEarlyError', async () => {
    const startedAt = new Date(Date.now() - 1_000); // 1 giây trước
    prismaMock.examSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      subjectId: 'toan',
      durationMinutes: 60,
      status: 'IN_PROGRESS',
      startedAt,
    });

    const { ExamService } = await import('../exam.service.js');
    const service = new ExamService();

    await expect(service.submitExam('user-1', 'session-1', [])).rejects.toThrow(ExamSubmitTooEarlyError);
  });

  it('⚠️ Edge: nộp đúng ở ranh giới 30% (de 10 phut, sau 3 phut) → KHÔNG throw TooEarly', async () => {
    const startedAt = new Date(Date.now() - 3 * 60_000); // 3 phút = đúng 30% của 10 phút
    prismaMock.examSession.findUnique.mockResolvedValue({
      id: 'session-2',
      userId: 'user-1',
      subjectId: 'toan',
      durationMinutes: 10,
      status: 'IN_PROGRESS',
      startedAt,
    });

    const { ExamService } = await import('../exam.service.js');
    const service = new ExamService();

    // Không throw TooEarly (có thể throw lỗi khác vì mock không đủ dữ liệu chấm điểm)
    await expect(service.submitExam('user-1', 'session-2', [])).rejects.not.toThrow(ExamSubmitTooEarlyError);
  });
});
