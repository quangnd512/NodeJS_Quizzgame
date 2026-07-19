// Unit test cho adminUsersService — mock Prisma, Redis, Firebase. Không cần DB thật.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Prisma ────────────────────────────────────────────────────────────
vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    examSession: {
      count: vi.fn(),
      aggregate: vi.fn(),
      findMany: vi.fn(),
    },
    practiceSession: {
      count: vi.fn(),
    },
    examPaper: {
      findMany: vi.fn(),
    },
  },
}));

// ─── Mock Redis ─────────────────────────────────────────────────────────────
vi.mock('../../../lib/redis.js', () => ({
  redis: {
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    scan: vi.fn(),
  },
}));

// ─── Mock Firebase Admin ────────────────────────────────────────────────────
const mockDeleteUser = vi.fn();
const mockGeneratePasswordResetLink = vi.fn();

vi.mock('../../../lib/firebase-admin.js', () => ({
  getFirebaseAuth: () => ({
    deleteUser: mockDeleteUser,
    generatePasswordResetLink: mockGeneratePasswordResetLink,
  }),
}));

// ─── Mock PremiumService (Feature 015) ──────────────────────────────────────
vi.mock('../../premium/premium.service.js', () => ({
  premiumService: {
    grantPremiumMonths: vi.fn(),
  },
}));

// ─── Imports sau khi mock ────────────────────────────────────────────────────
import { prisma } from '../../../lib/prisma.js';
import { redis } from '../../../lib/redis.js';
import { premiumService } from '../../premium/premium.service.js';
import { adminUsersService } from '../admin-users.service.js';
import {
  AdminUserNotFoundError,
  AdminUserNoEmailError,
  AdminInvalidRoleError,
} from '../admin-users.errors.js';

// ─── Typed mock helpers ──────────────────────────────────────────────────────
const prismaMock = prisma as unknown as {
  user: {
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  examSession: {
    count: ReturnType<typeof vi.fn>;
    aggregate: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  practiceSession: { count: ReturnType<typeof vi.fn> };
  examPaper: { findMany: ReturnType<typeof vi.fn> };
};

const redisMock = redis as unknown as {
  scan: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
};

const premiumMock = premiumService as unknown as {
  grantPremiumMonths: ReturnType<typeof vi.fn>;
};

// ─── Fixture user mẫu ────────────────────────────────────────────────────────
const MOCK_USER = {
  id: 'user-1',
  firebaseUid: 'firebase-uid-1',
  displayName: 'Nguyen Van A',
  email: 'a@example.com',
  phone: null,
  school: null,
  province: null,
  subjects: ['TOAN'],
  avatarUrl: null,
  lastLoginAt: null,
  createdAt: new Date('2026-01-01'),
  isBlocked: false,
  role: 'STUDENT',
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── getDashboardStats ────────────────────────────────────────────────────────

describe('getDashboardStats', () => {
  it('✅ Happy: trả đủ 6 trường, tính examPassRate đúng', async () => {
    prismaMock.user.count
      .mockResolvedValueOnce(100)  // totalUsers
      .mockResolvedValueOnce(5)    // newUsersThisWeek
      .mockResolvedValueOnce(20);  // newUsersThisMonth
    prismaMock.examSession.count
      .mockResolvedValueOnce(200)  // totalExamSessions
      .mockResolvedValueOnce(150); // passedExamSessions
    redisMock.scan.mockResolvedValue(['0', ['online:u1', 'online:u2', 'online:u3']]);

    const stats = await adminUsersService.getDashboardStats();

    expect(stats.totalUsers).toBe(100);
    expect(stats.newUsersThisWeek).toBe(5);
    expect(stats.newUsersThisMonth).toBe(20);
    expect(stats.totalExamSessions).toBe(200);
    expect(stats.examPassRate).toBe(75); // 150/200 * 100
    expect(stats.onlineNow).toBe(3);
  });

  it('⚠️ Edge: totalExamSessions=0 → examPassRate=0, không chia cho 0', async () => {
    prismaMock.user.count.mockResolvedValue(0);
    prismaMock.examSession.count.mockResolvedValue(0);
    redisMock.scan.mockResolvedValue(['0', []]);

    const stats = await adminUsersService.getDashboardStats();

    expect(stats.examPassRate).toBe(0);
    expect(stats.onlineNow).toBe(0);
  });

  it('⚠️ Edge: Redis lỗi → onlineNow=0, không crash service', async () => {
    prismaMock.user.count.mockResolvedValue(10);
    prismaMock.examSession.count.mockResolvedValue(5);
    redisMock.scan.mockRejectedValue(new Error('Redis connection refused'));

    const stats = await adminUsersService.getDashboardStats();

    expect(stats.onlineNow).toBe(0);
  });
});

// ─── listUsers ────────────────────────────────────────────────────────────────

describe('listUsers', () => {
  const mockUsers = [MOCK_USER];

  it('✅ Happy: trả danh sách đúng format, tính totalPages', async () => {
    prismaMock.user.findMany.mockResolvedValue(mockUsers);
    prismaMock.user.count.mockResolvedValue(1);

    const result = await adminUsersService.listUsers({
      page: 1,
      limit: 20,
    });

    expect(result.users).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.users[0]!.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO string
  });

  it('⚠️ Edge: total=0 → totalPages=1 (không trả về 0)', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.user.count.mockResolvedValue(0);

    const result = await adminUsersService.listUsers({ page: 1, limit: 20 });

    expect(result.totalPages).toBe(1);
    expect(result.total).toBe(0);
    expect(result.users).toHaveLength(0);
  });

  it('⚠️ Edge: phân trang đúng — page 2, limit 5, total 12 → totalPages 3', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.user.count.mockResolvedValue(12);

    const result = await adminUsersService.listUsers({ page: 2, limit: 5 });

    expect(result.totalPages).toBe(3); // ceil(12/5)=3
    expect(result.page).toBe(2);
  });

  it('✅ Happy: filter search + role + isBlocked truyền đúng vào where', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.user.count.mockResolvedValue(0);

    await adminUsersService.listUsers({
      search: 'nguyen',
      role: 'ADMIN',
      isBlocked: true,
      page: 1,
      limit: 20,
    });

    const whereArg = prismaMock.user.findMany.mock.calls[0]![0].where;
    expect(whereArg.OR).toBeDefined(); // search filter
    expect(whereArg.role).toBe('ADMIN');
    expect(whereArg.isBlocked).toBe(true);
  });
});

