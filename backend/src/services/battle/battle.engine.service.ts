// ============================================================================
// BattleEngine — "bo nao" xu ly toan bo luong choi realtime cua 1 tran PvP:
//   - Vong lap hang doi (moi 1 giay): ghep cap / vot bot / bao cap nhat dem gio.
//   - Bat dau tran (goi battle.match.service de chon cau + khoa cuoc).
//   - Gui tung cau hoi, nhan dap an, cham diem theo THOI GIAN SERVER.
//   - Ket thuc tran + thanh toan diem (uy quyen cho battle.match.service.settleMatch).
//   - Xu ly mat ket noi: cho 30s, huy neu ca 2 cung roi, tiep tuc binh thuong neu
//     quay lai kip (khong mat diem so da tich luy).
//
// TOAN BO trang thai "dang choi" (cau hoi da chon+xao, diem tam thoi, timer...)
// nam IN-MEMORY (Map<matchId, LiveMatch>) — CHUA dung Redis (dung 1 instance).
// ============================================================================
import type { User } from '@prisma/client';
import type { Namespace } from 'socket.io';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { pointsService } from '../points/points.service.js';
import {
  BattleError,
  BattleInvalidPayloadError,
  BattleMatchNotInProgressError,
  BattleMatchNotOwnedError,
  BattleRoomNotFoundError,
} from './battle.errors.js';
import {
  assertSufficientPoints,
  createAndStartMatch,
  recordAnswer,
  settleMatch,
  validateSubjectAndStake,
  type BattleLiveQuestion,
  type SettlementOutcome,
} from './battle.match.service.js';
import { battleQueueService, type WaitingPlayer } from './battle.queue.service.js';
import type { AuthenticatedBattleSocket } from './battle.socket.js';
import {
  BATTLE_BOT_CORRECT_RATE,
  BATTLE_BOT_MAX_ANSWER_MS,
  BATTLE_BOT_MIN_ANSWER_MS,
  BATTLE_DISCONNECT_GRACE_MS,
  BATTLE_QUESTION_TIME_LIMIT_MS,
  type BattleMatchResult,
  type BattleQuestionEvent,
} from './battle.types.js';
import { computeQuestionPoints, decideBotAnswer, determineOutcome, randomBotDelayMs } from './battle.utils.js';

/** So miligiay du them cho timer cau hoi phia server (tranh sai lech vai chuc ms voi client). */
const QUESTION_TIMER_BUFFER_MS = 500;

type PlayerSlot = 'player1' | 'player2';

interface LiveMatchPlayer {
  userId: string;
  /** null = hien dang mat ket noi (dang trong 30s cho). */
  socketId: string | null;
  displayName: string;
}

interface LiveMatch {
  matchId: string;
  subject: string;
  stake: number;
  isBotMatch: boolean;
  player1: LiveMatchPlayer;
  /** null NEU doi thu la bot. */
  player2: LiveMatchPlayer | null;
  questions: BattleLiveQuestion[];
  currentQuestionIndex: number;
  player1Score: number;
  player2Score: number;
  /** Cac slot ('player1'/'player2') DA tra loi cau hien tai. */
  answeredThisQuestion: Set<PlayerSlot>;
  /** Thoi diem SERVER gui cau hoi hien tai — dung de tinh bonus toc do khi nhan dap an. */
  questionSentAtMs: number;
  questionTimer: NodeJS.Timeout | null;
  botTimer: NodeJS.Timeout | null;
  /** Timer dem 30s cho tung slot dang mat ket noi. */
  disconnectTimers: Map<PlayerSlot, NodeJS.Timeout>;
  ended: boolean;
}

/** Trang thai toan cuc — singleton tren process backend (dung 1 instance, giong battleQueueService). */
const liveMatches = new Map<string, LiveMatch>();
let queueTickTimer: NodeJS.Timeout | null = null;

// ---------------------------------------------------------------------------
// Zod schema validate payload tu client (khong tin tuong du lieu tu socket)
// ---------------------------------------------------------------------------

const joinQueueSchema = z.object({ subject: z.string().min(1), stake: z.number().int().positive() });
const createRoomSchema = z.object({ subject: z.string().min(1), stake: z.number().int().positive() });
const joinRoomSchema = z.object({ roomCode: z.string().min(1).max(12) });
const submitAnswerSchema = z.object({
  matchId: z.string().min(1),
  questionIndex: z.number().int().min(0),
  selectedOption: z.number().int().min(0).max(3),
  clientTimeMs: z.number().optional(),
});

