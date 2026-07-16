// Unit test cho streak.utils.ts — đặc biệt computeStreaksWithFreeze (Feature 015).
// Cố định "now" bằng fake timers để kết quả currentStreak xác định, không phụ
// thuộc ngày chạy test thực tế.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { computeStreaks, computeStreaksWithFreeze, STREAK_FREEZE_GRANT } from '../streak.utils.js';

const NOW = new Date('2026-03-10T00:00:00.000Z'); // "hôm nay" cố định cho toàn bộ file test

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('computeStreaksWithFreeze', () => {
  it('⚠️ Edge: mảng rỗng → tất cả = 0, freezesRemaining = freezeGrant truyền vào', () => {
    expect(computeStreaksWithFreeze([], null, 3)).toEqual({
      currentStreak: 0, bestStreak: 0, freezesUsed: 0, freezesRemaining: 3,
    });
    expect(computeStreaksWithFreeze([], d('2026-01-01'), 0)).toEqual({
      currentStreak: 0, bestStreak: 0, freezesUsed: 0, freezesRemaining: 0,
    });
  });

  it('✅ Happy: chuỗi liên tục không có gap → giống hệt computeStreaks, freezesUsed=0', () => {
    const dates = ['03-01', '03-02', '03-03', '03-04', '03-05', '03-06', '03-07', '03-08', '03-09', '03-10']
      .map((day) => d(`2026-${day}`));

    const result = computeStreaksWithFreeze(dates, d('2026-02-01'), 3);

    expect(result).toEqual({ currentStreak: 10, bestStreak: 10, freezesUsed: 0, freezesRemaining: 3 });
  });

  it('✅ Happy: gap ĐÚNG 1 ngày sau khi Premium kích hoạt → bắc cầu, dùng 1 thẻ, streak không đứt', () => {
    // 03-04 bị bỏ lỡ (gap giữa 03-03 và 03-05)
    const dates = ['03-01', '03-02', '03-03', '03-05', '03-06', '03-07', '03-08', '03-09', '03-10']
      .map((day) => d(`2026-${day}`));

    const result = computeStreaksWithFreeze(dates, d('2026-02-01'), 3);

    expect(result).toEqual({ currentStreak: 9, bestStreak: 9, freezesUsed: 1, freezesRemaining: 2 });
  });

  it('❌ Edge: bỏ lỡ 2 ngày liên tiếp (gap=3) → streak ĐỨT dù còn thẻ', () => {
    // Mất 03-06 và 03-07 (2 ngày liền) giữa 03-05 và 03-08
    const dates = ['03-01', '03-02', '03-03', '03-04', '03-05', '03-08', '03-09', '03-10']
      .map((day) => d(`2026-${day}`));

    const result = computeStreaksWithFreeze(dates, d('2026-02-01'), 3);

    // Chuỗi cũ (03-01..03-05) dài 5, chuỗi mới (03-08..03-10) dài 3 → best=5, current=3
    expect(result.bestStreak).toBe(5);
    expect(result.currentStreak).toBe(3);
    expect(result.freezesUsed).toBe(0); // gap 2 ngày KHÔNG được bắc cầu
  });

  it('❌ Edge: gap xảy ra TRƯỚC premiumSinceEffective → KHÔNG được bắc cầu (chưa là Premium lúc đó)', () => {
    // Gap giữa 03-01 và 03-03 xảy ra TRƯỚC khi Premium kích hoạt (03-04)
    const dates = ['03-01', '03-03', '03-04', '03-05', '03-06', '03-07', '03-08', '03-09', '03-10']
      .map((day) => d(`2026-${day}`));

    const result = computeStreaksWithFreeze(dates, d('2026-03-04'), 3);

    expect(result.freezesUsed).toBe(0);
    // Chuỗi hiện tại chỉ tính từ 03-03 (03-01 bị cắt do gap không được bắc cầu) → dài 8 ngày (03-03..03-10)
    expect(result.currentStreak).toBe(8);
    expect(result.bestStreak).toBe(8);
  });

  it('✅ Edge: premiumSinceEffective TRÙNG đúng ngày trước gap (biên bao gồm) → vẫn được bắc cầu', () => {
    const dates = ['03-01', '03-03'].map((day) => d(`2026-${day}`));

    const result = computeStreaksWithFreeze(dates, d('2026-03-01'), 3);

    expect(result.freezesUsed).toBe(1);
    expect(result.bestStreak).toBe(2);
  });

  it('❌ Edge: dùng hết 3 thẻ → gap thứ 4 (dù đúng 1 ngày) KHÔNG còn được bắc cầu, streak đứt bình thường', () => {
    // 4 gap 1-ngày liên tiếp: 03-01,[gap],03-03,[gap],03-05,[gap],03-07,[gap],03-09,03-10
    const dates = ['03-01', '03-03', '03-05', '03-07', '03-09', '03-10'].map((day) => d(`2026-${day}`));

    const result = computeStreaksWithFreeze(dates, d('2026-02-01'), 3);

    expect(result.freezesUsed).toBe(3);
    expect(result.freezesRemaining).toBe(0);
    expect(result.bestStreak).toBe(4); // 03-01 bắc cầu 3 lần liên tiếp -> 03-01,03-03,03-05,03-07 = 4 ngày
    // Gap thứ 4 (03-07 -> 03-09) không còn thẻ -> đứt, chuỗi mới 03-09,03-10 = 2 ngày = current
    expect(result.currentStreak).toBe(2);
  });

  it('✅ Happy: gap "treo" (trailing) đúng 1 ngày tính đến HÔM NAY → streak vẫn sống, KHÔNG cần chờ user ôn tập lại', () => {
    // Hoạt động gần nhất là 03-08 (2 ngày trước "hôm nay" 03-10) -> nghĩa là bỏ lỡ 03-09 (hôm qua)
    const dates = ['03-01', '03-02', '03-03', '03-04', '03-05', '03-06', '03-07', '03-08']
      .map((day) => d(`2026-${day}`));

    const result = computeStreaksWithFreeze(dates, d('2026-02-01'), 3);

    expect(result.currentStreak).toBe(8); // vẫn sống nhờ thẻ, KHÔNG bị 0
    expect(result.bestStreak).toBe(8);
    expect(result.freezesUsed).toBe(1);
    expect(result.freezesRemaining).toBe(2);
  });

  it('❌ Edge: gap "treo" nhưng freezeGrant=0 (Free) → streak đứt (currentStreak=0), dù pattern giống hệt Premium', () => {
    const dates = ['03-01', '03-02', '03-03', '03-04', '03-05', '03-06', '03-07', '03-08']
      .map((day) => d(`2026-${day}`));

    const result = computeStreaksWithFreeze(dates, d('2026-02-01'), 0);

    expect(result.currentStreak).toBe(0);
    expect(result.freezesUsed).toBe(0);
    expect(result.freezesRemaining).toBe(0);
    expect(result.bestStreak).toBe(8); // best streak lịch sử không bị ảnh hưởng bởi trailing check
  });

  it('❌ Edge: gap "treo" 2 ngày (bỏ lỡ cả hôm qua lẫn hôm kia) → streak đứt dù còn thẻ (chỉ tha thứ đúng 1 ngày)', () => {
    const dates = ['03-01', '03-02', '03-03', '03-07'].map((day) => d(`2026-${day}`)); // hoạt động gần nhất 03-07, cách hôm nay (03-10) 3 ngày

    const result = computeStreaksWithFreeze(dates, d('2026-02-01'), 3);

    expect(result.currentStreak).toBe(0);
    expect(result.freezesUsed).toBe(0);
  });

  it('❌ Edge: premiumSinceEffective = null (chưa từng Premium) → không bắc cầu dù freezeGrant > 0', () => {
    const dates = ['03-01', '03-03', '03-04', '03-05', '03-06', '03-07', '03-08', '03-09', '03-10']
      .map((day) => d(`2026-${day}`));

    const result = computeStreaksWithFreeze(dates, null, 3);

    expect(result.freezesUsed).toBe(0);
    expect(result.currentStreak).toBe(8); // giống hệt trường hợp Free — chỉ chuỗi từ 03-03 trở đi
  });

  it('⚠️ Edge: mảng ngày KHÔNG sắp xếp sẵn + có ngày trùng lặp trong cùng 1 ngày → vẫn tính đúng', () => {
    const dates = [
      d('2026-03-03'), d('2026-03-01'), d('2026-03-02'), d('2026-03-02'), // 03-02 trùng lặp (2 phiên cùng ngày)
    ];

    const result = computeStreaksWithFreeze(dates, d('2026-02-01'), 3);

    expect(result.bestStreak).toBe(3);
    expect(result.freezesUsed).toBe(0);
  });

  it('🔍 Consistency: STREAK_FREEZE_GRANT export = 3 (hằng số dùng làm mặc định + cấp Premium)', () => {
    expect(STREAK_FREEZE_GRANT).toBe(3);
  });
});

// ─── Regression: đảm bảo computeStreaks cũ (không freeze) không bị thay đổi hành vi ──

describe('computeStreaks (không đổi hành vi cũ)', () => {
  it('✅ Happy: vẫn hoạt động như trước — không bị ảnh hưởng bởi việc thêm computeStreaksWithFreeze', () => {
    const dates = ['03-08', '03-09', '03-10'].map((day) => d(`2026-${day}`));
    const result = computeStreaks(dates);
    expect(result.currentStreak).toBe(3);
    expect(result.bestStreak).toBe(3);
  });
});