// ─── getUserDetail ────────────────────────────────────────────────────────────

describe('getUserDetail', () => {
  it('✅ Happy: trả đủ user, stats, recentExams với title từ examPaper', async () => {
    prismaMock.user.findUnique.mockResolvedValue(MOCK_USER);
    prismaMock.practiceSession.count.mockResolvedValue(10);
    prismaMock.examSession.aggregate.mockResolvedValue({
      _count: { id: 3 },
      _avg: { score: 7.5 },
    });
    prismaMock.examSession.findMany.mockResolvedValue([
      { id: 'es-1', examPaperId: 'ep-1', score: 8.0, status: 'COMPLETED', completedAt: new Date() },
    ]);
    prismaMock.examPaper.findMany.mockResolvedValue([
      { id: 'ep-1', title: 'Đề thi Toán 2026' },
    ]);

    const detail = await adminUsersService.getUserDetail('user-1');

    expect(detail.user.id).toBe('user-1');
    expect(detail.stats.totalPracticeSessions).toBe(10);
    expect(detail.stats.totalExamSessions).toBe(3);
    expect(detail.stats.avgExamScore).toBe(7.5);
    expect(detail.recentExams[0]!.examPaperTitle).toBe('Đề thi Toán 2026');
  });

  it('⚠️ Edge: examPaper đã bị xoá → title hiển thị fallback', async () => {
    prismaMock.user.findUnique.mockResolvedValue(MOCK_USER);
    prismaMock.practiceSession.count.mockResolvedValue(0);
    prismaMock.examSession.aggregate.mockResolvedValue({
      _count: { id: 1 },
      _avg: { score: null },
    });
    prismaMock.examSession.findMany.mockResolvedValue([
      { id: 'es-1', examPaperId: 'ep-deleted', score: null, status: 'EXPIRED', completedAt: null },
    ]);
    prismaMock.examPaper.findMany.mockResolvedValue([]); // examPaper đã bị xoá

    const detail = await adminUsersService.getUserDetail('user-1');

    expect(detail.recentExams[0]!.examPaperTitle).toBe('(Đề thi đã bị xoá)');
    expect(detail.stats.avgExamScore).toBeNull();
  });

  it('⚠️ Edge: user không có phiên thi nào → recentExams=[], stats đúng', async () => {
    prismaMock.user.findUnique.mockResolvedValue(MOCK_USER);
    prismaMock.practiceSession.count.mockResolvedValue(5);
    prismaMock.examSession.aggregate.mockResolvedValue({
      _count: { id: 0 },
      _avg: { score: null },
    });
    prismaMock.examSession.findMany.mockResolvedValue([]);
    prismaMock.examPaper.findMany.mockResolvedValue([]);

    const detail = await adminUsersService.getUserDetail('user-1');

    expect(detail.recentExams).toHaveLength(0);
    expect(detail.stats.totalExamSessions).toBe(0);
  });

  it('❌ Error: user không tồn tại → AdminUserNotFoundError', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(adminUsersService.getUserDetail('no-such-id'))
      .rejects.toThrow(AdminUserNotFoundError);
  });
});

