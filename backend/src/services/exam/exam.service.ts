// ============================================================================
// ExamService — xu ly toan bo logic Thi thu:
//   - Admin: CRUD de thi + cau hoi (3 dang: MCQ_4, TRUE_FALSE_4, FILL_BLANK)
//   - Hoc sinh: bat dau phien (chon de cong bang), nop bai (cham diem +
//     thuong diem), xem ket qua chi tiet (phan tich theo chuong, cau sai)
// ============================================================================
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { OptimisticLockError, OptimisticLockRetryableError, PointsInsufficientError } from '../points/points.errors.js';
import { pointsService } from '../points/points.service.js';
import { PointReason } from '../points/points.types.js';
import { isValidSubjectId } from '../users/users.types.js';
import {
  ExamExpiredError,
  ExamInsufficientPointsError,
  ExamInvalidSubjectError,
  ExamPaperEmptyError,
  ExamPaperNotFoundError,
  ExamQuestionInvalidError,
  ExamQuestionNotFoundError,
  ExamSessionAlreadyCompletedError,
  ExamSessionNotCompletedError,
  ExamSessionNotFoundError,
  ExamSessionNotOwnedError,
} from './exam.errors.js';
import { wrongAnswerService } from '../wrongAnswer/wrongAnswer.service.js';
import {
  EXAM_ENTRY_FEE,
  EXAM_GRACE_SECONDS,
  TRUE_FALSE_SCORE_RATIOS,
  getExamBonusPoints,
} from './exam.types.js';
import type {
  CreateExamPaperInput,
  CreateExamQuestionInput,
  ExamChapterAnalysis,
  ExamPaperDetailDto,
  ExamPaperSummaryDto,
  ExamQuestionFullDto,
  ExamQuestionPublicDto,
  ExamQuestionType,
  ExamResultResponse,
  ExamSessionStatus,
  ExamWrongAnswerItem,
  StartExamResponse,
  SubmitExamAnswerInput,
  SubmitExamResponse,
  UpdateExamPaperInput,
  UpdateExamQuestionInput,
} from './exam.types.js';

/** So lan retry toi da khi gap optimistic lock conflict (cong/tru diem atomic). */
const MAX_EXAM_RETRY = 10;

// ---------------------------------------------------------------------------
// Helpers noi bo
// ---------------------------------------------------------------------------