function parsePayload<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new BattleInvalidPayloadError(result.error.issues.map((i) => i.message).join('; '));
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Dang ky handler cho 1 socket da xac thuc (goi tu battle.socket.ts moi khi co ket noi moi)
// ---------------------------------------------------------------------------

export function registerBattleEventHandlers(namespace: Namespace, socket: AuthenticatedBattleSocket): void {
  ensureQueueTickLoop(namespace);

  const user = socket.data.user;

  attemptReconnectToActiveMatch(namespace, socket, user);

  socket.on('battle:join-queue', (payload: unknown) => {
    void handleJoinQueue(socket, user, payload);
  });

  socket.on('battle:create-room', (payload: unknown) => {
    void handleCreateRoom(socket, user, payload);
  });

  socket.on('battle:join-room', (payload: unknown) => {
    void handleJoinRoom(namespace, socket, user, payload);
  });

  socket.on('battle:cancel-queue', () => {
    handleCancelQueue(socket, user);
  });

  socket.on('battle:submit-answer', (payload: unknown) => {
    void handleSubmitAnswer(namespace, socket, user, payload);
  });

  socket.on('disconnect', () => {
    handleDisconnect(namespace, socket);
  });
}

function emitError(socket: AuthenticatedBattleSocket, err: unknown): void {
  const code = err instanceof BattleError ? err.code : 'BATTLE_INTERNAL_ERROR';
  const message = err instanceof Error ? err.message : 'Da xay ra loi khong xac dinh.';
  if (!(err instanceof BattleError)) {
    console.error('[battle.engine] Loi khong xac dinh:', err);
  }
  socket.emit('battle:error', { code, message });
}

// ---------------------------------------------------------------------------
// Hang doi thuong (join-queue / cancel-queue) + vong lap xu ly moi 1 giay
// ---------------------------------------------------------------------------

async function handleJoinQueue(socket: AuthenticatedBattleSocket, user: User, rawPayload: unknown): Promise<void> {
  try {
    const { subject, stake } = parsePayload(joinQueueSchema, rawPayload);
    validateSubjectAndStake(subject, stake);
    await assertSufficientPoints(user.id, stake);

    battleQueueService.join({ userId: user.id, socketId: socket.id, subject, stake, joinedAtMs: Date.now() });
    socket.emit('battle:queue-status', { waitingSeconds: 0, currentCriteria: 'STRICT' });
  } catch (err) {
    emitError(socket, err);
  }
}

function handleCancelQueue(socket: AuthenticatedBattleSocket, user: User): void {
  try {
    battleQueueService.cancel(user.id);
  } catch (err) {
    emitError(socket, err);
  }
}

async function handleCreateRoom(socket: AuthenticatedBattleSocket, user: User, rawPayload: unknown): Promise<void> {
  try {
    const { subject, stake } = parsePayload(createRoomSchema, rawPayload);
    validateSubjectAndStake(subject, stake);
    await assertSufficientPoints(user.id, stake);

    const roomCode = battleQueueService.createRoom(user.id, socket.id, subject, stake, Date.now());
    socket.emit('battle:room-created', { roomCode });
  } catch (err) {
    emitError(socket, err);
  }
}

async function handleJoinRoom(
  namespace: Namespace,
  socket: AuthenticatedBattleSocket,
  user: User,
  rawPayload: unknown,
): Promise<void> {
  try {
    const { roomCode } = parsePayload(joinRoomSchema, rawPayload);
    const room = battleQueueService.joinRoom(roomCode.trim().toUpperCase(), user.id);

    const creatorSocket = namespace.sockets.get(room.creatorSocketId);
    if (!creatorSocket) {
      // Nguoi tao phong da ngat ket noi truoc khi co ai vao - coi nhu phong khong con hop le.
      throw new BattleRoomNotFoundError(roomCode);
    }

    await assertSufficientPoints(user.id, room.stake);
    await assertSufficientPoints(room.creatorUserId, room.stake);

    await startRealMatch(namespace, {
      player1: { userId: room.creatorUserId, socketId: room.creatorSocketId },
      player2: { userId: user.id, socketId: socket.id },
      subject: room.subject,
      stake: room.stake,
      roomCode: room.roomCode,
    });
  } catch (err) {
    emitError(socket, err);
  }
}

