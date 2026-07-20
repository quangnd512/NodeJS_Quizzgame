// ============================================================================
// BattleMatchService — tang du lieu (Prisma) cho module Thi dau doi khang:
//   - Chon cau hoi + xao dap an cho 1 tran moi
//   - Tao tran + khoa cuoc (lock stake) khi bat dau
//   - Ghi log tung cau tra loi (audit)
//   - Thanh toan diem khi ket thuc tran (4 kich ban: thang nguoi that/thua/hoa/thang bot
//     + 2 nhanh mat ket noi: xu thang ky thuat / huy ca 2 hoan cuoc)
//   - Truy van REST: lich su tran (GET /api/battle/history), cau hinh (GET /api/battle/config)
//
// NGUYEN TAC THANH TOAN DIEM ("khoa cuoc roi chia lai" — escrow):
//   - Luc bat dau tran: TRU (deductPoints) dung 1 lan `stake` diem cua MOI nguoi
//     choi THAT (bot khong co vi diem nen khong bi tru). Day la "khoa cuoc"
//     (PVP_LOCK_BET) — dam bao ca 2 KHONG the tieu het diem giua chung tran.
//   - Luc ket thuc tran: KHONG dung transferPoints (vi diem da bi tru truoc do,
//     khong con nam trong tai khoan nguoi thua de "chuyen" nua) - ma dung addPoints:
//       + Thang (nguoi that hoac bot): +2*stake (= hoan lai cuoc cua chinh minh
//         + "an" cuoc cua doi thu, hoac + thuong 100% cuoc neu thang bot).
//       + Hoa: +stake (hoan lai dung phan da cuoc, khong lai khong lo).
//       + Thua: KHONG duoc gi them (da mat dung `stake` tu buoc khoa cuoc).
//       + Huy tran (ca 2 mat ket noi): +stake cho MOI nguoi that da tham gia
//         (hoan toan bo, khong tinh thang/thua).
// ============================================================================
import { prisma } from '../../lib/prisma.js';
import { pointsService } from '../points/points.service.js';
import { isValidSubjectId } from '../users/users.types.js';
import {
  BattleInsufficientPointsError,
  BattleInvalidStakeError,
  BattleInvalidSubjectError,
  BattleMatchNotFoundError,
  BattleNotEnoughQuestionsError,
} from './battle.errors.js';
import { shuffleOptionsWithAnswer } from './battle.utils.js';
import {
  BATTLE_QUESTIONS_PER_MATCH,
  BATTLE_STAKES,
  type BattleConfigResponse,
  type BattleHistoryItem,
  type PaginatedBattleHistory,
} from './battle.types.js';

/** So luong cau hoi toi da lay tu kho lam "pool" de random — du lon de dam bao ngau nhien tot, khong keo toan bo bang. */
const QUESTION_POOL_SIZE = 200;

/** So dong lich su toi da tra ve moi trang (chan client keo qua nhieu cung luc). */
const MAX_HISTORY_LIMIT = 50;

export interface BattleLiveQuestion {
  questionBankId: string;
  questionText: string;
  /** Da xao tron 1 lan, dung chung cho ca 2 nguoi choi. */
  options: string[];
  /** Vi tri dap an dung SAU KHI xao (khop voi `options` o tren). */
  correctOptionIndex: number;
}

/** Xao tron 1 mang (Fisher-Yates) — tra ve mang moi, khong sua in-place. Cung pattern voi practice/exam.service. */
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** Lay 4 phuong an tu truong Json cua QuestionBank (options). */
function parseOptions(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  return options.filter((o): o is string => typeof o === 'string');
}

/** Lay chi so dap an dung (0-3) tu truong Json correctAnswer cua QuestionBank (dang MCQ_4). */
function parseMcqCorrectIndex(correctAnswer: unknown): number {
  if (typeof correctAnswer === 'number' && Number.isInteger(correctAnswer)) return correctAnswer;
  const parsed = Number(correctAnswer);
  return Number.isInteger(parsed) ? parsed : -1;
}

