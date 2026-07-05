// ============================================================================
// WrongAnswerService — Ôn câu sai
//   - upsertWrongAnswer: ghi nhận/cộng dồn câu sai từ Practice hoặc Exam
//   - getWrongAnswers: danh sách câu sai chưa hết hạn (JOIN chi tiết câu hỏi)
//   - retryQuestion: kiểm tra đáp án khi làm lại — KHÔNG ghi điểm
// ============================================================================
import { prisma } from '../../lib/prisma.js';
import { WrongAnswerNotFoundError } from './wrongAnswer.errors.js';
import { normalizeAnswer } from '../exam/exam.service.js';
import type {
  WrongAnswerListItem,
  WrongAnswerListResponse,
  RetryResult,
  WrongAnswerSource,
} from './wrongAnswer.types.js';

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

/** Tính thời điểm hết hạn = thời điểm cho trước + 14 ngày. */
function addFourteenDays(from: Date): Date {
  return new Date(from.getTime() + FOURTEEN_DAYS_MS);
}

// ---------------------------------------------------------------------------
// Service class
// ---------------------------------------------------------------------------

export class WrongAnswerService {
  /**
   * Ghi nhận câu sai (upsert):
   * - Nếu (userId, questionId) hoặc (userId, examQuestionId) đã tồn tại:
   *   tăng wrongCount, cập nhật lastWrongAt và expiresAt (+14 ngày).
   * - Nếu chưa: tạo mới với wrongCount = 1.
   *
   * @param source 'practice' | 'exam' — xác định FK nào được dùng
   */
  async upsertWrongAnswer(
    userId: string,
    questionId: string,
    source: WrongAnswerSource,
  ): Promise<void> {
    const now = new Date();
    const expiresAt = addFourteenDays(now);

    if (source === 'practice') {
      await prisma.wrongAnswer.upsert({
        where: { userId_questionId: { userId, questionId } },
        update: {
          wrongCount: { increment: 1 },
          lastWrongAt: now,
          expiresAt,
        },
        create: {
          userId,
          questionId,
          wrongCount: 1,
          lastWrongAt: now,
          expiresAt,
        },
      });
    } else {
      await prisma.wrongAnswer.upsert({
        where: { userId_examQuestionId: { userId, examQuestionId: questionId } },
        update: {
          wrongCount: { increment: 1 },
          lastWrongAt: now,
          expiresAt,
        },
        create: {
          userId,
          examQuestionId: questionId,
          wrongCount: 1,
          lastWrongAt: now,
          expiresAt,
        },
      });
    }
  }

  /**
   * Lấy danh sách câu sai chưa hết hạn của user.
   * Bỏ qua câu hỏi đã bị soft-delete (isActive = false).
   * Hỗ trợ lọc theo subjectId và phân trang.
   */
  async getWrongAnswers(
    userId: string,
    subjectId?: string,
    page = 1,
    pageSize = 20,
  ): Promise<WrongAnswerListResponse> {
    const now = new Date();
    const skip = (page - 1) * pageSize;

    // Load tất cả câu sai còn hạn của user, filter subject và paginate trong bộ nhớ.
    // Chấp nhận được vì mỗi user có tối đa vài trăm câu sai (TTL 14 ngày),
    // và subject của ExamQuestion cần JOIN qua ExamPaper — khó paginate trực tiếp ở DB.
    const allRecords = await prisma.wrongAnswer.findMany({
      where: {
        userId,
        expiresAt: { gt: now },
      },
      include: {
        question: {
          select: {
            id: true,
            subject: true,
            question: true,
            options: true,
            correctAnswer: true,
            explanation: true,
            isActive: true,
          },
        },
        examQuestion: {
          select: {
            id: true,
            questionType: true,
            questionText: true,
            options: true,
            correctAnswer: true,
            explanation: true,
            isActive: true,
            examPaperId: true,
          },
        },
      },
      orderBy: { lastWrongAt: 'desc' },
    });

    // Lấy subject của exam questions qua ExamPaper
    const examPaperIds = allRecords
      .filter((r) => r.examQuestion !== null && r.examQuestion.examPaperId)
      .map((r) => r.examQuestion!.examPaperId);

    const examPapers =
      examPaperIds.length > 0
        ? await prisma.examPaper.findMany({
            where: { id: { in: examPaperIds } },
            select: { id: true, subject: true },
          })
        : [];
    const examPaperSubjectMap = new Map(examPapers.map((p) => [p.id, p.subject]));

    // Chuẩn hóa thành WrongAnswerListItem, bỏ qua record không có câu hỏi hợp lệ
    const items: WrongAnswerListItem[] = [];

    for (const record of allRecords) {
      if (record.question !== null) {
        // Câu từ Practice (MCQ_4)
        const q = record.question;
        if (!q.isActive) continue; // bỏ qua câu đã bị soft-delete

        const questionSubject = q.subject;
        if (subjectId && questionSubject !== subjectId) continue;

        const opts = Array.isArray(q.options)
          ? (q.options as string[])
          : [];

        items.push({
          id: record.id,
          wrongCount: record.wrongCount,
          lastWrongAt: record.lastWrongAt,
          expiresAt: record.expiresAt,
          source: 'practice',
          question: {
            id: q.id,
            content: q.question,
            type: 'MCQ_4',
            subjectId: questionSubject,
            options: opts,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
          },
        });
      } else if (record.examQuestion !== null) {
        // Câu từ Exam (MCQ_4 | TRUE_FALSE_4 | FILL_BLANK)
        const eq = record.examQuestion;
        if (!eq.isActive) continue;

        const questionSubject = examPaperSubjectMap.get(eq.examPaperId) ?? '';
        if (subjectId && questionSubject !== subjectId) continue;

        items.push({
          id: record.id,
          wrongCount: record.wrongCount,
          lastWrongAt: record.lastWrongAt,
          expiresAt: record.expiresAt,
          source: 'exam',
          question: {
            id: eq.id,
            content: eq.questionText,
            type: eq.questionType as 'MCQ_4' | 'TRUE_FALSE_4' | 'FILL_BLANK',
            subjectId: questionSubject,
            options: eq.options,
            correctAnswer: eq.correctAnswer,
            explanation: eq.explanation,
          },
        });
      }
      // record với cả hai FK null (câu đã bị hard-delete) → bỏ qua
    }

    const total = items.length;
    const paginated = items.slice(skip, skip + pageSize);

    return { data: paginated, total, page, pageSize };
  }

