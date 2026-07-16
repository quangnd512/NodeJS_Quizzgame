// Unit test cho premiumService — mock Prisma + NotificationService. Không cần DB thật.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Prisma ────────────────────────────────────────────────────────────
vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    appSettings: {
      upsert: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
  },
}));

// ─── Mock NotificationService (fire-and-forget, không cần DB thật) ──────────
vi.mock('../../notification/notification.service.js', () => ({
  notificationService: {
    createNotification: vi.fn().mockResolvedValue(undefined),
  },
}));

// ─── Imports sau khi mock ────────────────────────────────────────────────────
import { prisma } from '../../../lib/prisma.js';
import { notificationService } from '../../notification/notification.service.js';
import { premiumService } from '../premium.service.js';
import { InvalidPremiumMonthsError } from '../premium.errors.js';

const prismaMock = prisma as unknown as {
  appSettings: { upsert: ReturnType<typeof vi.fn> };
  user: { update: ReturnType<typeof vi.fn> };
};

const notificationMock = notificationService as unknown as {
  createNotification: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
  premiumService._resetCacheForTest();
});

// ─── isUserPremium (pure function) ──────────────────────────────────────────

describe('isUserPremium', () => {
  it('✅ Happy: global bật → luôn true dù premiumExpiresAt null', () => {
    const result = premiumService.isUserPremium(
      { premiumExpiresAt: null },
      { defaultPremiumForAll: true },
    );
    expect(result).toBe(true);
  });

  it('✅ Happy: global tắt, premiumExpiresAt còn hạn → true', () => {
    const future = new Date(Date.now() + 86_400_000);
    const result = premiumService.isUserPremium(
      { premiumExpiresAt: future },
      { defaultPremiumForAll: false },
    );
    expect(result).toBe(true);
  });

  it('❌ Edge: global tắt, premiumExpiresAt null → false', () => {
    const result = premiumService.isUserPremium(
      { premiumExpiresAt: null },
      { defaultPremiumForAll: false },
    );
    expect(result).toBe(false);
  });

  it('❌ Edge: global tắt, premiumExpiresAt đã qua hạn → false', () => {
    const past = new Date(Date.now() - 86_400_000);
    const result = premiumService.isUserPremium(
      { premiumExpiresAt: past },
      { defaultPremiumForAll: false },
    );
    expect(result).toBe(false);
  });
});

// ─── getEffectivePremiumSince ───────────────────────────────────────────────

describe('getEffectivePremiumSince', () => {
  it('✅ Happy: global bật → trả về createdAt (coi như Premium từ lúc tạo tài khoản)', () => {
    const createdAt = new Date('2025-01-01');
    const result = premiumService.getEffectivePremiumSince(
      { premiumSince: null, createdAt },
      { defaultPremiumForAll: true },
    );
    expect(result).toEqual(createdAt);
  });

  it('✅ Happy: global tắt → trả về premiumSince đã lưu', () => {
    const premiumSince = new Date('2026-03-01');
    const result = premiumService.getEffectivePremiumSince(
      { premiumSince, createdAt: new Date('2025-01-01') },
      { defaultPremiumForAll: false },
    );
    expect(result).toEqual(premiumSince);
  });

  it('⚠️ Edge: global tắt, user chưa từng Premium → null', () => {
    const result = premiumService.getEffectivePremiumSince(
      { premiumSince: null, createdAt: new Date('2025-01-01') },
      { defaultPremiumForAll: false },
    );
    expect(result).toBeNull();
  });
});

// ─── getGlobalPremiumSetting / setGlobalPremiumSetting (cache in-memory) ────

