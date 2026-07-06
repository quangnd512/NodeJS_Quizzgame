// Service xu ly cac nghiep vu quan tri nguoi dung (Admin User Management).
// Cung cap: thong ke dashboard, danh sach user, chi tiet user,
// khoa/mo tai khoan, doi quyen, dat lai mat khau, xoa tai khoan.

import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { getFirebaseAuth } from '../../lib/firebase-admin.js';
import {
  AdminUserNotFoundError,
  AdminUserNoEmailError,
  AdminInvalidRoleError,
} from './admin-users.errors.js';
import type {
  AdminListUsersQuery,
  AdminUserDetail,
  AdminUserListResult,
  DashboardStats,
} from './admin-users.types.js';
import { VALID_ROLES } from './admin-users.types.js';

// Nguong diem de tinh "da qua" ky thi (>= 7.0 theo 10).
const EXAM_PASS_SCORE = 7.0;

// So ky thi gan nhat hien thi trong detail user.
const RECENT_EXAMS_LIMIT = 5;

/**
 * Tra ve cac thong ke tong quan he thong cho dashboard admin.
 * 6 chi so: tong user, user moi tuan/thang, tong phien thi,
 * ty le dau, so user dang online (theo Redis).
 */
async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Chay parallel de giam latency.
  const [
    totalUsers,
    newUsersThisWeek,
    newUsersThisMonth,
    totalExamSessions,
    passedExamSessions,
    onlineNow,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.examSession.count({ where: { status: 'COMPLETED' } }),
    prisma.examSession.count({
      where: { status: 'COMPLETED', score: { gte: EXAM_PASS_SCORE } },
    }),
    countOnlineUsers(),
  ]);

  const examPassRate =
    totalExamSessions > 0
      ? Math.round((passedExamSessions / totalExamSessions) * 100 * 10) / 10
      : 0;

  return {
    totalUsers,
    newUsersThisWeek,
    newUsersThisMonth,
    totalExamSessions,
    examPassRate,
    onlineNow,
  };
}

/**
 * Dem so user "dang online" bang cach scan Redis key pattern "online:*".
 * Tra ve 0 neu Redis khong kha dung.
 */
async function countOnlineUsers(): Promise<number> {
  try {
    let count = 0;
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'online:*', 'COUNT', 100);
      cursor = nextCursor;
      count += keys.length;
    } while (cursor !== '0');
    return count;
  } catch {
    return 0;
  }
}

/**
 * Tra ve danh sach user co ho tro tim kiem, loc va phan trang.
 * search: tim theo displayName hoac email (khong phan biet hoa thuong).
 * role: loc theo role ('STUDENT' | 'ADMIN').
 * isBlocked: loc theo trang thai khoa tai khoan.
 */
async function listUsers(query: AdminListUsersQuery): Promise<AdminUserListResult> {
  const { search, role, isBlocked, page, limit } = query;

  const where = {
    ...(search
      ? {
          OR: [
            { displayName: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(role !== undefined ? { role } : {}),
    ...(isBlocked !== undefined ? { isBlocked } : {}),
  };

  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        isBlocked: true,
        createdAt: true,
        lastLoginAt: true,
        avatarUrl: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  // Toi thieu 1 trang du cho ket qua rong — tranh frontend bi confused voi totalPages=0.
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    users: users.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    })),
    total,
    page,
    totalPages,
  };
}

/**
 * Tra ve thong tin chi tiet mot user kem stats va lich su thi gan nhat.
 */
