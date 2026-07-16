// ============================================================================
// PremiumService — trung tam logic Free/Premium (Feature 015)
//
// Cac trach nhiem chinh:
//   - isUserPremium / getEffectivePremiumSince: quy tac xac dinh 1 user co
//     dang la Premium hay khong, va moc thoi gian "coi nhu bat dau Premium"
//     dung de tinh streak freeze (xem utils/streak.utils.ts).
//   - getGlobalPremiumSetting / setGlobalPremiumSetting: cong tac toan cuc
//     "Mac dinh Premium cho tat ca" (AppSettings, bang singleton). Duoc cache
//     in-memory de tranh query DB moi request (isUserPremium duoc goi RAT
//     NHIEU noi: /me, gate wrong-answer, gate exam-history, gate subjects...),
//     nhung PHAI invalidate NGAY khi admin ghi (khong dung TTL polling) - neu
//     khong se co do tre kho hieu khi admin bat/tat ma UI/API khong phan anh
//     ngay lap tuc.
//   - grantPremiumMonths: admin cap Premium thu cong theo thang (cong don neu
//     con han, reset "moi kich hoat" neu da het han tu truoc).
//
// QUY UOC quan trong (theo dung yeu cau nghiep vu da chot):
//   isUserPremium(user, globalSetting) =
//     globalSetting.defaultPremiumForAll || (user.premiumExpiresAt != null && user.premiumExpiresAt > now)
// ============================================================================
import type { User } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { notificationService } from '../notification/notification.service.js';
import { InvalidPremiumMonthsError } from './premium.errors.js';

/** Id co dinh cua dong duy nhat trong bang app_settings (xem schema.prisma). */
const APP_SETTINGS_ID = 'singleton';

/** So thang toi thieu/toi da cho phep khi admin cap Premium thu cong. */
const MIN_GRANT_MONTHS = 1;
const MAX_GRANT_MONTHS = 24;

export interface GlobalPremiumSetting {
  defaultPremiumForAll: boolean;
}

export interface GrantPremiumResult {
  id: string;
  premiumExpiresAt: Date;
  premiumSince: Date;
  /** true neu day la lan kich hoat Premium MOI (user dang KHONG premium truoc do) - streak freeze duoc coi la reset ve 3. */
  streakFreezeReset: boolean;
}

// ---------------------------------------------------------------------------
// Cache in-memory cong tac toan cuc — tranh query DB moi request.
// null = chua tung doc, se tu dong nap (kem tao dong singleton neu chua co)
// trong lan goi getGlobalPremiumSetting() dau tien.
// ---------------------------------------------------------------------------
let cachedGlobalSetting: GlobalPremiumSetting | null = null;

/**
 * Lay cong tac toan cuc "Mac dinh Premium cho tat ca" — co cache in-memory.
 * Neu bang app_settings chua co dong singleton (lan chay dau tien sau
 * migration), tu dong tao voi gia tri mac dinh defaultPremiumForAll=true
 * (dung theo @default trong schema.prisma - BAT SAN tu dau theo yeu cau).
 */
async function getGlobalPremiumSetting(): Promise<GlobalPremiumSetting> {
  if (cachedGlobalSetting !== null) return cachedGlobalSetting;

  const row = await prisma.appSettings.upsert({
    where: { id: APP_SETTINGS_ID },
    update: {},
    create: { id: APP_SETTINGS_ID },
  });

  cachedGlobalSetting = { defaultPremiumForAll: row.defaultPremiumForAll };
  return cachedGlobalSetting;
}

/**
 * Ghi cong tac toan cuc — invalidate (thuc chat la CAP NHAT NGAY) cache
 * in-memory ngay lap tuc, KHONG dung TTL polling. Nho vay request TIEP THEO
 * (ke ca tren cung 1 process) se thay gia tri moi ngay, khong co do tre.
 */
async function setGlobalPremiumSetting(enabled: boolean): Promise<GlobalPremiumSetting> {
  const row = await prisma.appSettings.upsert({
    where: { id: APP_SETTINGS_ID },
    update: { defaultPremiumForAll: enabled },
    create: { id: APP_SETTINGS_ID, defaultPremiumForAll: enabled },
  });

  cachedGlobalSetting = { defaultPremiumForAll: row.defaultPremiumForAll };
  return cachedGlobalSetting;
}

/**
 * Quy tac xac dinh 1 user co dang la Premium hay khong. Pure function (khong
 * query DB) — nhan globalSetting da duoc doc san tu getGlobalPremiumSetting()
 * de de test va tranh goi DB lap lai khi can kiem tra nhieu user cung luc.
 */
