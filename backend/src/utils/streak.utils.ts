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
