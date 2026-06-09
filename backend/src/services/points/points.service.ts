// ============================================================================
// PointsService - Quan ly toan bo he thong DIEM TICH LUY (currency duy nhat
// trong QuizzGame).
//
// NGUYEN TAC BAT BUOC (theo dung GDD - Game Design Document):
//   1. Diem khong bao gio duoc am (san = 0).
//   2. Moi thay doi diem PHAI atomic: cap nhat so du + ghi log giao dich
//      phai cung thanh cong hoac cung that bai (dung Prisma `$transaction`).
//   3. Dung OPTIMISTIC LOCKING (truong `version`) de tranh race condition khi
//      nhieu request cung sua diem cua 1 user trong cung thoi diem
//      (vi du: vua nhan thuong PvP vua bi tru tien vao thi thu).
// ============================================================================

import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma as defaultPrismaClient } from '../../lib/prisma.js';
import {
  InvalidPointsAmountError,
  OptimisticLockError,
  OptimisticLockRetryableError,
  PointsInsufficientError,
} from './points.errors.js';
import type {
  PaginatedHistory,
  PointsBalance,
  TransferResult,
} from './points.types.js';

/** Kieu Prisma client dung trong transaction (co the la client goc hoac transaction client). */
type PrismaTx = Prisma.TransactionClient;

/** Tin hieu noi bo bao hieu "optimistic lock that bai, hay thu lai tu dau". KHONG export ra ngoai. */
class OptimisticLockRetrySignal extends Error {
  constructor() {
    super('OPTIMISTIC_LOCK_RETRY_SIGNAL');
    this.name = 'OptimisticLockRetrySignal';
    Object.setPrototypeOf(this, OptimisticLockRetrySignal.prototype);
  }
}

/**
 * Ma loi Prisma "Unique constraint failed" - xay ra khi 2 transaction cung
 * lan dau goi `upsert` de tao ban ghi `user_points` cho CUNG MOT user
 * (ca hai cung thay chua co ban ghi -> cung INSERT -> 1 trong 2 vi pham UNIQUE).
 * Day KHONG phai loi nghiem trong - chi can thu lai, lan nay record da ton tai
 * nen `upsert` se di vao nhanh UPDATE.
 */
const PRISMA_UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

/** Kiem tra xem loi co phai la "vi pham rang buoc UNIQUE" tu Prisma hay khong. */
function isUniqueConstraintError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === PRISMA_UNIQUE_CONSTRAINT_VIOLATION
  );
}

/**
 * So lan thu lai toi da khi gap xung dot dong thoi (optimistic lock conflict
 * hoac unique constraint do "dua" tao ban ghi lan dau) truoc khi bao loi cho client.
 *
 * Dat kha cao (10) vi cac giao dich diem (vi du cong diem khi lam dung cau hoi
 * trong On tap) co the duoc client gui gan nhu dong thoi voi tan suat cao.
 */
const MAX_OPTIMISTIC_RETRY = 10;

/**
 * Gioi han toi da cho 1 lan cong/tru/chuyen diem.
 * Cot `currentPoints`/`delta` trong DB la kieu Postgres `Int` (32-bit, toi da ~2.14 ty).
 * Dat gioi han nay (1 trieu) de:
 *   (1) Tranh tran so (overflow) khi `currentPoints + amount` vuot qua gioi han Int,
 *   (2) Chan cac gia tri bat thuong/tan cong (vi du client gui amount = 999999999999).
 * Con so nay ran rai hon nhieu so voi gia tri lon nhat trong GDD hien tai (cuoc toi da
 * = 50% diem tich luy, thuong cao nhat = 180 diem) nen khong anh huong nghiep vu thuc te.
 */
const MAX_POINTS_AMOUNT = 1_000_000;

/** Khoang thoi gian cho toi thieu/toi da (ms) truoc khi thu lai - co jitter ngau nhien de tranh "thundering herd". */
const RETRY_BACKOFF_MIN_MS = 10;
const RETRY_BACKOFF_MAX_MS = 50;

