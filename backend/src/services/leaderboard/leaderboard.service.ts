// LeaderboardService — tinh toan va tra ve bang xep hang theo Diem Uy Tin.
//
// CONG THUC DIEM UY TIN (da xac nhan voi nguoi dung):
//   Diem Uy Tin = (Trung Binh - 0.5 x Do Dao Dong) x (1 - 1/(n+1))
//
//   - Trung Binh = AVG(score) cua ExamSession COMPLETED co score NOT NULL
//   - Do Dao Dong = STDDEV_POP(score) (= 0 khi chi co 1 lan thi)
//   - n = so lan thi thanh cong
//
// XU HUONG (TREND): so sanh hang hien tai vs hang chi tinh tu du lieu TRUOC 30 ngay.
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type {
  LeaderboardEntry,
  LeaderboardResponse,
  MyRankResponse,
  RawLeaderboardRow,
  Trend,
} from './leaderboard.types.js';

const PAGE_SIZE = 10;

// ---------------------------------------------------------------------------
// Query helper — xay dung menh de loc mon hoc (de tai su dung)
// ---------------------------------------------------------------------------

function subjectClause(subject: string | undefined): Prisma.Sql {
  return subject ? Prisma.sql`AND es."subjectId" = ${subject}` : Prisma.empty;
}

// ---------------------------------------------------------------------------
// LeaderboardService
// ---------------------------------------------------------------------------

export class LeaderboardService {
  /**
   * Lay danh sach xep hang phan trang, kem xu huong so voi 30 ngay truoc.
   * Chi tinh nhung user da co it nhat 1 ExamSession COMPLETED co score.
   */
  public async getLeaderboard(page: number, subject?: string): Promise<LeaderboardResponse> {
    const offset = (page - 1) * PAGE_SIZE;
    const sc = subjectClause(subject);

    // Tong so user tham gia xep hang (de tinh pageSize tren FE)
    const countRows = await prisma.$queryRaw<[{ total: bigint }]>`
      SELECT COUNT(DISTINCT es."userId")::bigint AS total
      FROM exam_sessions es
      WHERE es.status = 'COMPLETED' AND es.score IS NOT NULL
      ${sc}
    `;
    const total = Number(countRows[0]?.total ?? 0);

    if (total === 0) {
      return { data: [], total: 0, page, pageSize: PAGE_SIZE };
    }

    // CTE tong hop:
    //   current_scores: tinh Diem Uy Tin hien tai
    //   current_ranks:  ganh hang tu Diem Uy Tin
    //   old_scores:     tinh Diem Uy Tin chi tu du lieu TRUOC 30 ngay
    //   old_ranks:      xep hang 30 ngay truoc (de tinh xu huong)
    const rows = await prisma.$queryRaw<RawLeaderboardRow[]>`
      WITH current_scores AS (
        SELECT
          es."userId",
          AVG(es.score)::float                                             AS avg_score,
          COALESCE(STDDEV_POP(es.score), 0)::float                        AS stddev_score,
          COUNT(es.id)::int                                                AS exam_count,
          (
            AVG(es.score) - 0.5 * COALESCE(STDDEV_POP(es.score), 0)
          ) * (1.0 - 1.0 / (COUNT(es.id) + 1))                           AS reputation_score,
          MAX(es."completedAt")                                            AS last_completed_at
        FROM exam_sessions es
        WHERE es.status = 'COMPLETED' AND es.score IS NOT NULL
        ${sc}
        GROUP BY es."userId"
      ),
      current_ranks AS (
        SELECT
          "userId",
          avg_score,
          exam_count,
          reputation_score,
          ROW_NUMBER() OVER (
            ORDER BY reputation_score DESC, last_completed_at DESC
          )::int AS current_rank
        FROM current_scores
      ),
      old_scores AS (
        SELECT
          es."userId",
          (
            AVG(es.score) - 0.5 * COALESCE(STDDEV_POP(es.score), 0)
          ) * (1.0 - 1.0 / (COUNT(es.id) + 1))                           AS old_reputation_score,
          MAX(es."completedAt")                                            AS old_last_completed_at
        FROM exam_sessions es
        WHERE es.status = 'COMPLETED' AND es.score IS NOT NULL
          AND es."completedAt" < NOW() - INTERVAL '30 days'
        ${sc}
        GROUP BY es."userId"
      ),
      old_ranks AS (
        SELECT
          "userId",
          ROW_NUMBER() OVER (
            ORDER BY old_reputation_score DESC, old_last_completed_at DESC
          )::int AS old_rank
        FROM old_scores
      )
      SELECT
        cr."userId"            AS "userId",
        u."displayName"        AS "displayName",
        u."avatarUrl"          AS "avatarUrl",
        cr.avg_score           AS "avgScore",
        cr.exam_count          AS "examCount",
        cr.reputation_score    AS "reputationScore",
        cr.current_rank        AS "rank",
        CASE
          WHEN orr.old_rank IS NULL          THEN 'new'
          WHEN orr.old_rank > cr.current_rank THEN 'up'
          WHEN orr.old_rank < cr.current_rank THEN 'down'
          ELSE                                    'same'
        END::text              AS "trend"
      FROM current_ranks cr
      INNER JOIN users u ON u.id = cr."userId"
      LEFT JOIN old_ranks orr ON orr."userId" = cr."userId"
      ORDER BY cr.current_rank
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `;

    const data: LeaderboardEntry[] = rows.map((row) => ({
      rank:            Number(row.rank),
      userId:          row.userId,
      displayName:     row.displayName,
      avatarUrl:       row.avatarUrl,
      reputationScore: roundTwo(Number(row.reputationScore)),
      avgScore:        roundTwo(Number(row.avgScore)),
      examCount:       Number(row.examCount),
      trend:           row.trend as Trend,
    }));

    return { data, total, page, pageSize: PAGE_SIZE };
  }