/** Delay voi jitter ngan de giam xac suat "thundering herd" khi retry. */
function delayJitter(): Promise<void> {
  const ms = 10 + Math.random() * 40;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Xao tron mang (Fisher-Yates) — tra ve mang moi, khong sua in-place. */
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Chuan hoa dap an FILL_BLANK de so sanh: trim, lowercase, gop khoang trang lien tiep. */
export function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Kieu rut gon cua ExamQuestion - dung cho cac ham helper khong can toan bo cot. */
type ExamQuestionRow = {
  id: string;
  examPaperId: string;
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
};

/** Chuyen ExamQuestion sang ExamQuestionFullDto (danh cho admin - co dap an dung). */
function toFullDto(q: ExamQuestionRow): ExamQuestionFullDto {
  return {
    id: q.id,
    examPaperId: q.examPaperId,
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

/** Chuyen ExamQuestion sang ExamQuestionPublicDto (danh cho hoc sinh - AN dap an dung). */
function toPublicDto(q: ExamQuestionRow): ExamQuestionPublicDto {
  return {
    id: q.id,
    chapter: q.chapter,
    difficulty: q.difficulty,
    questionType: q.questionType as ExamQuestionType,
    points: q.points,
    questionText: q.questionText,
    options: q.options,
  };
}

/**
 * Kiem tra `options`/`correctAnswer` co dung dinh dang theo `questionType` hay khong.
 * Dung chung cho API admin tao/sua cau hoi VA import Excel (TASK4) - moi loi se
 * duoc bat boi caller va chuyen thanh thong bao phu hop (HTTP 400 hoac loi theo dong).
 *
 * @throws ExamQuestionInvalidError neu khong khop dinh dang
 */
export function validateQuestionShape(
  questionType: ExamQuestionType,
  options: unknown,
  correctAnswer: unknown,
): void {
  switch (questionType) {
    case 'MCQ_4': {
      if (
        !Array.isArray(options) ||
        options.length !== 4 ||
        !options.every((o) => typeof o === 'string' && o.trim().length > 0)
      ) {
        throw new ExamQuestionInvalidError(
          'Cau hoi MCQ_4 can dung 4 lua chon (options) dang chuoi khong rong.',
        );
      }
      if (
        typeof correctAnswer !== 'number' ||
        !Number.isInteger(correctAnswer) ||
        correctAnswer < 0 ||
        correctAnswer > 3
      ) {
        throw new ExamQuestionInvalidError('Cau hoi MCQ_4 can correctAnswer la so nguyen tu 0 den 3.');
      }
      break;
    }
    case 'TRUE_FALSE_4': {
      if (
        !Array.isArray(options) ||
        options.length !== 4 ||
        !options.every((o) => typeof o === 'string' && o.trim().length > 0)
      ) {
        throw new ExamQuestionInvalidError(
          'Cau hoi TRUE_FALSE_4 can dung 4 phat bieu (options) dang chuoi khong rong.',
        );
      }
      if (
        !Array.isArray(correctAnswer) ||
        correctAnswer.length !== 4 ||
        !correctAnswer.every((v) => typeof v === 'boolean')
      ) {
        throw new ExamQuestionInvalidError(
          'Cau hoi TRUE_FALSE_4 can correctAnswer la mang 4 gia tri true/false.',
        );
      }
      break;
    }
    case 'FILL_BLANK': {
      if (
        !Array.isArray(correctAnswer) ||
        correctAnswer.length === 0 ||
        !correctAnswer.every((v) => typeof v === 'string' && v.trim().length > 0)
      ) {
        throw new ExamQuestionInvalidError(
          'Cau hoi FILL_BLANK can correctAnswer la mang it nhat 1 dap an dang chuoi khong rong.',
        );
      }
      break;
    }
  }
}

/**
 * Cham diem 1 cau hoi theo dap an user gui len, tra ve so diem dat duoc (0 .. q.points).
 *
 * - MCQ_4: dung hoan toan -> +points, sai -> 0.
 * - TRUE_FALSE_4: dem so y dung (0-4) trong 4 phat bieu, tra ve points * TRUE_FALSE_SCORE_RATIOS[soYDung].
 *   Y khong duoc tra loi (khong phai boolean) tinh la SAI.
 * - FILL_BLANK: chuan hoa (trim, lowercase, gop khoang trang) roi so sanh voi tung
 *   dap an duoc admin chap nhan - khop 1 trong so do -> +points, khong khop -> 0.
 */
function gradeQuestion(
  question: { questionType: string; points: number; correctAnswer: Prisma.JsonValue },
  selectedAnswer: unknown,
): number {
  switch (question.questionType) {
    case 'MCQ_4': {
      const correct = question.correctAnswer;
      return typeof selectedAnswer === 'number' &&
        typeof correct === 'number' &&
        selectedAnswer === correct
        ? question.points
        : 0;
    }
    case 'TRUE_FALSE_4': {
      const correct = Array.isArray(question.correctAnswer) ? question.correctAnswer : [];
      const selected = Array.isArray(selectedAnswer) ? selectedAnswer : [];

      let correctCount = 0;
      for (let i = 0; i < 4; i++) {
        const expected = correct[i];
        const actual = selected[i];
        if (typeof expected === 'boolean' && typeof actual === 'boolean' && expected === actual) {
          correctCount += 1;
        }
      }

      const ratio = TRUE_FALSE_SCORE_RATIOS[correctCount] ?? 0;
      return question.points * ratio;
    }
    case 'FILL_BLANK': {
      const acceptable = Array.isArray(question.correctAnswer)
        ? question.correctAnswer
            .filter((a): a is string => typeof a === 'string')
            .map(normalizeAnswer)
        : [];
      const selected = typeof selectedAnswer === 'string' ? normalizeAnswer(selectedAnswer) : '';
      return selected !== '' && acceptable.includes(selected) ? question.points : 0;
    }
    default:
      return 0;
  }
}

/**
 * Chon 1 de thi "cong bang" cho user trong 1 mon hoc:
 *   1. Lay cac de dang kich hoat, co >= 1 cau hoi dang kich hoat.
 *   2. Dem so lan user da thi tung de (ExamSession).
 *   3. Random DEU trong nhom de co so lan thi = MIN (tao "round-robin" tu nhien).
 *
 * @throws ExamPaperEmptyError neu mon hoc khong co de thi hop le nao.
 */
async function pickFairExamPaper(
  userId: string,
  subjectId: string,
): Promise<{ id: string; title: string; durationMinutes: number }> {
  const papers = await prisma.examPaper.findMany({
    where: { subject: subjectId, isActive: true },
    select: { id: true, title: true, durationMinutes: true },
  });

  if (papers.length === 0) throw new ExamPaperEmptyError(subjectId);

  const paperIds = papers.map((p) => p.id);

  const questionCounts = await prisma.examQuestion.groupBy({
    by: ['examPaperId'],
    where: { examPaperId: { in: paperIds }, isActive: true },
    _count: { id: true },
  });
  const questionCountMap = new Map(questionCounts.map((c) => [c.examPaperId, c._count.id]));

  const eligiblePapers = papers.filter((p) => (questionCountMap.get(p.id) ?? 0) > 0);
  if (eligiblePapers.length === 0) throw new ExamPaperEmptyError(subjectId);

  const attemptCounts = await prisma.examSession.groupBy({
    by: ['examPaperId'],
    where: { userId, examPaperId: { in: eligiblePapers.map((p) => p.id) } },
    _count: { id: true },
  });
  const attemptCountMap = new Map(attemptCounts.map((c) => [c.examPaperId, c._count.id]));

  const withAttempts = eligiblePapers.map((p) => ({
    ...p,
    attemptCount: attemptCountMap.get(p.id) ?? 0,
  }));
  const minAttempts = Math.min(...withAttempts.map((p) => p.attemptCount));
  const candidates = withAttempts.filter((p) => p.attemptCount === minAttempts);

  return candidates[Math.floor(Math.random() * candidates.length)]!;
}

// ---------------------------------------------------------------------------
// ExamService class
// ---------------------------------------------------------------------------

export class ExamService {
  // -------------------------------------------------------------------------
  // ADMIN: De thi (ExamPaper)
  // -------------------------------------------------------------------------

  /** Tao moi 1 de thi (chua co cau hoi). */
  async createExamPaper(input: CreateExamPaperInput): Promise<ExamPaperSummaryDto> {
    const paper = await prisma.examPaper.create({
      data: {
        subject: input.subject,
        title: input.title,
        durationMinutes: input.durationMinutes,
      },
    });

    return {
      id: paper.id,
      subject: paper.subject,
      title: paper.title,
      durationMinutes: paper.durationMinutes,
      isActive: paper.isActive,
      questionCount: 0,
      createdAt: paper.createdAt,
    };
  }

  /** Lay danh sach de thi, kem so cau hoi dang kich hoat trong tung de. */
  async listExamPapers(subject?: string): Promise<ExamPaperSummaryDto[]> {
    const where: Prisma.ExamPaperWhereInput = subject !== undefined ? { subject } : {};

    const papers = await prisma.examPaper.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    if (papers.length === 0) return [];

    const counts = await prisma.examQuestion.groupBy({
      by: ['examPaperId'],
      where: { examPaperId: { in: papers.map((p) => p.id) }, isActive: true },
      _count: { id: true },
    });
    const countMap = new Map(counts.map((c) => [c.examPaperId, c._count.id]));

    return papers.map((p) => ({
      id: p.id,
      subject: p.subject,
      title: p.title,
      durationMinutes: p.durationMinutes,
      isActive: p.isActive,
      questionCount: countMap.get(p.id) ?? 0,
      createdAt: p.createdAt,
    }));
  }

  /** Lay chi tiet 1 de thi kem TOAN BO cau hoi (ca dang an, danh cho admin). */
  async getExamPaperDetail(examPaperId: string): Promise<ExamPaperDetailDto> {
    const paper = await prisma.examPaper.findUnique({ where: { id: examPaperId } });
    if (!paper) throw new ExamPaperNotFoundError(examPaperId);

    const questions = await prisma.examQuestion.findMany({
      where: { examPaperId },
      orderBy: { createdAt: 'asc' },
    });

    return {
      id: paper.id,
      subject: paper.subject,
      title: paper.title,
      durationMinutes: paper.durationMinutes,
      isActive: paper.isActive,
      questionCount: questions.filter((q) => q.isActive).length,
      createdAt: paper.createdAt,
      questions: questions.map(toFullDto),
    };
  }

  /** Cap nhat thong tin de thi (tieu de, thoi gian lam bai, trang thai kich hoat). */
  async updateExamPaper(examPaperId: string, input: UpdateExamPaperInput): Promise<ExamPaperSummaryDto> {
    const existing = await prisma.examPaper.findUnique({ where: { id: examPaperId } });
    if (!existing) throw new ExamPaperNotFoundError(examPaperId);

    const paper = await prisma.examPaper.update({
      where: { id: examPaperId },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.durationMinutes !== undefined && { durationMinutes: input.durationMinutes }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });

    const questionCount = await prisma.examQuestion.count({
      where: { examPaperId, isActive: true },
    });

    return {
      id: paper.id,
      subject: paper.subject,
      title: paper.title,
      durationMinutes: paper.durationMinutes,
      isActive: paper.isActive,
      questionCount,
      createdAt: paper.createdAt,
    };
  }

  // -------------------------------------------------------------------------
  // ADMIN: Cau hoi (ExamQuestion)
  // -------------------------------------------------------------------------

  /** Them 1 cau hoi vao de thi. */
  async createExamQuestion(
    examPaperId: string,
    input: CreateExamQuestionInput,
  ): Promise<ExamQuestionFullDto> {
    const paper = await prisma.examPaper.findUnique({ where: { id: examPaperId } });
    if (!paper) throw new ExamPaperNotFoundError(examPaperId);

    validateQuestionShape(input.questionType, input.options ?? null, input.correctAnswer);

    const q = await prisma.examQuestion.create({
      data: {
        examPaperId,
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

    return toFullDto(q);
  }

  /** Cap nhat 1 cau hoi trong de thi. */
  async updateExamQuestion(
    examPaperId: string,
    questionId: string,
    input: UpdateExamQuestionInput,
  ): Promise<ExamQuestionFullDto> {
    const existing = await prisma.examQuestion.findUnique({ where: { id: questionId } });
    if (!existing || existing.examPaperId !== examPaperId) {
      throw new ExamQuestionNotFoundError(questionId);
    }

    // Neu co thay doi lien quan den dang cau hoi/options/correctAnswer -> validate lai
    // toan bo theo dang cau hoi MOI (mac dinh giu nguyen gia tri cu cho phan khong doi).
    if (
      input.questionType !== undefined ||
      input.options !== undefined ||
      input.correctAnswer !== undefined
    ) {
      const questionType = (input.questionType ?? existing.questionType) as ExamQuestionType;
      const options = input.options !== undefined ? input.options : existing.options;
      const correctAnswer = input.correctAnswer !== undefined ? input.correctAnswer : existing.correctAnswer;
      validateQuestionShape(questionType, options, correctAnswer);
    }

    const q = await prisma.examQuestion.update({
      where: { id: questionId },
      data: {
        ...(input.chapter !== undefined && { chapter: input.chapter ?? null }),
        ...(input.difficulty !== undefined && { difficulty: input.difficulty }),
        ...(input.questionType !== undefined && { questionType: input.questionType }),
        ...(input.points !== undefined && { points: input.points }),
        ...(input.questionText !== undefined && { questionText: input.questionText }),
        ...(input.options !== undefined && { options: input.options as Prisma.InputJsonValue }),
        ...(input.correctAnswer !== undefined && {
          correctAnswer: input.correctAnswer as Prisma.InputJsonValue,
        }),
        ...(input.explanation !== undefined && { explanation: input.explanation ?? null }),
        ...(input.examYear !== undefined && { examYear: input.examYear ?? null }),
        ...(input.examCode !== undefined && { examCode: input.examCode ?? null }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });

    return toFullDto(q);
  }

  /**
   * Xoa cau hoi khoi de thi.
   * Hard delete neu chua co ExamAnswer nao tham chieu den cau nay (chua ai lam).
   * Soft delete (isActive=false) neu da co ExamAnswer - giu lich su de trang ket qua cu khong bi vo.
   */
  async deleteExamQuestion(examPaperId: string, questionId: string): Promise<void> {
    const existing = await prisma.examQuestion.findUnique({ where: { id: questionId } });
    if (!existing || existing.examPaperId !== examPaperId) {
      throw new ExamQuestionNotFoundError(questionId);
    }

    const answerCount = await prisma.examAnswer.count({ where: { examQuestionId: questionId } });
    if (answerCount > 0) {
      await prisma.examQuestion.update({ where: { id: questionId }, data: { isActive: false } });
    } else {
      await prisma.examQuestion.delete({ where: { id: questionId } });
    }
  }

  // -------------------------------------------------------------------------
  // HOC SINH: Thi thu
  // -------------------------------------------------------------------------

  /**
   * Bat dau phien thi thu moi cho 1 mon hoc:
   *   1. Chon de thi "cong bang" (xem pickFairExamPaper).
   *   2. Tru EXAM_ENTRY_FEE diem (atomic voi tao session - cung 1 transaction).
   *   3. Tra ve de thi voi cau hoi da AN dap an dung, thu tu xao tron.
   *
   * @throws ExamInvalidSubjectError neu subjectId khong hop le
   * @throws ExamPaperEmptyError neu mon hoc chua co de thi hop le
   * @throws ExamInsufficientPointsError neu user khong du EXAM_ENTRY_FEE diem
   */
  async startExam(userId: string, subjectId: string): Promise<StartExamResponse> {
    if (!isValidSubjectId(subjectId)) throw new ExamInvalidSubjectError(subjectId);

    const chosenPaper = await pickFairExamPaper(userId, subjectId);

    for (let attempt = 1; attempt <= MAX_EXAM_RETRY; attempt++) {
      try {
        return await prisma.$transaction(async (tx) => {
          try {
            await pointsService.deductPointsInTx(tx, userId, EXAM_ENTRY_FEE, PointReason.THI_THU_ENTRY_FEE, {
              examPaperId: chosenPaper.id,
            });
          } catch (err) {
            if (err instanceof PointsInsufficientError) throw new ExamInsufficientPointsError();
            throw err;
          }

          const session = await tx.examSession.create({
            data: {
              userId,
              examPaperId: chosenPaper.id,
              subjectId,
              durationMinutes: chosenPaper.durationMinutes,
              status: 'IN_PROGRESS',
            },
          });

          const questions = await tx.examQuestion.findMany({
            where: { examPaperId: chosenPaper.id, isActive: true },
          });

          return {
            sessionId: session.id,
            examPaperId: chosenPaper.id,
            subject: subjectId,
            title: chosenPaper.title,
            durationMinutes: chosenPaper.durationMinutes,
            startedAt: session.startedAt,
            questions: shuffle(questions).map(toPublicDto),
          };
        });
      } catch (err) {
        if (err instanceof OptimisticLockRetryableError) {
          if (attempt === MAX_EXAM_RETRY) throw new OptimisticLockError(userId, MAX_EXAM_RETRY);
          await delayJitter();
          continue;
        }
        throw err;
      }
    }

    throw new OptimisticLockError(userId, MAX_EXAM_RETRY);
  }

  /**
   * Nop bai thi thu: cham diem theo 3 dang cau hoi, quy doi ve thang 10,
   * cong diem thuong (neu co) theo bang diem thuong.
   *
   * Kiem tra thoi gian TRUOC khi vao transaction cham diem: neu da qua
   * (durationMinutes * 60 + EXAM_GRACE_SECONDS) giay tinh tu startedAt thi
   * danh dau session la EXPIRED, KHONG cham diem va KHONG hoan/doi diem da tru.
   *
   * @throws ExamSessionNotFoundError / ExamSessionNotOwnedError
   * @throws ExamSessionAlreadyCompletedError neu da nop bai truoc do
   * @throws ExamExpiredError neu het gio lam bai
   */
  async submitExam(
    userId: string,
    sessionId: string,
    answers: SubmitExamAnswerInput[],
  ): Promise<SubmitExamResponse> {
    const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new ExamSessionNotFoundError(sessionId);
    if (session.userId !== userId) throw new ExamSessionNotOwnedError(sessionId);
    if (session.status === 'COMPLETED') throw new ExamSessionAlreadyCompletedError(sessionId);
    if (session.status === 'EXPIRED') throw new ExamExpiredError(sessionId);

    const deadlineMs =
      session.startedAt.getTime() + session.durationMinutes * 60_000 + EXAM_GRACE_SECONDS * 1000;

    if (Date.now() > deadlineMs) {
      await prisma.examSession.update({
        where: { id: sessionId },
        data: { status: 'EXPIRED', completedAt: new Date() },
      });
      throw new ExamExpiredError(sessionId);
    }

    const answerMap = new Map(answers.map((a) => [a.examQuestionId, a.selectedAnswer]));

    // ID các câu sai — được set sau khi transaction commit thành công để upsert
    // không bị gọi nhiều lần khi transaction retry do optimistic lock conflict.
    let committedWrongIds: string[] = [];

    for (let attempt = 1; attempt <= MAX_EXAM_RETRY; attempt++) {
      try {
        const txResult = await prisma.$transaction(async (tx) => {
          const freshSession = await tx.examSession.findUnique({ where: { id: sessionId } });
          if (!freshSession || freshSession.status !== 'IN_PROGRESS') {
            throw new ExamSessionAlreadyCompletedError(sessionId);
          }

          const questions = await tx.examQuestion.findMany({
            where: { examPaperId: freshSession.examPaperId, isActive: true },
            orderBy: { createdAt: 'asc' },
          });

          let totalPoints = 0;
          let totalEarned = 0;
          const answerRecords: Prisma.ExamAnswerCreateManyInput[] = [];

          for (const q of questions) {
            totalPoints += q.points;
            const rawAnswer = answerMap.get(q.id);
            const pointsEarned = gradeQuestion(q, rawAnswer);
            totalEarned += pointsEarned;

            // "{}" la sentinel cho "chua tra loi" - hop le voi moi dang Json
            // va duoc gradeQuestion tinh la sai (xem cac nhanh switch ben tren).
            const selectedAnswerValue: Prisma.InputJsonValue =
              rawAnswer === undefined || rawAnswer === null ? {} : (rawAnswer as Prisma.InputJsonValue);

            answerRecords.push({
              sessionId,
              examQuestionId: q.id,
              selectedAnswer: selectedAnswerValue,
              pointsEarned,
            });
          }

          const score = totalPoints > 0 ? Math.round((totalEarned / totalPoints) * 100) / 10 : 0;
          const pointsAwarded = getExamBonusPoints(score);

          if (answerRecords.length > 0) {
            await tx.examAnswer.createMany({ data: answerRecords, skipDuplicates: true });
          }

          // QUAN TRONG: addPoints yeu cau amount > 0 - score < 7.0 (pointsAwarded = 0)
          // thi KHONG goi addPointsInTx, chi ghi score/pointsAwarded vao ExamSession.
          if (pointsAwarded > 0) {
            await pointsService.addPointsInTx(tx, userId, pointsAwarded, PointReason.THI_THU_RESULT, {
              sessionId,
              score,
            });
          }

          // Dieu kien `status: 'IN_PROGRESS'` trong WHERE bien update nay thanh
          // "chot phien" co kiem tra dieu kien (giong updateMany + version cua
          // PointsService). Neu pointsAwarded === 0 thi khong di qua addPointsInTx
          // (khong co optimistic lock) - 2 request nop bai dong thoi cho CUNG 1
          // phien deu co the vuot qua check `freshSession.status` o tren (Read
          // Committed). Buoc nay dam bao chi 1 trong 2 thuc su "chot" duoc phien;
          // request con lai nhan count=0 -> ExamSessionAlreadyCompletedError.
          const closeResult = await tx.examSession.updateMany({
            where: { id: sessionId, status: 'IN_PROGRESS' },
            data: { status: 'COMPLETED', score, pointsAwarded, completedAt: new Date() },
          });
          if (closeResult.count === 0) {
            throw new ExamSessionAlreadyCompletedError(sessionId);
          }

          // Thu thap id cau sai de upsert SAU KHI transaction commit — tranh goi
          // nhieu lan neu transaction bi retry do optimistic lock conflict.
          const wrongIds = questions
            .filter((q) => {
              const earned = answerRecords.find((a) => a.examQuestionId === q.id)?.pointsEarned ?? 0;
              return earned < q.points;
            })
            .map((q) => q.id);

          return { sessionId, score, pointsAwarded, wrongIds };
        });

        // Ghi nhận câu sai NGOÀI transaction — chỉ chạy 1 lần sau khi commit thành công
        committedWrongIds = txResult.wrongIds;
        if (committedWrongIds.length > 0) {
          void Promise.all(
            committedWrongIds.map((qId) =>
              wrongAnswerService.upsertWrongAnswer(userId, qId, 'exam').catch((err) => {
                console.warn('[ExamService] upsertWrongAnswer that bai (bo qua):', (err as Error).message);
              }),
            ),
          );
        }

        return { sessionId: txResult.sessionId, score: txResult.score, pointsAwarded: txResult.pointsAwarded };
      } catch (err) {
        if (err instanceof OptimisticLockRetryableError) {
          if (attempt === MAX_EXAM_RETRY) throw new OptimisticLockError(userId, MAX_EXAM_RETRY);
          await delayJitter();
          continue;
        }
        throw err;
      }
    }

    throw new OptimisticLockError(userId, MAX_EXAM_RETRY);
  }

  /**
   * Lay ket qua chi tiet 1 phien thi thu da hoan thanh (COMPLETED hoac EXPIRED):
   * diem so, diem thuong, phan tich theo chuong, danh sach cau sai kem giai thich.
   *
   * @throws ExamSessionNotFoundError / ExamSessionNotOwnedError
   * @throws ExamSessionNotCompletedError neu phien dang IN_PROGRESS (chua co ket qua)
   */
  async getExamResult(userId: string, sessionId: string): Promise<ExamResultResponse> {
    const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new ExamSessionNotFoundError(sessionId);
    if (session.userId !== userId) throw new ExamSessionNotOwnedError(sessionId);
    if (session.status === 'IN_PROGRESS') throw new ExamSessionNotCompletedError(sessionId);

    const [questions, answers] = await Promise.all([
      prisma.examQuestion.findMany({
        where: { examPaperId: session.examPaperId },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.examAnswer.findMany({ where: { sessionId } }),
    ]);

    const answerMap = new Map(answers.map((a) => [a.examQuestionId, a]));
    const chapterMap = new Map<string, ExamChapterAnalysis>();
    const wrongAnswers: ExamWrongAnswerItem[] = [];

    for (const q of questions) {
      const chapter = q.chapter ?? 'Khac';
      const entry = chapterMap.get(chapter) ?? {
        chapter,
        correctCount: 0,
        totalCount: 0,
        pointsEarned: 0,
        pointsTotal: 0,
      };

      entry.totalCount += 1;
      entry.pointsTotal += q.points;

      const answer = answerMap.get(q.id);
      const pointsEarned = answer?.pointsEarned ?? 0;
      entry.pointsEarned += pointsEarned;

      if (pointsEarned >= q.points) {
        entry.correctCount += 1;
      } else {
        wrongAnswers.push({
          examQuestionId: q.id,
          questionText: q.questionText,
          questionType: q.questionType as ExamQuestionType,
          chapter: q.chapter,
          options: q.options,
          correctAnswer: q.correctAnswer,
          selectedAnswer: answer?.selectedAnswer ?? null,
          explanation: q.explanation,
          points: q.points,
          pointsEarned,
        });
      }

      chapterMap.set(chapter, entry);
    }

    return {
      sessionId,
      status: session.status as ExamSessionStatus,
      score: session.score ?? 0,
      pointsAwarded: session.pointsAwarded,
      totalQuestions: questions.length,
      chapterAnalysis: [...chapterMap.values()],
      wrongAnswers,
    };
  }
}

/** Instance dung chung (singleton) - dung truc tiep o cac noi khac trong backend. */
export const examService = new ExamService();
