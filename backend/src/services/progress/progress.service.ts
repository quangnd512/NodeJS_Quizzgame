// ============================================================================
// ProgressService — thong ke tien do hoc tap:
//   - Tong quan (so phien, diem, streak)
//   - So sanh thang nay vs thang truoc
//   - Thong ke theo mon hoc (reuse practice.service getStats)
//   - Bieu do xu huong diem (30 phien gan nhat)
//   - Lich su thi thu co phan trang
// ============================================================================
import { prisma } from '../../lib/prisma.js';
import { practiceService } from '../practice/practice.service.js';
import type {
  ExamHistoryItem,
  MonthComparison,
  MonthStats,
  PaginatedExamHistory,
  ProgressOverview,
  ProgressSummary,
  ScoreTrendPoint,
} from './progress.types.js';

// ---------------------------------------------------------------------------
// Helpers noi bo
// ---------------------------------------------------------------------------

/** Lay ngay dau thang (00:00:00 UTC). */
function startOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
}

/** Lay ngay cuoi thang (23:59:59.999 UTC). */
function endOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
}

/**
 * Tinh streak tu mang ngay da hoan thanh phien on tap.
 * Tra ve { currentStreak, bestStreak }.
 * Quy tac:
 *   - "ngay" tinh theo UTC date (yyyy-mm-dd)
 *   - Neu hom nay chua co phien thi streak hien tai = chuoi ket thuc hom qua
 *   - Chuoi lien tiep = cac ngay lien ke nhau (khong co ngay trong)
 */
function computeStreaks(completedAtDates: Date[]): {
  currentStreak: number;
  bestStreak: number;
} {
  if (completedAtDates.length === 0) return { currentStreak: 0, bestStreak: 0 };

  // Lay danh sach ngay duy nhat (UTC date string), sap xep giam dan
  const uniqueDays = [
    ...new Set(completedAtDates.map((d) => d.toISOString().slice(0, 10))),
  ].sort().reverse(); // ['2025-07-04', '2025-07-03', ...]

  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  // Tinh chuoi hien tai bat dau tu hom nay hoac hom qua
  let currentStreak = 0;
  if (uniqueDays[0] === todayStr || uniqueDays[0] === yesterdayStr) {
    currentStreak = 1;
    for (let i = 1; i < uniqueDays.length; i++) {
      const prev = new Date(uniqueDays[i - 1]!);
      const curr = new Date(uniqueDays[i]!);
      const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86_400_000);
      if (diffDays === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Tinh best streak tren toan bo lich su
  let bestStreak = 1;
  let tempStreak = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    const prev = new Date(uniqueDays[i - 1]!);
    const curr = new Date(uniqueDays[i]!);
    const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86_400_000);
    if (diffDays === 1) {
      tempStreak++;
      if (tempStreak > bestStreak) bestStreak = tempStreak;
    } else {
      tempStreak = 1;
    }
  }

  return { currentStreak, bestStreak };
}

