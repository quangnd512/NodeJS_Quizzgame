// ============================================================================
// PracticeService — xu ly toan bo logic On tap:
//   - Rut cau hoi ngau nhien (filter 24h, fallback)
//   - Tiep nhan tra loi (idempotency qua @@unique)
//   - Hoan thanh phien (tinh diem, cong diem atomic voi retry)
//   - Thong ke, lich su
//   - Bao cao cau hoi sai (auto-hide khi >= 5 bao cao PENDING)
// ============================================================================
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { OptimisticLockError, OptimisticLockRetryableError } from '../points/points.errors.js';
import { pointsService } from '../points/points.service.js';
import { isValidSubjectId } from '../users/users.types.js';
import { computeStreaks, STREAK_MILESTONES } from '../../utils/streak.utils.js';
import { notificationService } from '../notification/notification.service.js';
import {
  PracticeRateLimitError,
  PracticeSessionAlreadyCompletedError,
  PracticeSessionExpiredError,
  PracticeSessionNotFoundError,
  PracticeSessionNotOwnedError,
  QuestionNotAttemptedError,
  QuestionNotAttemptedForReportError,
  QuestionNotFoundError,
  QuestionNotInSessionError,
  QuestionReportNotFoundError,
  ReportAlreadySubmittedError,
  SubjectHasNoQuestionsError,
  SubjectNotRegisteredError,
} from './practice.errors.js';
import type {
  AnswerResponse,
  AnswerSummary,
  CompleteSessionResponse,
  CreateQuestionInput,
  HistoryItem,
  ListReportsParams,
  PaginatedHistory,
  PracticeStats,
  QuestionFullDto,
  QuestionPublicDto,
  QuestionReportDto,
  QuestionReportSummary,
  ReportStatus,
  ResolvableReportStatus,
  ResolveReportQuestionUpdate,
  ResolveReportResult,
  SessionDetailResponse,
  StartSessionResponse,
  UpdateQuestionInput,
} from './practice.types.js';
import {
  AUTO_HIDE_REPORT_THRESHOLD,
  MAX_COMPLETE_RETRY,
  MAX_SESSIONS_PER_HOUR,
  QUESTIONS_PER_DIFFICULTY,
  QUESTIONS_PER_SESSION,
  REPORT_STATUSES,
  SESSION_TIMEOUT_SECONDS,
} from './practice.types.js';
import { wrongAnswerService } from '../wrongAnswer/wrongAnswer.service.js';

// ---------------------------------------------------------------------------
// Helpers noi bo
// ---------------------------------------------------------------------------

/** Kiem tra loi co phai "Unique constraint failed" cua Prisma (P2002) hay khong. */
function isUniqueConstraintError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  );
}

/** Lay danh sach questionId tu truong Json cua PracticeSession. */
function parseSessionQuestions(questions: Prisma.JsonValue): string[] {
  if (!Array.isArray(questions)) return [];
  return questions.filter((q): q is string => typeof q === 'string');
}