describe('getGlobalPremiumSetting', () => {
  it('✅ Happy: lần đầu đọc → query DB (upsert tạo dòng singleton nếu chưa có)', async () => {
    prismaMock.appSettings.upsert.mockResolvedValue({ id: 'singleton', defaultPremiumForAll: true });

    const result = await premiumService.getGlobalPremiumSetting();

    expect(result.defaultPremiumForAll).toBe(true);
    expect(prismaMock.appSettings.upsert).toHaveBeenCalledTimes(1);
  });

  it('✅ Happy: lần đọc thứ 2 → dùng cache, KHÔNG query DB lại', async () => {
    prismaMock.appSettings.upsert.mockResolvedValue({ id: 'singleton', defaultPremiumForAll: true });

    await premiumService.getGlobalPremiumSetting();
    await premiumService.getGlobalPremiumSetting();

    expect(prismaMock.appSettings.upsert).toHaveBeenCalledTimes(1);
  });
});

describe('setGlobalPremiumSetting', () => {
  it('✅ Happy: ghi xong → invalidate cache NGAY, đọc lại thấy giá trị mới không cần query lại', async () => {
    prismaMock.appSettings.upsert.mockResolvedValue({ id: 'singleton', defaultPremiumForAll: false });

    const written = await premiumService.setGlobalPremiumSetting(false);
    expect(written.defaultPremiumForAll).toBe(false);

    // Đọc lại — phải lấy giá trị MỚI từ cache, không gọi DB thêm lần nào.
    const read = await premiumService.getGlobalPremiumSetting();
    expect(read.defaultPremiumForAll).toBe(false);
    expect(prismaMock.appSettings.upsert).toHaveBeenCalledTimes(1);
  });
});

// ─── grantPremiumMonths ─────────────────────────────────────────────────────

const BASE_USER = {
  id: 'user-1',
  firebaseUid: 'fb-1',
  displayName: 'Nguyen Van A',
  email: 'a@example.com',
  phone: null,
  school: null,
  province: null,
  subjects: [],
  avatarUrl: null,
  lastLoginAt: null,
  isBlocked: false,
  role: 'STUDENT',
  createdAt: new Date('2025-01-01'),
  premiumExpiresAt: null,
  premiumSince: null,
  premiumExpiryWarnedAt: null,
};