/** Tinh diem trung binh thi thu trong 1 khoang thoi gian, tra null neu khong co du lieu. */
function calcExamAvg(scores: (number | null)[]): number | null {
  const valid = scores.filter((s): s is number => s !== null);
  if (valid.length === 0) return null;
  const sum = valid.reduce((acc, s) => acc + s, 0);
  return Math.round((sum / valid.length) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const progressService = {
  /**
   * Lay toan bo summary tien do hoc tap cua user.
   * Khong throw loi khi chua co du lieu — tra ve 0/null/[].
   */
  async getSummary(userId: string): Promise<ProgressSummary> {
    const now = new Date();
    const thisYear = now.getUTCFullYear();
    const thisMonth = now.getUTCMonth(); // 0-indexed

    const lastMonthDate = new Date(Date.UTC(thisYear, thisMonth - 1, 1));
    const lastYear = lastMonthDate.getUTCFullYear();
    const lastMonth = lastMonthDate.getUTCMonth();

    // --- Chay cac query doc lap song song ---
    const [
      practiceSessions,
      totalExamCount,
      pointsRow,
      thisMonthPracticeCount,
      lastMonthPracticeCount,
      thisMonthExamScores,
      lastMonthExamScores,
      scoreTrendRaw,
      practiceStatsBySubject,
    ] = await Promise.all([
      // Tat ca phien on tap da hoan thanh (lay completedAt de tinh streak + tong)
      prisma.practiceSession.findMany({
        where: { userId, completedAt: { not: null } },
        select: { completedAt: true },
        orderBy: { completedAt: 'asc' },
      }),

      // Tong so phien thi thu da hoan thanh
      prisma.examSession.count({
        where: { userId, status: 'COMPLETED' },
      }),

      // Diem hien tai
      prisma.userPoints.findUnique({
        where: { userId },
        select: { currentPoints: true },
      }),

      // So phien on tap thang nay
      prisma.practiceSession.count({
        where: {
          userId,
          completedAt: {
            gte: startOfMonth(thisYear, thisMonth),
            lte: endOfMonth(thisYear, thisMonth),
          },
        },
      }),

      // So phien on tap thang truoc
      prisma.practiceSession.count({
        where: {
          userId,
          completedAt: {
            gte: startOfMonth(lastYear, lastMonth),
            lte: endOfMonth(lastYear, lastMonth),
          },
        },
      }),

      // Diem thi thu thang nay
      prisma.examSession.findMany({
        where: {
          userId,
          status: 'COMPLETED',
          completedAt: {
            gte: startOfMonth(thisYear, thisMonth),
            lte: endOfMonth(thisYear, thisMonth),
          },
        },
        select: { score: true },
      }),

      // Diem thi thu thang truoc
      prisma.examSession.findMany({
        where: {
          userId,
          status: 'COMPLETED',
          completedAt: {
            gte: startOfMonth(lastYear, lastMonth),
            lte: endOfMonth(lastYear, lastMonth),
          },
        },
        select: { score: true },
      }),

      // 30 phien on tap gan nhat cho bieu do xu huong
      prisma.practiceSession.findMany({
        where: { userId, completedAt: { not: null } },
        orderBy: { completedAt: 'desc' },
        take: 30,
        select: { completedAt: true, score: true, subjectId: true },
      }),

      // Thong ke theo mon hoc (reuse logic tu practice service)
      practiceService.getStats(userId),
    ]);

    // Tinh streak
    const completedDates = practiceSessions
      .map((s) => s.completedAt)
      .filter((d): d is Date => d !== null);
    const { currentStreak, bestStreak } = computeStreaks(completedDates);

    // Tong quan
    const overview: ProgressOverview = {
      totalPracticeSessions: practiceSessions.length,
      totalExamSessions: totalExamCount,
      currentPoints: pointsRow?.currentPoints ?? 0,
      currentStreak,
    };

    // So sanh thang
    const thisMonthStats: MonthStats = {
      practiceSessions: thisMonthPracticeCount,
      examAvgScore: calcExamAvg(thisMonthExamScores.map((e) => e.score)),
    };
    const lastMonthStats: MonthStats = {
      practiceSessions: lastMonthPracticeCount,
      examAvgScore: calcExamAvg(lastMonthExamScores.map((e) => e.score)),
    };
    const monthComparison: MonthComparison = {
      thisMonth: thisMonthStats,
      lastMonth: lastMonthStats,
    };

    // Bieu do xu huong diem
    const scoreTrend: ScoreTrendPoint[] = scoreTrendRaw
      .filter((s) => s.completedAt !== null)
      .map((s) => ({
        date: s.completedAt!.toISOString(),
        score: s.score,
        subject: s.subjectId,
      }))
      .reverse(); // sap xep tu cu den moi de ve bieu do

    return {
      overview,
      bestStreak,
      monthComparison,
      practiceStatsBySubject,
      scoreTrend,
    };
  },

  /**
   * Lay lich su thi thu co phan trang.
   * Chi tra ve cac phien co status = "COMPLETED".
   */
  async getExamHistory(
    userId: string,
    limit = 10,
    offset = 0,
  ): Promise<PaginatedExamHistory> {
    const safeLimit  = Math.max(1, Math.min(limit, 50));
    const safeOffset = Math.max(0, offset);

    const [sessions, total] = await Promise.all([
      prisma.examSession.findMany({
        where: { userId, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        take: safeLimit,
        skip: safeOffset,
        select: {
          id: true,
          examPaperId: true,
          score: true,
          pointsAwarded: true,
          completedAt: true,
        },
      }),
      prisma.examSession.count({
        where: { userId, status: 'COMPLETED' },
      }),
    ]);

    // Lay thong tin de thi theo examPaperId (khong co Prisma relation)
    const paperIds = [...new Set(sessions.map((s) => s.examPaperId))];
    const papers = paperIds.length > 0
      ? await prisma.examPaper.findMany({
          where: { id: { in: paperIds } },
          select: { id: true, title: true, subject: true },
        })
      : [];
    const paperMap = new Map(papers.map((p) => [p.id, p]));

    const mapped: ExamHistoryItem[] = sessions.map((s) => {
      const paper = paperMap.get(s.examPaperId);
      return {
        id: s.id,
        examPaperId: s.examPaperId,
        title: paper?.title ?? '(Đề không còn tồn tại)',
        subject: paper?.subject ?? '',
        score: s.score,
        pointsAwarded: s.pointsAwarded,
        completedAt: s.completedAt!.toISOString(),
      };
    });

    return { items: mapped, total, limit: safeLimit, offset: safeOffset };
  },
};
