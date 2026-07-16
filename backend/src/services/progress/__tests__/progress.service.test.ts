// Unit test cho progressService — tập trung vào phần Free/Premium (Feature 015):
// isPremium/premiumExpiresAt/streakFreeze trong getSummary(), và gate Premium
// trong getExamHistory(). Mock Prisma + practiceService + premiumService hoàn
// toàn, không cần DB thật.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    practiceSession: { findMany: vi.fn(), count: vi.fn() },
    examSession: { count: vi.fn(), findMany: vi.fn() },
    userPoints: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    examPaper: { findMany: vi.fn() },
  },
}));

vi.mock('../../practice/practice.service.js', () => ({
  practiceService: { getStats: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../../premium/premium.service.js', () => ({
  premiumService: {
    getGlobalPremiumSetting: vi.fn(),
    isUserPremium: vi.fn(),
    getEffectivePremiumSince: vi.fn(),
  },
}));

import { prisma } from '../../../lib/prisma.js';
import { premiumService } from '../../premium/premium.service.js';
import { progressService } from '../progress.service.js';
import { ExamHistoryPremiumOnlyError } from '../progress.errors.js';

const prismaMock = prisma as unknown as {
  practiceSession: { findMany: ReturnType<typeof vi.fn> };
  examSession: { count: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  userPoints: { findUnique: ReturnType<typeof vi.fn> };
  user: { findUnique: ReturnType<typeof vi.fn> };
  examPaper: { findMany: ReturnType<typeof vi.fn> };
};

const premiumMock = premiumService as unknown as {
  getGlobalPremiumSetting: ReturnType<typeof vi.fn>;
  isUserPremium: ReturnType<typeof vi.fn>;
  getEffectivePremiumSince: ReturnType<typeof vi.fn>;
};

/** Thiết lập mock mặc định cho mọi query trong getSummary() — trả về rỗng/0. */
function mockEmptySummaryQueries() {
  prismaMock.practiceSession.findMany.mockResolvedValue([]);
  prismaMock.practiceSession.count.mockResolvedValue(0);
  prismaMock.examSession.count.mockResolvedValue(0);
  prismaMock.userPoints.findUnique.mockResolvedValue({ currentPoints: 0 });
  prismaMock.examSession.findMany.mockResolvedValue([]);
  prismaMock.user.findUnique.mockResolvedValue({
    premiumExpiresAt: null, premiumSince: null, createdAt: new Date('2025-01-01'),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getSummary — Free/Premium (Feature 015)', () => {
  it('✅ Happy: user Free → isPremium=false, streakFreeze=0/0/0, premiumExpiresAt=null', async () => {
    mockEmptySummaryQueries();
    premiumMock.getGlobalPremiumSetting.mockResolvedValue({ defaultPremiumForAll: false });
    premiumMock.isUserPremium.mockReturnValue(false);
    premiumMock.getEffectivePremiumSince.mockReturnValue(null);

    const result = await progressService.getSummary('user-1');

    expect(result.isPremium).toBe(false);
    expect(result.premiumExpiresAt).toBeNull();
    expect(result.streakFreeze).toEqual({ granted: 0, used: 0, remaining: 0 });
  });

  it('✅ Happy: global toggle bật → isPremium=true dù premiumExpiresAt=null trong DB', async () => {
    mockEmptySummaryQueries();
    premiumMock.getGlobalPremiumSetting.mockResolvedValue({ defaultPremiumForAll: true });
    premiumMock.isUserPremium.mockReturnValue(true);
    premiumMock.getEffectivePremiumSince.mockReturnValue(new Date('2025-01-01'));

    const result = await progressService.getSummary('user-1');

    expect(result.isPremium).toBe(true);
    expect(result.premiumExpiresAt).toBeNull(); // field DB thật sự vẫn null
    expect(result.streakFreeze.granted).toBe(3);
  });

  it('✅ Happy: user Premium qua premiumExpiresAt còn hạn → trả premiumExpiresAt dạng ISO string', async () => {
    const expiry = new Date('2026-12-31T00:00:00.000Z');
    prismaMock.practiceSession.findMany.mockResolvedValue([]);
    prismaMock.practiceSession.count.mockResolvedValue(0);
    prismaMock.examSession.count.mockResolvedValue(0);
    prismaMock.userPoints.findUnique.mockResolvedValue({ currentPoints: 0 });
    prismaMock.examSession.findMany.mockResolvedValue([]);
    prismaMock.user.findUnique.mockResolvedValue({
      premiumExpiresAt: expiry, premiumSince: new Date('2026-01-01'), createdAt: new Date('2025-01-01'),
    });
    premiumMock.getGlobalPremiumSetting.mockResolvedValue({ defaultPremiumForAll: false });
    premiumMock.isUserPremium.mockReturnValue(true);
    premiumMock.getEffectivePremiumSince.mockReturnValue(new Date('2026-01-01'));

    const result = await progressService.getSummary('user-1');

    expect(result.isPremium).toBe(true);
    expect(result.premiumExpiresAt).toBe(expiry.toISOString());
  });

  it('⚠️ Edge: không tìm thấy user (hi hữu) → coi như Free, không crash', async () => {
    prismaMock.practiceSession.findMany.mockResolvedValue([]);
    prismaMock.practiceSession.count.mockResolvedValue(0);
    prismaMock.examSession.count.mockResolvedValue(0);
    prismaMock.userPoints.findUnique.mockResolvedValue(null);
    prismaMock.examSession.findMany.mockResolvedValue([]);
    prismaMock.user.findUnique.mockResolvedValue(null);
    premiumMock.getGlobalPremiumSetting.mockResolvedValue({ defaultPremiumForAll: false });
    premiumMock.isUserPremium.mockReturnValue(false);
    premiumMock.getEffectivePremiumSince.mockReturnValue(null);

    const result = await progressService.getSummary('user-ghost');

    expect(result.isPremium).toBe(false);
    expect(result.overview.currentPoints).toBe(0);
  });
});

describe('getExamHistory — gate Premium', () => {
  it('❌ Error: user Free → ném ExamHistoryPremiumOnlyError, KHÔNG query examSession', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ premiumExpiresAt: null });
    premiumMock.getGlobalPremiumSetting.mockResolvedValue({ defaultPremiumForAll: false });
    premiumMock.isUserPremium.mockReturnValue(false);

    await expect(progressService.getExamHistory('user-1')).rejects.toThrow(ExamHistoryPremiumOnlyError);
    expect(prismaMock.examSession.findMany).not.toHaveBeenCalled();
  });

  it('✅ Happy: user Premium → trả về danh sách bình thường', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ premiumExpiresAt: new Date(Date.now() + 86_400_000) });
    premiumMock.getGlobalPremiumSetting.mockResolvedValue({ defaultPremiumForAll: false });
    premiumMock.isUserPremium.mockReturnValue(true);
    prismaMock.examSession.findMany.mockResolvedValue([
      { id: 'es-1', examPaperId: 'ep-1', score: 8, pointsAwarded: 10, completedAt: new Date('2026-01-01') },
    ]);
    prismaMock.examSession.count.mockResolvedValue(1);
    prismaMock.examPaper.findMany.mockResolvedValue([{ id: 'ep-1', title: 'Đề Toán', subject: 'TOAN' }]);

    const result = await progressService.getExamHistory('user-1');

    expect(result.total).toBe(1);
    expect(result.items[0]!.title).toBe('Đề Toán');
  });
});