// ─── setUserBlocked ───────────────────────────────────────────────────────────

describe('setUserBlocked', () => {
  it('✅ Happy: khoá user thành công', async () => {
    prismaMock.user.findUnique.mockResolvedValue(MOCK_USER);
    prismaMock.user.update.mockResolvedValue({ id: 'user-1', isBlocked: true });

    const result = await adminUsersService.setUserBlocked('user-1', true);

    expect(result.isBlocked).toBe(true);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isBlocked: true } }),
    );
  });

  it('✅ Happy: mở khoá → gọi redis.del để xoá key online', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...MOCK_USER, isBlocked: true });
    prismaMock.user.update.mockResolvedValue({ id: 'user-1', isBlocked: false });

    await adminUsersService.setUserBlocked('user-1', false);

    expect(redisMock.del).toHaveBeenCalledWith('online:user-1');
  });

  it('⚠️ Edge: khoá user → KHÔNG gọi redis.del (chỉ mở khoá mới xoá key)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(MOCK_USER);
    prismaMock.user.update.mockResolvedValue({ id: 'user-1', isBlocked: true });

    await adminUsersService.setUserBlocked('user-1', true);

    expect(redisMock.del).not.toHaveBeenCalled();
  });

  it('❌ Error: user không tồn tại → AdminUserNotFoundError', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(adminUsersService.setUserBlocked('no-such-id', true))
      .rejects.toThrow(AdminUserNotFoundError);
  });
});

// ─── resetUserPassword ────────────────────────────────────────────────────────

describe('resetUserPassword', () => {
  it('✅ Happy: user có email → trả về resetLink từ Firebase', async () => {
    prismaMock.user.findUnique.mockResolvedValue(MOCK_USER);
    mockGeneratePasswordResetLink.mockResolvedValue('https://firebase.link/reset?oob=xxx');

    const result = await adminUsersService.resetUserPassword('user-1');

    expect(result.resetLink).toBe('https://firebase.link/reset?oob=xxx');
    expect(mockGeneratePasswordResetLink).toHaveBeenCalledWith('a@example.com');
  });

  it('❌ Error: user không có email → AdminUserNoEmailError', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...MOCK_USER, email: null });

    await expect(adminUsersService.resetUserPassword('user-1'))
      .rejects.toThrow(AdminUserNoEmailError);
    expect(mockGeneratePasswordResetLink).not.toHaveBeenCalled();
  });

  it('❌ Error: user không tồn tại → AdminUserNotFoundError', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(adminUsersService.resetUserPassword('no-such-id'))
      .rejects.toThrow(AdminUserNotFoundError);
  });
});

// ─── setUserRole ──────────────────────────────────────────────────────────────

describe('setUserRole', () => {
  it('✅ Happy: đổi STUDENT → ADMIN', async () => {
    prismaMock.user.findUnique.mockResolvedValue(MOCK_USER);
    prismaMock.user.update.mockResolvedValue({ id: 'user-1', role: 'ADMIN' });

    const result = await adminUsersService.setUserRole('user-1', 'ADMIN');

    expect(result.role).toBe('ADMIN');
  });

  it('✅ Happy: đổi ADMIN → STUDENT', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...MOCK_USER, role: 'ADMIN' });
    prismaMock.user.update.mockResolvedValue({ id: 'user-1', role: 'STUDENT' });

    const result = await adminUsersService.setUserRole('user-1', 'STUDENT');

    expect(result.role).toBe('STUDENT');
  });

  it('❌ Error: role không hợp lệ → AdminInvalidRoleError', async () => {
    await expect(adminUsersService.setUserRole('user-1', 'SUPERADMIN'))
      .rejects.toThrow(AdminInvalidRoleError);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('❌ Error: user không tồn tại → AdminUserNotFoundError', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(adminUsersService.setUserRole('no-such-id', 'ADMIN'))
      .rejects.toThrow(AdminUserNotFoundError);
  });
});

