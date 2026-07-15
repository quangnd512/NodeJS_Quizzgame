// Unit test cho PracticeService — CHỈ phần "Quản lý câu hỏi" (report redesign):
// listReports (JOIN thủ công + filter), getReportsSummary (2 số liệu tách rõ),
// resolveReport (snapshot + batch-resolve + reactivate). Mock Prisma hoàn toàn,
// không cần DB thật, không cần Redis (practice.service.ts import redis nhưng
// các method được test ở đây không dùng tới).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    questionReport: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      groupBy: vi.fn(),
    },
    question: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../notification/notification.service.js', () => ({
  notificationService: { createNotification: vi.fn().mockResolvedValue(undefined) },
}));

import { prisma } from '../../../lib/prisma.js';
import { notificationService } from '../../notification/notification.service.js';
import { PracticeService } from '../practice.service.js';
import { QuestionReportNotFoundError, ReportNotPendingError } from '../practice.errors.js';

const mock = prisma as unknown as {
  questionReport: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
  };
  question: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

const notifMock = notificationService as unknown as { createNotification: ReturnType<typeof vi.fn> };

const MOCK_QUESTION = {
  id: 'q-1',
  subject: 'TOAN',
  chapter: 'Đại số',
  difficulty: 2,
  question: '2 + 2 = ?',
  options: ['3', '4', '5', '6'],
  correctAnswer: 1,
  explanation: null,
  examYear: null,
  examCode: null,
  isActive: true,
  createdAt: new Date('2026-07-01T00:00:00Z'),
};

const MOCK_REPORT = {
  id: 'rep-1',
  questionId: 'q-1',
  userId: 'user-1',
  reason: 'WRONG_ANSWER',
  description: null,
  status: 'PENDING',
  createdAt: new Date('2026-07-13T00:00:00Z'),
};

