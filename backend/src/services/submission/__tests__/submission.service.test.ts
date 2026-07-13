// Unit test cho SubmissionService — mock Prisma + pointsService + notificationService,
// không cần DB thật.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma trước khi import service
vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    studentQuestionSubmission: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    questionBank: {
      findMany: vi.fn(),
      create: vi.fn(),
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
import { SubmissionService } from '../submission.service.js';
import {
  SubmissionNotFoundError,
  SubmissionNotOwnedError,
  SubmissionNotPendingError,
  SubmissionRateLimitError,
  SubmissionRejectNoteRequiredError,
} from '../submission.errors.js';

const mock = prisma as unknown as {
  studentQuestionSubmission: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  questionBank: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

const pointsMock = pointsService as unknown as { addPoints: ReturnType<typeof vi.fn> };
const notifMock = notificationService as unknown as { createNotification: ReturnType<typeof vi.fn> };

const MOCK_SUBMISSION = {
  id: 'sub-1',
  userId: 'user-1',
  subject: 'TOAN',
  chapter: 'Đại số',
  questionText: '2 + 2 bằng mấy?',
  options: ['3', '4', '5', '6'],
  correctOptionIndex: 1,
  status: 'PENDING',
  adminNote: null,
  questionBankId: null,
  usageCount: 0,
  usagePointsEarned: 0,
  createdAt: new Date('2026-07-13T10:00:00Z'),
  updatedAt: new Date('2026-07-13T10:00:00Z'),
};

describe('SubmissionService', () => {
  let service: SubmissionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SubmissionService();
  });

  // ─── createSubmission ─────────────────────────────────────────────────────

  describe('createSubmission', () => {
    it('✅ tạo thành công khi chưa vượt rate limit', async () => {
      mock.studentQuestionSubmission.count.mockResolvedValue(2); // đã gửi 2/5 hôm nay
      mock.studentQuestionSubmission.create.mockResolvedValue(MOCK_SUBMISSION);

      const result = await service.createSubmission('user-1', {
        subject: 'TOAN',
        questionText: '2 + 2 bằng mấy?',
        options: ['3', '4', '5', '6'],
        correctOptionIndex: 1,
      });

      expect(result.status).toBe('PENDING');
      expect(mock.studentQuestionSubmission.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1', status: 'PENDING' }) }),
      );
    });

    it('⚠️ edge case: vẫn tạo được khi count=4 (ngay dưới ngưỡng 5/ngày)', async () => {
      mock.studentQuestionSubmission.count.mockResolvedValue(4);
      mock.studentQuestionSubmission.create.mockResolvedValue(MOCK_SUBMISSION);

      await expect(
        service.createSubmission('user-1', {
          subject: 'TOAN',
          questionText: '2 + 2 bằng mấy?',
          options: ['3', '4', '5', '6'],
          correctOptionIndex: 1,
        }),
      ).resolves.toBeDefined();
    });

    it('❌ throw SubmissionRateLimitError khi đã gửi đủ 5 câu hôm nay', async () => {
      mock.studentQuestionSubmission.count.mockResolvedValue(5);

      await expect(
        service.createSubmission('user-1', {
          subject: 'TOAN',
          questionText: '2 + 2 bằng mấy?',
          options: ['3', '4', '5', '6'],
          correctOptionIndex: 1,
        }),
      ).rejects.toThrow(SubmissionRateLimitError);

      expect(mock.studentQuestionSubmission.create).not.toHaveBeenCalled();
    });
  });

  // ─── listSubmissions ──────────────────────────────────────────────────────

  describe('listSubmissions', () => {
    it('trả danh sách + total, lọc theo userId', async () => {
      mock.studentQuestionSubmission.findMany.mockResolvedValue([MOCK_SUBMISSION]);
      mock.studentQuestionSubmission.count.mockResolvedValue(1);

      const result = await service.listSubmissions('user-1', {});

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mock.studentQuestionSubmission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
    });
  });

  // ─── getSubmission ────────────────────────────────────────────────────────

  describe('getSubmission', () => {
    it('❌ throw SubmissionNotFoundError khi không tồn tại', async () => {
      mock.studentQuestionSubmission.findUnique.mockResolvedValue(null);
      await expect(service.getSubmission('user-1', 'sub-x')).rejects.toThrow(SubmissionNotFoundError);
    });

    it('❌ throw SubmissionNotOwnedError khi không phải chủ sở hữu', async () => {
      mock.studentQuestionSubmission.findUnique.mockResolvedValue({ ...MOCK_SUBMISSION, userId: 'user-2' });
      await expect(service.getSubmission('user-1', 'sub-1')).rejects.toThrow(SubmissionNotOwnedError);
    });

    it('✅ trả về DTO khi đúng chủ sở hữu', async () => {
      mock.studentQuestionSubmission.findUnique.mockResolvedValue(MOCK_SUBMISSION);
      const result = await service.getSubmission('user-1', 'sub-1');
      expect(result.id).toBe('sub-1');
    });
  });

  // ─── updateSubmission / deleteSubmission ─────────────────────────────────

  describe('updateSubmission', () => {
    it('❌ throw SubmissionNotPendingError khi đã APPROVED', async () => {
      mock.studentQuestionSubmission.findUnique.mockResolvedValue({ ...MOCK_SUBMISSION, status: 'APPROVED' });
      await expect(
        service.updateSubmission('user-1', 'sub-1', { questionText: 'Sửa lại' }),
      ).rejects.toThrow(SubmissionNotPendingError);
      expect(mock.studentQuestionSubmission.updateMany).not.toHaveBeenCalled();
    });

    it('✅ cập nhật thành công khi còn PENDING', async () => {
      mock.studentQuestionSubmission.findUnique.mockResolvedValue(MOCK_SUBMISSION);
      mock.studentQuestionSubmission.updateMany.mockResolvedValue({ count: 1 });
      mock.studentQuestionSubmission.findUniqueOrThrow.mockResolvedValue({
        ...MOCK_SUBMISSION,
        questionText: 'Sửa lại',
      });

      const result = await service.updateSubmission('user-1', 'sub-1', { questionText: 'Sửa lại' });
      expect(result.questionText).toBe('Sửa lại');
      expect(mock.studentQuestionSubmission.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'sub-1', userId: 'user-1', status: 'PENDING' } }),
      );
    });

    it('❌ race condition: throw SubmissionNotPendingError khi admin vừa duyệt/từ chối ngay trước khi ghi (updateMany count=0)', async () => {
      // Check ban đầu thấy PENDING, nhưng giữa lúc đó có request khác (vd approve)
      // đã đổi status trước — updateMany có điều kiện status:'PENDING' sẽ không khớp nữa.
      mock.studentQuestionSubmission.findUnique.mockResolvedValue(MOCK_SUBMISSION);
      mock.studentQuestionSubmission.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updateSubmission('user-1', 'sub-1', { questionText: 'Sửa lại' }),
      ).rejects.toThrow(SubmissionNotPendingError);
      expect(mock.studentQuestionSubmission.findUniqueOrThrow).not.toHaveBeenCalled();
    });
  });

  describe('deleteSubmission', () => {
    it('❌ throw SubmissionNotPendingError khi đã REJECTED', async () => {
      mock.studentQuestionSubmission.findUnique.mockResolvedValue({ ...MOCK_SUBMISSION, status: 'REJECTED' });
      await expect(service.deleteSubmission('user-1', 'sub-1')).rejects.toThrow(SubmissionNotPendingError);
    });

    it('✅ xoá thành công khi còn PENDING', async () => {
      mock.studentQuestionSubmission.findUnique.mockResolvedValue(MOCK_SUBMISSION);
      mock.studentQuestionSubmission.deleteMany.mockResolvedValue({ count: 1 });
      await service.deleteSubmission('user-1', 'sub-1');
      expect(mock.studentQuestionSubmission.deleteMany).toHaveBeenCalledWith({
        where: { id: 'sub-1', userId: 'user-1', status: 'PENDING' },
      });
    });

    it('❌ race condition: throw SubmissionNotPendingError khi deleteMany count=0 (đã bị xử lý trước đó)', async () => {
      mock.studentQuestionSubmission.findUnique.mockResolvedValue(MOCK_SUBMISSION);
      mock.studentQuestionSubmission.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.deleteSubmission('user-1', 'sub-1')).rejects.toThrow(SubmissionNotPendingError);
    });
  });

  // ─── listSubmissionsAdmin (duplicateWarning) ─────────────────────────────

  describe('listSubmissionsAdmin', () => {
    it('gắn duplicateWarning khi trùng câu hỏi cùng môn trong kho (đã chuẩn hoá dấu)', async () => {
      mock.studentQuestionSubmission.findMany.mockResolvedValue([
        { ...MOCK_SUBMISSION, questionText: 'Thủ đô của Việt Nam là gì?' },
      ]);
      mock.studentQuestionSubmission.count.mockResolvedValue(1);
      mock.questionBank.findMany.mockResolvedValue([
        { id: 'bank-1', subject: 'TOAN', questionText: 'Thu do cua Viet Nam la gi' },
      ]);

      const result = await service.listSubmissionsAdmin({});

      expect(result.items[0]!.duplicateWarning).not.toBeNull();
      expect(result.items[0]!.duplicateWarning!.questionBankId).toBe('bank-1');
      expect(result.items[0]!.duplicateWarning!.similarity).toBeGreaterThanOrEqual(0.6);
    });

    it('duplicateWarning = null khi không có câu nào đủ giống', async () => {
      mock.studentQuestionSubmission.findMany.mockResolvedValue([MOCK_SUBMISSION]);
      mock.studentQuestionSubmission.count.mockResolvedValue(1);
      mock.questionBank.findMany.mockResolvedValue([
        { id: 'bank-1', subject: 'TOAN', questionText: 'Một câu hỏi hoàn toàn khác về lịch sử' },
      ]);

      const result = await service.listSubmissionsAdmin({});
      expect(result.items[0]!.duplicateWarning).toBeNull();
    });
  });

  // ─── approveSubmission ────────────────────────────────────────────────────

  describe('approveSubmission', () => {
    it('❌ throw SubmissionNotFoundError khi không tồn tại', async () => {
      mock.studentQuestionSubmission.findUnique.mockResolvedValue(null);
      await expect(service.approveSubmission('sub-x')).rejects.toThrow(SubmissionNotFoundError);
    });

    it('❌ throw SubmissionNotPendingError khi không còn PENDING', async () => {
      mock.studentQuestionSubmission.findUnique.mockResolvedValue({ ...MOCK_SUBMISSION, status: 'APPROVED' });
      await expect(service.approveSubmission('sub-1')).rejects.toThrow(SubmissionNotPendingError);
    });

    it('✅ tạo QuestionBank entry + cập nhật APPROVED + cộng điểm + thông báo', async () => {
      mock.studentQuestionSubmission.findUnique.mockResolvedValue(MOCK_SUBMISSION);
      const txMock = {
        questionBank: { create: vi.fn().mockResolvedValue({ id: 'bank-99' }) },
        studentQuestionSubmission: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          update: vi.fn().mockResolvedValue({}),
        },
      };
      mock.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));

      const result = await service.approveSubmission('sub-1');

      expect(result).toEqual({ id: 'sub-1', status: 'APPROVED', questionBankId: 'bank-99' });
      expect(txMock.studentQuestionSubmission.updateMany).toHaveBeenCalledWith({
        where: { id: 'sub-1', status: 'PENDING' },
        data: { status: 'APPROVED' },
      });
      expect(txMock.questionBank.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ subject: 'TOAN', questionType: 'MCQ_4', isActive: true }),
        }),
      );
      expect(txMock.studentQuestionSubmission.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { questionBankId: 'bank-99' },
      });

      // Fire-and-forget — chờ microtask queue flush trước khi assert.
      await new Promise((resolve) => setImmediate(resolve));
      expect(pointsMock.addPoints).toHaveBeenCalledWith(
        'user-1', 30, 'SUBMISSION_APPROVED', expect.objectContaining({ submissionId: 'sub-1' }),
      );
      expect(notifMock.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', type: 'SUBMISSION_APPROVED' }),
      );
    });

    it('❌ race condition: throw SubmissionNotPendingError khi 2 admin cùng duyệt 1 submission gần như đồng thời (updateMany trong tx count=0)', async () => {
      mock.studentQuestionSubmission.findUnique.mockResolvedValue(MOCK_SUBMISSION);
      const txMock = {
        questionBank: { create: vi.fn() },
        studentQuestionSubmission: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }), // request khác đã "claim" trước
          update: vi.fn(),
        },
      };
      mock.$transaction.mockImplementation(async (cb: (tx: typeof txMock) => unknown) => cb(txMock));

      await expect(service.approveSubmission('sub-1')).rejects.toThrow(SubmissionNotPendingError);
      // Không được tạo QuestionBank entry trùng lặp khi thua cuộc đua claim.
      expect(txMock.questionBank.create).not.toHaveBeenCalled();
    });
  });

  // ─── rejectSubmission ─────────────────────────────────────────────────────

  describe('rejectSubmission', () => {
    it('❌ throw SubmissionRejectNoteRequiredError khi note rỗng', async () => {
      await expect(service.rejectSubmission('sub-1', '')).rejects.toThrow(SubmissionRejectNoteRequiredError);
      expect(mock.studentQuestionSubmission.findUnique).not.toHaveBeenCalled();
    });

    it('❌ throw SubmissionNotPendingError khi không còn PENDING', async () => {
      mock.studentQuestionSubmission.findUnique.mockResolvedValue({ ...MOCK_SUBMISSION, status: 'REJECTED' });
      await expect(service.rejectSubmission('sub-1', 'Trùng câu hỏi')).rejects.toThrow(
        SubmissionNotPendingError,
      );
    });

    it('✅ cập nhật REJECTED + gửi thông báo kèm lý do', async () => {
      mock.studentQuestionSubmission.findUnique.mockResolvedValue(MOCK_SUBMISSION);
      mock.studentQuestionSubmission.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.rejectSubmission('sub-1', 'Trùng câu hỏi đã có');

      expect(result).toEqual({ id: 'sub-1', status: 'REJECTED' });
      expect(mock.studentQuestionSubmission.updateMany).toHaveBeenCalledWith({
        where: { id: 'sub-1', status: 'PENDING' },
        data: { status: 'REJECTED', adminNote: 'Trùng câu hỏi đã có' },
      });

      await new Promise((resolve) => setImmediate(resolve));
      expect(notifMock.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', type: 'SUBMISSION_REJECTED', body: 'Trùng câu hỏi đã có' }),
      );
    });

    it('❌ race condition: throw SubmissionNotPendingError khi updateMany count=0 (đã bị duyệt/từ chối trước đó)', async () => {
      mock.studentQuestionSubmission.findUnique.mockResolvedValue(MOCK_SUBMISSION);
      mock.studentQuestionSubmission.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.rejectSubmission('sub-1', 'Trùng câu hỏi đã có')).rejects.toThrow(
        SubmissionNotPendingError,
      );
      expect(notifMock.createNotification).not.toHaveBeenCalled();
    });
  });
});