// ─── deleteUser ───────────────────────────────────────────────────────────────

describe('deleteUser', () => {
  it('✅ Happy: xoá Firebase + DB + Redis cleanup thành công', async () => {
    prismaMock.user.findUnique.mockResolvedValue(MOCK_USER);
    mockDeleteUser.mockResolvedValue(undefined);
    prismaMock.user.delete.mockResolvedValue(MOCK_USER);

    const result = await adminUsersService.deleteUser('user-1');

    expect(mockDeleteUser).toHaveBeenCalledWith('firebase-uid-1');
    expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    expect(redisMock.del).toHaveBeenCalledWith('online:user-1');
    expect(result.message).toContain('Nguyen Van A');
  });

  it('⚠️ Edge: DB xoá lỗi sau khi Firebase đã xoá → vẫn trả success + ghi log', async () => {
    prismaMock.user.findUnique.mockResolvedValue(MOCK_USER);
    mockDeleteUser.mockResolvedValue(undefined);
    prismaMock.user.delete.mockRejectedValue(new Error('DB connection failed'));

    // Không throw — vẫn trả success
    const result = await adminUsersService.deleteUser('user-1');

    expect(result.message).toBeDefined();
    // Firebase vẫn được gọi
    expect(mockDeleteUser).toHaveBeenCalled();
    // Redis cleanup vẫn được gọi
    expect(redisMock.del).toHaveBeenCalled();
  });

  it('⚠️ Edge: displayName=null → message dùng userId làm fallback', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...MOCK_USER, displayName: null });
    mockDeleteUser.mockResolvedValue(undefined);
    prismaMock.user.delete.mockResolvedValue({});

    const result = await adminUsersService.deleteUser('user-1');

    expect(result.message).toContain('user-1');
  });

  it('❌ Error: user không tồn tại → AdminUserNotFoundError', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(adminUsersService.deleteUser('no-such-id'))
      .rejects.toThrow(AdminUserNotFoundError);
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });
});

// ─── grantPremium (Feature 015 — Free/Premium) ───────────────────────────────

describe('grantPremium', () => {
  it('✅ Happy: fetch user rồi giao cho premiumService.grantPremiumMonths, trả về dạng ISO string', async () => {
    const userWithPremiumFields = {
      ...MOCK_USER,
      premiumExpiresAt: null,
      premiumSince: null,
      premiumExpiryWarnedAt: null,
    };
    prismaMock.user.findUnique.mockResolvedValue(userWithPremiumFields);
    premiumMock.grantPremiumMonths.mockResolvedValue({
      id: 'user-1',
      premiumExpiresAt: new Date('2026-04-01T00:00:00.000Z'),
      premiumSince: new Date('2026-01-01T00:00:00.000Z'),
      streakFreezeReset: true,
    });

    const result = await adminUsersService.grantPremium('user-1', 3);

    // Truyen `userId` (KHONG truyen thang object `user` da fetch) - premiumService
    // tu fetch lai ben trong de tranh race condition (xem premium.service.ts).
    expect(premiumMock.grantPremiumMonths).toHaveBeenCalledWith('user-1', 3);
    expect(result).toEqual({
      id: 'user-1',
      premiumExpiresAt: '2026-04-01T00:00:00.000Z',
      premiumSince: '2026-01-01T00:00:00.000Z',
      streakFreezeReset: true,
    });
  });

  it('❌ Error: user không tồn tại → AdminUserNotFoundError, KHÔNG gọi premiumService', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(adminUsersService.grantPremium('no-such-id', 3))
      .rejects.toThrow(AdminUserNotFoundError);
    expect(premiumMock.grantPremiumMonths).not.toHaveBeenCalled();
  });
});
