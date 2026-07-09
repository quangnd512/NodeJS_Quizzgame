// Unit test cho Exam UX Improvements (Feature 012):
//   - getActiveSession: lay phien thi dang do
//   - abandonSession: huy phien thi
// Mock Prisma, khong can DB that.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock prisma ─────────────────────────────────────────────────────────────

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    examSession: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    examPaper: {
      findUnique: vi.fn(),
    },
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

// ─── Mock redis ──────────────────────────────────────────────────────────────

vi.mock('../../../lib/redis.js', () => ({
  redis: { get: vi.fn(), incr: vi.fn(), expire: vi.fn() },
}));

import { prisma } from '../../../lib/prisma.js';
import { examService } from '../exam.service.js';
import {
  ExamSessionNotFoundError,
  ExamSessionNotOwnedError,
  ExamSessionAbandonedError,
  ExamSessionAlreadyCompletedError,
} from '../exam.errors.js';

const prismaMock = prisma as unknown as {
  examSession: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  examPaper: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

const USER_ID = 'user-abc';
const SESSION_ID = 'session-xyz';

/** Tao du lieu ExamSession mau theo trang thai cho truoc. */
function mockSession(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    userId: USER_ID,
    examPaperId: 'paper-1',
    subjectId: 'toan',
    durationMinutes: 60,
    startedAt: new Date(),
    status: 'IN_PROGRESS',
    score: null,
    pointsAwarded: 0,
    completedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// getActiveSession
// ─────────────────────────────────────────────────────────────────────────────

describe('getActiveSession', () => {
  it('✅ Happy: có phiên IN_PROGRESS → trả về session với remainingSeconds > 0', async () => {
    const startedAt = new Date(Date.now() - 5 * 60_000); // bat dau 5 phut truoc
    prismaMock.examSession.findFirst.mockResolvedValue({
      id: SESSION_ID,
      subjectId: 'toan',
      durationMinutes: 60,
      startedAt,
      examPaperId: 'paper-1',
    });
    prismaMock.examPaper.findUnique.mockResolvedValue({ title: 'Đề Toán 2024' });

    const result = await examService.getActiveSession(USER_ID);

    expect(result.session).not.toBeNull();
    expect(result.session!.id).toBe(SESSION_ID);
    expect(result.session!.subject).toBe('toan');
    expect(result.session!.title).toBe('Đề Toán 2024');
    expect(result.session!.durationMinutes).toBe(60);
    // Con khoang 55 phut -> remainingSeconds ~ 3300 giay
    expect(result.session!.remainingSeconds).toBeGreaterThan(3200);
    expect(result.session!.remainingSeconds).toBeLessThan(3400);
  });

  it('✅ Happy: không có phiên nào → trả về { session: null }', async () => {
    prismaMock.examSession.findFirst.mockResolvedValue(null);

    const result = await examService.getActiveSession(USER_ID);

    expect(result.session).toBeNull();
    // Khong goi findUnique lay ten de thi neu khong co session
    expect(prismaMock.examPaper.findUnique).not.toHaveBeenCalled();
  });

  it('⚠️ Edge: phiên đã hết giờ → remainingSeconds âm', async () => {
    const startedAt = new Date(Date.now() - 90 * 60_000); // bat dau 90 phut truoc, de thi 60 phut
    prismaMock.examSession.findFirst.mockResolvedValue({
      id: SESSION_ID,
      subjectId: 'ly',
      durationMinutes: 60,
      startedAt,
      examPaperId: 'paper-2',
    });
    prismaMock.examPaper.findUnique.mockResolvedValue({ title: 'Đề Lý 2024' });

    const result = await examService.getActiveSession(USER_ID);

    expect(result.session).not.toBeNull();
    // Da qua 30 phut → remainingSeconds am
    expect(result.session!.remainingSeconds).toBeLessThan(0);
  });

  it('⚠️ Edge: đề thi đã bị xóa → title trả về chuỗi rỗng (không crash)', async () => {
    prismaMock.examSession.findFirst.mockResolvedValue({
      id: SESSION_ID,
      subjectId: 'su',
      durationMinutes: 45,
      startedAt: new Date(),
      examPaperId: 'paper-deleted',
    });
    prismaMock.examPaper.findUnique.mockResolvedValue(null); // de thi da bi xoa

    const result = await examService.getActiveSession(USER_ID);

    expect(result.session).not.toBeNull();
    expect(result.session!.title).toBe(''); // fallback chuoi rong, khong throw
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// abandonSession
// ─────────────────────────────────────────────────────────────────────────────

describe('abandonSession', () => {
  it('✅ Happy: phiên IN_PROGRESS → cập nhật ABANDONED thành công', async () => {
    prismaMock.examSession.findUnique.mockResolvedValue(mockSession({ status: 'IN_PROGRESS' }));
    prismaMock.examSession.update.mockResolvedValue({});

    await expect(examService.abandonSession(USER_ID, SESSION_ID)).resolves.toBeUndefined();

    expect(prismaMock.examSession.update).toHaveBeenCalledWith({
      where: { id: SESSION_ID },
      data: { status: 'ABANDONED', completedAt: expect.any(Date) },
    });
  });

  it('❌ Error: session không tồn tại → throw ExamSessionNotFoundError', async () => {
    prismaMock.examSession.findUnique.mockResolvedValue(null);

    await expect(examService.abandonSession(USER_ID, SESSION_ID))
      .rejects.toThrow(ExamSessionNotFoundError);
  });

  it('❌ Error: session không thuộc user → throw ExamSessionNotOwnedError', async () => {
    prismaMock.examSession.findUnique.mockResolvedValue(
      mockSession({ userId: 'other-user' }),
    );

    await expect(examService.abandonSession(USER_ID, SESSION_ID))
      .rejects.toThrow(ExamSessionNotOwnedError);
  });

  it('❌ Error: session đã ABANDONED → throw ExamSessionAbandonedError', async () => {
    prismaMock.examSession.findUnique.mockResolvedValue(
      mockSession({ status: 'ABANDONED' }),
    );

    await expect(examService.abandonSession(USER_ID, SESSION_ID))
      .rejects.toThrow(ExamSessionAbandonedError);
  });

  it('❌ Error: session đã COMPLETED → throw ExamSessionAlreadyCompletedError', async () => {
    prismaMock.examSession.findUnique.mockResolvedValue(
      mockSession({ status: 'COMPLETED' }),
    );

    await expect(examService.abandonSession(USER_ID, SESSION_ID))
      .rejects.toThrow(ExamSessionAlreadyCompletedError);
  });

  it('❌ Error: session đã EXPIRED → throw ExamSessionAlreadyCompletedError', async () => {
    prismaMock.examSession.findUnique.mockResolvedValue(
      mockSession({ status: 'EXPIRED' }),
    );

    await expect(examService.abandonSession(USER_ID, SESSION_ID))
      .rejects.toThrow(ExamSessionAlreadyCompletedError);
  });

  it('⚠️ Edge: update không được gọi nếu session không hợp lệ', async () => {
    prismaMock.examSession.findUnique.mockResolvedValue(null);

    await expect(examService.abandonSession(USER_ID, SESSION_ID)).rejects.toThrow();
    expect(prismaMock.examSession.update).not.toHaveBeenCalled();
  });

  it('✅ Code error đúng — ExamSessionAbandonedError.code = EXAM_SESSION_ABANDONED', () => {
    const err = new ExamSessionAbandonedError(SESSION_ID);
    expect(err.code).toBe('EXAM_SESSION_ABANDONED');
  });
});