function isUserPremium(
  user: Pick<User, 'premiumExpiresAt'>,
  globalSetting: GlobalPremiumSetting,
): boolean {
  if (globalSetting.defaultPremiumForAll) return true;
  return user.premiumExpiresAt !== null && user.premiumExpiresAt.getTime() > Date.now();
}

/**
 * Ham tien ich: ket hop getGlobalPremiumSetting() + isUserPremium() cho cac
 * noi chi can biet 1 user co phai Premium hay khong (khong can tu tay doc
 * cong tac toan cuc truoc). Da so noi goi (gate route, UserMeDto...) dung
 * ham nay cho gon; isUserPremium/getGlobalPremiumSetting van duoc export
 * rieng cho cac truong hop can kiem soat chi tiet hon (vi du progress.service
 * can globalSetting de tinh CA isPremium LAN getEffectivePremiumSince tu
 * CUNG 1 lan doc, tranh goi cache 2 lan khong can thiet).
 */
async function checkIsPremium(user: Pick<User, 'premiumExpiresAt'>): Promise<boolean> {
  const globalSetting = await getGlobalPremiumSetting();
  return isUserPremium(user, globalSetting);
}

/**
 * Moc thoi gian "coi nhu bat dau Premium" — dung lam moc goc cho thuat toan
 * streak freeze (computeStreaksWithFreeze). Neu cong tac toan cuc dang BAT,
 * coi nhu MOI user deu la Premium ke tu luc tao tai khoan (user.createdAt) -
 * tuc toan bo lich su hoat dong deu duoc tinh freeze. Nguoc lai, dung dung
 * premiumSince da luu (null neu user chua tung duoc cap Premium thu cong).
 */
function getEffectivePremiumSince(
  user: Pick<User, 'premiumSince' | 'createdAt'>,
  globalSetting: GlobalPremiumSetting,
): Date | null {
  if (globalSetting.defaultPremiumForAll) return user.createdAt;
  return user.premiumSince;
}

/**
 * Cong `months` thang vao 1 Date theo lich UTC, xu ly dung truong hop tran
 * ngay cuoi thang (vi du 31/1 + 1 thang KHONG duoc nhay sang 3/3 ma phai
 * clamp ve ngay cuoi cung cua thang dich - 28/2 hoac 29/2).
 */
function addMonthsUtc(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const originalDay = result.getUTCDate();
  result.setUTCMonth(result.getUTCMonth() + months);
  if (result.getUTCDate() !== originalDay) {
    // Thang dich khong co du ngay (vd thang 2) -> JS da tu "tran" sang thang
    // ke tiep. Lui ve "ngay 0" cua thang hien tai (= ngay cuoi cung cua
    // thang truoc do, chinh la thang dich ta muon).
    result.setUTCDate(0);
  }
  return result;
}

/**
 * Admin cap Premium thu cong cho 1 user theo so thang (1-24).
 *
 * QUY TAC (theo dung yeu cau nghiep vu da chot):
 *   - Neu user HIEN TAI KHONG premium (premiumExpiresAt null hoac da qua han):
 *     premiumSince = now (RESET moc tinh streak freeze - coi nhu vua kich
 *     hoat Premium, duoc cap lai du 3 the bao hiem chuoi).
 *   - Neu user DANG premium con han: cong DON them `months` thang tu han cu
 *     (KHONG phai tu "now"), premiumSince GIU NGUYEN (khong reset freeze).
 *   - premiumExpiryWarnedAt LUON duoc reset ve null (de cron canh bao gui lai
 *     dung han cho lan het han MOI, tranh bo lo canh bao vi han da doi).
 *   - Gui thong bao PREMIUM_GRANTED (fire-and-forget, khong lam that bai
 *     luong chinh neu tao thong bao loi).
 *
 * Nhan vao `user` (ban ghi da duoc fetch san boi noi goi, vi du
 * adminUsersService - noi da chiu trach nhiem kiem tra ton tai / nem 404)
 * thay vi tu fetch lai theo userId, tranh 1 query trung lap khong can thiet.
 *
 * @throws InvalidPremiumMonthsError neu months khong hop le (phong thu tang
 *   cuong - route da validate bang Zod truoc khi goi toi day).
 */
