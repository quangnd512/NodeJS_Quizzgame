// Types cho Admin User Management service.

export interface AdminUserListItem {
  id: string;
  displayName: string | null;
  email: string | null;
  role: string;
  isBlocked: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  avatarUrl: string | null;
}

export interface AdminUserListResult {
  users: AdminUserListItem[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AdminUserStats {
  totalPracticeSessions: number;
  totalExamSessions: number;
  avgExamScore: number | null;
}

export interface AdminUserRecentExam {
  id: string;
  examPaperTitle: string;
  score: number | null;
  status: string;
  completedAt: string | null;
}

export interface AdminUserDetail {
  user: {
    id: string;
    displayName: string | null;
    email: string | null;
    phone: string | null;
    school: string | null;
    province: string | null;
    role: string;
    isBlocked: boolean;
    createdAt: string;
    lastLoginAt: string | null;
    avatarUrl: string | null;
    subjects: string[];
  };
  stats: AdminUserStats;
  recentExams: AdminUserRecentExam[];
}

export interface DashboardStats {
  totalUsers: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  totalExamSessions: number;
  examPassRate: number;
  onlineNow: number;
}

export interface AdminListUsersQuery {
  search?: string;
  role?: string;
  isBlocked?: boolean;
  page: number;
  limit: number;
}

export const VALID_ROLES = ['STUDENT', 'ADMIN'] as const;
export type UserRole = (typeof VALID_ROLES)[number];