describe('grantPremiumMonths', () => {
  it('✅ Happy: user KHÔNG premium (chưa từng cấp) → premiumSince=now, streakFreezeReset=true', async () => {
    const user = { ...BASE_USER, premiumExpiresAt: null, premiumSince: null };
    const beforeCall = Date.now();
    prismaMock.user.update.mockImplementation(({ data }: { data: { premiumExpiresAt: Date; premiumSince: Date } }) =>
      Promise.resolve({ id: 'user-1', premiumExpiresAt: data.premiumExpiresAt, premiumSince: data.premiumSince }),
    );

    const result = await premiumService.grantPremiumMonths(user, 3);

    expect(result.streakFreezeReset).toBe(true);
    expect(result.premiumSince.getTime()).toBeGreaterThanOrEqual(beforeCall);
    // Hạn mới ~ now + 3 tháng
    const expectedMonth = (new Date().getUTCMonth() + 3) % 12;
    expect(result.premiumExpiresAt.getUTCMonth()).toBe(expectedMonth);
    expect(notificationMock.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', type: 'PREMIUM_GRANTED' }),
    );
  });

  it('✅ Happy: user đã qua hạn (premiumExpiresAt ở quá khứ) → coi như KHÔNG premium, reset premiumSince', async () => {
    const pastExpiry = new Date(Date.now() - 86_400_000);
    const oldSince = new Date('2025-06-01');
    const user = { ...BASE_USER, premiumExpiresAt: pastExpiry, premiumSince: oldSince };
    prismaMock.user.update.mockImplementation(({ data }: { data: { premiumExpiresAt: Date; premiumSince: Date } }) =>
      Promise.resolve({ id: 'user-1', premiumExpiresAt: data.premiumExpiresAt, premiumSince: data.premiumSince }),
    );

    const result = await premiumService.grantPremiumMonths(user, 1);

    expect(result.streakFreezeReset).toBe(true);
    expect(result.premiumSince.getTime()).not.toBe(oldSince.getTime());
    // Hạn mới tính từ NOW (không phải từ hạn cũ đã qua) → phải nằm trong tương lai.
    expect(result.premiumExpiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('✅ Happy: user ĐANG premium còn hạn → cộng dồn từ hạn cũ, premiumSince GIỮ NGUYÊN', async () => {
    const futureExpiry = new Date(Date.now() + 10 * 86_400_000); // còn 10 ngày
    const oldSince = new Date('2025-06-01');
    const user = { ...BASE_USER, premiumExpiresAt: futureExpiry, premiumSince: oldSince };
    prismaMock.user.update.mockImplementation(({ data }: { data: { premiumExpiresAt: Date; premiumSince: Date } }) =>
      Promise.resolve({ id: 'user-1', premiumExpiresAt: data.premiumExpiresAt, premiumSince: data.premiumSince }),
    );

    const result = await premiumService.grantPremiumMonths(user, 2);

    expect(result.streakFreezeReset).toBe(false);
    expect(result.premiumSince.getTime()).toBe(oldSince.getTime());
    // Han moi phai SAU han cu (cong don, khong phai tinh tu now)
    expect(result.premiumExpiresAt.getTime()).toBeGreaterThan(futureExpiry.getTime());
  });

  it('⚠️ Edge: cộng tháng qua ranh giới cuối tháng (31/1 + 1 tháng → clamp về 28/2, không nhảy sang tháng 3)', async () => {
    // Co dinh "now" = 31/1/2026 (UTC) de kiem soat phep cong thang chinh xac.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 31)));
    try {
      const user = { ...BASE_USER, premiumExpiresAt: null, premiumSince: null };
      prismaMock.user.update.mockImplementation(({ data }: { data: { premiumExpiresAt: Date; premiumSince: Date } }) =>
        Promise.resolve({ id: 'user-1', premiumExpiresAt: data.premiumExpiresAt, premiumSince: data.premiumSince }),
      );

      const result = await premiumService.grantPremiumMonths(user, 1);

      // Thang 2/2026 khong phai nam nhuan -> chi co 28 ngay -> phai clamp, KHONG nhay sang thang 3.
      expect(result.premiumExpiresAt.getUTCFullYear()).toBe(2026);
      expect(result.premiumExpiresAt.getUTCMonth()).toBe(1); // Tháng 2 (0-indexed)
      expect(result.premiumExpiresAt.getUTCDate()).toBe(28);
    } finally {
      vi.useRealTimers();
    }
  });

  it('❌ Error: months = 0 → InvalidPremiumMonthsError', async () => {
    await expect(premiumService.grantPremiumMonths(BASE_USER, 0))
      .rejects.toThrow(InvalidPremiumMonthsError);
  });

  it('❌ Error: months = 25 (ngoài khoảng 1-24) → InvalidPremiumMonthsError', async () => {
    await expect(premiumService.grantPremiumMonths(BASE_USER, 25))
      .rejects.toThrow(InvalidPremiumMonthsError);
  });

  it('❌ Error: months không phải số nguyên → InvalidPremiumMonthsError', async () => {
    await expect(premiumService.grantPremiumMonths(BASE_USER, 1.5))
      .rejects.toThrow(InvalidPremiumMonthsError);
  });

  it('⚠️ Edge: lỗi tạo thông báo KHÔNG làm hỏng luồng cấp Premium chính', async () => {
    const user = { ...BASE_USER, premiumExpiresAt: null, premiumSince: null };
    prismaMock.user.update.mockImplementation(({ data }: { data: { premiumExpiresAt: Date; premiumSince: Date } }) =>
      Promise.resolve({ id: 'user-1', premiumExpiresAt: data.premiumExpiresAt, premiumSince: data.premiumSince }),
    );
    notificationMock.createNotification.mockRejectedValue(new Error('DB down'));

    const result = await premiumService.grantPremiumMonths(user, 1);

    expect(result.id).toBe('user-1');
  });
});