  /**
   * Làm lại câu hỏi sai — kiểm tra đáp án, trả về isCorrect + correctAnswer.
   * KHÔNG ghi điểm, KHÔNG xóa khỏi danh sách WrongAnswer.
   *
   * @param id ID của bản ghi WrongAnswer (không phải questionId)
   */
  async retryQuestion(
    userId: string,
    id: number,
    answer: unknown,
  ): Promise<RetryResult> {
    const now = new Date();

    const record = await prisma.wrongAnswer.findUnique({
      where: { id },
      include: {
        question: {
          select: {
            id: true,
            correctAnswer: true,
            explanation: true,
            isActive: true,
          },
        },
        examQuestion: {
          select: {
            id: true,
            questionType: true,
            correctAnswer: true,
            explanation: true,
            isActive: true,
          },
        },
      },
    });

    if (!record || record.userId !== userId) throw new WrongAnswerNotFoundError(id);
    if (record.expiresAt <= now) throw new WrongAnswerNotFoundError(id);

    if (record.question !== null) {
      const correct = record.question.correctAnswer;
      const isCorrect = typeof answer === 'number' && answer === correct;
      return { isCorrect, correctAnswer: correct, explanation: record.question.explanation };
    }

    if (record.examQuestion !== null) {
      const eq = record.examQuestion;
      const isCorrect = this.checkExamAnswer(eq.questionType, eq.correctAnswer, answer);
      return { isCorrect, correctAnswer: eq.correctAnswer, explanation: eq.explanation };
    }

    throw new WrongAnswerNotFoundError(id);
  }

  /** Kiểm tra đáp án cho 3 dạng câu hỏi Exam (không tính điểm). */
  private checkExamAnswer(
    questionType: string,
    correctAnswer: unknown,
    selectedAnswer: unknown,
  ): boolean {
    switch (questionType) {
      case 'MCQ_4': {
        return (
          typeof selectedAnswer === 'number' &&
          typeof correctAnswer === 'number' &&
          selectedAnswer === correctAnswer
        );
      }
      case 'TRUE_FALSE_4': {
        const correct = Array.isArray(correctAnswer) ? correctAnswer : [];
        const selected = Array.isArray(selectedAnswer) ? selectedAnswer : [];
        if (correct.length !== 4 || selected.length !== 4) return false;
        return correct.every((v, i) => typeof v === 'boolean' && v === selected[i]);
      }
      case 'FILL_BLANK': {
        const acceptable = Array.isArray(correctAnswer)
          ? correctAnswer.filter((a): a is string => typeof a === 'string').map(normalizeAnswer)
          : [];
        const given = typeof selectedAnswer === 'string' ? normalizeAnswer(selectedAnswer) : '';
        return given !== '' && acceptable.includes(given);
      }
      default:
        return false;
    }
  }
}

export const wrongAnswerService = new WrongAnswerService();