/** Dam bao vong lap xu ly hang doi (moi 1 giay) chi duoc khoi tao 1 LAN DUY NHAT cho ca process. */
function ensureQueueTickLoop(namespace: Namespace): void {
  if (queueTickTimer) return;
  queueTickTimer = setInterval(() => {
    void processQueueTick(namespace);
  }, 1000);
}

/** So sanh 2 nguoi cho, uu tien tieu chi (mon/cuoc) cua nguoi da vao hang doi TRUOC (kien nhan hon). */
function pickCanonicalCriteria(a: WaitingPlayer, b: WaitingPlayer): { subject: string; stake: number } {
  const earlier = a.joinedAtMs <= b.joinedAtMs ? a : b;
  return { subject: earlier.subject, stake: earlier.stake };
}

async function processQueueTick(namespace: Namespace): Promise<void> {
  const result = battleQueueService.tick(Date.now());

  for (const update of result.statusUpdates) {
    namespace.sockets
      .get(update.player.socketId)
      ?.emit('battle:queue-status', { waitingSeconds: update.waitingSeconds, currentCriteria: update.criteria });
  }

  for (const [a, b] of result.matchedPairs) {
    const socketA = namespace.sockets.get(a.socketId);
    const socketB = namespace.sockets.get(b.socketId);

    // 1 (hoac ca 2) da ngat ket noi dung luc vua ghep - dua nguoi con lai (neu co) tro lai hang doi,
    // KHONG tao tran (chua tru diem nen khong can hoan gi ca).
    if (!socketA || !socketB) {
      if (socketA) battleQueueService.join({ ...a, joinedAtMs: Date.now() });
      if (socketB) battleQueueService.join({ ...b, joinedAtMs: Date.now() });
      continue;
    }

    const { subject, stake } = pickCanonicalCriteria(a, b);
    // eslint-disable-next-line no-await-in-loop
    await startRealMatch(namespace, {
      player1: { userId: a.userId, socketId: a.socketId },
      player2: { userId: b.userId, socketId: b.socketId },
      subject,
      stake,
    });
  }

  for (const botPlayer of result.botFallbacks) {
    const socket = namespace.sockets.get(botPlayer.socketId);
    if (!socket) continue; // da ngat ket noi - khong can tao tran bot cho ai ca
    // eslint-disable-next-line no-await-in-loop
    await startBotMatch(namespace, botPlayer);
  }
}

// ---------------------------------------------------------------------------
// Bat dau tran (nguoi that vs nguoi that / nguoi that vs bot)
// ---------------------------------------------------------------------------

async function getDisplayName(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true, email: true } });
  return u?.displayName ?? u?.email ?? 'Người chơi';
}

function makeLiveMatchBase(matchId: string, subject: string, stake: number, isBotMatch: boolean): LiveMatch {
  return {
    matchId,
    subject,
    stake,
    isBotMatch,
    player1: { userId: '', socketId: null, displayName: '' },
    player2: null,
    questions: [],
    currentQuestionIndex: -1,
    player1Score: 0,
    player2Score: 0,
    answeredThisQuestion: new Set(),
    questionSentAtMs: 0,
    questionTimer: null,
    botTimer: null,
    disconnectTimers: new Map(),
    ended: false,
  };
}

async function startRealMatch(
  namespace: Namespace,
  params: {
    player1: { userId: string; socketId: string };
    player2: { userId: string; socketId: string };
    subject: string;
    stake: number;
    roomCode?: string;
  },
): Promise<void> {
  const { player1, player2, subject, stake, roomCode } = params;
  try {
    const { matchId, questions } = await createAndStartMatch({
      subject,
      stake,
      player1Id: player1.userId,
      player2Id: player2.userId,
      isBotMatch: false,
      roomCode: roomCode ?? null,
    });

    const [p1Name, p2Name] = await Promise.all([getDisplayName(player1.userId), getDisplayName(player2.userId)]);

    const live = makeLiveMatchBase(matchId, subject, stake, false);
    live.player1 = { userId: player1.userId, socketId: player1.socketId, displayName: p1Name };
    live.player2 = { userId: player2.userId, socketId: player2.socketId, displayName: p2Name };
    live.questions = questions;
    liveMatches.set(matchId, live);

    const socket1 = namespace.sockets.get(player1.socketId);
    const socket2 = namespace.sockets.get(player2.socketId);
    socket1?.join(matchId);
    socket2?.join(matchId);

    socket1?.emit('battle:match-found', { matchId, subject, stake, opponentName: p2Name, isBotMatch: false });
    socket2?.emit('battle:match-found', { matchId, subject, stake, opponentName: p1Name, isBotMatch: false });

    sendNextQuestion(namespace, live);
  } catch (err) {
    notifyStartFailure(namespace, [player1.socketId, player2.socketId], err);
  }
}

