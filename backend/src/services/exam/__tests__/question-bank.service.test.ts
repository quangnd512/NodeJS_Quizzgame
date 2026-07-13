// Unit test cho QuestionBankService — CHỈ phần "usage points trigger" (TASK 5
// của Feature 014: mỗi lần 1 câu hỏi bắt nguồn từ StudentQuestionSubmission đã
// APPROVED được thêm vào 1 đề thi qua addFromBank(), cộng thêm điểm usage cho
// học sinh, tối đa 100đ/câu). Mock Prisma hoàn toàn, không cần DB thật.
//
// Trọng tâm: xác nhận cơ chế CAS (compare-and-swap) chống lost-update khi 2 lần
// gọi addFromBank cho CÙNG 1 câu hỏi xảy ra gần như đồng thời — đây là race
// condition được phát hiện và sửa ở bước review (S3).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    examPaper: { findUnique: vi.fn() },
    examQuestion: { findMany: vi.fn(), createMany: vi.fn() },
    questionBank: { findMany: vi.fn() },
    studentQuestionSubmission: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../points/points.service.js', () => ({
  pointsService: { addPoints: vi.fn().mockResolvedValue({}) },
}));

vi.mock('../../notification/notification.service.js', () => ({
  notificationService: { createNotification: vi.fn().mockResolvedValue(undefined) },
}));

import { prisma } from '../../../lib/prisma.js';
import { pointsService } from '../../points/points.service.js';
import { notificationService } from '../../notification/notification.service.js';
import { QuestionBankService } from '../question-bank.service.js';

const mock = prisma as unknown as {
  examPaper: { findUnique: ReturnType<typeof vi.fn> };
  examQuestion: { findMany: ReturnType<typeof vi.fn>; createMany: ReturnType<typeof vi.fn> };
  questionBank: { findMany: ReturnType<typeof vi.fn> };
  studentQuestionSubmission: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

const pointsMock = pointsService as unknown as { addPoints: ReturnType<typeof vi.fn> };
const notifMock = notificationService as unknown as { createNotification: ReturnType<typeof vi.fn> };

const MOCK_PAPER = { id: 'paper-1', subject: 'TOAN' };

const MOCK_BANK_QUESTION = {
  id: 'bank-1',
  chapter: null,
  difficulty: 2,
  questionType: 'MCQ_4',
  points: 1,
  questionText: 'Câu hỏi test',
  options: ['A', 'B', 'C', 'D'],
  correctAnswer: 0,
  explanation: null,
  examYear: null,
  examCode: null,
};

function mockAddFromBankTransaction(bankQuestions: typeof MOCK_BANK_QUESTION[]): void {
  const txMock = {
    questionBank: { findMany: vi.fn().mockResolvedValue(bankQuestions) },
    examQuestion: {
      findMany: vi.fn().mockResolvedValue([]), // chưa có câu nào trong đề (không skip)
      createMany: vi.fn().mockResolvedValue({ count: bankQuestions.length }),
    },
  };
  mock.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));
}