  /**
   * Lay hang va chi so Diem Uy Tin cua user dang dang nhap.
   * Neu chua thi lan nao -> examCount=0, rank=null.
   */
  public async getMyRank(userId: string, subject?: string): Promise<MyRankResponse> {
    const sc = subjectClause(subject);

    // Kiem tra user co trong bang xep hang khong
    const statsRows = await prisma.$queryRaw<
      [{ avg_score: number; exam_count: number; reputation_score: number } | undefined]
    >`
      SELECT
        AVG(es.score)::float                                             AS avg_score,
        COUNT(es.id)::int                                                AS exam_count,
        (
          AVG(es.score) - 0.5 * COALESCE(STDDEV_POP(es.score), 0)
        ) * (1.0 - 1.0 / (COUNT(es.id) + 1))                           AS reputation_score
      FROM exam_sessions es
      WHERE es."userId" = ${userId}
        AND es.status = 'COMPLETED'
        AND es.score IS NOT NULL
      ${sc}
    `;

    const stats = statsRows[0];
    if (!stats || Number(stats.exam_count) === 0) {
      return { rank: null, reputationScore: null, avgScore: null, examCount: 0, trend: null };
    }

    // Tinh hang hien tai: tinh ROW_NUMBER tren tat ca user truoc, sau do filter theo userId
    const rankRows = await prisma.$queryRaw<[{ current_rank: number }]>`
      WITH all_scores AS (
        SELECT
          es."userId",
          (
            AVG(es.score) - 0.5 * COALESCE(STDDEV_POP(es.score), 0)
          ) * (1.0 - 1.0 / (COUNT(es.id) + 1)) AS reputation_score,
          MAX(es."completedAt") AS last_completed_at
        FROM exam_sessions es
        WHERE es.status = 'COMPLETED' AND es.score IS NOT NULL
        ${sc}
        GROUP BY es."userId"
      ),
      ranked AS (
        SELECT
          "userId",
          ROW_NUMBER() OVER (
            ORDER BY reputation_score DESC, last_completed_at DESC
          )::int AS current_rank
        FROM all_scores
      )
      SELECT current_rank
      FROM ranked
      WHERE "userId" = ${userId}
    `;

    const currentRank = Number(rankRows[0]?.current_rank ?? null);

    // Tinh hang 30 ngay truoc: tinh ROW_NUMBER tren tat ca user truoc, sau do filter
    const oldRankRows = await prisma.$queryRaw<Array<{ old_rank: number }>>`
      WITH old_scores AS (
        SELECT
          es."userId",
          (
            AVG(es.score) - 0.5 * COALESCE(STDDEV_POP(es.score), 0)
          ) * (1.0 - 1.0 / (COUNT(es.id) + 1)) AS reputation_score,
          MAX(es."completedAt") AS last_completed_at
        FROM exam_sessions es
        WHERE es.status = 'COMPLETED' AND es.score IS NOT NULL
          AND es."completedAt" < NOW() - INTERVAL '30 days'
        ${sc}
        GROUP BY es."userId"
      ),
      old_ranked AS (
        SELECT
          "userId",
          ROW_NUMBER() OVER (
            ORDER BY reputation_score DESC, last_completed_at DESC
          )::int AS old_rank
        FROM old_scores
      )
      SELECT old_rank
      FROM old_ranked
      WHERE "userId" = ${userId}
    `;

    const oldRankRow = oldRankRows[0];
    const oldRank = oldRankRow !== undefined ? Number(oldRankRow.old_rank) : null;

    const trend: Trend =
      oldRank === null
        ? 'new'
        : oldRank > currentRank
          ? 'up'
          : oldRank < currentRank
            ? 'down'
            : 'same';

    return {
      rank:            currentRank || null,
      reputationScore: roundTwo(Number(stats.reputation_score)),
      avgScore:        roundTwo(Number(stats.avg_score)),
      examCount:       Number(stats.exam_count),
      trend,
    };
  }
}

export const leaderboardService = new LeaderboardService();

// ---------------------------------------------------------------------------
// Util
// ---------------------------------------------------------------------------

function roundTwo(n: number): number {
  return Math.round(n * 100) / 100;
}