async function startBotMatch(namespace: Namespace, waitingPlayer: WaitingPlayer): Promise<void> {
  try {
    const { matchId, questions } = await createAndStartMatch({
      subject: waitingPlayer.subject,
      stake: waitingPlayer.stake,
      player1Id: waitingPlayer.userId,
      player2Id: null,
      isBotMatch: true,
    });

    const displayName = await getDisplayName(waitingPlayer.userId);

    const live = makeLiveMatchBase(matchId, waitingPlayer.subject, waitingPlayer.stake, true);
    live.player1 = { userId: waitingPlayer.userId, socketId: waitingPlayer.socketId, displayName };
    live.player2 = null;
    live.questions = questions;
    liveMatches.set(matchId, live);

    const socket = namespace.sockets.get(waitingPlayer.socketId);
    socket?.join(matchId);
    socket?.emit('battle:match-found', {
      matchId,
      subject: live.subject,
      stake: live.stake,
      opponentName: 'Máy',
      isBotMatch: true,
    });

    sendNextQuestion(namespace, live);
  } catch (err) {
    notifyStartFailure(namespace, [waitingPlayer.socketId], err);
  }
}

function notifyStartFailure(namespace: Namespace, socketIds: string[], err: unknown): void {
  const code = err instanceof BattleError ? err.code : 'BATTLE_START_FAILED';
  const message = err instanceof Error ? err.message : 'Không thể bắt đầu trận đấu.';
  if (!(err instanceof BattleError)) {
    console.error('[battle.engine] Loi khong xac dinh khi bat dau tran:', err);
  }
  for (const socketId of socketIds) {
    namespace.sockets.get(socketId)?.emit('battle:error', { code, message });
  }
}

// ---------------------------------------------------------------------------
// Luong cau hoi realtime — gui cau, nhan dap an, cham diem theo THOI GIAN SERVER
// ---------------------------------------------------------------------------

function sendNextQuestion(namespace: Namespace, live: LiveMatch): void {
  live.currentQuestionIndex += 1;
  const idx = live.currentQuestionIndex;

  if (idx >= live.questions.length) {
    void finishMatch(namespace, live, { type: 'NORMAL' });
    return;
  }

  const question = live.questions[idx]!;
  live.answeredThisQuestion = new Set();
  live.questionSentAtMs = Date.now();

  const payload: BattleQuestionEvent = {
    questionIndex: idx,
    questionText: question.questionText,
    options: question.options as [string, string, string, string],
  };
  namespace.to(live.matchId).emit('battle:question', payload);

  if (live.questionTimer) clearTimeout(live.questionTimer);
  live.questionTimer = setTimeout(() => {
    handleQuestionTimeout(namespace, live, idx);
  }, BATTLE_QUESTION_TIME_LIMIT_MS + QUESTION_TIMER_BUFFER_MS);

  if (live.isBotMatch) {
    scheduleBotAnswer(namespace, live, idx, question);
  }
}

function scheduleBotAnswer(namespace: Namespace, live: LiveMatch, questionIndex: number, question: BattleLiveQuestion): void {
  const delayMs = randomBotDelayMs(BATTLE_BOT_MIN_ANSWER_MS, BATTLE_BOT_MAX_ANSWER_MS);
  live.botTimer = setTimeout(() => {
    void handleBotAnswer(namespace, live, questionIndex, question, delayMs);
  }, delayMs);
}