describe('PracticeService — Quản lý báo cáo (redesign)', () => {
  let service: PracticeService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PracticeService();
  });

  // ─── listReports ──────────────────────────────────────────────────────────

  describe('listReports', () => {
    it('JOIN đầy đủ nội dung câu hỏi vào từng report', async () => {
      mock.questionReport.findMany.mockResolvedValue([MOCK_REPORT]);
      mock.questionReport.count.mockResolvedValue(1);
      mock.question.findMany.mockResolvedValue([MOCK_QUESTION]);

      const result = await service.listReports({});

      expect(result.total).toBe(1);
      expect(result.items[0]!.question).toEqual(
        expect.objectContaining({ subject: 'TOAN', question: '2 + 2 = ?', options: ['3', '4', '5', '6'] }),
      );
    });

    it('bỏ qua report có questionId không còn tồn tại (không làm sập request)', async () => {
      mock.questionReport.findMany.mockResolvedValue([MOCK_REPORT]);
      mock.questionReport.count.mockResolvedValue(1);
      mock.question.findMany.mockResolvedValue([]); // câu hỏi không tìm thấy

      const result = await service.listReports({});
      expect(result.items).toHaveLength(0);
    });

    it('lọc theo subject: tìm questionId khớp môn trước khi lọc report', async () => {
      mock.questionReport.findMany.mockResolvedValue([MOCK_REPORT]);
      mock.questionReport.count.mockResolvedValue(1);
      // Lần gọi 1: tìm questionId khớp subject. Lần gọi 2: JOIN nội dung câu hỏi cho kết quả.
      mock.question.findMany.mockResolvedValueOnce([{ id: 'q-1' }]).mockResolvedValueOnce([MOCK_QUESTION]);

      await service.listReports({ subject: 'TOAN' });

      expect(mock.questionReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ questionId: { in: ['q-1'] } }) }),
      );
    });
  });

  // ─── getReportsSummary ────────────────────────────────────────────────────

  describe('getReportsSummary', () => {
    it('tách rõ pendingReports (số dòng) và pendingQuestions (số câu khác nhau)', async () => {
      mock.questionReport.groupBy
        .mockResolvedValueOnce([
          { status: 'PENDING', _count: { id: 3 } },
          { status: 'FIXED', _count: { id: 2 } },
          { status: 'DISMISSED', _count: { id: 1 } },
        ])
        // pendingQuestionGroups: 3 dòng PENDING nhưng chỉ 2 câu hỏi khác nhau
        .mockResolvedValueOnce([{ questionId: 'q-1' }, { questionId: 'q-2' }])
        .mockResolvedValueOnce([{ questionId: 'q-1', _count: { id: 2 } }]);

      const result = await service.getReportsSummary();

      expect(result.pendingReports).toBe(3);
      expect(result.pendingQuestions).toBe(2);
      expect(result.fixed).toBe(2);
      expect(result.dismissed).toBe(1);
    });
  });

  // ─── resolveReport ────────────────────────────────────────────────────────

  describe('resolveReport', () => {
    it('❌ throw QuestionReportNotFoundError khi không tồn tại', async () => {
      mock.questionReport.findUnique.mockResolvedValue(null);
      await expect(service.resolveReport('rep-x', 'FIXED')).rejects.toThrow(QuestionReportNotFoundError);
    });

    it('✅ DISMISSED không kèm questionUpdate: không tạo snapshot, không reactivate', async () => {
      mock.questionReport.findUnique.mockResolvedValue(MOCK_REPORT);
      const txMock = {
        question: { findUnique: vi.fn().mockResolvedValue(MOCK_QUESTION), update: vi.fn() },
        questionEditHistory: { create: vi.fn() },
        questionReport: {
          findMany: vi.fn().mockResolvedValue([]), // không có report PENDING nào khác
          updateMany: vi.fn().mockResolvedValue({ count: 1 }), // claim thành công (còn PENDING)
        },
      };
      mock.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));

      const result = await service.resolveReport('rep-1', 'DISMISSED');

      expect(result).toEqual({ id: 'rep-1', status: 'DISMISSED', batchResolvedCount: 0, reactivated: false });
      expect(txMock.questionEditHistory.create).not.toHaveBeenCalled();
      expect(txMock.question.update).not.toHaveBeenCalled();
      expect(txMock.questionReport.updateMany).toHaveBeenCalledWith({
        where: { id: 'rep-1', status: 'PENDING' },
        data: { status: 'DISMISSED' },
      });
    });

    it('❌ race condition: throw ReportNotPendingError khi report đã bị xử lý bởi request khác (claim updateMany count=0)', async () => {
      // Report đọc ban đầu (ngoài transaction) vẫn thấy PENDING, nhưng giữa lúc đó có
      // request khác (double-click, retry client, hoặc 2 admin xử lý gần như đồng thời)
      // đã claim trước — updateMany điều kiện status:'PENDING' không còn khớp (count=0).
      mock.questionReport.findUnique.mockResolvedValue(MOCK_REPORT);
      const txMock = {
        question: { findUnique: vi.fn().mockResolvedValue(MOCK_QUESTION), update: vi.fn() },
        questionEditHistory: { create: vi.fn() },
        questionReport: {
          findMany: vi.fn(),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      };
      mock.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));

      await expect(
        service.resolveReport('rep-1', 'FIXED', { question: 'Câu hỏi đã sửa' }),
      ).rejects.toThrow(ReportNotPendingError);

      // Claim thất bại phải dừng NGAY — không tạo snapshot thừa, không ghi đè Question,
      // không chạy tới bước batch-resolve report khác.
      expect(txMock.questionEditHistory.create).not.toHaveBeenCalled();
      expect(txMock.question.update).not.toHaveBeenCalled();
      expect(txMock.questionReport.findMany).not.toHaveBeenCalled();
    });

    it('✅ FIXED + questionUpdate: lưu snapshot TRƯỚC khi update Question', async () => {
      mock.questionReport.findUnique.mockResolvedValue(MOCK_REPORT);
      const callOrder: string[] = [];
      const txMock = {
        question: {
          findUnique: vi.fn().mockResolvedValue(MOCK_QUESTION),
          update: vi.fn().mockImplementation(() => { callOrder.push('update-question'); return {}; }),
        },
        questionEditHistory: {
          create: vi.fn().mockImplementation(() => { callOrder.push('create-snapshot'); return {}; }),
        },
        questionReport: {
          findMany: vi.fn().mockResolvedValue([]),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      };
      mock.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));

      await service.resolveReport('rep-1', 'FIXED', { question: 'Câu hỏi đã sửa' });

      expect(callOrder).toEqual(['create-snapshot', 'update-question']);
      expect(txMock.questionEditHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            questionId: 'q-1',
            reportId: 'rep-1',
            beforeData: expect.objectContaining({ question: '2 + 2 = ?' }),
          }),
        }),
      );
      expect(txMock.question.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ question: 'Câu hỏi đã sửa' }) }),
      );
    });

    it('✅ FIXED trên câu đang bị auto-hide (isActive=false) → reactivate isActive=true', async () => {
      mock.questionReport.findUnique.mockResolvedValue(MOCK_REPORT);
      const txMock = {
        question: {
          findUnique: vi.fn().mockResolvedValue({ ...MOCK_QUESTION, isActive: false }),
          update: vi.fn().mockResolvedValue({}),
        },
        questionEditHistory: { create: vi.fn() },
        questionReport: {
          findMany: vi.fn().mockResolvedValue([]),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      };
      mock.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));

      const result = await service.resolveReport('rep-1', 'FIXED');

      expect(result.reactivated).toBe(true);
      expect(txMock.question.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isActive: true }) }),
      );
    });

    it('✅ DISMISSED trên câu đang bị auto-hide → KHÔNG reactivate (chỉ FIXED mới reactivate)', async () => {
      mock.questionReport.findUnique.mockResolvedValue(MOCK_REPORT);
      const txMock = {
        question: {
          findUnique: vi.fn().mockResolvedValue({ ...MOCK_QUESTION, isActive: false }),
          update: vi.fn().mockResolvedValue({}),
        },
        questionEditHistory: { create: vi.fn() },
        questionReport: {
          findMany: vi.fn().mockResolvedValue([]),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      };
      mock.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));

      const result = await service.resolveReport('rep-1', 'DISMISSED');

      expect(result.reactivated).toBe(false);
      expect(txMock.question.update).not.toHaveBeenCalled();
    });

    it('✅ batch-resolve: mọi report PENDING khác cùng questionId cũng chuyển status + mỗi user nhận 1 thông báo riêng', async () => {
      mock.questionReport.findUnique.mockResolvedValue(MOCK_REPORT);
      const otherReports = [
        { id: 'rep-2', userId: 'user-2' },
        { id: 'rep-3', userId: 'user-3' },
      ];
      const txMock = {
        question: { findUnique: vi.fn().mockResolvedValue(MOCK_QUESTION), update: vi.fn() },
        questionEditHistory: { create: vi.fn() },
        questionReport: {
          findMany: vi.fn().mockResolvedValue(otherReports),
          // Trả count > 0 cho MỌI lần gọi updateMany (lần 1: claim report chính; lần 2: batch report khác).
          updateMany: vi.fn().mockResolvedValue({ count: 2 }),
        },
      };
      mock.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));
      // Notify nội bộ đọc lại question — mock findUnique top-level (ngoài tx) cho fireReportResolvedNotification.
      mock.question.findUnique.mockResolvedValue(MOCK_QUESTION);

      const result = await service.resolveReport('rep-1', 'FIXED');

      expect(result.batchResolvedCount).toBe(2);
      expect(txMock.questionReport.updateMany).toHaveBeenCalledWith({
        where: { id: 'rep-1', status: 'PENDING' },
        data: { status: 'FIXED' },
      });
      expect(txMock.questionReport.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['rep-2', 'rep-3'] } },
        data: { status: 'FIXED' },
      });

      // Fire-and-forget — chờ microtask queue flush trước khi assert.
      await new Promise((resolve) => setImmediate(resolve));
      expect(notifMock.createNotification).toHaveBeenCalledTimes(3); // report chính + 2 report khác
      expect(notifMock.createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
      expect(notifMock.createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-2' }));
      expect(notifMock.createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-3' }));
    });
  });
});