/** Validate subject + stake dau vao (dung chung cho join-queue, create-room). */
export function validateSubjectAndStake(subject: string, stake: number): void {
  if (!isValidSubjectId(subject)) throw new BattleInvalidSubjectError(subject);
  if (!BATTLE_STAKES.includes(stake)) throw new BattleInvalidStakeError(stake);
}

/** Kiem tra user co du diem >= stake hay khong — dung de CHAN SOM (khi vao hang doi/tao phong), KHONG tru diem. */
export async function assertSufficientPoints(userId: string, stake: number): Promise<void> {
  const balance = await pointsService.getBalance(userId);
  if (balance.currentPoints < stake) {
    throw new BattleInsufficientPointsError(stake, balance.currentPoints);
  }
}

/**
 * Chon ngau nhien 10 cau MCQ_4 (isActive) cung mon tu Ngan hang cau hoi, xao dap an
 * 1 LAN cho moi cau (dung chung cho ca 2 nguoi choi).
 *
 * @throws BattleNotEnoughQuestionsError neu khong du 10 cau MCQ_4 active cho mon nay
 */
export async function selectMatchQuestions(subject: string): Promise<BattleLiveQuestion[]> {
  const pool = await prisma.questionBank.findMany({
    where: { subject, questionType: 'MCQ_4', isActive: true },
    select: { id: true, questionText: true, options: true, correctAnswer: true },
    take: QUESTION_POOL_SIZE,
  });

  if (pool.length < BATTLE_QUESTIONS_PER_MATCH) {
    throw new BattleNotEnoughQuestionsError(subject);
  }

  const picked = shuffle(pool).slice(0, BATTLE_QUESTIONS_PER_MATCH);

  return picked.map((q) => {
    const options = parseOptions(q.options);
    const correctIndex = parseMcqCorrectIndex(q.correctAnswer);
    const { options: shuffledOptions, correctIndex: shuffledCorrectIndex } = shuffleOptionsWithAnswer(
      options,
      correctIndex,
    );
    return {
      questionBankId: q.id,
      questionText: q.questionText,
      options: shuffledOptions,
      correctOptionIndex: shuffledCorrectIndex,
    };
  });
}

export interface CreateAndStartMatchParams {
  subject: string;
  stake: number;
  player1Id: string;
  /** null neu day la tran voi bot. */
  player2Id: string | null;
  isBotMatch: boolean;
  /** Ma phong neu tran duoc tao qua "moi ban be" — null neu ghep qua hang doi thuong. */
  roomCode?: string | null;
}

/**
 * Tao 1 tran dau moi trong DB + khoa cuoc (deductPoints) cua (cac) nguoi choi that,
 * dong thoi chon san bo 10 cau hoi (da xao dap an) de engine dung ngay khi bat dau thi dau.
 *
 * Neu khoa cuoc that bai giua chung (vi du diem thay doi dung luc nay - rat hiem vi da
 * kiem tra truoc khi vao hang doi) -> hoan lai phan da tru (neu co) va danh dau tran
 * ABANDONED, nem loi ra ngoai de caller bao loi cho client.
 */
export async function createAndStartMatch(
  params: CreateAndStartMatchParams,
): Promise<{ matchId: string; questions: BattleLiveQuestion[] }> {
  const questions = await selectMatchQuestions(params.subject);

  const match = await prisma.battleMatch.create({
    data: {
      subject: params.subject,
      stake: params.stake,
      player1Id: params.player1Id,
      player2Id: params.player2Id,
      isBotMatch: params.isBotMatch,
      status: 'WAITING',
      roomCode: params.roomCode ?? null,
    },
  });

  let player1Locked = false;
  try {
    await pointsService.deductPoints(params.player1Id, params.stake, 'PVP_LOCK_BET', { matchId: match.id });
    player1Locked = true;

    if (!params.isBotMatch && params.player2Id) {
      await pointsService.deductPoints(params.player2Id, params.stake, 'PVP_LOCK_BET', { matchId: match.id });
    }
  } catch (err) {
    // Rollback phan da tru (neu co) va huy tran vua tao - khong de "tran ma" khong ai tra cuoc.
    if (player1Locked) {
      await pointsService
        .addPoints(params.player1Id, params.stake, 'PVP_CANCELLED_REFUND', {
          matchId: match.id,
          reason: 'start_failed',
        })
        .catch((refundErr: unknown) => {
          console.error('[battle.match.service] Loi hoan cuoc sau khi tao tran that bai:', refundErr);
        });
    }
    await prisma.battleMatch
      .update({ where: { id: match.id }, data: { status: 'ABANDONED', completedAt: new Date() } })
      .catch(() => {});
    throw err;
  }

  await prisma.battleMatch.update({ where: { id: match.id }, data: { status: 'IN_PROGRESS' } });

  return { matchId: match.id, questions };
}

