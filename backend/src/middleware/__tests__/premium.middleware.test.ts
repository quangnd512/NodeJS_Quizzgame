// Unit test cho middleware requirePremium — mock premiumService hoàn toàn.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../services/premium/premium.service.js', () => ({
  premiumService: {
    getGlobalPremiumSetting: vi.fn(),
    isUserPremium: vi.fn(),
  },
}));

import { premiumService } from '../../services/premium/premium.service.js';
import { requirePremium } from '../premium.middleware.js';

const premiumMock = premiumService as unknown as {
  getGlobalPremiumSetting: ReturnType<typeof vi.fn>;
  isUserPremium: ReturnType<typeof vi.fn>;
};

class TestPremiumOnlyError extends Error {
  readonly code = 'TEST_PREMIUM_ONLY';
}

beforeEach(() => {
  vi.clearAllMocks();
});

function makeReq(currentUser: unknown): Request {
  return { currentUser } as unknown as Request;
}

describe('requirePremium', () => {
  it('✅ Happy: user Premium → gọi next() không kèm lỗi', async () => {
    premiumMock.getGlobalPremiumSetting.mockResolvedValue({ defaultPremiumForAll: false });
    premiumMock.isUserPremium.mockReturnValue(true);
    const next = vi.fn();
    const middleware = requirePremium(() => new TestPremiumOnlyError());

    await middleware(makeReq({ id: 'u1', premiumExpiresAt: null }), {} as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('❌ Error: user Free → gọi next(err) với lỗi do errorFactory tạo ra', async () => {
    premiumMock.getGlobalPremiumSetting.mockResolvedValue({ defaultPremiumForAll: false });
    premiumMock.isUserPremium.mockReturnValue(false);
    const next = vi.fn();
    const middleware = requirePremium(() => new TestPremiumOnlyError());

    await middleware(makeReq({ id: 'u1', premiumExpiresAt: null }), {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    const errArg = next.mock.calls[0]![0];
    expect(errArg).toBeInstanceOf(TestPremiumOnlyError);
  });

  it('⚠️ Edge: premiumService ném lỗi bất ngờ (vd DB down) → next(err) chuyển cho error handler trung tâm, KHÔNG throw', async () => {
    premiumMock.getGlobalPremiumSetting.mockRejectedValue(new Error('DB down'));
    const next = vi.fn();
    const middleware = requirePremium(() => new TestPremiumOnlyError());

    await middleware(makeReq({ id: 'u1' }), {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]![0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0]![0]).not.toBeInstanceOf(TestPremiumOnlyError);
  });
});