async function getUserDetail(userId: string): Promise<AdminUserDetail> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AdminUserNotFoundError(userId);

  const [totalPracticeSessions, examAgg, recentExamSessions] = await Promise.all([
    prisma.practiceSession.count({ where: { userId } }),
    prisma.examSession.aggregate({
      where: { userId, status: 'COMPLETED' },
      _count: { id: true },
      _avg: { score: true },
    }),
    prisma.examSession.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: RECENT_EXAMS_LIMIT,
      select: {
        id: true,
        examPaperId: true,
        score: true,
        status: true,
        completedAt: true,
      },
    }),
  ]);

  // Lay ten de thi cho cac phien thi gan nhat (batch query de tranh N+1).
  const examPaperIds = [...new Set(recentExamSessions.map((e) => e.examPaperId))];
  const examPapers = await prisma.examPaper.findMany({
    where: { id: { in: examPaperIds } },
    select: { id: true, title: true },
  });
  const examPaperMap = new Map(examPapers.map((p) => [p.id, p.title]));

  const avgExamScore =
    examAgg._avg.score !== null
      ? Math.round(examAgg._avg.score * 10) / 10
      : null;

  return {
    user: {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      phone: user.phone,
      school: user.school,
      province: user.province,
      role: user.role,
      isBlocked: user.isBlocked,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      avatarUrl: user.avatarUrl,
      subjects: user.subjects,
    },
    stats: {
      totalPracticeSessions,
      totalExamSessions: examAgg._count.id,
      avgExamScore,
    },
    recentExams: recentExamSessions.map((e) => ({
      id: e.id,
      examPaperTitle: examPaperMap.get(e.examPaperId) ?? '(Đề thi đã bị xoá)',
      score: e.score,
      status: e.status,
      completedAt: e.completedAt?.toISOString() ?? null,
    })),
  };
}

/**
 * Khoa hoac mo khoa tai khoan user.
 * isBlocked = true → khoa; false → mo khoa.
 */
async function setUserBlocked(
  userId: string,
  isBlocked: boolean,
): Promise<{ id: string; isBlocked: boolean }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AdminUserNotFoundError(userId);

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isBlocked },
    select: { id: true, isBlocked: true },
  });

  // Neu mo khoa, xoa key online de tranh hien thi nham nguoi bi khoa la online.
  if (!isBlocked) {
    redis.del(`online:${userId}`).catch(() => {});
  }

  return updated;
}

/**
 * Tao link dat lai mat khau qua Firebase Admin SDK.
 * Chi hoat dong neu user co email. Tra ve link de admin gui cho user.
 */
async function resetUserPassword(userId: string): Promise<{ resetLink: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AdminUserNotFoundError(userId);
  if (!user.email) throw new AdminUserNoEmailError();

  const resetLink = await getFirebaseAuth().generatePasswordResetLink(user.email);
  return { resetLink };
}

/**
 * Doi role cua user: 'STUDENT' hoac 'ADMIN'.
 */
async function setUserRole(
  userId: string,
  role: string,
): Promise<{ id: string; role: string }> {
  if (!VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
    throw new AdminInvalidRoleError(role);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AdminUserNotFoundError(userId);

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: { id: true, role: true },
  });

  return updated;
}

/**
 * Xoa hoan toan tai khoan user: xoa Firebase truoc, sau do xoa DB.
 * Neu DB loi sau khi da xoa Firebase: ghi log va van tra success
 * (Firebase user da mat, khong the rollback — chap nhan va log de xu ly thu cong).
 */
async function deleteUser(userId: string): Promise<{ message: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AdminUserNotFoundError(userId);

  // Xoa Firebase truoc.
  // Neu Firebase bao 'auth/user-not-found' (user chi ton tai trong DB, khong co trong Firebase)
  // → log canh bao va van tiep tuc xoa DB. Cac loi khac (network, permission...) → nem ra.
  try {
    await getFirebaseAuth().deleteUser(user.firebaseUid);
  } catch (firebaseErr: unknown) {
    const code = (firebaseErr as { code?: string })?.code;
    if (code !== 'auth/user-not-found') {
      throw firebaseErr;
    }
    console.warn(
      `[AdminUsersService] Firebase user ${user.firebaseUid} khong ton tai (auth/user-not-found), tiep tuc xoa DB.`,
    );
  }

  // Xoa DB — neu loi, ghi log (Firebase da mat, khong rollback duoc).
  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch (dbErr) {
    console.error(
      `[AdminUsersService] Da xoa Firebase user ${user.firebaseUid} nhung KHONG the xoa DB user ${userId}:`,
      dbErr,
    );
    // Van tra success vi Firebase user da bi xoa — user khong the dang nhap lai.
  }

  // Don dep Redis.
  redis.del(`online:${userId}`).catch(() => {});

  return { message: `Da xoa tai khoan nguoi dung '${user.displayName ?? userId}' thanh cong.` };
}

export const adminUsersService = {
  getDashboardStats,
  listUsers,
  getUserDetail,
  setUserBlocked,
  resetUserPassword,
  setUserRole,
  deleteUser,
};
