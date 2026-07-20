// Cac ham thuan (pure function) dung trong module Battle — tach rieng de de unit test
// (khong phu thuoc Prisma/Socket.io), dung chung boi battle.queue.service.ts va battle.engine.service.ts.
import {
  BATTLE_BASE_POINTS_PER_QUESTION,
  BATTLE_MAX_SPEED_BONUS,
  BATTLE_QUESTION_TIME_LIMIT_MS,
  QUEUE_ANY_UNTIL_SECONDS,
  QUEUE_STRICT_UNTIL_SECONDS,
  QUEUE_SUBJECT_ONLY_UNTIL_SECONDS,
  type BattleMatchResult,
  type QueueCriteria,
} from './battle.types.js';

/**
 * Xac dinh muc do noi long tieu chi ghep tran dua tren so giay da cho.
 *   - < 10s: STRICT (dung mon + dung cuoc)
 *   - 10-20s: SUBJECT_ONLY (dung mon, moi cuoc)
 *   - >= 20s: ANY (moi mon, moi cuoc) — tai giay thu 30 se bi "vot" ra ghep bot
 *     (xu ly o tang goi — ham nay khong tu dong tao bot).
 */
export function getQueueCriteria(waitedSeconds: number): QueueCriteria {
  if (waitedSeconds < QUEUE_STRICT_UNTIL_SECONDS) return 'STRICT';
  if (waitedSeconds < QUEUE_SUBJECT_ONLY_UNTIL_SECONDS) return 'SUBJECT_ONLY';
  return 'ANY';
}

/** User da cho >= 30s ma chua ghep duoc ai -> can tu dong tao tran voi bot. */
export function shouldFallbackToBot(waitedSeconds: number): boolean {
  return waitedSeconds >= QUEUE_ANY_UNTIL_SECONDS;
}

/**
 * Kiem tra 1 nguoi cho (voi tieu chi cua RIENG ho, dua tren thoi gian ho da cho)
 * co CHAP NHAN ghep voi `other` hay khong.
 */
export function acceptsCandidate(
  criteria: QueueCriteria,
  self: { subject: string; stake: number },
  other: { subject: string; stake: number },
): boolean {
  if (criteria === 'STRICT') return self.subject === other.subject && self.stake === other.stake;
  if (criteria === 'SUBJECT_ONLY') return self.subject === other.subject;
  return true; // ANY
}

/**
 * Kiem tra 2 nguoi cho co the ghep voi nhau ngay bay gio hay khong — CA HAI PHIA
 * deu phai chap nhan nhau theo tieu chi HIEN TAI cua chinh minh (khong doi xung:
 * 1 nguoi cho lau co the "de tinh" hon nguoi vua vao).
 */
export function canMatch(
  a: { subject: string; stake: number; waitedSeconds: number },
  b: { subject: string; stake: number; waitedSeconds: number },
): boolean {
  const criteriaA = getQueueCriteria(a.waitedSeconds);
  const criteriaB = getQueueCriteria(b.waitedSeconds);
  return acceptsCandidate(criteriaA, a, b) && acceptsCandidate(criteriaB, b, a);
}

/**
 * Tinh bonus toc do (0-3 diem) dua tren thoi gian tra loi (server-time, ms) so voi
 * thoi gian toi da cho phep. Chia deu thanh 4 "bac" — tra loi cang som trong 20s
 * cang duoc bonus cao; tra loi dung luc/qua gio -> 0 bonus.
 *
 * QUAN TRONG: `elapsedMs` PHAI duoc tinh tu THOI GIAN SERVER (luc gui cau hoi ->
 * luc server nhan duoc dap an), KHONG duoc dung `clientTimeMs` do client tu gui len
 * (chi dung de hien thi/chong gian lan) — cung nguyen tac "fail-closed server time"
 * da ap dung o Anti-Cheat Feature 011.
 */