async function handleBotAnswer(
  namespace: Namespace,
  live: LiveMatch,
  questionIndex: number,
  question: BattleLiveQuestion,
  elapsedMs: number,
): Promise<void> {
  if (live.ended || live.currentQuestionIndex !== questionIndex || live.answeredThisQuestion.has('player2')) return;

  const { isCorrect, selectedOption } = decideBotAnswer(question.correctOptionIndex, question.options.length, BATTLE_BOT_CORRECT_RATE);
  const pointsEarned = computeQuestionPoints(isCorrect, elapsedMs);

  live.answeredThisQuestion.add('player2');
  live.player2Score += pointsEarned;

  await recordAnswer({
    matchId: live.matchId,
    playerId: null,
    questionIndex,
    questionBankId: question.questionBankId,
    selectedOption,
    isCorrect,
    pointsEarned,
  });

  if (live.player1.socketId) {
    namespace.sockets
      .get(live.player1.socketId)
      ?.emit('battle:opponent-progress', { questionIndex, opponentScore: live.player2Score });
  }

  maybeAdvanceAfterAnswer(namespace, live, questionIndex);
}

async function handleSubmitAnswer(
  namespace: Namespace,
  socket: AuthenticatedBattleSocket,
  user: User,
  rawPayload: unknown,
): Promise<void> {
  try {
    const { matchId, questionIndex, selectedOption } = parsePayload(submitAnswerSchema, rawPayload);

    const live = liveMatches.get(matchId);
    if (!live || live.ended) throw new BattleMatchNotInProgressError(matchId);

    const slot = resolveSlotByUserId(live, user.id);
    if (!slot) throw new BattleMatchNotOwnedError();
    if (questionIndex !== live.currentQuestionIndex) throw new BattleInvalidPayloadError('cau hoi khong con hieu luc.');
    if (live.answeredThisQuestion.has(slot)) throw new BattleInvalidPayloadError('ban da tra loi cau nay roi.');

    const question = live.questions[questionIndex];
    if (!question) throw new BattleInvalidPayloadError('khong tim thay cau hoi.');

    // QUAN TRONG: dung THOI GIAN SERVER (luc nhan duoc request nay) de tinh bonus toc do —
    // KHONG dung clientTimeMs client gui len (chi de hien thi/chong gian lan).
    const elapsedMs = Date.now() - live.questionSentAtMs;
    const isCorrect = selectedOption === question.correctOptionIndex;
    const pointsEarned = computeQuestionPoints(isCorrect, elapsedMs);

    live.answeredThisQuestion.add(slot);
    if (slot === 'player1') live.player1Score += pointsEarned;
    else live.player2Score += pointsEarned;

    await recordAnswer({
      matchId: live.matchId,
      playerId: user.id,
      questionIndex,
      questionBankId: question.questionBankId,
      selectedOption,
      isCorrect,
      pointsEarned,
    });

    const myTotalScore = slot === 'player1' ? live.player1Score : live.player2Score;
    socket.emit('battle:question-result', {
      questionIndex,
      correctOption: question.correctOptionIndex,
      myPointsEarned: pointsEarned,
      myTotalScore,
    });

    const opponent = slot === 'player1' ? live.player2 : live.player1;
    if (opponent?.socketId) {
      namespace.sockets.get(opponent.socketId)?.emit('battle:opponent-progress', { questionIndex, opponentScore: myTotalScore });
    }

    maybeAdvanceAfterAnswer(namespace, live, questionIndex);
  } catch (err) {
    emitError(socket, err);
  }
}

function handleQuestionTimeout(namespace: Namespace, live: LiveMatch, questionIndex: number): void {
  if (live.ended || questionIndex !== live.currentQuestionIndex) return;
  // Nguoi (hoac bot, truong hop rat hiem) chua tra loi kip -> tinh 0 diem cho cau nay, khong ghi BattleAnswer
  // (khong co lua chon nao duoc gui), chuyen sang cau tiep theo.
  advanceToNextQuestion(namespace, live);
}

function maybeAdvanceAfterAnswer(namespace: Namespace, live: LiveMatch, questionIndex: number): void {
  if (live.ended || questionIndex !== live.currentQuestionIndex) return;
  // Luon co dung 2 "phia" tra loi: player1 + (player2 that HOAC bot).
  if (live.answeredThisQuestion.size >= 2) {
    advanceToNextQuestion(namespace, live);
  }
}

