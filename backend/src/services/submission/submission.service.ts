// ============================================================================
// SubmissionService — xử lý toàn bộ logic "Học sinh đóng góp câu hỏi":
//   - Học sinh: tạo/sửa/xoá (chỉ khi PENDING)/xem danh sách + chi tiết
//   - Admin: danh sách chờ duyệt (kèm cảnh báo trùng lặp), duyệt, từ chối
//
// Fire-and-forget cho điểm + thông báo sau khi duyệt/từ chối (giống pattern
// Feature 013 Notifications) — không block response admin, không rollback
// giao dịch chính nếu cộng điểm/gửi thông báo thất bại.
// ============================================================================
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { pointsService } from '../points/points.service.js';
import { PointReason } from '../points/points.types.js';
import { notificationService } from '../notification/notification.service.js';
import { textSimilarity } from '../../utils/text-similarity.utils.js';
import {
  SubmissionNotFoundError,
  SubmissionNotOwnedError,
  SubmissionNotPendingError,
  SubmissionRateLimitError,
  SubmissionRejectNoteRequiredError,
} from './submission.errors.js';
import type {
  AdminSubmissionListItem,
  ApproveSubmissionResult,
  CreateSubmissionInput,
  DuplicateWarning,
  PaginatedAdminSubmissions,
  PaginatedSubmissions,
  RejectSubmissionResult,
  SubmissionDto,
  SubmissionStatus,
  UpdateSubmissionInput,
} from './submission.types.js';
import {
  SUBMISSION_APPROVE_POINTS,
  SUBMISSION_DAILY_LIMIT,
  SUBMISSION_DUPLICATE_SIMILARITY_THRESHOLD,
} from './submission.types.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Độ khó mặc định cho câu hỏi được duyệt vào Ngân hàng câu hỏi.
 * Học sinh không tự chấm độ khó khi gửi — admin có thể chỉnh lại sau qua
 * trang quản lý Ngân hàng câu hỏi hiện có (không thuộc phạm vi tính năng này).
 */
const DEFAULT_APPROVED_DIFFICULTY = 2;

// ---------------------------------------------------------------------------
// Helpers nội bộ
// ---------------------------------------------------------------------------

type SubmissionRow = {
  id: string;
  userId: string;
  subject: string;
  chapter: string | null;
  questionText: string;
  options: Prisma.JsonValue;
  correctOptionIndex: number;
  status: string;
  adminNote: string | null;
  questionBankId: string | null;
  usageCount: number;
  usagePointsEarned: number;
  createdAt: Date;
  updatedAt: Date;
};