/** Đợi hàng đợi microtask flush — dùng để chờ [fire-and-forget] chạy xong trước khi assert. */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('QuestionBankService — usage points trigger (addFromBank)', () => {
  let service: QuestionBankService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new QuestionBankService();
    mock.examPaper.findUnique.mockResolvedValue(MOCK_PAPER);
  });

  it('✅ happy path: cộng 5đ usage cho submission APPROVED khi câu được thêm vào đề thi', async () => {
    mockAddFromBankTransaction([MOCK_BANK_QUESTION]);
    mock.studentQuestionSubmission.findMany.mockResolvedValue([
      { id: 'sub-1', userId: 'user-1', questionBankId: 'bank-1', status: 'APPROVED', usagePointsEarned: 0 },
    ]);
    mock.studentQuestionSubmission.findUnique.mockResolvedValue({
      id: 'sub-1', userId: 'user-1', questionBankId: 'bank-1', status: 'APPROVED', usagePointsEarned: 0,
    });
    mock.studentQuestionSubmission.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.addFromBank('paper-1', { questionBankIds: ['bank-1'] });
    expect(result).toEqual({ added: 1, skipped: 0 });

    await flushMicrotasks();

    expect(mock.studentQuestionSubmission.updateMany).toHaveBeenCalledWith({
      where: { id: 'sub-1', usagePointsEarned: 0 },
      data: { usageCount: { increment: 1 }, usagePointsEarned: 5 },
    });
    expect(pointsMock.addPoints).toHaveBeenCalledWith(
      'user-1', 5, 'SUBMISSION_USED', expect.objectContaining({ submissionId: 'sub-1' }),
    );
    expect(notifMock.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', type: 'SUBMISSION_USED' }),
    );
  });

  it('⚠️ edge case: đã đạt trần 100đ usage → KHÔNG cộng thêm điểm, không gửi thông báo', async () => {
    mockAddFromBankTransaction([MOCK_BANK_QUESTION]);
    mock.studentQuestionSubmission.findMany.mockResolvedValue([
      { id: 'sub-1', userId: 'user-1', questionBankId: 'bank-1', status: 'APPROVED', usagePointsEarned: 100 },
    ]);
    mock.studentQuestionSubmission.findUnique.mockResolvedValue({
      id: 'sub-1', userId: 'user-1', questionBankId: 'bank-1', status: 'APPROVED', usagePointsEarned: 100,
    });

    await service.addFromBank('paper-1', { questionBankIds: ['bank-1'] });
    await flushMicrotasks();

    expect(mock.studentQuestionSubmission.updateMany).not.toHaveBeenCalled();
    expect(pointsMock.addPoints).not.toHaveBeenCalled();
    expect(notifMock.createNotification).not.toHaveBeenCalled();
  });

  it('⚠️ edge case: gần trần (95đ) → chỉ cộng đúng phần còn thiếu (5đ), không vượt trần', async () => {
    mockAddFromBankTransaction([MOCK_BANK_QUESTION]);
    mock.studentQuestionSubmission.findMany.mockResolvedValue([
      { id: 'sub-1', userId: 'user-1', questionBankId: 'bank-1', status: 'APPROVED', usagePointsEarned: 97 },
    ]);
    mock.studentQuestionSubmission.findUnique.mockResolvedValue({
      id: 'sub-1', userId: 'user-1', questionBankId: 'bank-1', status: 'APPROVED', usagePointsEarned: 97,
    });
    mock.studentQuestionSubmission.updateMany.mockResolvedValue({ count: 1 });

    await service.addFromBank('paper-1', { questionBankIds: ['bank-1'] });
    await flushMicrotasks();

    // min(5, 100-97) = 3, KHÔNG phải 5 mặc định.
    expect(mock.studentQuestionSubmission.updateMany).toHaveBeenCalledWith({
      where: { id: 'sub-1', usagePointsEarned: 97 },
      data: { usageCount: { increment: 1 }, usagePointsEarned: 100 },
    });
    expect(pointsMock.addPoints).toHaveBeenCalledWith('user-1', 3, 'SUBMISSION_USED', expect.anything());
  });

  it('❌ race condition (CAS retry): lần ghi đầu bị xung đột (count=0) → đọc lại giá trị mới rồi thử lại thành công', async () => {
    mockAddFromBankTransaction([MOCK_BANK_QUESTION]);
    mock.studentQuestionSubmission.findMany.mockResolvedValue([
      { id: 'sub-1', userId: 'user-1', questionBankId: 'bank-1', status: 'APPROVED', usagePointsEarned: 0 },
    ]);
    // Lần đọc 1: usagePointsEarned=0 (stale). Lần đọc 2 (sau khi CAS thất bại):
    // giả lập 1 request song song khác đã ghi trước, giờ giá trị thực là 50.
    mock.studentQuestionSubmission.findUnique
      .mockResolvedValueOnce({ id: 'sub-1', userId: 'user-1', questionBankId: 'bank-1', status: 'APPROVED', usagePointsEarned: 0 })
      .mockResolvedValueOnce({ id: 'sub-1', userId: 'user-1', questionBankId: 'bank-1', status: 'APPROVED', usagePointsEarned: 50 });
    // Lần updateMany 1: điều kiện where usagePointsEarned=0 không còn khớp -> count=0 (thua cuộc đua).
    // Lần updateMany 2: điều kiện where usagePointsEarned=50 khớp -> count=1 (thành công).
    mock.studentQuestionSubmission.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    await service.addFromBank('paper-1', { questionBankIds: ['bank-1'] });
    await flushMicrotasks();

    expect(mock.studentQuestionSubmission.updateMany).toHaveBeenCalledTimes(2);
    expect(mock.studentQuestionSubmission.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'sub-1', usagePointsEarned: 0 },
      data: { usageCount: { increment: 1 }, usagePointsEarned: 5 },
    });
    expect(mock.studentQuestionSubmission.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 'sub-1', usagePointsEarned: 50 },
      data: { usageCount: { increment: 1 }, usagePointsEarned: 55 },
    });
    // Chỉ cộng điểm đúng 1 lần, dùng giá trị đã retry (5đ theo lần ghi thành công).
    expect(pointsMock.addPoints).toHaveBeenCalledTimes(1);
    expect(pointsMock.addPoints).toHaveBeenCalledWith('user-1', 5, 'SUBMISSION_USED', expect.anything());
  });

  it('✅ không có submission nào bắt nguồn từ câu vừa thêm → không gọi addPoints/thông báo', async () => {
    mockAddFromBankTransaction([MOCK_BANK_QUESTION]);
    mock.studentQuestionSubmission.findMany.mockResolvedValue([]); // câu này không phải do học sinh gửi

    await service.addFromBank('paper-1', { questionBankIds: ['bank-1'] });
    await flushMicrotasks();

    expect(mock.studentQuestionSubmission.updateMany).not.toHaveBeenCalled();
    expect(pointsMock.addPoints).not.toHaveBeenCalled();
    expect(notifMock.createNotification).not.toHaveBeenCalled();
  });
});