function advanceToNextQuestion(namespace: Namespace, live: LiveMatch): void {
  if (live.questionTimer) {
    clearTimeout(live.questionTimer);
    live.questionTimer = null;
  }
  if (live.botTimer) {
    clearTimeout(live.botTimer);
    live.botTimer = null;
  }
  sendNextQuestion(namespace, live);
}

// ---------------------------------------------------------------------------
// Ket thuc tran + thanh toan diem
// ---------------------------------------------------------------------------

function resolveSlotByUserId(live: LiveMatch, userId: string): PlayerSlot | null {
  if (live.player1.userId === userId) return 'player1';
  if (live.player2?.userId === userId) return 'player2';
  return null;
}

function computeResultForPlayer(
  slot: PlayerSlot,
  live: LiveMatch,
  outcome: SettlementOutcome,
): { result: BattleMatchResult; pointsChange: number } {
  if (outcome.type === 'CANCELLED') {
    return { result: 'CANCELLED_BOTH_LEFT', pointsChange: 0 };
  }

  if (outcome.type === 'DISCONNECT_WIN') {
    const amWinner = (slot === 'player1') === outcome.winnerIsPlayer1;
    return amWinner ? { result: 'OPPONENT_LEFT_WIN', pointsChange: live.stake } : { result: 'LOSE', pointsChange: -live.stake };
  }

  const myScore = slot === 'player1' ? live.player1Score : live.player2Score;
  const opponentScore = slot === 'player1' ? live.player2Score : live.player1Score;
  const base = determineOutcome(myScore, opponentScore);
  const pointsChange = base === 'WIN' ? live.stake : base === 'LOSE' ? -live.stake : 0;
  return { result: base, pointsChange };
}

async function emitMatchEnded(namespace: Namespace, live: LiveMatch, outcome: SettlementOutcome): Promise<void> {
  const player1Result = computeResultForPlayer('player1', live, outcome);
  const player1Balance = await pointsService.getBalance(live.player1.userId);
  if (live.player1.socketId) {
    namespace.sockets.get(live.player1.socketId)?.emit('battle:match-ended', {
      result: player1Result.result,
      myScore: live.player1Score,
      opponentScore: live.player2Score,
      pointsChange: player1Result.pointsChange,
      newBalance: player1Balance.currentPoints,
    });
  }

  if (live.player2) {
    const player2Result = computeResultForPlayer('player2', live, outcome);
    const player2Balance = await pointsService.getBalance(live.player2.userId);
    if (live.player2.socketId) {
      namespace.sockets.get(live.player2.socketId)?.emit('battle:match-ended', {
        result: player2Result.result,
        myScore: live.player2Score,
        opponentScore: live.player1Score,
        pointsChange: player2Result.pointsChange,
        newBalance: player2Balance.currentPoints,
      });
    }
  }
}

async function finishMatch(namespace: Namespace, live: LiveMatch, outcome: SettlementOutcome): Promise<void> {
  if (live.ended) return;
  live.ended = true;

  if (live.questionTimer) clearTimeout(live.questionTimer);
  if (live.botTimer) clearTimeout(live.botTimer);
  for (const timer of live.disconnectTimers.values()) clearTimeout(timer);
  live.disconnectTimers.clear();

  try {
    await settleMatch({
      matchId: live.matchId,
      player1Id: live.player1.userId,
      player2Id: live.player2?.userId ?? null,
      isBotMatch: live.isBotMatch,
      stake: live.stake,
      player1Score: live.player1Score,
      player2Score: live.player2Score,
      outcome,
    });

    await emitMatchEnded(namespace, live, outcome);
  } catch (err) {
    console.error(`[battle.engine] Loi khi ket thuc/thanh toan tran ${live.matchId}:`, err);
  } finally {
    liveMatches.delete(live.matchId);
  }
}

// ---------------------------------------------------------------------------
// Xu ly mat ket noi (disconnect) + quay lai kip (reconnect)
// ---------------------------------------------------------------------------

function clearDisconnectTimer(live: LiveMatch, slot: PlayerSlot): void {
  const timer = live.disconnectTimers.get(slot);
  if (timer) clearTimeout(timer);
  live.disconnectTimers.delete(slot);
}