function toDto(row: SubmissionRow): SubmissionDto {
  return {
    id: row.id,
    userId: row.userId,
    subject: row.subject,
    chapter: row.chapter,
    questionText: row.questionText,
    options: row.options as [string, string, string, string],
    correctOptionIndex: row.correctOptionIndex,
    status: row.status as SubmissionStatus,
    adminNote: row.adminNote,
    questionBankId: row.questionBankId,
    usageCount: row.usageCount,
    usagePointsEarned: row.usagePointsEarned,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** 00:00:00 UTC của ngày hôm nay — mốc bắt đầu để đếm rate limit "5 câu/ngày". */
function startOfTodayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export class SubmissionService {
  // ==========================================================================
  // HỌC SINH
  // ==========================================================================

  /** Tạo mới 1 câu hỏi gửi. Kiểm tra rate limit 5 câu/ngày trước khi tạo. */
  async createSubmission(userId: string, input: CreateSubmissionInput): Promise<SubmissionDto> {
    await this.assertUnderDailyLimit(userId);

    const row = await prisma.studentQuestionSubmission.create({
      data: {
        userId,
        subject: input.subject,
        chapter: input.chapter ?? null,
        questionText: input.questionText,
        options: input.options as Prisma.InputJsonValue,
        correctOptionIndex: input.correctOptionIndex,
        status: 'PENDING',
      },
    });
    return toDto(row);
  }

  /** Danh sách câu hỏi đã gửi của 1 học sinh, phân trang, lọc theo trạng thái (tuỳ chọn). */
  async listSubmissions(
    userId: string,
    params: { status?: string; page?: number; limit?: number },
  ): Promise<PaginatedSubmissions> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(MAX_PAGE_SIZE, params.limit ?? DEFAULT_PAGE_SIZE);

    const where: Prisma.StudentQuestionSubmissionWhereInput = {
      userId,
      ...(params.status !== undefined && { status: params.status }),
    };

    const [items, total] = await Promise.all([
      prisma.studentQuestionSubmission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.studentQuestionSubmission.count({ where }),
    ]);

    return { items: items.map(toDto), total };
  }

  /** Chi tiết 1 câu hỏi gửi — chỉ chủ sở hữu mới xem được. */
  async getSubmission(userId: string, id: string): Promise<SubmissionDto> {
    const row = await this.findOwnedOrThrow(userId, id);
    return toDto(row);
  }

  /**
   * Sửa 1 câu hỏi gửi — chỉ khi còn PENDING, chỉ chủ sở hữu.
   * Dùng `updateMany` với điều kiện `status: 'PENDING'` (thay vì `update` theo id
   * đơn thuần) để tránh race condition: nếu admin duyệt/từ chối submission này
   * đúng lúc học sinh đang sửa (giữa lúc kiểm tra status ở trên và lúc ghi DB),
   * điều kiện sẽ không khớp nữa (count=0) và ta báo lỗi thay vì âm thầm sửa đè
   * lên 1 submission đã có QuestionBank/thông báo được tạo ra từ nó.
   */
  async updateSubmission(
    userId: string,
    id: string,
    input: UpdateSubmissionInput,
  ): Promise<SubmissionDto> {
    const existing = await this.findOwnedOrThrow(userId, id);
    if (existing.status !== 'PENDING') throw new SubmissionNotPendingError();

    const claimed = await prisma.studentQuestionSubmission.updateMany({
      where: { id, userId, status: 'PENDING' },
      data: {
        ...(input.subject !== undefined && { subject: input.subject }),
        ...(input.chapter !== undefined && { chapter: input.chapter }),
        ...(input.questionText !== undefined && { questionText: input.questionText }),
        ...(input.options !== undefined && { options: input.options as Prisma.InputJsonValue }),
        ...(input.correctOptionIndex !== undefined && { correctOptionIndex: input.correctOptionIndex }),
      },
    });
    if (claimed.count === 0) throw new SubmissionNotPendingError();

    const row = await prisma.studentQuestionSubmission.findUniqueOrThrow({ where: { id } });
    return toDto(row);
  }

  /**
   * Xoá 1 câu hỏi gửi — chỉ khi còn PENDING, chỉ chủ sở hữu.
   * Dùng `deleteMany` có điều kiện `status: 'PENDING'` cùng lý do race condition
   * như `updateSubmission` ở trên (tránh xoá "hụt" 1 submission admin vừa duyệt).
   */
  async deleteSubmission(userId: string, id: string): Promise<void> {
    const existing = await this.findOwnedOrThrow(userId, id);
    if (existing.status !== 'PENDING') throw new SubmissionNotPendingError();

    const deleted = await prisma.studentQuestionSubmission.deleteMany({
      where: { id, userId, status: 'PENDING' },
    });
    if (deleted.count === 0) throw new SubmissionNotPendingError();
  }

  // ==========================================================================
  // ADMIN
  // ==========================================================================

  /**
   * Danh sách câu hỏi gửi (mọi học sinh), phân trang, lọc theo trạng thái.
   * Mỗi item kèm `duplicateWarning` — so khớp đơn giản với Ngân hàng câu hỏi
   * đang active CÙNG MÔN, chỉ cảnh báo, không chặn duyệt.
   */
  async listSubmissionsAdmin(params: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedAdminSubmissions> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(MAX_PAGE_SIZE, params.limit ?? DEFAULT_PAGE_SIZE);

    const where: Prisma.StudentQuestionSubmissionWhereInput = {
      ...(params.status !== undefined && { status: params.status }),
    };

    const [rows, total] = await Promise.all([
      prisma.studentQuestionSubmission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.studentQuestionSubmission.count({ where }),
    ]);

    const duplicateWarnings = await this.computeDuplicateWarnings(rows);

    const items: AdminSubmissionListItem[] = rows.map((row) => ({
      ...toDto(row),
      duplicateWarning: duplicateWarnings.get(row.id) ?? null,
    }));

    return { items, total };
  }

  /**
   * Duyệt 1 câu hỏi gửi:
   *   1. "Claim" submission bằng conditional update (status: PENDING -> APPROVED)
   *      NGAY ĐẦU transaction — nếu 2 admin cùng duyệt 1 submission gần như đồng
   *      thời, chỉ transaction nào khớp điều kiện `status: 'PENDING'` trước mới
   *      thành công; transaction còn lại nhận count=0 và dừng ngay, tránh tạo
   *      2 bản ghi QuestionBank trùng lặp + cộng điểm/thông báo 2 lần cho 1 câu.
   *   2. Tạo bản ghi QuestionBank (type=MCQ_4, isActive=true) từ nội dung submission
   *   3. Gắn questionBankId vào submission (vẫn trong cùng transaction ở bước 1)
   *   4. [Fire-and-forget] Cộng 30 điểm cho học sinh + gửi thông báo SUBMISSION_APPROVED
   */
  async approveSubmission(id: string): Promise<ApproveSubmissionResult> {
    const existing = await prisma.studentQuestionSubmission.findUnique({ where: { id } });
    if (!existing) throw new SubmissionNotFoundError(id);
    if (existing.status !== 'PENDING') throw new SubmissionNotPendingError();

    const { questionBankId } = await prisma.$transaction(async (tx) => {
      const claimed = await tx.studentQuestionSubmission.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'APPROVED' },
      });
      if (claimed.count === 0) throw new SubmissionNotPendingError();

      const bankEntry = await tx.questionBank.create({
        data: {
          subject: existing.subject,
          chapter: existing.chapter,
          difficulty: DEFAULT_APPROVED_DIFFICULTY,
          questionType: 'MCQ_4',
          points: 1,
          questionText: existing.questionText,
          options: existing.options as Prisma.InputJsonValue,
          correctAnswer: existing.correctOptionIndex,
          isActive: true,
        },
      });

      await tx.studentQuestionSubmission.update({
        where: { id },
        data: { questionBankId: bankEntry.id },
      });

      return { questionBankId: bankEntry.id };
    });

    // Fire-and-forget: cộng điểm + thông báo — không block response admin,
    // không rollback việc duyệt câu hỏi nếu 2 bước này thất bại.
    void this.fireApprovedRewards(existing.userId, id, questionBankId);

    return { id, status: 'APPROVED', questionBankId };
  }

  /**
   * Từ chối 1 câu hỏi gửi — bắt buộc kèm ghi chú lý do.
   * Dùng `updateMany` điều kiện `status: 'PENDING'` để chống race condition
   * tương tự `approveSubmission` (2 admin cùng xử lý 1 submission gần như đồng
   * thời — vd 1 người duyệt, 1 người từ chối cùng lúc).
   * [Fire-and-forget] gửi thông báo SUBMISSION_REJECTED kèm lý do trong `body`.
   */
  async rejectSubmission(id: string, note: string): Promise<RejectSubmissionResult> {
    if (!note || note.trim().length === 0) throw new SubmissionRejectNoteRequiredError();

    const existing = await prisma.studentQuestionSubmission.findUnique({ where: { id } });
    if (!existing) throw new SubmissionNotFoundError(id);
    if (existing.status !== 'PENDING') throw new SubmissionNotPendingError();

    const claimed = await prisma.studentQuestionSubmission.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'REJECTED', adminNote: note },
    });
    if (claimed.count === 0) throw new SubmissionNotPendingError();

    void this.fireRejectedNotification(existing.userId, id, note);

    return { id, status: 'REJECTED' };
  }

  // ---------------------------------------------------------------------------
  // Helpers riêng tư
  // ---------------------------------------------------------------------------

  /** Tìm submission theo ID, kiểm tra ownership — ném lỗi rõ ràng nếu không hợp lệ. */
  private async findOwnedOrThrow(userId: string, id: string): Promise<SubmissionRow> {
    const row = await prisma.studentQuestionSubmission.findUnique({ where: { id } });
    if (!row) throw new SubmissionNotFoundError(id);
    if (row.userId !== userId) throw new SubmissionNotOwnedError();
    return row;
  }

  /** Kiểm tra user chưa vượt quá SUBMISSION_DAILY_LIMIT câu gửi trong ngày hôm nay (UTC). */
  private async assertUnderDailyLimit(userId: string): Promise<void> {
    const count = await prisma.studentQuestionSubmission.count({
      where: { userId, createdAt: { gte: startOfTodayUtc() } },
    });
    if (count >= SUBMISSION_DAILY_LIMIT) {
      throw new SubmissionRateLimitError(SUBMISSION_DAILY_LIMIT);
    }
  }

  /**
   * Tính cảnh báo trùng lặp cho 1 danh sách submission: so khớp questionText
   * (đã chuẩn hoá) với các câu hỏi ACTIVE trong Ngân hàng câu hỏi CÙNG MÔN.
   * Chỉ cảnh báo (similarity >= ngưỡng) — không chặn duyệt.
   */
  private async computeDuplicateWarnings(
    rows: SubmissionRow[],
  ): Promise<Map<string, DuplicateWarning | null>> {
    const result = new Map<string, DuplicateWarning | null>();
    if (rows.length === 0) return result;

    const subjects = [...new Set(rows.map((r) => r.subject))];
    const bankQuestions = await prisma.questionBank.findMany({
      where: { subject: { in: subjects }, isActive: true },
      select: { id: true, subject: true, questionText: true },
    });

    // Nhóm câu hỏi trong kho theo môn để tra cứu nhanh khi so khớp từng submission.
    const bySubject = new Map<string, { id: string; questionText: string }[]>();
    for (const q of bankQuestions) {
      const list = bySubject.get(q.subject) ?? [];
      list.push({ id: q.id, questionText: q.questionText });
      bySubject.set(q.subject, list);
    }

    for (const row of rows) {
      const candidates = bySubject.get(row.subject) ?? [];
      let best: DuplicateWarning | null = null;
      for (const candidate of candidates) {
        const similarity = textSimilarity(row.questionText, candidate.questionText);
        if (similarity >= SUBMISSION_DUPLICATE_SIMILARITY_THRESHOLD) {
          if (!best || similarity > best.similarity) {
            best = { questionBankId: candidate.id, similarity };
          }
        }
      }
      result.set(row.id, best);
    }

    return result;
  }

  /** [Fire-and-forget] Cộng điểm + thông báo khi câu hỏi gửi được duyệt. */
  private async fireApprovedRewards(
    userId: string,
    submissionId: string,
    questionBankId: string,
  ): Promise<void> {
    try {
      await pointsService.addPoints(userId, SUBMISSION_APPROVE_POINTS, PointReason.SUBMISSION_APPROVED, {
        submissionId,
        questionBankId,
      });
    } catch (err) {
      console.error('[SubmissionService] fireApprovedRewards addPoints error:', err);
    }
    try {
      await notificationService.createNotification({
        userId,
        type: 'SUBMISSION_APPROVED',
        title: '🎉 Câu hỏi của bạn đã được duyệt!',
        body: `Câu hỏi bạn gửi đã được thêm vào ngân hàng câu hỏi. Bạn nhận được +${SUBMISSION_APPROVE_POINTS} điểm.`,
        targetScreen: null,
        metadata: { submissionId, questionBankId, pointsAwarded: SUBMISSION_APPROVE_POINTS },
      });
    } catch (err) {
      console.error('[SubmissionService] fireApprovedRewards notify error:', err);
    }
  }

  /** [Fire-and-forget] Gửi thông báo khi câu hỏi gửi bị từ chối. */
  private async fireRejectedNotification(userId: string, submissionId: string, note: string): Promise<void> {
    try {
      await notificationService.createNotification({
        userId,
        type: 'SUBMISSION_REJECTED',
        title: '❌ Câu hỏi của bạn không được duyệt',
        body: note,
        targetScreen: null,
        metadata: { submissionId, note },
      });
    } catch (err) {
      console.error('[SubmissionService] fireRejectedNotification error:', err);
    }
  }
}

/** Instance dùng chung (singleton). */
export const submissionService = new SubmissionService();
