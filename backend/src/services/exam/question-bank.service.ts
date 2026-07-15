// QuestionBankService — quan ly Ngan hang cau hoi chung cho module Thi thu.
// Admin CRUD cau hoi trong kho, kiem tra usage truoc khi xoa (hard delete),
// va them nhieu cau tu kho vao 1 de thi theo batch.

import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { isValidSubjectId } from '../users/users.types.js';
import { validateQuestionShape } from './exam.service.js';
import { ExamPaperNotFoundError } from './exam.errors.js';
import { QuestionBankNotFoundError, QuestionBankDeleteBlockedError } from './question-bank.errors.js';
import { pointsService } from '../points/points.service.js';
import { PointReason } from '../points/points.types.js';
import { notificationService } from '../notification/notification.service.js';
import { SUBMISSION_USAGE_POINTS_CAP, SUBMISSION_USAGE_POINTS_PER_USE } from '../submission/submission.types.js';
import type {
  AddFromBankInput,
  AddFromBankResult,
  AutoFillFromBankInput,
  AutoFillFromBankResult,
  CreateQuestionBankInput,
  QuestionBankFilter,
  QuestionBankListResult,
  QuestionBankSummaryDto,
  QuestionBankUsageDto,
  UpdateQuestionBankInput,
} from './question-bank.types.js';
import type { ExamQuestionType } from './exam.types.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** Chuyen ban ghi QuestionBank thanh DTO tra ve client. */
function toDto(q: {
  id: string;
  subject: string;
  chapter: string | null;
  difficulty: number;
  questionType: string;
  points: number;
  questionText: string;
  options: Prisma.JsonValue;
  correctAnswer: Prisma.JsonValue;
  explanation: string | null;
  examYear: number | null;
  examCode: string | null;
  isActive: boolean;
  createdAt: Date;
}): QuestionBankSummaryDto {
  return {
    id: q.id,
    subject: q.subject,
    chapter: q.chapter,
    difficulty: q.difficulty,
    questionType: q.questionType as ExamQuestionType,
    points: q.points,
    questionText: q.questionText,
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    examYear: q.examYear,
    examCode: q.examCode,
    isActive: q.isActive,
    createdAt: q.createdAt,
  };
}

export class QuestionBankService {
  // -------------------------------------------------------------------------
  // Lay danh sach cau hoi (filter + phan trang)
  // -------------------------------------------------------------------------