function resolveSlotBySocketId(live: LiveMatch, socketId: string): PlayerSlot | null {
  if (live.player1.socketId === socketId) return 'player1';
  if (live.player2?.socketId === socketId) return 'player2';
  return null;
}

function onPlayerDisconnected(namespace: Namespace, live: LiveMatch, slot: PlayerSlot): void {
  const otherSlot: PlayerSlot = slot === 'player1' ? 'player2' : 'player1';

  // Ben kia CUNG dang trong 30s cho (da mat ket noi truoc do, chua het han) -> ca 2 cung roi -> huy tran ngay, hoan ca 2.
  if (live.disconnectTimers.has(otherSlot)) {
    clearDisconnectTimer(live, otherSlot);
    void finishMatch(namespace, live, { type: 'CANCELLED' });
    return;
  }

  const player = slot === 'player1' ? live.player1 : live.player2;
  if (player) player.socketId = null;

  const opponent = otherSlot === 'player1' ? live.player1 : live.player2;
  if (opponent?.socketId) {
    namespace.sockets.get(opponent.socketId)?.emit('battle:opponent-disconnected', { gracePeriodSeconds: 30 });
  }

  const timer = setTimeout(() => {
    live.disconnectTimers.delete(slot);
    void handleDisconnectGraceExpired(namespace, live, slot);
  }, BATTLE_DISCONNECT_GRACE_MS);
  live.disconnectTimers.set(slot, timer);
}

async function handleDisconnectGraceExpired(namespace: Namespace, live: LiveMatch, disconnectedSlot: PlayerSlot): Promise<void> {
  if (live.ended) return;

  if (live.isBotMatch) {
    // Chi co 1 nguoi that (player1) trong tran voi bot - khong co "doi thu that" de xu thang ky thuat,
    // hop ly nhat la huy tran va hoan cuoc (khong the coi la thua chi vi mat mang).
    await finishMatch(namespace, live, { type: 'CANCELLED' });
    return;
  }

  const winnerSlot: PlayerSlot = disconnectedSlot === 'player1' ? 'player2' : 'player1';
  await finishMatch(namespace, live, { type: 'DISCONNECT_WIN', winnerIsPlayer1: winnerSlot === 'player1' });
}

function handleDisconnect(namespace: Namespace, socket: AuthenticatedBattleSocket): void {
  battleQueueService.removeBySocketId(socket.id);
  battleQueueService.removeRoomByCreatorSocketId(socket.id);

  for (const live of liveMatches.values()) {
    if (live.ended) continue;
    const slot = resolveSlotBySocketId(live, socket.id);
    if (!slot) continue;
    onPlayerDisconnected(namespace, live, slot);
    break; // 1 socket chi thuoc dung 1 tran dang dien ra tai 1 thoi diem
  }
}

/** Khi 1 socket MOI ket noi, kiem tra xem user co dang o giua 1 tran con dang dien ra hay khong (vua bi mat ket noi) de gan lai socket + huy dem 30s. */
function attemptReconnectToActiveMatch(namespace: Namespace, socket: AuthenticatedBattleSocket, user: User): void {
  for (const live of liveMatches.values()) {
    if (live.ended) continue;
    const slot = resolveSlotByUserId(live, user.id);
    if (!slot) continue;

    const player = slot === 'player1' ? live.player1 : live.player2;
    if (!player || player.socketId === socket.id) continue;

    player.socketId = socket.id;
    socket.join(live.matchId);
    clearDisconnectTimer(live, slot);

    const otherSlot: PlayerSlot = slot === 'player1' ? 'player2' : 'player1';
    const opponent = otherSlot === 'player1' ? live.player1 : live.player2;
    const myScore = slot === 'player1' ? live.player1Score : live.player2Score;
    if (opponent?.socketId) {
      namespace.sockets.get(opponent.socketId)?.emit('battle:opponent-progress', {
        questionIndex: live.currentQuestionIndex,
        opponentScore: myScore,
      });
    }

    const currentQuestion = live.questions[live.currentQuestionIndex];
    if (currentQuestion && !live.answeredThisQuestion.has(slot)) {
      socket.emit('battle:question', {
        questionIndex: live.currentQuestionIndex,
        questionText: currentQuestion.questionText,
        options: currentQuestion.options as [string, string, string, string],
      });
    }
    break;
  }
}
