// ============================================================================
// streak.utils.ts — Tính chuỗi học liên tiếp (streak) từ mảng ngày hoàn thành
//
// Tách ra thành util riêng để tránh circular import:
//   progress.service.ts imports practiceService
//   practice.service.ts cần tính streak → không thể import progress.service
// ============================================================================

/**
 * Tính streak từ mảng ngày đã hoàn thành phiên ôn tập.
 * Trả về { currentStreak, bestStreak }.
 *
 * Quy tắc:
 *   - "ngày" tính theo UTC date (yyyy-mm-dd)
 *   - Nếu hôm nay chưa có phiên thì streak hiện tại = chuỗi kết thúc hôm qua
 *   - Chuỗi liên tiếp = các ngày liền kề nhau (không có ngày trống)
 */
export function computeStreaks(completedAtDates: Date[]): {
  currentStreak: number;
  bestStreak: number;
} {
  if (completedAtDates.length === 0) return { currentStreak: 0, bestStreak: 0 };

  // Lấy danh sách ngày duy nhất (UTC date string), sắp xếp giảm dần
  const uniqueDays = [
    ...new Set(completedAtDates.map((d) => d.toISOString().slice(0, 10))),
  ].sort().reverse(); // ['2025-07-04', '2025-07-03', ...]

  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  // Tính chuỗi hiện tại bắt đầu từ hôm nay hoặc hôm qua
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

  // Tính best streak trên toàn bộ lịch sử
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

/** Danh sách milestone streak cần thông báo. */
export const STREAK_MILESTONES = [7, 14, 30, 60, 100] as const;
export type StreakMilestone = (typeof STREAK_MILESTONES)[number];

// ============================================================================
// computeStreaksWithFreeze — streak co "the bao hiem chuoi" (Feature 015 —
// Free/Premium). Premium duoc cap STREAK_FREEZE_GRANT the ngay khi kich hoat;
// moi khoang trong DUNG 1 ngay xay ra SAU premiumSinceEffective se tu dong
// dung 1 the de "bac cau" (khong cat streak) cho toi khi het the.
//
// Day la PURE FUNCTION (khong query DB) - de test day du moi kich ban gap.
// Khong sua/xoa computeStreaks o tren - ham do van dung cho truong hop KHONG
// can freeze (vi du Free, hoac noi nao chua can nang cap).
// ============================================================================

/** So the bao hiem chuoi duoc cap ngay khi 1 user kich hoat Premium. */
export const STREAK_FREEZE_GRANT = 3;

export interface StreakFreezeResult {
  currentStreak: number;
  bestStreak: number;
  /** Tong so the da dung (tinh tu premiumSinceEffective den nay, toi da = freezeGrant). */
  freezesUsed: number;
  /** So the con lai = freezeGrant - freezesUsed (khong am). */
  freezesRemaining: number;
}

/** So ngay lich (UTC) giua 2 chuoi ngay dang 'yyyy-mm-dd'. Duong neu `toStr` sau `fromStr`. */
function daysBetweenDayStrings(fromStr: string, toStr: string): number {
  const from = new Date(fromStr).getTime();
  const to = new Date(toStr).getTime();
  return Math.round((to - from) / 86_400_000);
}

/**
 * Tinh streak co ho tro "the bao hiem chuoi" (streak freeze) cho Premium.
 *
 * @param completedAtDates    Danh sach ngay hoan thanh phien on tap (khong can sap xep san).
 * @param premiumSinceEffective Moc thoi gian coi nhu "bat dau Premium" (xem
 *   premiumService.getEffectivePremiumSince) - `null` neu user chua tung la
 *   Premium (khong co the nao ca, hoat dong y het computeStreaks thuong).
 * @param freezeGrant Tong so the duoc cap (mac dinh STREAK_FREEZE_GRANT=3).
 *   Truyen `0` cho user Free (KHONG co the nao) - dam bao ket qua tra ve
 *   granted/used/remaining deu = 0 dung theo yeu cau nghiep vu.
 *
 * THUAT TOAN: duyet cac ngay CO HOAT DONG theo thu tu CU -> MOI (1 lan duy
 * nhat). Voi moi cap ngay lien tiep trong danh sach:
 *   - Cach nhau DUNG 1 ngay (diff=1)                         -> lien tuc binh thuong.
 *   - Cach nhau DUNG 2 ngay (diff=2, tuc bo lo dung 1 ngay ở
 *     giua) VA khoang trong nay xay ra tu luc da la Premium
 *     (ngay truoc gap >= premiumSinceEffective) VA con the    -> "bac cau"
 *     (coi nhu khong dut), dung 1 the.
 *   - Con lai (cach nhau > 2 ngay, hoac het the, hoac chua la
 *     Premium luc do)                                        -> dut streak, reset ve 1.
 *
 * Sau khi duyet xong lich su, KIEM TRA THEM khoang cach tu ngay hoat dong GAN
 * NHAT den HOM NAY (dung logic bac cau y het o tren) de xac dinh currentStreak
 * co con "song" hay khong - dam bao streak duoc bao ve NGAY CA KHI user chua
 * kip on tap lai sau khi bo lo 1 ngay (khong phai doi den luc ho on tap lai
 * moi thay streak duoc "hoi phuc").
 */
export function computeStreaksWithFreeze(
  completedAtDates: Date[],
  premiumSinceEffective: Date | null,
  freezeGrant: number = STREAK_FREEZE_GRANT,
): StreakFreezeResult {
  if (completedAtDates.length === 0) {
    return { currentStreak: 0, bestStreak: 0, freezesUsed: 0, freezesRemaining: Math.max(0, freezeGrant) };
  }

  // Ngay duy nhat (UTC date string), sap xep TANG DAN (cu -> moi) - nguoc
  // huong voi computeStreaks (dang giam dan) vi thuat toan freeze can duyet
  // theo dung trinh tu thoi gian de "tieu" the mot cach nhat quan.
  const uniqueDays = [...new Set(completedAtDates.map((d) => d.toISOString().slice(0, 10)))].sort();

  const premiumSinceStr = premiumSinceEffective ? premiumSinceEffective.toISOString().slice(0, 10) : null;

  let freezesUsed = 0;

  /** Con the de bac cau khoang trong bat dau tu ngay `prevDayStr` hay khong. */
  const canBridge = (prevDayStr: string): boolean =>
    premiumSinceStr !== null && prevDayStr >= premiumSinceStr && freezesUsed < freezeGrant;

  let bestStreak = 1;
  let tempStreak = 1;

  for (let i = 1; i < uniqueDays.length; i++) {
    const prevStr = uniqueDays[i - 1]!;
    const currStr = uniqueDays[i]!;
    const diffDays = daysBetweenDayStrings(prevStr, currStr);

    if (diffDays === 1) {
      tempStreak++;
    } else if (diffDays === 2 && canBridge(prevStr)) {
      freezesUsed++;
      tempStreak++;
    } else {
      tempStreak = 1;
    }

    if (tempStreak > bestStreak) bestStreak = tempStreak;
  }

  // --- currentStreak: con "song" tinh den HOM NAY khong? ---
  const lastDayStr = uniqueDays[uniqueDays.length - 1]!;
  const todayStr = new Date().toISOString().slice(0, 10);
  const diffFromToday = daysBetweenDayStrings(lastDayStr, todayStr);

  let currentStreak = 0;
  if (diffFromToday === 0 || diffFromToday === 1) {
    // Hom nay hoac hom qua da co hoat dong -> streak dang song binh thuong.
    currentStreak = tempStreak;
  } else if (diffFromToday === 2 && canBridge(lastDayStr)) {
    // Bo lo dung 1 ngay (hom qua), con the -> tu dong dung the, streak van song.
    freezesUsed++;
    currentStreak = tempStreak;
  }
  // diffFromToday >= 3 (hoac het the/chua Premium luc do) -> streak da dut, currentStreak = 0.

  return {
    currentStreak,
    bestStreak,
    freezesUsed,
    freezesRemaining: Math.max(0, freezeGrant - freezesUsed),
  };
}