export function computeSpeedBonus(
  elapsedMs: number,
  timeLimitMs: number = BATTLE_QUESTION_TIME_LIMIT_MS,
): number {
  const safeElapsed = Math.max(0, elapsedMs);
  if (safeElapsed >= timeLimitMs) return 0;

  const remainingRatio = 1 - safeElapsed / timeLimitMs; // (0, 1]
  const bucketCount = BATTLE_MAX_SPEED_BONUS + 1; // 4 bac: 0,1,2,3
  const bonus = Math.floor(remainingRatio * bucketCount);
  return Math.min(BATTLE_MAX_SPEED_BONUS, Math.max(0, bonus));
}

/**
 * Tinh tong diem 1 cau: 0 neu tra loi SAI (hoac qua gio khong tra loi),
 * 10 co ban + bonus toc do (0-3) neu tra loi DUNG.
 */
export function computeQuestionPoints(
  isCorrect: boolean,
  elapsedMs: number,
  timeLimitMs: number = BATTLE_QUESTION_TIME_LIMIT_MS,
): number {
  if (!isCorrect) return 0;
  return BATTLE_BASE_POINTS_PER_QUESTION + computeSpeedBonus(elapsedMs, timeLimitMs);
}

/** Xao tron 1 mang (Fisher-Yates) — tra ve mang moi, khong sua in-place. */
function shuffleIndices(length: number): number[] {
  const indices = Array.from({ length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j]!, indices[i]!];
  }
  return indices;
}

/**
 * Xao tron thu tu 4 dap an CUA 1 CAU HOI 1 LAN, dung chung cho ca 2 nguoi choi
 * (khong phai moi nguoi 1 kieu xao khac nhau — de cong bang khi so sanh toc do
 * bam dap an dung). Tra ve mang options da xao + vi tri MOI cua dap an dung.
 */
export function shuffleOptionsWithAnswer(
  options: readonly string[],
  correctIndex: number,
): { options: string[]; correctIndex: number } {
  const order = shuffleIndices(options.length);
  const newOptions = order.map((originalIndex) => options[originalIndex]!);
  const newCorrectIndex = order.indexOf(correctIndex);
  return { options: newOptions, correctIndex: newCorrectIndex };
}

/** Bo ky tu de nham lan khi doc (0/O, 1/I/L) khoi bang chu cai tao ma phong. */
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 6;

/** Sinh 1 ma phong ngau nhien 6 ky tu (chua dam bao duy nhat — caller kiem tra trung). */
export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

/** So sanh diem 2 nguoi choi -> ket qua tu goc nhin nguoi choi thu 1 (`mine`). */
export function determineOutcome(myScore: number, opponentScore: number): 'WIN' | 'LOSE' | 'DRAW' {
  if (myScore > opponentScore) return 'WIN';
  if (myScore < opponentScore) return 'LOSE';
  return 'DRAW';
}

/**
 * Quyet dinh bot co tra loi DUNG cau hien tai hay khong (~65% ngau nhien) va
 * chon 1 chi so dap an tuong ung (dung neu dung, ngau nhien 1 trong 3 dap an
 * sai con lai neu sai).
 */
export function decideBotAnswer(
  correctOptionIndex: number,
  optionCount: number,
  correctRate: number,
  randomFn: () => number = Math.random,
): { isCorrect: boolean; selectedOption: number } {
  const isCorrect = randomFn() < correctRate;
  if (isCorrect) return { isCorrect: true, selectedOption: correctOptionIndex };

  const wrongOptions = Array.from({ length: optionCount }, (_, i) => i).filter((i) => i !== correctOptionIndex);
  const pick = wrongOptions[Math.floor(randomFn() * wrongOptions.length)]!;
  return { isCorrect: false, selectedOption: pick };
}

/** Sinh thoi gian (ms) bot "suy nghi" truoc khi tra loi — ngau nhien deu trong [min, max]. */
export function randomBotDelayMs(minMs: number, maxMs: number, randomFn: () => number = Math.random): number {
  return Math.round(minMs + randomFn() * (maxMs - minMs));
}

/** Map ket qua WIN/LOSE/DRAW tu goc nhin 1 nguoi sang BattleMatchResult day du (co the ghi de boi disconnect/cancel o noi khac). */
export function toMatchResult(outcome: 'WIN' | 'LOSE' | 'DRAW'): BattleMatchResult {
  return outcome;
}