/** Lay 4 options tu truong Json cua Question. */
function parseOptions(options: Prisma.JsonValue): string[] {
  if (!Array.isArray(options)) return [];
  return options.filter((o): o is string => typeof o === 'string');
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

/** Chuyen Question Prisma model sang QuestionPublicDto (khong co correctAnswer). */
function toPublicDto(q: {
  id: string;
  subject: string;
  chapter: string | null;
  difficulty: number;
  question: string;
  options: Prisma.JsonValue;
}): QuestionPublicDto {
  return {
    id: q.id,
    subject: q.subject,
    chapter: q.chapter,
    difficulty: q.difficulty,
    question: q.question,
    options: parseOptions(q.options),
  };
}

/** Chuyen Question Prisma model sang QuestionFullDto (co correctAnswer). */
function toFullDto(q: {
  id: string;
  subject: string;
  chapter: string | null;
  difficulty: number;
  question: string;
  options: Prisma.JsonValue;
  correctAnswer: number;
  explanation: string | null;
  examYear: number | null;
  examCode: string | null;
  isActive: boolean;
  createdAt: Date;
}): QuestionFullDto {
  return {
    ...toPublicDto(q),
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    examYear: q.examYear,
    examCode: q.examCode,
    isActive: q.isActive,
    createdAt: q.createdAt,
  };
}

/** Delay voi jitter ngan de giam xac suat "thundering herd" khi retry. */
function delayJitter(): Promise<void> {
  const ms = 10 + Math.random() * 40;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Rut cau hoi cho 1 do kho
// ---------------------------------------------------------------------------

/**
 * Lay toi da `count` cau hoi cho 1 do kho, uu tien cau chua lam trong 24h.
 * Neu khong du thi fill them tu cac cau da lam gan day.
 */
async function fetchQuestionsForDifficulty(
  subject: string,
  difficulty: number,
  excludeRecentIds: string[],
  count: number,
): Promise<QuestionPublicDto[]> {
  // Fetch nhieu hon count de co du lieu xao tron ngau nhien
  const fetchLimit = Math.max(count * 3, 20);

  // Buoc 1: lay cau chua lam trong 24h
  const freshCandidates = await prisma.question.findMany({
    where: {
      subject,
      difficulty,
      isActive: true,
      ...(excludeRecentIds.length > 0 ? { id: { notIn: excludeRecentIds } } : {}),
    },
    take: fetchLimit,
    select: { id: true, subject: true, chapter: true, difficulty: true, question: true, options: true },
  });

  const picked = shuffle(freshCandidates).slice(0, count);

  if (picked.length >= count) {
    return picked.map(toPublicDto);
  }

  // Buoc 2: chua du — fill them tu tat ca cac cau con lai (ke ca cau da lam gan day)
  const alreadyPickedIds = picked.map((q) => q.id);
  const remaining = await prisma.question.findMany({
    where: {
      subject,
      difficulty,
      isActive: true,
      id: { notIn: alreadyPickedIds },
    },
    take: fetchLimit,
    select: { id: true, subject: true, chapter: true, difficulty: true, question: true, options: true },
  });

  const extra = shuffle(remaining).slice(0, count - picked.length);
  return [...picked, ...extra].map(toPublicDto);
}

// ---------------------------------------------------------------------------
// PracticeService class
// ---------------------------------------------------------------------------

export class PracticeService {
  // -------------------------------------------------------------------------
  // PRACTICE ENDPOINTS
  // -------------------------------------------------------------------------

  /**
   * Bat dau phien on tap moi.
   * Rut 15 cau (5 de + 5 trung + 5 kho), uu tien cau chua lam trong 24h.
   * Rate limit: toi da MAX_SESSIONS_PER_HOUR phien/gio/user (dung Redis).
   */
  async startSession(userId: string, subjectId: string): Promise<StartSessionResponse> {
    // Validate mon hoc hop le trong danh muc
    if (!isValidSubjectId(subjectId)) {
      throw new SubjectNotRegisteredError(subjectId);
    }

    // Validate user da dang ky mon nay
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { subjects: true } });
    if (!user || !user.subjects.includes(subjectId)) {
      throw new SubjectNotRegisteredError(subjectId);
    }

    // Rate limit qua Redis
    await this.checkRateLimit(userId);

    // Lay danh sach questionId da lam trong 24h
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentHistory = await prisma.userQuestionHistory.findMany({
      where: { userId, attemptedAt: { gte: since24h } },
      select: { questionId: true },
    });
    const recentIds = recentHistory.map((h) => h.questionId);

    // Rut cau hoi song song cho 3 do kho
    const [easy, medium, hard] = await Promise.all([
      fetchQuestionsForDifficulty(subjectId, 1, recentIds, QUESTIONS_PER_DIFFICULTY),
      fetchQuestionsForDifficulty(subjectId, 2, recentIds, QUESTIONS_PER_DIFFICULTY),
      fetchQuestionsForDifficulty(subjectId, 3, recentIds, QUESTIONS_PER_DIFFICULTY),
    ]);

    const questions = [...easy, ...medium, ...hard];

    if (questions.length === 0) {
      throw new SubjectHasNoQuestionsError(subjectId);
    }

    // Tao phien on tap
    const session = await prisma.practiceSession.create({
      data: {
        userId,
        subjectId,
        questions: questions.map((q) => q.id),
      },
    });

    // Tang bieu dem rate limit sau khi tao thanh cong
    await this.incrementRateLimit(userId);

    return {
      sessionId: session.id,
      subjectId,
      questions,
      timeLimitSeconds: SESSION_TIMEOUT_SECONDS,
      startedAt: session.startedAt,
    };
  }

  /**
   * Tiep nhan tra loi 1 cau hoi trong phien.
   * Idempotent: goi lai cung sessionId + questionId → tra ve ket qua cu.
   */
  async submitAnswer(
    userId: string,
    sessionId: string,
    questionId: string,
    selectedOption: number,
  ): Promise<AnswerResponse> {
    const session = await prisma.practiceSession.findUnique({ where: { id: sessionId } });

    if (!session) throw new PracticeSessionNotFoundError(sessionId);
    if (session.userId !== userId) throw new PracticeSessionNotOwnedError(sessionId);
    if (session.completedAt) throw new PracticeSessionAlreadyCompletedError(sessionId);

    // Kiem tra het gio (17 phut)
    const elapsedSeconds = (Date.now() - session.startedAt.getTime()) / 1000;
    if (elapsedSeconds > SESSION_TIMEOUT_SECONDS) {
      throw new PracticeSessionExpiredError(sessionId);
    }

    // Kiem tra cau hoi co trong phien khong
    const sessionQuestions = parseSessionQuestions(session.questions);
    if (!sessionQuestions.includes(questionId)) {
      throw new QuestionNotInSessionError(questionId);
    }

    // Kiem tra idempotency — da tra loi cau nay chua?
    const existing = await prisma.practiceAnswer.findUnique({
      where: { sessionId_questionId: { sessionId, questionId } },
    });

    if (existing) {
      // Da co ket qua — tra ve ket qua cu (idempotent)
      const question = await prisma.question.findUnique({
        where: { id: questionId },
        select: { correctAnswer: true, explanation: true },
      });
      const answeredCount = await prisma.practiceAnswer.count({ where: { sessionId } });

      return {
        isCorrect: existing.isCorrect,
        correctAnswer: question?.correctAnswer ?? existing.selectedOption ?? 0,
        explanation: question?.explanation ?? null,
        answeredCount,
        totalQuestions: sessionQuestions.length,
      };
    }

    // Cau moi — can lay thong tin cau hoi de tinh isCorrect
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: { correctAnswer: true, explanation: true },
    });
    if (!question) throw new QuestionNotFoundError(questionId);

    const isCorrect = selectedOption === question.correctAnswer;

    // Luu tra loi va cap nhat lich su trong 1 transaction.
    // Catch P2002: truong hop 2 request song song cung vuot qua check idempotency
    // ben tren → chi 1 create thanh cong, cai kia bi loi UNIQUE → xu ly nhu idempotent.
    let answeredCount: number;
    try {
      answeredCount = await prisma.$transaction(async (tx) => {
        await tx.practiceAnswer.create({
          data: { sessionId, questionId, selectedOption, isCorrect },
        });

        // Upsert lich su: neu da ton tai thi chi cap nhat attemptedAt
        await tx.userQuestionHistory.upsert({
          where: { userId_questionId: { userId, questionId } },
          update: { attemptedAt: new Date() },
          create: { userId, questionId },
        });

        return tx.practiceAnswer.count({ where: { sessionId } });
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        // Race condition: request khac da tao answer nay truoc — tra ve idempotent response
        const savedAnswer = await prisma.practiceAnswer.findUnique({
          where: { sessionId_questionId: { sessionId, questionId } },
        });
        const count = await prisma.practiceAnswer.count({ where: { sessionId } });
        return {
          isCorrect: savedAnswer?.isCorrect ?? isCorrect,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          answeredCount: count,
          totalQuestions: sessionQuestions.length,
        };
      }
      throw err;
    }

    // Ghi nhận câu sai vào wrong_answers (fire-and-forget, không block response)
    if (!isCorrect) {
      void wrongAnswerService.upsertWrongAnswer(userId, questionId, 'practice').catch((err) => {
        console.warn('[PracticeService] upsertWrongAnswer that bai (bo qua):', (err as Error).message);
      });
    }

    return {
      isCorrect,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      answeredCount,
      totalQuestions: sessionQuestions.length,
    };
  }

  /**
   * Hoan thanh phien on tap, tinh diem va cong diem tich luy.
   * Retry loop de chong optimistic lock conflict khi cap nhat diem.
   */
  async completeSession(userId: string, sessionId: string): Promise<CompleteSessionResponse> {
    for (let attempt = 1; attempt <= MAX_COMPLETE_RETRY; attempt++) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          const session = await tx.practiceSession.findUnique({ where: { id: sessionId } });

          if (!session) throw new PracticeSessionNotFoundError(sessionId);
          if (session.userId !== userId) throw new PracticeSessionNotOwnedError(sessionId);
          if (session.completedAt) throw new PracticeSessionAlreadyCompletedError(sessionId);

          // Bug 3: Kiem tra timeout trong transaction (tranh race condition).
          // 60 giay grace cho phep nop muon hon 1 chut do tre mang.
          const elapsedSeconds = (Date.now() - session.startedAt.getTime()) / 1000;
          if (elapsedSeconds > SESSION_TIMEOUT_SECONDS + 60) {
            // Danh dau da ket thuc (tranh retry vo tan) nhung KHONG cong diem.
            await tx.practiceSession.update({
              where: { id: sessionId },
              data: { completedAt: new Date() },
            });
            throw new PracticeSessionExpiredError(sessionId);
          }

          // Lay tat ca cac tra loi trong phien
          const answers = await tx.practiceAnswer.findMany({
            where: { sessionId },
          });

          const score = answers.filter((a) => a.isCorrect).length;
          const pointsEarned = score;

          // Cap nhat session
          await tx.practiceSession.update({
            where: { id: sessionId },
            data: { score, pointsEarned, completedAt: new Date() },
          });

          // Cong diem neu co dap an dung (su dung outer tx)
          if (score > 0) {
            await pointsService.addPointsInTx(tx, userId, score, 'ON_TAP_CORRECT', { sessionId });
          }

          // Lay them thong tin correctAnswer + explanation cho response
          const sessionQuestions = parseSessionQuestions(session.questions);
          const questionDetails = await tx.question.findMany({
            where: { id: { in: sessionQuestions } },
            select: { id: true, correctAnswer: true, explanation: true },
          });
          const questionMap = new Map(questionDetails.map((q) => [q.id, q]));

          const answerSummaries: AnswerSummary[] = answers.map((a) => ({
            questionId: a.questionId,
            selectedOption: a.selectedOption,
            isCorrect: a.isCorrect,
            correctAnswer: questionMap.get(a.questionId)?.correctAnswer ?? 0,
            explanation: questionMap.get(a.questionId)?.explanation ?? null,
          }));

          return {
            sessionId,
            score,
            pointsEarned,
            totalQuestions: sessionQuestions.length,
            answers: answerSummaries,
          };
        });

        // Fire-and-forget: kiểm tra streak milestone sau khi transaction thành công
        void this.checkAndFireStreakMilestone(userId);

        return result;
      } catch (err) {
        // Neu optimistic lock retryable → retry toan bo transaction
        if (err instanceof OptimisticLockRetryableError) {
          if (attempt === MAX_COMPLETE_RETRY) {
            throw new OptimisticLockError(userId, MAX_COMPLETE_RETRY);
          }
          await delayJitter();
          continue;
        }
        // Moi loi khac (loi nghiep vu, loi DB...) → nem thang, khong retry
        throw err;
      }
    }

    // Khong bao gio den day nhung TS can return type ro rang
    throw new OptimisticLockError(userId, MAX_COMPLETE_RETRY);
  }

  /**
   * [Fire-and-forget] Kiểm tra xem phiên vừa hoàn thành có tạo streak milestone hay không.
   * Chỉ thông báo nếu:
   *   1. Đây là phiên đầu tiên trong ngày hôm nay (tránh gửi thông báo trùng lặp)
   *   2. Streak đúng bằng một giá trị milestone [7, 14, 30, 60, 100]
   */
  private async checkAndFireStreakMilestone(userId: string): Promise<void> {
    try {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setUTCHours(23, 59, 59, 999);

      // Chỉ xử lý khi là phiên đầu tiên hôm nay (completedAt not null = thật sự hoàn thành)
      const todayCompletedCount = await prisma.practiceSession.count({
        where: {
          userId,
          completedAt: { gte: todayStart, lte: todayEnd },
        },
      });
      if (todayCompletedCount !== 1) return;

      // Tính streak từ toàn bộ lịch sử
      const sessions = await prisma.practiceSession.findMany({
        where: { userId, completedAt: { not: null } },
        select: { completedAt: true },
      });
      const dates = sessions.map((s) => s.completedAt!);
      const { currentStreak } = computeStreaks(dates);

      if (!(STREAK_MILESTONES as readonly number[]).includes(currentStreak)) return;

      void notificationService.createNotification({
        userId,
        type: 'STREAK_MILESTONE',
        title: `🔥 Streak ${currentStreak} ngày!`,
        body: `Tuyệt vời! Bạn đã học liên tiếp ${currentStreak} ngày. Hãy giữ vững nhịp độ này nhé!`,
        targetScreen: 'progress',
        metadata: { streakDays: currentStreak },
      });
    } catch (err) {
      // Lỗi thông báo không được làm hỏng flow chính
      console.error('[PracticeService] checkAndFireStreakMilestone error:', err);
    }
  }

  /**
   * Lay chi tiet phien dang do de resume (chua hoan thanh).
   * Tra ve cau hoi da lam, thoi gian con lai.
   */
  async getSessionDetail(userId: string, sessionId: string): Promise<SessionDetailResponse> {
    const session = await prisma.practiceSession.findUnique({ where: { id: sessionId } });

    if (!session) throw new PracticeSessionNotFoundError(sessionId);
    if (session.userId !== userId) throw new PracticeSessionNotOwnedError(sessionId);
    if (session.completedAt) throw new PracticeSessionAlreadyCompletedError(sessionId);

    const sessionQuestions = parseSessionQuestions(session.questions);

    const [questions, answers] = await Promise.all([
      prisma.question.findMany({
        where: { id: { in: sessionQuestions } },
        select: { id: true, subject: true, chapter: true, difficulty: true, question: true, options: true },
      }),
      prisma.practiceAnswer.findMany({
        where: { sessionId },
        select: { questionId: true, selectedOption: true, isCorrect: true },
      }),
    ]);

    // Giu thu tu cau hoi dung voi thu tu trong session.questions
    const orderedQuestions = sessionQuestions
      .map((id) => questions.find((q) => q.id === id))
      .filter((q): q is NonNullable<typeof q> => q !== undefined)
      .map(toPublicDto);

    const elapsedSeconds = (Date.now() - session.startedAt.getTime()) / 1000;
    const timeRemainingSeconds = Math.floor(SESSION_TIMEOUT_SECONDS - elapsedSeconds);

    return {
      sessionId,
      subjectId: session.subjectId,
      questions: orderedQuestions,
      answers: answers.map((a) => ({
        questionId: a.questionId,
        selectedOption: a.selectedOption,
        isCorrect: a.isCorrect,
      })),
      timeRemainingSeconds,
      startedAt: session.startedAt,
    };
  }

  /** Lay lich su cac phien da hoan thanh, phan trang. */
  async getHistory(userId: string, limit = 20, offset = 0): Promise<PaginatedHistory> {
    const safeLimit = Math.min(limit, 100);

    const [items, total] = await Promise.all([
      prisma.practiceSession.findMany({
        where: { userId, completedAt: { not: null } },
        orderBy: { completedAt: 'desc' },
        take: safeLimit,
        skip: offset,
        select: {
          id: true,
          subjectId: true,
          score: true,
          pointsEarned: true,
          questions: true,
          startedAt: true,
          completedAt: true,
        },
      }),
      prisma.practiceSession.count({ where: { userId, completedAt: { not: null } } }),
    ]);

    const historyItems: HistoryItem[] = items.map((s) => ({
      sessionId: s.id,
      subjectId: s.subjectId,
      score: s.score,
      pointsEarned: s.pointsEarned,
      totalQuestions: parseSessionQuestions(s.questions).length,
      startedAt: s.startedAt,
      completedAt: s.completedAt as Date,
    }));

    return { items: historyItems, total, limit: safeLimit, offset };
  }

  /** Thong ke on tap tong hop cua user theo mon hoc. */
  async getStats(userId: string, subjectId?: string): Promise<PracticeStats[]> {
    // Lay tat ca phien da hoan thanh (co loc theo mon neu truyen vao)
    const sessions = await prisma.practiceSession.findMany({
      where: {
        userId,
        completedAt: { not: null },
        ...(subjectId ? { subjectId } : {}),
      },
      select: { id: true, subjectId: true, score: true, questions: true },
    });

    if (sessions.length === 0) return [];

    const sessionIds = sessions.map((s) => s.id);

    // Lay tat ca tra loi va do kho tuong ung (2 query rieng vi khong co relation Prisma)
    const answers = await prisma.practiceAnswer.findMany({
      where: { sessionId: { in: sessionIds } },
      select: { sessionId: true, questionId: true, isCorrect: true },
    });

    const questionIds = [...new Set(answers.map((a) => a.questionId))];
    const questionDifficulties = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: { id: true, difficulty: true },
    });
    const diffMap = new Map(questionDifficulties.map((q) => [q.id, q.difficulty]));

    // Nhom theo mon hoc
    const grouped = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const list = grouped.get(s.subjectId) ?? [];
      list.push(s);
      grouped.set(s.subjectId, list);
    }

    const results: PracticeStats[] = [];

    for (const [subject, subjectSessions] of grouped.entries()) {
      const subjectSessionIds = new Set(subjectSessions.map((s) => s.id));
      const subjectAnswers = answers.filter((a) => subjectSessionIds.has(a.sessionId));

      const scores = subjectSessions.map((s) => s.score);
      const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      const bestScore = Math.max(...scores);

      // Tinh accuracy theo tung do kho
      const accuracyByDifficulty: Record<number, number> = {};
      for (const diff of [1, 2, 3]) {
        const diffAnswers = subjectAnswers.filter((a) => diffMap.get(a.questionId) === diff);
        if (diffAnswers.length > 0) {
          const correct = diffAnswers.filter((a) => a.isCorrect).length;
          accuracyByDifficulty[diff] = correct / diffAnswers.length;
        } else {
          accuracyByDifficulty[diff] = 0;
        }
      }

      results.push({
        subject,
        totalSessions: subjectSessions.length,
        avgScore: Math.round(avgScore * 100) / 100,
        bestScore,
        accuracyByDifficulty,
      });
    }

    return results;
  }

  /**
   * Xem giai thich cau hoi — chi cho phep neu user DA lam cau do trong bat ky phien nao.
   */
  async getExplanation(
    userId: string,
    questionId: string,
  ): Promise<{ correctAnswer: number; explanation: string | null }> {
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: { correctAnswer: true, explanation: true },
    });
    if (!question) throw new QuestionNotFoundError(questionId);

    // Kiem tra user da tung lam cau nay chua
    const attempted = await prisma.userQuestionHistory.findUnique({
      where: { userId_questionId: { userId, questionId } },
    });
    if (!attempted) throw new QuestionNotAttemptedError(questionId);

    return { correctAnswer: question.correctAnswer, explanation: question.explanation };
  }

  // -------------------------------------------------------------------------
  // ADMIN ENDPOINTS
  // -------------------------------------------------------------------------

  /** Tao 1 cau hoi moi. */
  async createQuestion(input: CreateQuestionInput): Promise<QuestionFullDto> {
    const q = await prisma.question.create({
      data: {
        subject: input.subject,
        chapter: input.chapter ?? null,
        difficulty: input.difficulty,
        question: input.question,
        options: input.options,
        correctAnswer: input.correctAnswer,
        explanation: input.explanation ?? null,
        examYear: input.examYear ?? null,
        examCode: input.examCode ?? null,
      },
    });
    return toFullDto(q);
  }

  /**
   * Nhap hang loat cau hoi (all-or-nothing).
   * Validate toan bo mang truoc, neu 1 cau loi thi tra ve danh sach loi theo index.
   */
  async bulkCreateQuestions(inputs: CreateQuestionInput[]): Promise<QuestionFullDto[]> {
    // Validate truoc — all-or-nothing: neu co loi thi nem ngay, khong insert gi
    // (Zod validate o middleware level, day chi la guard tang service)
    const results = await prisma.$transaction(
      inputs.map((input) =>
        prisma.question.create({
          data: {
            subject: input.subject,
            chapter: input.chapter ?? null,
            difficulty: input.difficulty,
            question: input.question,
            options: input.options,
            correctAnswer: input.correctAnswer,
            explanation: input.explanation ?? null,
            examYear: input.examYear ?? null,
            examCode: input.examCode ?? null,
          },
        }),
      ),
    );
    return results.map(toFullDto);
  }

  /** Cap nhat cau hoi. */
  async updateQuestion(questionId: string, input: UpdateQuestionInput): Promise<QuestionFullDto> {
    const existing = await prisma.question.findUnique({ where: { id: questionId } });
    if (!existing) throw new QuestionNotFoundError(questionId);

    const q = await prisma.question.update({
      where: { id: questionId },
      data: {
        ...(input.subject !== undefined && { subject: input.subject }),
        ...(input.chapter !== undefined && { chapter: input.chapter ?? null }),
        ...(input.difficulty !== undefined && { difficulty: input.difficulty }),
        ...(input.question !== undefined && { question: input.question }),
        ...(input.options !== undefined && { options: input.options }),
        ...(input.correctAnswer !== undefined && { correctAnswer: input.correctAnswer }),
        ...(input.explanation !== undefined && { explanation: input.explanation ?? null }),
        ...(input.examYear !== undefined && { examYear: input.examYear ?? null }),
        ...(input.examCode !== undefined && { examCode: input.examCode ?? null }),
      },
    });
    return toFullDto(q);
  }

  /** Soft delete cau hoi (set isActive = false). */
  async deleteQuestion(questionId: string): Promise<void> {
    const existing = await prisma.question.findUnique({ where: { id: questionId } });
    if (!existing) throw new QuestionNotFoundError(questionId);

    await prisma.question.update({
      where: { id: questionId },
      data: { isActive: false },
    });
  }

  /** Lay danh sach cau hoi co phan trang va loc. */
  async listQuestions(params: {
    subject?: string;
    difficulty?: number;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ items: QuestionFullDto[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, params.limit ?? 20);
    const offset = (page - 1) * limit;

    const where: Prisma.QuestionWhereInput = {
      ...(params.subject !== undefined && { subject: params.subject }),
      ...(params.difficulty !== undefined && { difficulty: params.difficulty }),
      ...(params.isActive !== undefined && { isActive: params.isActive }),
    };

    const [items, total] = await Promise.all([
      prisma.question.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.question.count({ where }),
    ]);

    return { items: items.map(toFullDto), total, page, limit };
  }

  /**
   * Lay danh sach bao cao cau hoi, phan trang, kem JOIN day du noi dung cau hoi
   * (khong chi tra ve questionId thô) — loc duoc theo status/subject/reason.
   */
  async listReports(params: ListReportsParams): Promise<{ items: QuestionReportDto[]; total: number }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, params.limit ?? 20);

    const where: Prisma.QuestionReportWhereInput = {
      ...(params.status !== undefined && { status: params.status }),
      ...(params.reason !== undefined && { reason: params.reason }),
    };

    // Loc theo subject: QuestionReport khong co cot subject truc tiep (khong co
    // Prisma relation chinh thuc toi Question) -> tim truoc cac questionId khop
    // subject, roi loc report theo questionId trong tap do.
    if (params.subject !== undefined) {
      const matchingQuestions = await prisma.question.findMany({
        where: { subject: params.subject },
        select: { id: true },
      });
      where.questionId = { in: matchingQuestions.map((q) => q.id) };
    }

    const [reports, total] = await Promise.all([
      prisma.questionReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.questionReport.count({ where }),
    ]);

    const items = await this.joinReportsWithQuestions(reports);
    return { items, total };
  }

  /**
   * "JOIN" thu cong danh sach bao cao voi noi dung cau hoi tuong ung (khong co
   * Prisma relation chinh thuc giua QuestionReport <-> Question trong schema).
   * Bao cao nao co questionId khong con ton tai (truong hop hiem, Question hien
   * tai khong bao gio hard-delete) se bi bo qua khoi ket qua thay vi lam sap he thong.
   */
  private async joinReportsWithQuestions(
    reports: Array<{
      id: string;
      questionId: string;
      userId: string;
      reason: string;
      description: string | null;
      status: string;
      createdAt: Date;
    }>,
  ): Promise<QuestionReportDto[]> {
    if (reports.length === 0) return [];

    const questionIds = [...new Set(reports.map((r) => r.questionId))];
    const questions = await prisma.question.findMany({ where: { id: { in: questionIds } } });
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    const items: QuestionReportDto[] = [];
    for (const r of reports) {
      const q = questionMap.get(r.questionId);
      if (!q) continue; // cau hoi khong con ton tai — bo qua, khong lam sap request
      items.push({
        id: r.id,
        questionId: r.questionId,
        userId: r.userId,
        reason: r.reason,
        description: r.description,
        status: r.status,
        createdAt: r.createdAt,
        question: {
          subject: q.subject,
          chapter: q.chapter,
          difficulty: q.difficulty,
          question: q.question,
          options: q.options as string[],
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          isActive: q.isActive,
        },
      });
    }
    return items;
  }

  /**
   * Cap nhat trang thai bao cao.
   * Sau khi cap nhat: dem PENDING reports cua cau hoi do,
   * neu >= 5 thi tu dong an cau hoi (isActive = false).
   * Fire-and-forget: gui thong bao REPORT_RESOLVED cho user bao cao.
   */
  async updateReport(
    reportId: string,
    status: ReportStatus,
  ): Promise<{ id: string; status: string; autoHidden: boolean }> {
    // Lấy trạng thái trước khi update để biết có phải lần đầu resolve không
    const reportBefore = await prisma.questionReport.findUnique({
      where: { id: reportId },
      select: { userId: true, questionId: true, status: true },
    });

    const report = await prisma.questionReport.update({
      where: { id: reportId },
      data: { status },
    });

    const autoHidden = await this.autoHideIfThresholdExceeded(report.questionId);

    // Notify khi admin lần đầu xử lý báo cáo (PENDING → trạng thái khác)
    if (reportBefore?.status === 'PENDING' && status !== 'PENDING' && reportBefore.userId) {
      void this.fireReportResolvedNotification(
        reportBefore.userId,
        reportId,
        status,
        reportBefore.questionId,
      );
    }

    return { id: report.id, status: report.status, autoHidden };
  }

  /**
   * Endpoint gộp xử lý báo cáo (thay thế `updateReport` cho luồng admin mới):
   *   1. Nếu có `questionUpdate`: lưu SNAPSHOT nội dung câu hỏi hiện tại vào
   *      `question_edit_history` TRƯỚC khi ghi đè, rồi cập nhật Question.
   *   2. Cập nhật report hiện tại → status (chỉ FIXED|DISMISSED — validate ở route qua Zod).
   *   3. Batch: mọi report PENDING KHÁC cùng questionId cũng chuyển sang status
   *      này luôn (1 lần sửa đóng hết mọi báo cáo trùng câu) — chạy trong CÙNG
   *      transaction để tránh race condition nếu 2 báo cáo được xử lý gần như
   *      đồng thời.
   *   4. Nếu status=FIXED và Question đang bị auto-hide (isActive=false) →
   *      set lại isActive=true (không cần đợi báo cáo nào khác).
   *   5. [Fire-and-forget] Gửi thông báo REPORT_RESOLVED cho TỪNG người đã báo
   *      cáo (báo cáo chính + mọi báo cáo batch khác), mỗi người 1 thông báo riêng.
   */
  async resolveReport(
    reportId: string,
    status: ResolvableReportStatus,
    questionUpdate?: ResolveReportQuestionUpdate,
  ): Promise<ResolveReportResult> {
    const report = await prisma.questionReport.findUnique({ where: { id: reportId } });
    if (!report) throw new QuestionReportNotFoundError(reportId);

    const { batchResolvedCount, reactivated, othersToNotify } = await prisma.$transaction(async (tx) => {
      const currentQuestion = await tx.question.findUnique({ where: { id: report.questionId } });
      if (!currentQuestion) throw new QuestionNotFoundError(report.questionId);

      if (questionUpdate) {
        // Snapshot TOÀN BỘ field hiện tại của Question — lưu TRƯỚC khi ghi đè.
        await tx.questionEditHistory.create({
          data: {
            questionId: currentQuestion.id,
            reportId,
            beforeData: {
              subject: currentQuestion.subject,
              chapter: currentQuestion.chapter,
              difficulty: currentQuestion.difficulty,
              question: currentQuestion.question,
              options: currentQuestion.options,
              correctAnswer: currentQuestion.correctAnswer,
              explanation: currentQuestion.explanation,
              examYear: currentQuestion.examYear,
              examCode: currentQuestion.examCode,
              isActive: currentQuestion.isActive,
            } as Prisma.InputJsonValue,
          },
        });
      }

      // Chỉ re-activate khi FIXED và câu đang bị ẩn (auto-hide do vượt ngưỡng báo cáo).
      const shouldReactivate = status === 'FIXED' && currentQuestion.isActive === false;

      if (questionUpdate || shouldReactivate) {
        await tx.question.update({
          where: { id: currentQuestion.id },
          data: {
            ...(questionUpdate?.subject !== undefined && { subject: questionUpdate.subject }),
            ...(questionUpdate?.chapter !== undefined && { chapter: questionUpdate.chapter }),
            ...(questionUpdate?.difficulty !== undefined && { difficulty: questionUpdate.difficulty }),
            ...(questionUpdate?.question !== undefined && { question: questionUpdate.question }),
            ...(questionUpdate?.options !== undefined && {
              options: questionUpdate.options as Prisma.InputJsonValue,
            }),
            ...(questionUpdate?.correctAnswer !== undefined && { correctAnswer: questionUpdate.correctAnswer }),
            ...(questionUpdate?.explanation !== undefined && { explanation: questionUpdate.explanation }),
            ...(shouldReactivate && { isActive: true }),
          },
        });
      }

      await tx.questionReport.update({ where: { id: reportId }, data: { status } });

      // Batch: mọi report PENDING khác cùng câu hỏi này cũng đóng theo — 1 lần sửa
      // đóng hết mọi báo cáo trùng lặp, tránh admin phải xử lý thủ công từng cái.
      const others = await tx.questionReport.findMany({
        where: { questionId: report.questionId, status: 'PENDING', id: { not: reportId } },
        select: { id: true, userId: true },
      });
      if (others.length > 0) {
        await tx.questionReport.updateMany({
          where: { id: { in: others.map((o) => o.id) } },
          data: { status },
        });
      }

      return { batchResolvedCount: others.length, reactivated: shouldReactivate, othersToNotify: others };
    });

    // [Fire-and-forget] Notify từng người báo cáo riêng — báo cáo chính + các báo cáo
    // batch khác — giữ nguyên hành vi "mỗi user 1 thông báo" của hàm có sẵn.
    if (report.userId) {
      void this.fireReportResolvedNotification(report.userId, reportId, status, report.questionId);
    }
    for (const other of othersToNotify) {
      if (other.userId) {
        void this.fireReportResolvedNotification(other.userId, other.id, status, report.questionId);
      }
    }

    return { id: reportId, status, batchResolvedCount, reactivated };
  }

  /** [Fire-and-forget] Gửi thông báo REPORT_RESOLVED khi admin xử lý báo cáo. */
  private async fireReportResolvedNotification(
    userId: string,
    reportId: string,
    status: string,
    questionId: string,
  ): Promise<void> {
    try {
      const question = await prisma.question.findUnique({
        where: { id: questionId },
        select: { question: true },
      });
      const qText = question?.question ?? '';
      const preview = qText
        ? qText.slice(0, 60) + (qText.length > 60 ? '…' : '')
        : 'câu hỏi đã báo cáo';

      const isApproved = status === 'FIXED' || status === 'REVIEWED';
      void notificationService.createNotification({
        userId,
        type: 'REPORT_RESOLVED',
        title: isApproved ? '✅ Báo cáo của bạn đã được xử lý' : '❌ Báo cáo của bạn bị từ chối',
        body: isApproved
          ? `Cảm ơn bạn! Báo cáo về "${preview}" đã được duyệt.`
          : `Báo cáo về "${preview}" không được chấp nhận.`,
        targetScreen: null,
        metadata: { reportId, status, questionPreview: preview },
      });
    } catch (err) {
      console.error('[PracticeService] fireReportResolvedNotification error:', err);
    }
  }

  /**
   * Tong hop thong ke bao cao — tach ro 2 so lieu de tranh nham lan:
   *   - pendingReports:   tong so DONG bao cao dang PENDING
   *   - pendingQuestions: so CAU HOI KHAC NHAU dang co it nhat 1 bao cao PENDING
   *     (dung groupBy thay vi COUNT DISTINCT truc tiep — Prisma khong ho tro
   *     count-distinct tren 1 truong don le qua API chuan).
   */
  async getReportsSummary(): Promise<QuestionReportSummary> {
    const [statusGroups, pendingQuestionGroups, topReported] = await Promise.all([
      prisma.questionReport.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.questionReport.groupBy({ by: ['questionId'], where: { status: 'PENDING' } }),
      prisma.questionReport.groupBy({
        by: ['questionId'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ]);

    const counts: Record<ReportStatus, number> = {
      PENDING: 0,
      REVIEWED: 0,
      FIXED: 0,
      DISMISSED: 0,
    };
    for (const g of statusGroups) {
      if (REPORT_STATUSES.includes(g.status as ReportStatus)) {
        counts[g.status as ReportStatus] = g._count.id;
      }
    }

    return {
      pendingReports: counts.PENDING,
      pendingQuestions: pendingQuestionGroups.length,
      fixed: counts.FIXED,
      dismissed: counts.DISMISSED,
      topReportedQuestions: topReported.map((r) => ({
        questionId: r.questionId,
        count: r._count.id,
      })),
    };
  }

  /** User bao cao cau hoi sai/co van de. */
  async reportQuestion(
    userId: string,
    questionId: string,
    reason: string,
    description?: string,
  ): Promise<void> {
    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) throw new QuestionNotFoundError(questionId);

    // Chi cho phep bao cao cau hoi user da tung lam
    const attempted = await prisma.userQuestionHistory.findUnique({
      where: { userId_questionId: { userId, questionId } },
    });
    if (!attempted) throw new QuestionNotAttemptedForReportError(questionId);

    // Kiem tra da bao cao chua (check truoc de tranh write thua)
    const existing = await prisma.questionReport.findUnique({
      where: { userId_questionId: { userId, questionId } },
    });
    if (existing) throw new ReportAlreadySubmittedError();

    // Catch P2002: truong hop 2 request song song cung vuot qua check tren
    // → chi 1 create thanh cong, cai kia bi UNIQUE constraint → bao loi ro rang.
    try {
      await prisma.questionReport.create({
        data: { questionId, userId, reason, description: description ?? null },
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) throw new ReportAlreadySubmittedError();
      throw err;
    }

    await this.autoHideIfThresholdExceeded(questionId);
  }

  /**
   * Dem so bao cao PENDING cua 1 cau hoi, neu >= AUTO_HIDE_REPORT_THRESHOLD
   * thi tu dong an cau hoi (isActive = false). Tra ve true neu vua an.
   * Dung chung cho `reportQuestion` (user gui bao cao moi) va
   * `updateReport` (admin doi trang thai mot bao cao ve PENDING).
   */
  private async autoHideIfThresholdExceeded(questionId: string): Promise<boolean> {
    const pendingCount = await prisma.questionReport.count({
      where: { questionId, status: 'PENDING' },
    });
    if (pendingCount < AUTO_HIDE_REPORT_THRESHOLD) return false;

    await prisma.question.update({
      where: { id: questionId },
      data: { isActive: false },
    });
    console.warn('[PracticeService] Auto-hide cau hoi do vuot nguong bao cao:', {
      questionId,
      pendingCount,
      at: new Date().toISOString(),
    });
    return true;
  }

  // -------------------------------------------------------------------------
  // SESSION CLEANUP (goi boi scheduler)
  // -------------------------------------------------------------------------

  /**
   * Dong tat ca phien on tap qua gio (startedAt < 1 gio truoc, completedAt = null).
   * Duoc goi boi node-cron hang ngay luc 3:00 AM.
   */
  async cleanupExpiredSessions(): Promise<number> {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000); // 1 gio truoc
    const result = await prisma.practiceSession.updateMany({
      where: { completedAt: null, startedAt: { lt: cutoff } },
      data: { completedAt: new Date() },
    });
    return result.count;
  }

  // -------------------------------------------------------------------------
  // RATE LIMITING (Redis)
  // -------------------------------------------------------------------------

  /** Kiem tra user co bi gioi han rate hay khong. Nem loi neu vuot qua. */
  private async checkRateLimit(userId: string): Promise<void> {
    try {
      const key = `ratelimit:practice:${userId}`;
      const current = await redis.get(key);
      if (current !== null && parseInt(current, 10) >= MAX_SESSIONS_PER_HOUR) {
        throw new PracticeRateLimitError();
      }
    } catch (err) {
      // Neu la loi rate limit thi nem loi
      if (err instanceof PracticeRateLimitError) throw err;
      // Bug 2: Fail-closed — Redis loi → chan user, tranh vuot gioi han khi Redis down.
      console.error('[PracticeService] Redis rate limit check that bai (fail-closed):', (err as Error).message);
      throw new PracticeRateLimitError();
    }
  }

  /** Tang bieu dem rate limit sau khi tao phien thanh cong. */
  private async incrementRateLimit(userId: string): Promise<void> {
    try {
      const key = `ratelimit:practice:${userId}`;
      const count = await redis.incr(key);
      if (count === 1) {
        // Lan dau trong gio nay — dat TTL 1 gio
        await redis.expire(key, 3600);
      }
    } catch (err) {
      // Loi Redis → bo qua (khong anh huong den chuc nang chinh)
      console.warn('[PracticeService] Redis rate limit increment that bai (bo qua):', (err as Error).message);
    }
  }
}

/** Instance dung chung (singleton). */
export const practiceService = new PracticeService();
