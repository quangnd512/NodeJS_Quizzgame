// Unit test cho UsersService — CHỈ phần ad-unlock đổi môn học (Feature 015 —
// Free/Premium). Các method khác của UsersService đã tồn tại từ trước Feature
// 015 và không thuộc phạm vi task này. Mock Redis hoàn toàn, không cần Redis thật.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../lib/redis.js', () => ({
  redis: {
    set: vi.fn(),
    del: vi.fn(),
  },
}));

import { redis } from '../../../lib/redis.js';
import { UsersService } from '../users.service.js';

const redisMock = redis as unknown as {
  set: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
};

const usersService = new UsersService();

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