/** Ghi 1 dong log cau tra loi (playerId = null neu la bot). */
export async function recordAnswer(params: {
  matchId: string;
  playerId: string | null;
  questionIndex: number;
  questionBankId: string;
  selectedOption: number;
  isCorrect: boolean;
  pointsEarned: number;
}): Promise<void> {
  await prisma.battleAnswer.create({ data: params });
}

/** Cach tran ket thuc — dung de settleMatch quyet dinh cach thanh toan diem phu hop. */
export type SettlementOutcome =
  /** Ket thuc binh thuong (du 10 cau) - so sanh player1Score/player2Score de ra thang/thua/hoa. */
  | { type: 'NORMAL' }
  /** 1 ben mat ket noi qua 30s khong quay lai - ben con lai thang ky thuat. */
  | { type: 'DISCONNECT_WIN'; winnerIsPlayer1: boolean }
  /** Ca 2 ben mat ket noi trong luc cho (hoac tran bi huy vi ly do khac truoc khi ket thuc) - hoan cuoc, khong tinh thang thua. */
  | { type: 'CANCELLED' };

export interface SettleMatchParams {
  matchId: string;
  player1Id: string;
  player2Id: string | null;
  isBotMatch: boolean;
  stake: number;
  player1Score: number;
  player2Score: number;
  outcome: SettlementOutcome;
}

export interface SettleMatchResult {
  winnerId: string | null;
  status: 'COMPLETED' | 'ABANDONED';
}

/**
 * Thanh toan diem + cap nhat trang thai cuoi cung cho 1 tran dau. Xem giai thich
 * thuat toan "khoa cuoc roi chia lai" o dau file.
 */
export async function settleMatch(params: SettleMatchParams): Promise<SettleMatchResult> {
  const { matchId, player1Id, player2Id, isBotMatch, stake, player1Score, player2Score, outcome } = params;

  if (outcome.type === 'CANCELLED') {
    await pointsService.addPoints(player1Id, stake, 'PVP_CANCELLED_REFUND', { matchId });
    if (!isBotMatch && player2Id) {
      await pointsService.addPoints(player2Id, stake, 'PVP_CANCELLED_REFUND', { matchId });
    }
    await prisma.battleMatch.update({
      where: { id: matchId },
      data: { status: 'ABANDONED', winnerId: null, player1Score, player2Score, completedAt: new Date() },
    });
    return { winnerId: null, status: 'ABANDONED' };
  }

  let winnerId: string | null = null;

  if (outcome.type === 'DISCONNECT_WIN') {
    winnerId = outcome.winnerIsPlayer1 ? player1Id : player2Id;
    if (winnerId) {
      await pointsService.addPoints(winnerId, stake * 2, 'PVP_WIN', { matchId, viaDisconnect: true });
    }
  } else {
    // NORMAL: so sanh diem so sau khi da tra loi du (hoac het) 10 cau.
    if (player1Score > player2Score) {
      winnerId = player1Id;
      await pointsService.addPoints(player1Id, stake * 2, 'PVP_WIN', {
        matchId,
        vsBot: isBotMatch,
        opponentId: player2Id,
      });
    } else if (player2Score > player1Score) {
      // Bot khong co vi diem -> chi thanh toan neu doi thu la nguoi that.
      if (!isBotMatch && player2Id) {
        winnerId = player2Id;
        await pointsService.addPoints(player2Id, stake * 2, 'PVP_WIN', { matchId, opponentId: player1Id });
      }
      // isBotMatch && bot thang: khong ai duoc gi them - player1 da mat dung `stake` tu buoc khoa cuoc.
    } else {
      // Hoa - hoan cuoc cho MOI nguoi that (kho ca truong hop vs bot: nguoi that van duoc hoan).
      await pointsService.addPoints(player1Id, stake, 'PVP_DRAW_REFUND', { matchId, vsBot: isBotMatch });
      if (!isBotMatch && player2Id) {
        await pointsService.addPoints(player2Id, stake, 'PVP_DRAW_REFUND', { matchId });
      }
    }
  }

  await prisma.battleMatch.update({
    where: { id: matchId },
    data: { status: 'COMPLETED', winnerId, player1Score, player2Score, completedAt: new Date() },
  });

  return { winnerId, status: 'COMPLETED' };
}