async function grantPremiumMonths(user: User, months: number): Promise<GrantPremiumResult> {
  if (!Number.isInteger(months) || months < MIN_GRANT_MONTHS || months > MAX_GRANT_MONTHS) {
    throw new InvalidPremiumMonthsError(months);
  }

  const now = new Date();
  const currentlyPremium = user.premiumExpiresAt !== null && user.premiumExpiresAt.getTime() > now.getTime();

  const baseDate = currentlyPremium ? user.premiumExpiresAt! : now;
  const newExpiresAt = addMonthsUtc(baseDate, months);
  const streakFreezeReset = !currentlyPremium;
  const newPremiumSince = currentlyPremium ? user.premiumSince : now;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      premiumExpiresAt: newExpiresAt,
      premiumSince: newPremiumSince,
      premiumExpiryWarnedAt: null,
    },
    select: { id: true, premiumExpiresAt: true, premiumSince: true },
  });

  // Fire-and-forget: loi tao thong bao khong duoc lam hong luong cap Premium chinh.
  void notificationService.createNotification({
    userId: user.id,
    type: 'PREMIUM_GRANTED',
    title: '⭐ Bạn đã được cấp Premium!',
    body: `Tài khoản của bạn vừa được admin cấp Premium thêm ${months} tháng. Hạn sử dụng mới: ${newExpiresAt.toLocaleDateString('vi-VN')}.`,
    targetScreen: 'progress',
    metadata: { months, premiumExpiresAt: newExpiresAt.toISOString() },
  }).catch((err: unknown) => {
    console.error('[PremiumService] Loi tao thong bao PREMIUM_GRANTED:', err);
  });

  return {
    id: updated.id,
    // Khong the null vi vua duoc ghi ben tren.
    premiumExpiresAt: updated.premiumExpiresAt!,
    premiumSince: updated.premiumSince!,
    streakFreezeReset,
  };
}

/** So mili-giay trong 24 gio - dung cho cua so quet cua cron canh bao sap het han. */
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * [Goi boi cron hang ngay trong server.ts] Quet cac user co premiumExpiresAt
 * roi vao khoang (now, now+24h] VA premiumExpiryWarnedAt con null (chua tung
 * canh bao cho HAN HIEN TAI - luu y grantPremiumMonths LUON reset truong nay
 * ve null moi lan cap/gia han, nen dieu kien "con null" la du de dam bao
 * KHONG gui trung lap nhieu ngay cho cung 1 han, ma van canh bao lai dung
 * neu user duoc gia han them sau do).
 *
 * Voi moi user thoa dieu kien: gui thong bao PREMIUM_EXPIRING_SOON (fire-and-
 * forget, loi khong lam hong vong quet) + set premiumExpiryWarnedAt = now.
 *
 * @returns So user da duoc canh bao trong lan quet nay.
 */
async function notifyExpiringPremiumUsers(): Promise<number> {
  const now = new Date();
  const in24Hours = new Date(now.getTime() + TWENTY_FOUR_HOURS_MS);

  const expiringUsers = await prisma.user.findMany({
    where: {
      premiumExpiresAt: { gt: now, lte: in24Hours },
      premiumExpiryWarnedAt: null,
    },
    select: { id: true, premiumExpiresAt: true },
  });

  for (const user of expiringUsers) {
    // Fire-and-forget: loi tao thong bao cho 1 user khong duoc lam dung ca vong quet.
    notificationService.createNotification({
      userId: user.id,
      type: 'PREMIUM_EXPIRING_SOON',
      title: '⏰ Premium sắp hết hạn',
      body: `Premium của bạn sẽ hết hạn vào ${user.premiumExpiresAt!.toLocaleString('vi-VN')}. Hãy gia hạn để không bị gián đoạn quyền lợi!`,
      targetScreen: 'progress',
      metadata: { premiumExpiresAt: user.premiumExpiresAt!.toISOString() },
    }).catch((err: unknown) => {
      console.error(`[PremiumService] Loi tao thong bao PREMIUM_EXPIRING_SOON cho user ${user.id}:`, err);
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { premiumExpiryWarnedAt: now },
    });
  }

  return expiringUsers.length;
}

/** [Chi dung cho unit test] Reset cache in-memory ve trang thai chua doc lan nao. */
function _resetCacheForTest(): void {
  cachedGlobalSetting = null;
}

export const premiumService = {
  isUserPremium,
  checkIsPremium,
  getEffectivePremiumSince,
  getGlobalPremiumSetting,
  setGlobalPremiumSetting,
  grantPremiumMonths,
  notifyExpiringPremiumUsers,
  _resetCacheForTest,
};
