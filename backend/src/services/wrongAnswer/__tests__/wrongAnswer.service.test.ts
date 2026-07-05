// Unit test cho WrongAnswerService — mock Prisma, không cần DB thật.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma trước khi import service
vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    wrongAnswer: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    examPaper: {
      findMany: vi.fn(),
    },
  },
}));

// Mock normalizeAnswer từ exam.service
vi.mock('../../exam/exam.service.js', () => ({
  normalizeAnswer: (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' '),
}));

import { prisma } from '../../../lib/prisma.js';
import { WrongAnswerService } from '../wrongAnswer.service.js';
import { WrongAnswerNotFoundError } from '../wrongAnswer.errors.js';

const prismaMock = prisma as unknown as {
  wrongAnswer: {
    upsert: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  examPaper: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

describe('WrongAnswerService', () => {
  let service: WrongAnswerService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WrongAnswerService();
  });

  // ─── upsertWrongAnswer ────────────────────────────────────────────────────

  describe('upsertWrongAnswer', () => {
    it('✅ Happy: gọi upsert đúng key cho practice', async () => {
      prismaMock.wrongAnswer.upsert.mockResolvedValue({});

      await service.upsertWrongAnswer('user1', 'q1', 'practice');

      expect(prismaMock.wrongAnswer.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_questionId: { userId: 'user1', questionId: 'q1' } },
          update: expect.objectContaining({ wrongCount: { increment: 1 } }),
          create: expect.objectContaining({ userId: 'user1', questionId: 'q1', wrongCount: 1 }),
        }),
      );
    });

    it('✅ Happy: gọi upsert đúng key cho exam', async () => {
      prismaMock.wrongAnswer.upsert.mockResolvedValue({});

      await service.upsertWrongAnswer('user1', 'eq1', 'exam');

      expect(prismaMock.wrongAnswer.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_examQuestionId: { userId: 'user1', examQuestionId: 'eq1' } },
          create: expect.objectContaining({ userId: 'user1', examQuestionId: 'eq1', wrongCount: 1 }),
        }),
      );
    });

    it('✅ Happy: expiresAt = lastWrongAt + 14 ngày', async () => {
      prismaMock.wrongAnswer.upsert.mockResolvedValue({});
      const before = Date.now();

      await service.upsertWrongAnswer('user1', 'q1', 'practice');

      const call = prismaMock.wrongAnswer.upsert.mock.calls[0]![0]!;
      const create = call.create as { lastWrongAt: Date; expiresAt: Date };
      const diff = create.expiresAt.getTime() - create.lastWrongAt.getTime();
      const expectedDiff = 14 * 24 * 60 * 60 * 1000;
      expect(diff).toBe(expectedDiff);
      expect(create.lastWrongAt.getTime()).toBeGreaterThanOrEqual(before);
    });
  });

  // ─── retryQuestion ────────────────────────────────────────────────────────

  describe('retryQuestion', () => {
    const futureDate = new Date(Date.now() + 86400000 * 10); // còn 10 ngày

    it('❌ Error: ném WrongAnswerNotFoundError khi id không tồn tại', async () => {
      prismaMock.wrongAnswer.findUnique.mockResolvedValue(null);

      await expect(service.retryQuestion('user1', 99, 0)).rejects.toThrow(WrongAnswerNotFoundError);
    });

    it('❌ Error: ném WrongAnswerNotFoundError khi userId không khớp', async () => {
      prismaMock.wrongAnswer.findUnique.mockResolvedValue({
        id: 1, userId: 'other_user', expiresAt: futureDate,
        question: null, examQuestion: null,
      });

      await expect(service.retryQuestion('user1', 1, 0)).rejects.toThrow(WrongAnswerNotFoundError);
    });

    it('❌ Error: ném WrongAnswerNotFoundError khi đã hết hạn', async () => {
      const pastDate = new Date(Date.now() - 1000);
      prismaMock.wrongAnswer.findUnique.mockResolvedValue({
        id: 1, userId: 'user1', expiresAt: pastDate,
        question: { id: 'q1', correctAnswer: 2, explanation: null, isActive: true },
        examQuestion: null,
      });

      await expect(service.retryQuestion('user1', 1, 2)).rejects.toThrow(WrongAnswerNotFoundError);
    });

    it('✅ Happy: MCQ_4 practice — đáp án đúng', async () => {
      prismaMock.wrongAnswer.findUnique.mockResolvedValue({
        id: 1, userId: 'user1', expiresAt: futureDate,
        question: { id: 'q1', correctAnswer: 2, explanation: 'Giải thích', isActive: true },
        examQuestion: null,
      });

      const result = await service.retryQuestion('user1', 1, 2);

      expect(result.isCorrect).toBe(true);
      expect(result.correctAnswer).toBe(2);
      expect(result.explanation).toBe('Giải thích');
    });

    it('⚠️ Edge: MCQ_4 practice — đáp án sai', async () => {
      prismaMock.wrongAnswer.findUnique.mockResolvedValue({
        id: 1, userId: 'user1', expiresAt: futureDate,
        question: { id: 'q1', correctAnswer: 2, explanation: null, isActive: true },
        examQuestion: null,
      });

      const result = await service.retryQuestion('user1', 1, 0);

      expect(result.isCorrect).toBe(false);
    });

    it('✅ Happy: TRUE_FALSE_4 exam — tất cả 4 ý đúng', async () => {
      prismaMock.wrongAnswer.findUnique.mockResolvedValue({
        id: 2, userId: 'user1', expiresAt: futureDate,
        question: null,
        examQuestion: {
          id: 'eq1', questionType: 'TRUE_FALSE_4',
          correctAnswer: [true, false, true, false],
          explanation: null, isActive: true,
        },
      });

      const result = await service.retryQuestion('user1', 2, [true, false, true, false]);

      expect(result.isCorrect).toBe(true);
    });

    it('⚠️ Edge: TRUE_FALSE_4 — thiếu 1 ý (null trong mảng) → isCorrect = false', async () => {
      prismaMock.wrongAnswer.findUnique.mockResolvedValue({
        id: 2, userId: 'user1', expiresAt: futureDate,
        question: null,
        examQuestion: {
          id: 'eq1', questionType: 'TRUE_FALSE_4',
          correctAnswer: [true, false, true, false],
          explanation: null, isActive: true,
        },
      });

      const result = await service.retryQuestion('user1', 2, [true, false, true, null]);

      expect(result.isCorrect).toBe(false);
    });

    it('✅ Happy: FILL_BLANK — đáp án khớp sau normalize', async () => {
      prismaMock.wrongAnswer.findUnique.mockResolvedValue({
        id: 3, userId: 'user1', expiresAt: futureDate,
        question: null,
        examQuestion: {
          id: 'eq2', questionType: 'FILL_BLANK',
          correctAnswer: ['Hà Nội', 'ha noi'],
          explanation: null, isActive: true,
        },
      });

      // 'HÀ NỘI  ' → normalize → 'hà nội' — không khớp (khác ký tự diacritics)
      // Test với chính xác lowercase không dấu
      const result = await service.retryQuestion('user1', 3, 'ha noi');

      expect(result.isCorrect).toBe(true);
    });

    it('⚠️ Edge: FILL_BLANK — chuỗi rỗng → isCorrect = false', async () => {
      prismaMock.wrongAnswer.findUnique.mockResolvedValue({
        id: 3, userId: 'user1', expiresAt: futureDate,
        question: null,
        examQuestion: {
          id: 'eq2', questionType: 'FILL_BLANK',
          correctAnswer: ['đáp án'],
          explanation: null, isActive: true,
        },
      });

      const result = await service.retryQuestion('user1', 3, '');

      expect(result.isCorrect).toBe(false);
    });

    it('❌ Error: cả question và examQuestion đều null (câu bị hard-delete) → ném lỗi', async () => {
      prismaMock.wrongAnswer.findUnique.mockResolvedValue({
        id: 4, userId: 'user1', expiresAt: futureDate,
        question: null,
        examQuestion: null,
      });

      await expect(service.retryQuestion('user1', 4, 0)).rejects.toThrow(WrongAnswerNotFoundError);
    });
  });

  // ─── getWrongAnswers ──────────────────────────────────────────────────────

  describe('getWrongAnswers', () => {
    const futureDate = new Date(Date.now() + 86400000 * 10);

    it('✅ Happy: trả về danh sách rỗng khi không có dữ liệu', async () => {
      prismaMock.wrongAnswer.findMany.mockResolvedValue([]);
      prismaMock.examPaper.findMany.mockResolvedValue([]);

      const result = await service.getWrongAnswers('user1');

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('✅ Happy: trả về câu từ practice đúng format', async () => {
      prismaMock.wrongAnswer.findMany.mockResolvedValue([
        {
          id: 1, userId: 'user1', wrongCount: 3,
          lastWrongAt: new Date(), expiresAt: futureDate,
          question: {
            id: 'q1', subject: 'TOAN', question: 'Câu hỏi toán',
            options: ['A', 'B', 'C', 'D'], correctAnswer: 0,
            explanation: null, isActive: true,
          },
          examQuestion: null,
        },
      ]);
      prismaMock.examPaper.findMany.mockResolvedValue([]);

      const result = await service.getWrongAnswers('user1');

      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.source).toBe('practice');
      expect(result.data[0]!.question.type).toBe('MCQ_4');
      expect(result.data[0]!.wrongCount).toBe(3);
    });

    it('⚠️ Edge: bỏ qua câu bị soft-delete (isActive = false)', async () => {
      prismaMock.wrongAnswer.findMany.mockResolvedValue([
        {
          id: 1, userId: 'user1', wrongCount: 1,
          lastWrongAt: new Date(), expiresAt: futureDate,
          question: {
            id: 'q1', subject: 'TOAN', question: 'Câu bị ẩn',
            options: [], correctAnswer: 0, explanation: null, isActive: false,
          },
          examQuestion: null,
        },
      ]);
      prismaMock.examPaper.findMany.mockResolvedValue([]);

      const result = await service.getWrongAnswers('user1');

      expect(result.data).toHaveLength(0);
    });

    it('⚠️ Edge: lọc đúng theo subjectId', async () => {
      prismaMock.wrongAnswer.findMany.mockResolvedValue([
        {
          id: 1, userId: 'user1', wrongCount: 1,
          lastWrongAt: new Date(), expiresAt: futureDate,
          question: { id: 'q1', subject: 'TOAN', question: 'Toán', options: [], correctAnswer: 0, explanation: null, isActive: true },
          examQuestion: null,
        },
        {
          id: 2, userId: 'user1', wrongCount: 1,
          lastWrongAt: new Date(), expiresAt: futureDate,
          question: { id: 'q2', subject: 'VAN', question: 'Văn', options: [], correctAnswer: 0, explanation: null, isActive: true },
          examQuestion: null,
        },
      ]);
      prismaMock.examPaper.findMany.mockResolvedValue([]);

      const result = await service.getWrongAnswers('user1', 'TOAN');

      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.question.subjectId).toBe('TOAN');
    });

    it('⚠️ Edge: pagination đúng — trang 2 với pageSize=1', async () => {
      prismaMock.wrongAnswer.findMany.mockResolvedValue([
        {
          id: 1, userId: 'user1', wrongCount: 1, lastWrongAt: new Date(), expiresAt: futureDate,
          question: { id: 'q1', subject: 'TOAN', question: 'C1', options: [], correctAnswer: 0, explanation: null, isActive: true },
          examQuestion: null,
        },
        {
          id: 2, userId: 'user1', wrongCount: 2, lastWrongAt: new Date(), expiresAt: futureDate,
          question: { id: 'q2', subject: 'TOAN', question: 'C2', options: [], correctAnswer: 1, explanation: null, isActive: true },
          examQuestion: null,
        },
      ]);
      prismaMock.examPaper.findMany.mockResolvedValue([]);

      const result = await service.getWrongAnswers('user1', undefined, 2, 1);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.id).toBe(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(1);
    });
  });
});