/** GET /api/battle/config — muc cuoc hop le + so du diem hien tai. */
export async function getBattleConfig(userId: string): Promise<BattleConfigResponse> {
  const balance = await pointsService.getBalance(userId);
  return { stakes: BATTLE_STAKES, currentPoints: balance.currentPoints };
}

/** GET /api/battle/history — lich su tran DA HOAN THANH cua user, phan trang, MO CHO TAT CA (chua khoa Premium o dot nay). */
export async function getBattleHistory(userId: string, limit: number, offset: number): Promise<PaginatedBattleHistory> {
  const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, MAX_HISTORY_LIMIT) : 20;
  const safeOffset = Number.isInteger(offset) && offset >= 0 ? offset : 0;

  const where = {
    status: 'COMPLETED',
    OR: [{ player1Id: userId }, { player2Id: userId }],
  };

  const [rows, total] = await Promise.all([
    prisma.battleMatch.findMany({
      where,
      orderBy: { completedAt: 'desc' },
      take: safeLimit,
      skip: safeOffset,
    }),
    prisma.battleMatch.count({ where }),
  ]);

  const opponentIds = rows
    .filter((r) => !r.isBotMatch)
    .map((r) => (r.player1Id === userId ? r.player2Id : r.player1Id))
    .filter((id): id is string => Boolean(id));

  const opponents =
    opponentIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: opponentIds } },
          select: { id: true, displayName: true, email: true },
        })
      : [];
  const nameById = new Map(opponents.map((o) => [o.id, o.displayName ?? o.email ?? 'Người chơi']));

  const items: BattleHistoryItem[] = rows.map((r) => {
    const isPlayer1 = r.player1Id === userId;
    const myScore = isPlayer1 ? r.player1Score : r.player2Score;
    const opponentScore = isPlayer1 ? r.player2Score : r.player1Score;
    const opponentId = isPlayer1 ? r.player2Id : r.player1Id;
    const result: 'WIN' | 'LOSE' | 'DRAW' = myScore > opponentScore ? 'WIN' : myScore < opponentScore ? 'LOSE' : 'DRAW';
    const pointsChange = result === 'WIN' ? r.stake : result === 'LOSE' ? -r.stake : 0;

    return {
      id: r.id,
      subject: r.subject,
      stake: r.stake,
      isBotMatch: r.isBotMatch,
      opponentName: r.isBotMatch ? null : (opponentId ? nameById.get(opponentId) ?? 'Người chơi' : null),
      myScore,
      opponentScore,
      result,
      pointsChange,
      completedAt: (r.completedAt ?? r.createdAt).toISOString(),
    };
  });

  return { items, total };
}

/** Lay 1 tran theo ID - dung khi engine can doi chieu du lieu (vd. kiem tra quyen so huu). */
export async function getMatchById(matchId: string) {
  const match = await prisma.battleMatch.findUnique({ where: { id: matchId } });
  if (!match) throw new BattleMatchNotFoundError(matchId);
  return match;
}