  /**
   * Lay danh sach cau hoi tu ngan hang voi bo loc va phan trang.
   * Tim kiem theo noi dung (contains, case-insensitive), loc theo mon/chuong/do kho.
   */
  async listQuestions(filter: QuestionBankFilter): Promise<QuestionBankListResult> {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, filter.pageSize ?? DEFAULT_PAGE_SIZE));
    const skip = (page - 1) * pageSize;

    const where: Prisma.QuestionBankWhereInput = {};

    if (filter.subject) where.subject = filter.subject;
    if (filter.chapter) where.chapter = { contains: filter.chapter, mode: 'insensitive' };
    if (filter.difficulty !== undefined) where.difficulty = filter.difficulty;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;
    if (filter.search) {
      where.questionText = { contains: filter.search, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      prisma.questionBank.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.questionBank.count({ where }),
    ]);

    return {
      items: items.map(toDto),
      total,
      page,
      pageSize,
    };
  }

  // -------------------------------------------------------------------------
  // Tao moi cau hoi trong kho
  // -------------------------------------------------------------------------

  /**
   * Tao moi mot cau hoi trong ngan hang.
   * Validate hinh dang cau hoi (options/correctAnswer phu hop questionType) truoc khi luu.
   */
  async createQuestion(input: CreateQuestionBankInput): Promise<QuestionBankSummaryDto> {
    validateQuestionShape(input.questionType, input.options ?? null, input.correctAnswer);

    const q = await prisma.questionBank.create({
      data: {
        subject: input.subject,
        chapter: input.chapter ?? null,
        difficulty: input.difficulty,
        questionType: input.questionType,
        points: input.points,
        questionText: input.questionText,
        ...(input.options !== undefined && { options: input.options as Prisma.InputJsonValue }),
        correctAnswer: input.correctAnswer as Prisma.InputJsonValue,
        explanation: input.explanation ?? null,
        examYear: input.examYear ?? null,
        examCode: input.examCode ?? null,
      },
    });

    return toDto(q);
  }

  // -------------------------------------------------------------------------
  // Cap nhat cau hoi trong kho
  // -------------------------------------------------------------------------

  async updateQuestion(id: string, input: UpdateQuestionBankInput): Promise<QuestionBankSummaryDto> {
    const existing = await prisma.questionBank.findUnique({ where: { id } });
    if (!existing) throw new QuestionBankNotFoundError(id);

    // Neu co thay doi lien quan den dang cau hoi/options/correctAnswer -> validate lai
    if (input.questionType !== undefined || input.options !== undefined || input.correctAnswer !== undefined) {
      const questionType = (input.questionType ?? existing.questionType) as ExamQuestionType;
      const options = input.options !== undefined ? input.options : existing.options;
      const correctAnswer = input.correctAnswer !== undefined ? input.correctAnswer : existing.correctAnswer;
      validateQuestionShape(questionType, options, correctAnswer);
    }

    const q = await prisma.questionBank.update({
      where: { id },
      data: {
        ...(input.subject !== undefined && { subject: input.subject }),
        ...(input.chapter !== undefined && { chapter: input.chapter ?? null }),
        ...(input.difficulty !== undefined && { difficulty: input.difficulty }),
        ...(input.questionType !== undefined && { questionType: input.questionType }),
        ...(input.points !== undefined && { points: input.points }),
        ...(input.questionText !== undefined && { questionText: input.questionText }),
        ...(input.options !== undefined && { options: input.options as Prisma.InputJsonValue }),
        ...(input.correctAnswer !== undefined && { correctAnswer: input.correctAnswer as Prisma.InputJsonValue }),
        ...(input.explanation !== undefined && { explanation: input.explanation ?? null }),
        ...(input.examYear !== undefined && { examYear: input.examYear ?? null }),
        ...(input.examCode !== undefined && { examCode: input.examCode ?? null }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });

    return toDto(q);
  }

  // -------------------------------------------------------------------------
  // Kiem tra cau hoi dang duoc su dung o dau (truoc khi xoa)
  // -------------------------------------------------------------------------

  /**
   * Kiem tra cau hoi trong kho dang duoc dung o de thi nao.
   * Goi truoc khi xoa de hien thi canh bao cho admin (xem co phien dang dien ra khong).
   */
  async getUsage(id: string): Promise<QuestionBankUsageDto> {
    const existing = await prisma.questionBank.findUnique({ where: { id } });
    if (!existing) throw new QuestionBankNotFoundError(id);

    // Tim tat ca ExamQuestion tham chieu den cau nay
    const examQuestions = await prisma.examQuestion.findMany({
      where: { questionBankId: id },
      select: { examPaperId: true },
    });

    if (examQuestions.length === 0) {
      return { examPapers: [], totalExamPapers: 0, hasActiveSession: false };
    }

    const paperIds = [...new Set(examQuestions.map((q) => q.examPaperId))];

    // Lay thong tin cac de thi
    const papers = await prisma.examPaper.findMany({
      where: { id: { in: paperIds } },
      select: { id: true, title: true, subject: true, isActive: true },
    });

    // Kiem tra xem co ExamSession IN_PROGRESS nao tham chieu den cac de thi nay khong
    const activeSessions = await prisma.examSession.findMany({
      where: {
        examPaperId: { in: paperIds },
        status: 'IN_PROGRESS',
      },
      select: { examPaperId: true },
    });

    const activeSessionPaperIds = new Set(activeSessions.map((s) => s.examPaperId));
    const hasActiveSession = activeSessions.length > 0;

    return {
      examPapers: papers.map((p) => ({
        paperId: p.id,
        paperTitle: p.title,
        subject: p.subject,
        isActive: p.isActive,
        hasActiveSession: activeSessionPaperIds.has(p.id),
      })),
      totalExamPapers: papers.length,
      hasActiveSession,
    };
  }

  // -------------------------------------------------------------------------
  // Hard delete cau hoi khoi kho (co guard)
  // -------------------------------------------------------------------------

  /**
   * Hard delete cau hoi khoi ngan hang.
   * Throw QuestionBankDeleteBlockedError neu con ExamSession IN_PROGRESS dang su dung cau nay.
   * Toan bo kiem tra + xoa duoc boc trong transaction de dam bao atomic.
   * FK ON DELETE SET NULL tu dong dat questionBankId=null tren ExamQuestion khi xoa.
   */
  async deleteQuestion(id: string): Promise<void> {
    const existing = await prisma.questionBank.findUnique({ where: { id } });
    if (!existing) throw new QuestionBankNotFoundError(id);

    await prisma.$transaction(async (tx) => {
      // Kiem tra co ExamSession IN_PROGRESS nao tham chieu den cau nay khong.
      // Thuc hien ben trong transaction de dam bao kiem tra va xoa la atomic,
      // tranh truong hop session moi duoc tao ngay sau khi kiem tra.
      const examQuestions = await tx.examQuestion.findMany({
        where: { questionBankId: id },
        select: { examPaperId: true },
      });

      if (examQuestions.length > 0) {
        const paperIds = [...new Set(examQuestions.map((q) => q.examPaperId))];
        const activeSession = await tx.examSession.findFirst({
          where: { examPaperId: { in: paperIds }, status: 'IN_PROGRESS' },
        });

        if (activeSession) {
          throw new QuestionBankDeleteBlockedError(id);
        }
      }

      // FK constraint ON DELETE SET NULL xu ly viec dat questionBankId=null tren
      // ExamQuestion tu dong khi xoa ban ghi goc, nen khong can updateMany rieng.
      await tx.questionBank.delete({ where: { id } });
    });
  }

  // -------------------------------------------------------------------------
  // Them nhieu cau tu kho vao de thi (batch, khong duplicate)
  // -------------------------------------------------------------------------

  /**
   * Them nhieu cau hoi tu ngan hang vao 1 de thi theo batch.
   * Cau da ton tai trong de (theo questionBankId) se bi bo qua, khong bao loi.
   * Boc trong transaction de dam bao atomic: khong co cau nao duoc them neu createMany that bai.
   */
  async addFromBank(examPaperId: string, input: AddFromBankInput): Promise<AddFromBankResult> {
    const paper = await prisma.examPaper.findUnique({ where: { id: examPaperId } });
    if (!paper) throw new ExamPaperNotFoundError(examPaperId);

    // Boc toan bo luong "kiem tra trung + insert" trong 1 transaction de dam bao
    // atomic: neu createMany that bai giua chung, khong co cau nao duoc them mot phan.
    const result = await prisma.$transaction(async (tx) => {
      // Lay cac cau hoi trong kho theo IDs duoc yeu cau
      const bankQuestions = await tx.questionBank.findMany({
        where: { id: { in: input.questionBankIds }, isActive: true },
      });

      // Tim cac questionBankId da co trong de thi nay (de skip duplicate)
      const existingLinks = await tx.examQuestion.findMany({
        where: {
          examPaperId,
          questionBankId: { in: input.questionBankIds },
        },
        select: { questionBankId: true },
      });
      const existingBankIds = new Set(existingLinks.map((q) => q.questionBankId));

      // Loc bo cac cau da co trong de thi
      const toInsert = bankQuestions.filter((q) => !existingBankIds.has(q.id));

      if (toInsert.length > 0) {
        await tx.examQuestion.createMany({
          data: toInsert.map((q) => ({
            examPaperId,
            questionBankId: q.id,
            chapter: q.chapter,
            difficulty: q.difficulty,
            questionType: q.questionType,
            points: q.points,
            questionText: q.questionText,
            options: q.options ?? Prisma.JsonNull,
            correctAnswer: q.correctAnswer as Prisma.InputJsonValue,
            explanation: q.explanation,
            examYear: q.examYear,
            examCode: q.examCode,
          })),
        });
      }

      const skipped = input.questionBankIds.length - toInsert.length;

      return { added: toInsert.length, skipped, insertedBankIds: toInsert.map((q) => q.id) };
    });

    // [Fire-and-forget] Cau nao trong so vua them bat nguon tu 1 StudentQuestionSubmission
    // da duyet thi cong them diem "usage" cho hoc sinh — khong block response admin.
    if (result.insertedBankIds.length > 0) {
      void this.fireUsagePointsTrigger(result.insertedBankIds);
    }

    return { added: result.added, skipped: result.skipped };
  }

  /**
   * [Fire-and-forget] Sau khi 1+ cau hoi tu kho duoc them vao de thi: voi moi cau
   * (theo questionBankId) neu bat nguon tu 1 StudentQuestionSubmission da APPROVED
   * va chua dat toi da 100 diem usage, cong them min(5, 100 - da_nhan) diem cho
   * hoc sinh, tang usageCount, va gui thong bao SUBMISSION_USED.
   */
  private async fireUsagePointsTrigger(bankIds: string[]): Promise<void> {
    try {
      const submissions = await prisma.studentQuestionSubmission.findMany({
        where: { questionBankId: { in: bankIds }, status: 'APPROVED' },
      });

      for (const sub of submissions) {
        await this.awardUsagePointsForSubmission(sub.id);
      }
    } catch (err) {
      console.error('[QuestionBankService] fireUsagePointsTrigger error:', err);
    }
  }

  /**
   * Cong diem "usage" cho 1 submission theo kieu COMPARE-AND-SWAP (doc gia tri cu,
   * roi ghi CO DIEU KIEN dung gia tri cu do lam dieu kien WHERE).
   *
   * VI SAO CAN CAS: neu chi doc `usagePointsEarned` roi tinh `newTotal = cu + delta`
   * va ghi de bang `update` thuong, 2 lan goi gan nhu dong thoi (vi du: cung 1 cau
   * hoi trong kho duoc them vao 2 de thi khac nhau trong 2 request song song) co the
   * cung doc duoc 1 gia tri cu, roi lan ghi sau "de len" lan ghi truoc (lost update).
   * Hau qua: `usagePointsEarned` bi ghi THIEU so voi thuc te, khien lan cong diem
   * tiep theo tinh sai phan con lai duoi tran 100d/cau — vo hieu hoa tran usage cap.
   * `pointsService.addPoints` (co optimistic lock rieng) van cong dung diem thuc te
   * cho user, nhung so lieu theo doi tran usage se bi lech neu khong co CAS o day.
   *
   * `updateMany` voi dieu kien `usagePointsEarned: <gia tri vua doc>` dam bao chi 1
   * trong so cac lan goi dong thoi thanh cong (count=1); cac lan con lai nhan
   * count=0 va thu lai voi gia tri moi nhat, toi da `MAX_CAS_RETRY` lan.
   */
  private async awardUsagePointsForSubmission(submissionId: string): Promise<void> {
    const MAX_CAS_RETRY = 5;

    for (let attempt = 0; attempt < MAX_CAS_RETRY; attempt++) {
      const sub = await prisma.studentQuestionSubmission.findUnique({ where: { id: submissionId } });
      // Submission co the da bi xoa hoac doi trang thai giua chung — bo qua an toan.
      if (!sub || sub.status !== 'APPROVED') return;

      const pointsToAdd = Math.min(
        SUBMISSION_USAGE_POINTS_PER_USE,
        SUBMISSION_USAGE_POINTS_CAP - sub.usagePointsEarned,
      );
      if (pointsToAdd <= 0) return; // da dat toi da 100 diem usage — khong cong them

      const newTotal = sub.usagePointsEarned + pointsToAdd;
      const claimed = await prisma.studentQuestionSubmission.updateMany({
        where: { id: submissionId, usagePointsEarned: sub.usagePointsEarned },
        data: { usageCount: { increment: 1 }, usagePointsEarned: newTotal },
      });
      if (claimed.count === 0) continue; // xung dot voi 1 lan ghi khac — doc lai va thu lai

      try {
        await pointsService.addPoints(sub.userId, pointsToAdd, PointReason.SUBMISSION_USED, {
          submissionId: sub.id,
          questionBankId: sub.questionBankId,
        });
      } catch (err) {
        console.error('[QuestionBankService] fireUsagePointsTrigger addPoints error:', err);
      }

      try {
        await notificationService.createNotification({
          userId: sub.userId,
          type: 'SUBMISSION_USED',
          title: '📝 Câu hỏi của bạn được dùng trong đề thi!',
          body: `Câu hỏi bạn đóng góp vừa được thêm vào 1 đề thi. Bạn nhận được +${pointsToAdd} điểm.`,
          targetScreen: null,
          metadata: { submissionId: sub.id, pointsAwarded: pointsToAdd, totalUsagePoints: newTotal },
        });
      } catch (err) {
        console.error('[QuestionBankService] fireUsagePointsTrigger notify error:', err);
      }
      return;
    }

    console.error(
      `[QuestionBankService] awardUsagePointsForSubmission: het ${MAX_CAS_RETRY} lan thu CAS cho submission ${submissionId}, bo qua lan cong diem nay.`,
    );
  }

  // -------------------------------------------------------------------------
  // Lay cau tu kho tu dong theo ti le do kho (50% de / 30% tb / 20% kho)
  // -------------------------------------------------------------------------

  /**
   * Lay ngau nhien N cau tu kho cung mon voi de thi, theo ti le:
   *   50% de (difficulty=1), 30% trung binh (2), 20% kho (3).
   * Cau da ton tai trong de thi se bi bo qua, khong tinh vao `added`.
   * Neu kho khong du cau cho 1 muc do, lay tat ca so cau con lai cua muc do do.
   * Boc trong transaction de tranh race condition: concurrent request cung paperId
   * co the doc existingBankIds giong nhau va insert duplicate neu khong co transaction.
   */
  async autoFillFromBank(
    examPaperId: string,
    input: AutoFillFromBankInput,
  ): Promise<AutoFillFromBankResult> {
    const paper = await prisma.examPaper.findUnique({ where: { id: examPaperId } });
    if (!paper) throw new ExamPaperNotFoundError(examPaperId);

    const { count } = input;
    // Tinh so cau theo tung do kho; muc kho nhan phan con lai de tranh lech do lam tron.
    const easyCount   = Math.round(count * 0.5);
    const mediumCount = Math.round(count * 0.3);
    const hardCount   = count - easyCount - mediumCount;

    type BankRow = {
      id: string;
      chapter: string | null;
      difficulty: number;
      questionType: string;
      points: number;
      questionText: string;
      options: Prisma.JsonValue;
      correctAnswer: Prisma.JsonValue;
      explanation: string | null;
      examYear: number | null;
      examCode: string | null;
    };

    return prisma.$transaction(async (tx) => {
      // Doc existingBankIds ben trong transaction de dam bao atomic voi phan insert phia duoi.
      const existingLinks = await tx.examQuestion.findMany({
        where: { examPaperId, questionBankId: { not: null } },
        select: { questionBankId: true },
      });
      const existingBankIds = new Set(existingLinks.map((q) => q.questionBankId!));

      /**
       * Lay ngau nhien `need` cau tu kho theo do kho `diff`, loai bo nhung cau da co
       * trong de thi. Shuffle bang Fisher-Yates sau khi lay de tranh lech vi tri.
       */
      const pickRandom = async (diff: number, need: number): Promise<BankRow[]> => {
        if (need <= 0) return [];
        const available = await tx.questionBank.findMany({
          where: {
            subject: paper.subject,
            difficulty: diff,
            isActive: true,
            id: existingBankIds.size > 0 ? { notIn: [...existingBankIds] } : undefined,
          },
          select: {
            id: true,
            chapter: true,
            difficulty: true,
            questionType: true,
            points: true,
            questionText: true,
            options: true,
            correctAnswer: true,
            explanation: true,
            examYear: true,
            examCode: true,
          },
        });
        // Fisher-Yates shuffle de dam bao random thuc su, khong phu thuoc thu tu DB.
        for (let i = available.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [available[i], available[j]] = [available[j]!, available[i]!];
        }
        return available.slice(0, need);
      };

      const [easy, medium, hard] = await Promise.all([
        pickRandom(1, easyCount),
        pickRandom(2, mediumCount),
        pickRandom(3, hardCount),
      ]);

      const toInsert: BankRow[] = [...easy, ...medium, ...hard];
      const shortage = count - toInsert.length;

      if (toInsert.length === 0) {
        return { added: 0, skipped: 0, shortage };
      }

      await tx.examQuestion.createMany({
        data: toInsert.map((q) => ({
          examPaperId,
          questionBankId: q.id,
          chapter: q.chapter,
          difficulty: q.difficulty,
          questionType: q.questionType,
          points: q.points,
          questionText: q.questionText,
          options: q.options ?? Prisma.JsonNull,
          correctAnswer: q.correctAnswer as Prisma.InputJsonValue,
          explanation: q.explanation,
          examYear: q.examYear,
          examCode: q.examCode,
        })),
      });

      return { added: toInsert.length, skipped: 0, shortage };
    });
  }
}

/** Instance dung chung (singleton). */
export const questionBankService = new QuestionBankService();
