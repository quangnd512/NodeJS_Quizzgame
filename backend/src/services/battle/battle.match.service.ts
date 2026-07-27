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
//
// ATOMICITY (sua boi S3): moi thao tac tra/khoa diem O TREN deu di kem 1 thay doi
// trang thai BattleMatch tuong ung (WAITING->IN_PROGRESS luc khoa cuoc, IN_PROGRESS->
// COMPLETED/ABANDONED luc tra) - CA HAI nam trong CUNG 1 prisma.$transaction (dung
// deductPointsInTx/addPointsInTx, giong pattern ExamService.startExam/submitExam) de
// khong bao gio xay ra tinh trang "da tra/tru diem nhung chua kip cap nhat trang thai
// tran" (hoac nguoc lai) neu co loi giua chung. Xem chi tiet trong tung ham.
// ============================================================================
import { prisma } from '../../lib/prisma.js';
import { pointsService } from '../points/points.service.js';
import { OptimisticLockError, OptimisticLockRetryableError, PointsInsufficientError } from '../points/points.errors.js';
import { PointReason } from '../points/points.types.js';
import { isValidSubjectId } from '../users/users.types.js';
import {
  BattleInsufficientPointsError,
  BattleInvalidStakeError,
  BattleInvalidSubjectError,
  BattleMatchNotFoundError,
  BattleMatchNotInProgressError,
  BattleNotEnoughQuestionsError,
} from './battle.errors.js';
import { pickBotDisplayName, shuffleOptionsWithAnswer } from './battle.utils.js';
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

/**
 * So lan retry toi da khi gap optimistic lock conflict luc khoa/tra cuoc PvP
 * (cung gia tri + cung ly do voi MAX_EXAM_RETRY trong exam.service.ts — xem
 * PointsService.deductPointsInTx/addPointsInTx).
 */
const MAX_BATTLE_RETRY = 10;

