// Unit test cho UsersService — phần ad-unlock đổi môn học + getProfile mở
// rộng isPremium/premiumExpiresAt (Feature 015 — Free/Premium). Các method
// khác (updateSubjects, updateProfile validate, avatar...) đã tồn tại từ
// trước Feature 015 và không thuộc phạm vi task này.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { PointsService } from '../../points/points.service.js';

vi.mock('../../../lib/redis.js', () => ({
  redis: {
    set: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('../../premium/premium.service.js', () => ({
  premiumService: {
    getGlobalPremiumSetting: vi.fn(),
    isUserPremium: vi.fn(),
  },
}));

import { redis } from '../../../lib/redis.js';
import { premiumService } from '../../premium/premium.service.js';
import { UsersService } from '../users.service.js';
import { UserNotFoundError } from '../users.errors.js';

const redisMock = redis as unknown as {
  set: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
};

const premiumMock = premiumService as unknown as {
  getGlobalPremiumSetting: ReturnType<typeof vi.fn>;
  isUserPremium: ReturnType<typeof vi.fn>;
};

const usersService = new UsersService();

const MOCK_USER = {
  id: 'user-1',
  firebaseUid: 'fb-1',
  displayName: 'Nguyen Van A',
  email: 'a@example.com',
  phone: null,
  school: null,
  province: null,
  subjects: ['TOAN'],
  avatarUrl: null,
  lastLoginAt: null,
  createdAt: new Date('2025-01-01'),
  isBlocked: false,
  role: 'STUDENT',
  premiumExpiresAt: null,
  premiumSince: null,
  premiumExpiryWarnedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('grantSubjectsAdUnlock', () => {
  it('✅ Happy: set Redis key đúng tên + TTL 300s, trả về expiresInSeconds=300', async () => {
    redisMock.set.mockResolvedValue('OK');

    const result = await usersService.grantSubjectsAdUnlock('user-1');

    expect(result).toEqual({ expiresInSeconds: 300 });
    expect(redisMock.set).toHaveBeenCalledWith('premium:ad-unlock:user-1', '1', 'EX', 300);
  });
});

describe('consumeSubjectsAdUnlock', () => {
  it('✅ Happy: token còn hiệu lực (del trả về 1) → true (tiêu thụ thành công)', async () => {
    redisMock.del.mockResolvedValue(1);

    const result = await usersService.consumeSubjectsAdUnlock('user-1');

    expect(result).toBe(true);
    expect(redisMock.del).toHaveBeenCalledWith('premium:ad-unlock:user-1');
  });

  it('❌ Edge: token không tồn tại/đã hết hạn (del trả về 0) → false', async () => {
    redisMock.del.mockResolvedValue(0);

    const result = await usersService.consumeSubjectsAdUnlock('user-1');

    expect(result).toBe(false);
  });

  it('⚠️ Edge: gọi 2 lần liên tiếp cùng token → lần đầu true, lần 2 false (single-use thật sự)', async () => {
    redisMock.del.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    const first = await usersService.consumeSubjectsAdUnlock('user-1');
    const second = await usersService.consumeSubjectsAdUnlock('user-1');

    expect(first).toBe(true);
    expect(second).toBe(false);
  });
});

describe('getProfile — isPremium/premiumExpiresAt (Feature 015)', () => {
  const prismaMock = { user: { findUnique: vi.fn() } } as unknown as PrismaClient;
  const pointsServiceMock = { getBalance: vi.fn() } as unknown as PointsService;
  const service = new UsersService(prismaMock, pointsServiceMock);

  it('✅ Happy: user Free → isPremium=false, premiumExpiresAt=null', async () => {
    (prismaMock.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_USER);
    (pointsServiceMock.getBalance as ReturnType<typeof vi.fn>).mockResolvedValue({ currentPoints: 50 });
    premiumMock.getGlobalPremiumSetting.mockResolvedValue({ defaultPremiumForAll: false });
    premiumMock.isUserPremium.mockReturnValue(false);

    const result = await service.getProfile('user-1');

    expect(result.isPremium).toBe(false);
    expect(result.premiumExpiresAt).toBeNull();
    expect(result.points).toBe(50);
  });

  it('✅ Happy: user Premium (còn hạn) → isPremium=true, premiumExpiresAt trả đúng giá trị DB', async () => {
    const expiry = new Date('2026-12-31');
    (prismaMock.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ ...MOCK_USER, premiumExpiresAt: expiry });
    (pointsServiceMock.getBalance as ReturnType<typeof vi.fn>).mockResolvedValue({ currentPoints: 0 });
    premiumMock.getGlobalPremiumSetting.mockResolvedValue({ defaultPremiumForAll: false });
    premiumMock.isUserPremium.mockReturnValue(true);

    const result = await service.getProfile('user-1');

    expect(result.isPremium).toBe(true);
    expect(result.premiumExpiresAt).toBe(expiry);
  });

  it('❌ Error: user không tồn tại → UserNotFoundError', async () => {
    (prismaMock.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(service.getProfile('no-such-id')).rejects.toThrow(UserNotFoundError);
  });
});