/** Tam dung mot khoang thoi gian ngan, ngau nhien truoc khi thu lai giao dich. */
function delayWithJitter(): Promise<void> {
  const ms = RETRY_BACKOFF_MIN_MS + Math.random() * (RETRY_BACKOFF_MAX_MS - RETRY_BACKOFF_MIN_MS);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class PointsService {
  private readonly prisma: PrismaClient;

  constructor(prismaClient: PrismaClient = defaultPrismaClient) {
    this.prisma = prismaClient;
  }

  // --------------------------------------------------------------------
  // CONG KHAI (PUBLIC API)
  // --------------------------------------------------------------------

  /**
   * Cong them diem cho user (vi du: lam dung cau hoi, thang PvP, thuong rewarded-video...).
   *
   * @param userId   ID nguoi dung (Firebase UID)
   * @param amount   So diem can cong - PHAI la so nguyen duong (> 0)
   * @param reason   Ly do giao dich (nen dung hang so trong `PointReason`)
   * @param metadata Du lieu bo sung tuy chon, luu duoi dang JSON trong log
   *
   * @throws InvalidPointsAmountError neu amount khong hop le (<= 0 hoac khong phai so nguyen)
   * @throws OptimisticLockError neu xung dot dong thoi sau nhieu lan thu lai
   */
  public async addPoints(
    userId: string,
    amount: number,
    reason: string,
    metadata?: Prisma.InputJsonValue,
  ): Promise<PointsBalance> {
    this.assertNonEmptyString(userId, 'userId');
    this.assertNonEmptyString(reason, 'reason');
    this.assertPositiveInteger(amount, 'amount');

    return this.runWithOptimisticRetry(userId, async (tx) => {
      const current = await this.ensureUserPointsRecord(tx, userId);
      const newBalance = current.currentPoints + amount;

      await this.applyOptimisticUpdate(tx, userId, current.version, newBalance);
      await this.writeTransactionLog(tx, userId, amount, reason, metadata);

      return this.toBalanceDto(userId, newBalance, current.version + 1);
    });
  }

  /**
   * Tru diem cua user (vi du: vao thi thu, thua PvP, mat ket noi...).
   * Se NEM LOI neu user khong du diem - khong bao gio cho phep diem am.
   *
   * @throws InvalidPointsAmountError neu amount khong hop le (<= 0)
   * @throws PointsInsufficientError neu so du hien tai < amount
   * @throws OptimisticLockError neu xung dot dong thoi sau nhieu lan thu lai
   */
  public async deductPoints(
    userId: string,
    amount: number,
    reason: string,
    metadata?: Prisma.InputJsonValue,
  ): Promise<PointsBalance> {
    this.assertNonEmptyString(userId, 'userId');
    this.assertNonEmptyString(reason, 'reason');
    this.assertPositiveInteger(amount, 'amount');

    return this.runWithOptimisticRetry(userId, async (tx) => {
      const current = await this.ensureUserPointsRecord(tx, userId);

      if (current.currentPoints < amount) {
        // Khong du diem -> nem loi nghiep vu ro rang, KHONG sua DB.
        throw new PointsInsufficientError(userId, amount, current.currentPoints);
      }

      const newBalance = current.currentPoints - amount;

      await this.applyOptimisticUpdate(tx, userId, current.version, newBalance);
      // Luu delta la SO AM de phan anh dung ban chat "tru diem" trong nhat ky.
      await this.writeTransactionLog(tx, userId, -amount, reason, metadata);

      return this.toBalanceDto(userId, newBalance, current.version + 1);
    });
  }

  /**
   * Chuyen diem giua 2 user trong 1 giao dich atomic duy nhat
   * (vi du: thanh toan tien cuoc PvP "winner takes all").
   *
   * Dam bao:
   *   - Kiem tra nguoi gui co du diem TRUOC khi tru (khong de am).
   *   - Tru tien nguoi gui va cong tien nguoi nhan cung thanh cong hoac cung
   *     that bai (atomic) - khong bao gio xay ra truong hop "mat tich" diem.
   *   - Ghi 2 ban ghi log rieng biet (TRANSFER_OUT / TRANSFER_IN) de truy vet 2 chieu.
   *   - Khoa ca 2 ban ghi theo THU TU CO DINH (sap xep theo userId) de tranh
   *     deadlock khi co nhieu giao dich chuyen diem nguoc chieu xay ra dong thoi.
   *
   * @throws InvalidPointsAmountError neu amount khong hop le, hoac fromUserId === toUserId
   * @throws PointsInsufficientError neu nguoi gui khong du diem
   * @throws OptimisticLockError neu xung dot dong thoi sau nhieu lan thu lai
   */
  public async transferPoints(
    fromUserId: string,
    toUserId: string,
    amount: number,
    reason: string,
    metadata?: Prisma.InputJsonValue,
  ): Promise<TransferResult> {
    this.assertNonEmptyString(fromUserId, 'fromUserId');
    this.assertNonEmptyString(toUserId, 'toUserId');
    this.assertNonEmptyString(reason, 'reason');
    this.assertPositiveInteger(amount, 'amount');

    if (fromUserId === toUserId) {
      throw new InvalidPointsAmountError('Khong the chuyen diem cho chinh minh (fromUserId === toUserId).');
    }

    // Sap xep userId theo thu tu bang chu cai -> moi giao dich (du chieu nao)
    // luon truy cap 2 ban ghi theo CUNG MOT THU TU -> tranh deadlock o muc DB.
    const [firstId, secondId] = [fromUserId, toUserId].sort();
    const retryKey = `${firstId}:${secondId}`;

    return this.runWithOptimisticRetry(retryKey, async (tx) => {
      const firstRecord = await this.ensureUserPointsRecord(tx, firstId);
      const secondRecord = await this.ensureUserPointsRecord(tx, secondId);

      const fromRecord = fromUserId === firstId ? firstRecord : secondRecord;
      const toRecord = toUserId === firstId ? firstRecord : secondRecord;

      if (fromRecord.currentPoints < amount) {
        throw new PointsInsufficientError(fromUserId, amount, fromRecord.currentPoints);
      }

      const fromNewBalance = fromRecord.currentPoints - amount;
      const toNewBalance = toRecord.currentPoints + amount;

      // Cap nhat theo dung thu tu da "khoa" (firstId truoc, secondId sau).
      await this.applyOptimisticUpdate(
        tx,
        firstId,
        firstRecord.version,
        firstId === fromUserId ? fromNewBalance : toNewBalance,
      );
      await this.applyOptimisticUpdate(
        tx,
        secondId,
        secondRecord.version,
        secondId === fromUserId ? fromNewBalance : toNewBalance,
      );

      // Ghi 2 dong log doc lap - giup truy vet duoc tu CA HAI phia.
      await this.writeTransactionLog(tx, fromUserId, -amount, reason, {
        ...this.asMetadataObject(metadata),
        counterpartUserId: toUserId,
        transferRole: 'SENDER',
      });
      await this.writeTransactionLog(tx, toUserId, amount, reason, {
        ...this.asMetadataObject(metadata),
        counterpartUserId: fromUserId,
        transferRole: 'RECEIVER',
      });

      return {
        fromUserId,
        toUserId,
        amount,
        fromBalanceAfter: fromNewBalance,
        toBalanceAfter: toNewBalance,
      } satisfies TransferResult;
    });
  }

  /**
   * Lay so du diem hien tai cua user.
   * Neu user chua co ban ghi diem (vi du moi dang ky), tra ve so du = 0
   * (KHONG tao ban ghi moi o day - tranh ghi DB tren duong doc-only;
   * ban ghi se duoc tao "lazy" khi co giao dich dau tien qua addPoints/deductPoints).
   */
  public async getBalance(userId: string): Promise<PointsBalance> {
    this.assertNonEmptyString(userId, 'userId');

    const record = await this.prisma.userPoints.findUnique({ where: { userId } });

    if (!record) {
      // User chua tung co giao dich nao -> chua co ban ghi trong DB.
      // Tra ve so du mac dinh = 0 thay vi nem loi, vi day la trang thai HOP LE
      // (vi du user vua dang ky xong, chua lam bai nao). `lastUpdated = null`
      // de phan biet ro voi "da co ban ghi nhung chua bao gio duoc cap nhat".
      return { userId, currentPoints: 0, version: 0, lastUpdated: null };
    }

    return this.toBalanceDto(userId, record.currentPoints, record.version, record.lastUpdated);
  }

  /**
   * Lay lich su giao dich diem cua user, co phan trang.
   *
   * @param userId ID nguoi dung
   * @param limit  So ban ghi toi da tra ve moi trang (mac dinh 20, toi da 100 de tranh qua tai)
   * @param offset Vi tri bat dau (mac dinh 0)
   */
  public async getHistory(userId: string, limit = 20, offset = 0): Promise<PaginatedHistory> {
    this.assertNonEmptyString(userId, 'userId');

    if (!Number.isInteger(limit) || limit <= 0) {
      throw new InvalidPointsAmountError('Tham so "limit" phai la so nguyen duong.');
    }
    if (!Number.isInteger(offset) || offset < 0) {
      throw new InvalidPointsAmountError('Tham so "offset" phai la so nguyen khong am.');
    }

    // Gioi han "limit" toi da de tranh client vo tinh (hoac co y) keo qua nhieu du lieu cung luc.
    const safeLimit = Math.min(limit, 100);

    const [items, total] = await Promise.all([
      this.prisma.pointTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: safeLimit,
        skip: offset,
      }),
      this.prisma.pointTransaction.count({ where: { userId } }),
    ]);

    return { items, total, limit: safeLimit, offset };
  }

  /**
   * Cong diem trong 1 outer transaction do caller quan ly (khong tu tao $transaction).
   *
   * Dung khi nhieu thao tac can atomic trong cung 1 giao dich - vi du:
   * PracticeService.completeSession vua update PracticeSession vua cong diem.
   *
   * NEU optimistic lock that bai (version da bi thay doi boi request khac):
   * → Nem `OptimisticLockRetryableError` (exported) de caller co the catch va
   *   retry toan bo outer transaction tu dau.
   *
   * @param tx     Prisma TransactionClient tu outer $transaction
   * @param userId ID nguoi dung nhan diem
   * @param amount So diem can cong (phai > 0)
   * @param reason Ly do giao dich
   * @param metadata Du lieu bo sung (tuy chon)
   *
   * @throws InvalidPointsAmountError neu amount khong hop le
   * @throws OptimisticLockRetryableError neu version conflict → caller can retry
   */
  public async addPointsInTx(
    tx: PrismaTx,
    userId: string,
    amount: number,
    reason: string,
    metadata?: Prisma.InputJsonValue,
  ): Promise<void> {
    this.assertNonEmptyString(userId, 'userId');
    this.assertNonEmptyString(reason, 'reason');
    this.assertPositiveInteger(amount, 'amount');

    const current = await this.ensureUserPointsRecord(tx, userId);
    const newBalance = current.currentPoints + amount;

    // Thuc hien optimistic update truc tiep (khong qua applyOptimisticUpdate
    // vi method do nem OptimisticLockRetrySignal noi bo — ta can nem
    // OptimisticLockRetryableError (exported) de caller bat duoc).
    const result = await tx.userPoints.updateMany({
      where: { userId, version: current.version },
      data: { currentPoints: newBalance, version: { increment: 1 } },
    });

    if (result.count === 0) {
      // Version da thay doi — bao hieu caller can retry outer transaction.
      throw new OptimisticLockRetryableError();
    }

    await this.writeTransactionLog(tx, userId, amount, reason, metadata);
  }

  // --------------------------------------------------------------------
  // NOI BO (PRIVATE HELPERS)
  // --------------------------------------------------------------------

  /**
   * Chay 1 khoi cong viec ben trong Prisma `$transaction`, tu dong THU LAI
   * (retry) khi gap xung dot optimistic lock (toi da `MAX_OPTIMISTIC_RETRY` lan).
   *
   * `lockKey` chi dung de hien thi trong thong bao loi (giup debug biet
   * giao dich nao that bai), khong anh huong logic.
   */
  private async runWithOptimisticRetry<T>(
    lockKey: string,
    work: (tx: PrismaTx) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= MAX_OPTIMISTIC_RETRY; attempt += 1) {
      try {
        // Toan bo "work" chay trong 1 Prisma $transaction: neu OptimisticLockRetrySignal
        // (hoac bat ky loi nao khac) duoc nem ra giua chung, Prisma se tu dong ROLLBACK
        // truoc khi loi duoc nem tiep ra ngoai cho khoi catch ben duoi xu ly.
        // eslint-disable-next-line no-await-in-loop
        return await this.prisma.$transaction((tx) => work(tx));
      } catch (err) {
        const shouldRetry = err instanceof OptimisticLockRetrySignal || isUniqueConstraintError(err);

        if (shouldRetry) {
          if (attempt === MAX_OPTIMISTIC_RETRY) break; // Het luot thu -> roi xuong nem OptimisticLockError ben duoi.
          // Cho mot khoang ngan co jitter truoc khi thu lai, giam ap luc len DB
          // va giam xac suat nhieu request lai tiep tuc xung dot cung luc.
          // eslint-disable-next-line no-await-in-loop
          await delayWithJitter();
          continue;
        }

        // Loi nghiep vu (PointsInsufficientError, InvalidPointsAmountError...) -> nem ngay, khong retry.
        throw err;
      }
    }

    throw new OptimisticLockError(lockKey, MAX_OPTIMISTIC_RETRY);
  }

  /**
   * Dam bao user da co ban ghi `user_points`. Neu chua co, tao moi voi
   * `currentPoints = 0, version = 0` (theo dung dinh nghia mac dinh trong schema).
   *
   * Dung `upsert` de tranh tinh trang race condition khi 2 request cung
   * tao ban ghi cho cung 1 user lan dau tien (nho rang buoc UNIQUE tren userId).
   */
  private async ensureUserPointsRecord(
    tx: PrismaTx,
    userId: string,
  ): Promise<{ currentPoints: number; version: number }> {
    const record = await tx.userPoints.upsert({
      where: { userId },
      update: {}, // Da ton tai -> khong sua gi, chi de lay du lieu hien tai
      create: { userId, currentPoints: 0, version: 0 },
      select: { currentPoints: true, version: true },
    });

    return record;
  }

  /**
   * Cap nhat so du diem THEO DIEU KIEN version cu (optimistic locking).
   *
   * Neu khong co ban ghi nao khop dieu kien (vi du: ban ghi da bi user khac
   * cap nhat truoc, lam version thay doi) -> `updateMany` tra ve `count = 0`,
   * ta nem `OptimisticLockRetrySignal` de toan bo transaction duoc thu lai.
   */
  private async applyOptimisticUpdate(
    tx: PrismaTx,
    userId: string,
    expectedVersion: number,
    newBalance: number,
  ): Promise<void> {
    if (newBalance < 0) {
      // Lop bao ve cuoi cung (defense-in-depth) - khong bao gio duoc phep ghi
      // so du am xuong DB, du logic kiem tra phia tren co the da bo sot truong hop nao do.
      // "required" o day duoc tinh nguoc lai tu so du am de thong bao van co y nghia.
      throw new PointsInsufficientError(userId, Math.abs(newBalance), 0);
    }

    const result = await tx.userPoints.updateMany({
      where: { userId, version: expectedVersion },
      data: {
        currentPoints: newBalance,
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      throw new OptimisticLockRetrySignal();
    }
  }

  /** Ghi 1 dong vao nhat ky giao dich diem (point_transactions). */
  private async writeTransactionLog(
    tx: PrismaTx,
    userId: string,
    delta: number,
    reason: string,
    metadata?: Prisma.InputJsonValue,
  ): Promise<void> {
    await tx.pointTransaction.create({
      data: {
        userId,
        delta,
        reason,
        metadata: metadata ?? undefined,
      },
    });
  }

  /**
   * Kiem tra `value` la so nguyen duong (> 0) va khong vuot qua `MAX_POINTS_AMOUNT`.
   * Nem `InvalidPointsAmountError` neu khong hop le.
   *
   * Validate ca 2 chieu (qua nho / qua lon) giup chan:
   *   - Gia tri khong hop le tu client (NaN, so thuc, so am, 0).
   *   - Gia tri bat thuong co the gay tran so trong cot Postgres `Int`.
   */
  private assertPositiveInteger(value: number, fieldName: string): void {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
      throw new InvalidPointsAmountError(
        `Tham so "${fieldName}" phai la so nguyen duong (nhan duoc: ${value}).`,
      );
    }
    if (value > MAX_POINTS_AMOUNT) {
      throw new InvalidPointsAmountError(
        `Tham so "${fieldName}" vuot qua gioi han cho phep (toi da ${MAX_POINTS_AMOUNT}, nhan duoc: ${value}).`,
      );
    }
  }

  /**
   * Kiem tra `value` la chuoi khong rong (sau khi trim).
   * Ap dung cho `userId`, `reason` - nhung tham so bat buoc phai co gia tri y nghia,
   * tranh truong hop client vo y (hoac co y) gui chuoi rong / chi co khoang trang
   * lam "ban gio rac" trong DB (vi du ban ghi user_points voi userId = "").
   */
  private assertNonEmptyString(value: string, fieldName: string): void {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new InvalidPointsAmountError(`Tham so "${fieldName}" khong duoc de trong.`);
    }
  }

  /** Chuyen metadata dau vao thanh object (de co the spread / bo sung them truong) mot cach an toan. */
  private asMetadataObject(metadata?: Prisma.InputJsonValue): Record<string, unknown> {
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      return metadata as Record<string, unknown>;
    }
    return {};
  }

  /**
   * Dung de dong goi ket qua tra ve thanh `PointsBalance` DTO thong nhat.
   *
   * Luu y: khi goi tu addPoints/deductPoints/transferPoints (ngay sau khi update),
   * ta dung `new Date()` lam gia tri xap xi cho `lastUpdated` thay vi truy van lai
   * DB (tranh 1 query thua). Gia tri nay co the lech vai mili-giay so voi
   * `lastUpdated` that su duoc Postgres ghi qua `@updatedAt` - khong anh huong
   * nghiep vu (chi mang tinh hien thi/debug).
   */
  private toBalanceDto(
    userId: string,
    currentPoints: number,
    version: number,
    lastUpdated: Date = new Date(),
  ): PointsBalance {
    return { userId, currentPoints, version, lastUpdated };
  }
}

/** Instance dung chung (singleton) - dung truc tiep o cac noi khac trong backend. */
export const pointsService = new PointsService();