/** Delay voi jitter ngan de giam xac suat "thundering herd" khi retry (cung pattern voi exam.service.ts). */
function delayJitter(): Promise<void> {
  const ms = 10 + Math.random() * 40;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
 * QUAN TRONG (sua boi S3 — xem CODE_REVIEW_LOG.md): tao tran + khoa cuoc CA HAI nguoi
 * choi nam TRONG CUNG 1 `prisma.$transaction` (dung `deductPointsInTx`, giong het pattern
 * `ExamService.startExam`) thay vi 2 buoc rieng + "hoan cuoc thu cong" nhu ban truoc. Neu
 * khoa cuoc that bai giua chung (vi du diem thay doi dung luc nay - rat hiem vi da kiem
 * tra truoc khi vao hang doi), Postgres TU DONG rollback toan bo (ke ca dong BattleMatch
 * vua tao) — khong con "tran ma" WAITING mo coi, cung khong con rui ro "hoan cuoc thu cong"
 * tu no that bai giua chung lam mat diem oan cua nguoi choi.
 *
 * @throws BattleInsufficientPointsError neu 1 trong 2 nguoi khong (con) du diem luc nay
 * @throws BattleNotEnoughQuestionsError neu khong du 10 cau MCQ_4 active cho mon nay
 */
export async function createAndStartMatch(
  params: CreateAndStartMatchParams,
): Promise<{ matchId: string; questions: BattleLiveQuestion[] }> {
  const questions = await selectMatchQuestions(params.subject);

  for (let attempt = 1; attempt <= MAX_BATTLE_RETRY; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const match = await tx.battleMatch.create({
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

        try {
          await pointsService.deductPointsInTx(tx, params.player1Id, params.stake, PointReason.PVP_LOCK_BET, {
            matchId: match.id,
          });
          if (!params.isBotMatch && params.player2Id) {
            await pointsService.deductPointsInTx(tx, params.player2Id, params.stake, PointReason.PVP_LOCK_BET, {
              matchId: match.id,
            });
          }
        } catch (err) {
          if (err instanceof PointsInsufficientError) {
            throw new BattleInsufficientPointsError(err.required, err.available);
          }
          throw err;
        }

        await tx.battleMatch.update({ where: { id: match.id }, data: { status: 'IN_PROGRESS' } });

        return { matchId: match.id, questions };
      });
    } catch (err) {
      if (err instanceof OptimisticLockRetryableError) {
        if (attempt === MAX_BATTLE_RETRY) {
          throw new OptimisticLockError(`battle-start:${params.player1Id}`, MAX_BATTLE_RETRY);
        }
        await delayJitter();
        continue;
      }
      throw err;
    }
  }

  throw new OptimisticLockError(`battle-start:${params.player1Id}`, MAX_BATTLE_RETRY);
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
 *
 * QUAN TRONG (sua boi S3 — xem CODE_REVIEW_LOG.md): TOAN BO viec tra diem
 * (addPointsInTx) + "chot" trang thai tran (status COMPLETED/ABANDONED) nam
 * TRONG CUNG 1 `prisma.$transaction`, giong het pattern `closeResult` trong
 * `ExamService.submitExam`. Ban truoc goi `pointsService.addPoints` (tu mo
 * transaction rieng) RỒI MOI `prisma.battleMatch.update` (transaction khac) —
 * neu buoc thu 2 that bai giua chung (mat ket noi DB, process crash...), diem
 * DA duoc tra nhung tran van hien "IN_PROGRESS" mai mai (khong xuat hien trong
 * lich su, khong the doi soat). Buoc "chot" cuoi cung dung `updateMany` VOI
 * DIEU KIEN `status: 'IN_PROGRESS'` con dong vai tro 1 CAS (compare-and-swap):
 * neu ham nay vo tinh duoc goi 2 lan cho CUNG 1 tran (engine dung co `live.ended`
 * chan truoc, day la lop bao ve thu 2 o tang DB — vd. phong khi sau nay scale
 * nhieu instance backend), lan thu 2 se nhan count=0 va NEM LOI, khien Postgres
 * rollback TOAN BO transaction do (ke ca cac addPointsInTx vua goi ben tren) —
 * khong bao gio tra diem 2 lan cho cung 1 tran.
 *
 * @throws BattleMatchNotInProgressError neu tran khong (con) o trang thai
 *         IN_PROGRESS luc "chot" (da duoc settle boi 1 lan goi khac truoc do)
 */
export async function settleMatch(params: SettleMatchParams): Promise<SettleMatchResult> {
  const { matchId, player1Id, player2Id, isBotMatch, stake, player1Score, player2Score, outcome } = params;

  for (let attempt = 1; attempt <= MAX_BATTLE_RETRY; attempt++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await prisma.$transaction(async (tx) => {
        let winnerId: string | null = null;
        let finalStatus: 'COMPLETED' | 'ABANDONED' = 'COMPLETED';

        if (outcome.type === 'CANCELLED') {
          finalStatus = 'ABANDONED';
          await pointsService.addPointsInTx(tx, player1Id, stake, PointReason.PVP_CANCELLED_REFUND, { matchId });
          if (!isBotMatch && player2Id) {
            await pointsService.addPointsInTx(tx, player2Id, stake, PointReason.PVP_CANCELLED_REFUND, { matchId });
          }
        } else if (outcome.type === 'DISCONNECT_WIN') {
          winnerId = outcome.winnerIsPlayer1 ? player1Id : player2Id;
          if (winnerId) {
            await pointsService.addPointsInTx(tx, winnerId, stake * 2, PointReason.PVP_WIN, {
              matchId,
              viaDisconnect: true,
            });
          }
        } else {
          // NORMAL: so sanh diem so sau khi da tra loi du (hoac het) 10 cau.
          if (player1Score > player2Score) {
            winnerId = player1Id;
            await pointsService.addPointsInTx(tx, player1Id, stake * 2, PointReason.PVP_WIN, {
              matchId,
              vsBot: isBotMatch,
              opponentId: player2Id,
            });
          } else if (player2Score > player1Score) {
            // Bot khong co vi diem -> chi thanh toan neu doi thu la nguoi that.
            if (!isBotMatch && player2Id) {
              winnerId = player2Id;
              await pointsService.addPointsInTx(tx, player2Id, stake * 2, PointReason.PVP_WIN, {
                matchId,
                opponentId: player1Id,
              });
            }
            // isBotMatch && bot thang: khong ai duoc gi them - player1 da mat dung `stake` tu buoc khoa cuoc.
          } else {
            // Hoa - hoan cuoc cho MOI nguoi that (ke ca truong hop vs bot: nguoi that van duoc hoan).
            await pointsService.addPointsInTx(tx, player1Id, stake, PointReason.PVP_DRAW_REFUND, {
              matchId,
              vsBot: isBotMatch,
            });
            if (!isBotMatch && player2Id) {
              await pointsService.addPointsInTx(tx, player2Id, stake, PointReason.PVP_DRAW_REFUND, { matchId });
            }
          }
        }

        const closeResult = await tx.battleMatch.updateMany({
          where: { id: matchId, status: 'IN_PROGRESS' },
          data: { status: finalStatus, winnerId, player1Score, player2Score, completedAt: new Date() },
        });
        if (closeResult.count === 0) {
          throw new BattleMatchNotInProgressError(matchId);
        }

        return { winnerId, status: finalStatus };
      });
    } catch (err) {
      if (err instanceof OptimisticLockRetryableError) {
        if (attempt === MAX_BATTLE_RETRY) throw new OptimisticLockError(matchId, MAX_BATTLE_RETRY);
        // eslint-disable-next-line no-await-in-loop
        await delayJitter();
        continue;
      }
      throw err;
    }
  }

  throw new OptimisticLockError(matchId, MAX_BATTLE_RETRY);
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

    // QUAN TRONG (sua boi S3): KHONG duoc suy result tu viec so sanh diem so don thuan
    // cho tran nguoi that vs nguoi that — tran ket thuc do doi thu MAT KET NOI (xu thang
    // ky thuat, xem SettlementOutcome 'DISCONNECT_WIN' trong settleMatch) tra thang cho
    // NGUOI CON LAI bat ke diem so luc do (vd. nguoi mat ket noi dang dan diem van bi xu
    // thua) — so sanh diem se cho ra ket qua SAI, ngược voi diem thuc te da thanh toan.
    // `winnerId` da luu DUNG nguoi thang thuc su (bang) nen dung truc tiep — CHI TRU
    // truong hop tran voi bot: bot khong co userId nen KHONG the la winnerId (`winnerId`
    // luon null neu bot thang), buoc phai quay lai so sanh diem so cho rieng truong hop nay.
    const result: 'WIN' | 'LOSE' | 'DRAW' = r.isBotMatch
      ? (myScore > opponentScore ? 'WIN' : myScore < opponentScore ? 'LOSE' : 'DRAW')
      : (r.winnerId === userId ? 'WIN' : r.winnerId === null ? 'DRAW' : 'LOSE');
    const pointsChange = result === 'WIN' ? r.stake : result === 'LOSE' ? -r.stake : 0;

    return {
      id: r.id,
      subject: r.subject,
      stake: r.stake,
      isBotMatch: r.isBotMatch,
      // An hoan toan danh tinh bot khoi nguoi choi (quyet dinh san pham) - dung ten gia
      // GIONG NGUOI THAT (deterministic theo matchId, xem pickBotDisplayName) thay vi
      // null/"Máy". `isBotMatch` van giu nguyen trong response cho muc dich doi soat noi
      // bo (xem admin-guide.md muc 16) - CHI khong con dung o tang hien thi FE.
      opponentName: r.isBotMatch ? pickBotDisplayName(r.id) : (opponentId ? nameById.get(opponentId) ?? 'Người chơi' : null),
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
