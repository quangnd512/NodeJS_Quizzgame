// Cac kieu du lieu (types/interfaces) va hang so dung chung cho module Thi thu.
// Tach rieng de cac route handler co the import ma khong phu thuoc vao service logic.

import type { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Hang so nghiep vu
// ---------------------------------------------------------------------------

/** So diem tru khi vao thi thu - dung voi PointReason.THI_THU_ENTRY_FEE. */
export const EXAM_ENTRY_FEE = 60;

/** So giay "an toan" cong them sau khi het gio lam bai, truoc khi tinh la EXPIRED. */
export const EXAM_GRACE_SECONDS = 30;

/**
 * Ti le thoi gian toi thieu can lam bai truoc khi duoc phep nop.
 * Vi du: de 60 phut → phai lam it nhat 60 * 0.3 = 18 phut moi duoc nop.
 */
export const EXAM_MIN_SUBMIT_RATIO = 0.3;

/** Cac dang cau hoi thi thu hop le. */
export const EXAM_QUESTION_TYPES = ['MCQ_4', 'TRUE_FALSE_4', 'FILL_BLANK'] as const;
export type ExamQuestionType = (typeof EXAM_QUESTION_TYPES)[number];

/**
 * Cac trang thai phien thi thu hop le.
 * - IN_PROGRESS: dang lam bai
 * - COMPLETED: da nop bai, da cham diem
 * - EXPIRED: qua gio nop bai, khong duoc cham diem
 * - ABANDONED: nguoi dung chu dong huy phien (nhan nut Thoat va xac nhan)
 */
export const EXAM_SESSION_STATUSES = ['IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'ABANDONED'] as const;
export type ExamSessionStatus = (typeof EXAM_SESSION_STATUSES)[number];

/**
 * Bang ti le diem cho dang TRUE_FALSE_4 - chi so la SO Y DUNG (0-4),
 * gia tri la TI LE diem dat duoc tren tong diem cau hoi.
 * Vi du: dung 2/4 y -> pointsEarned = points * 0.25.
 */
export const TRUE_FALSE_SCORE_RATIOS: readonly number[] = [0, 0.1, 0.25, 0.5, 1];

/**
 * Tinh so diem tich luy duoc THUONG THEM theo ket qua thi thu (PointReason.THI_THU_RESULT).
 *
 * | Diem (thang 10) | Diem thuong |
 * |------------------|-------------|
 * | < 7.0            | 0           |
 * | 7.0 - 7.9        | 10          |
 * | 8.0 - 8.9        | 20          |
 * | 9.0 - 9.9        | 50          |
 * | 10.0             | 120         |
 *
 * QUAN TRONG: khi ket qua tra ve 0, caller KHONG duoc goi `pointsService.addPoints`
 * (ham nay yeu cau amount > 0, nem InvalidPointsAmountError neu amount <= 0)
 * - chi ghi `score`/`pointsAwarded = 0` vao ExamSession.
 */
export function getExamBonusPoints(score: number): number {
  if (score >= 10) return 120;
  if (score >= 9) return 50;
  if (score >= 8) return 20;
  if (score >= 7) return 10;
  return 0;
}

// ---------------------------------------------------------------------------
// DTO: De thi & cau hoi (Admin)
// ---------------------------------------------------------------------------

/** Tom tat 1 de thi (danh sach - admin). */
export interface ExamPaperSummaryDto {
  id: string;
  subject: string;
  title: string;
  durationMinutes: number;
  isActive: boolean;
  /** So cau hoi DANG KICH HOAT trong de. */
  questionCount: number;
  createdAt: Date;
}

/** Chi tiet 1 de thi - kem danh sach cau hoi DAY DU (admin, co dap an dung). */
export interface ExamPaperDetailDto extends ExamPaperSummaryDto {
  questions: ExamQuestionFullDto[];
}

/** Cau hoi day du (danh cho admin - CO dap an dung + giai thich). */
export interface ExamQuestionFullDto {
  id: string;
  examPaperId: string;
  chapter: string | null;
  difficulty: number;
  questionType: ExamQuestionType;
  points: number;
  questionText: string;
  options: Prisma.JsonValue | null;
  correctAnswer: Prisma.JsonValue;
  explanation: string | null;
  examYear: number | null;
  examCode: string | null;
  isActive: boolean;
  createdAt: Date;
}

/** Cau hoi cong khai (danh cho hoc sinh dang lam bai - AN dap an dung + giai thich). */
export interface ExamQuestionPublicDto {
  id: string;
  chapter: string | null;
  difficulty: number;
  questionType: ExamQuestionType;
  points: number;
  questionText: string;
  options: Prisma.JsonValue | null;
}

// ---------------------------------------------------------------------------
// Input: Admin tao/sua de thi + cau hoi
// ---------------------------------------------------------------------------

/** Input tao moi de thi (admin). */
export interface CreateExamPaperInput {
  subject: string;
  title: string;
  durationMinutes: number;
}

/** Input cap nhat de thi (admin) - moi truong deu tuy chon. */
export interface UpdateExamPaperInput {
  title?: string;
  durationMinutes?: number;
  isActive?: boolean;
}

/**
 * Input tao moi/cap nhat 1 cau hoi thi thu (admin hoac import Excel).
 *
 * `options` / `correctAnswer` phai khop voi `questionType`:
 *   - MCQ_4: options = 4 string; correctAnswer = so (0-3)
 *   - TRUE_FALSE_4: options = 4 string (4 phat bieu); correctAnswer = 4 boolean
 *   - FILL_BLANK: options = khong co (undefined); correctAnswer = mang >= 1 string
 */
export interface CreateExamQuestionInput {
  chapter?: string;
  difficulty: number;
  questionType: ExamQuestionType;
  points: number;
  questionText: string;
  options?: string[];
  correctAnswer: unknown;
  explanation?: string;
  examYear?: number;
  examCode?: string;
}

/** Input cap nhat cau hoi thi thu (admin) - moi truong deu tuy chon. */
export type UpdateExamQuestionInput = Partial<CreateExamQuestionInput> & { isActive?: boolean };

// ---------------------------------------------------------------------------
// Response: Hoc sinh lam bai thi thu
// ---------------------------------------------------------------------------

/** Ket qua tra ve khi bat dau phien thi thu (POST /api/exam/start). */
export interface StartExamResponse {
  sessionId: string;
  examPaperId: string;
  subject: string;
  title: string;
  durationMinutes: number;
  startedAt: Date;
  questions: ExamQuestionPublicDto[];
}

/** 1 cau tra loi user gui khi nop bai. */
export interface SubmitExamAnswerInput {
  examQuestionId: string;
  /**
   * Dap an da chon, theo tung dang:
   *   - MCQ_4: so (0-3)
   *   - TRUE_FALSE_4: mang 4 boolean
   *   - FILL_BLANK: string
   */
  selectedAnswer: unknown;
}

/**
 * Ket qua tra ve sau khi nop bai (POST /api/exam/submit).
 * CHI gom diem so + diem thuong - KHONG de cap den 60 diem da tru khi vao thi.
 */
export interface SubmitExamResponse {
  sessionId: string;
  /** Diem so theo thang 10 (1 chu so thap phan). */
  score: number;
  /** So diem tich luy duoc thuong (0 neu score < 7.0). */
  pointsAwarded: number;
}

/** Phan tich ket qua theo 1 chuong/chu de (GET /api/exam/:id/result). */
export interface ExamChapterAnalysis {
  /** Ten chuong - "Khac" neu cau hoi khong gan chuong. */
  chapter: string;
  /** So cau lam DUNG HOAN TOAN (dat tron diem) trong chuong nay. */
  correctCount: number;
  /** Tong so cau trong chuong nay. */
  totalCount: number;
  /** Tong diem dat duoc trong chuong nay. */
  pointsEarned: number;
  /** Tong diem toi da co the dat trong chuong nay. */
  pointsTotal: number;
}

/** 1 cau lam sai/chua dat tron diem - kem giai thich (GET /api/exam/:id/result). */
export interface ExamWrongAnswerItem {
  examQuestionId: string;
  questionText: string;
  questionType: ExamQuestionType;
  chapter: string | null;
  options: Prisma.JsonValue | null;
  /**
   * Dap an dung cua cau hoi.
   * null khi cau bi bo trang (selectedAnswer la sentinel {} - hoc sinh chua tra loi).
   * Frontend hien thi "Ban chua tra loi cau nay" thay vi dap an dung.
   */
  correctAnswer: Prisma.JsonValue | null;
  selectedAnswer: Prisma.JsonValue;
  explanation: string | null;
  points: number;
  pointsEarned: number;
}

/**
 * Ket qua chi tiet 1 phien thi thu (GET /api/exam/:id/result).
 * CHI gom diem so + diem thuong - KHONG de cap den 60 diem da tru khi vao thi.
 */
export interface ExamResultResponse {
  sessionId: string;
  status: ExamSessionStatus;
  score: number;
  pointsAwarded: number;
  totalQuestions: number;
  chapterAnalysis: ExamChapterAnalysis[];
  wrongAnswers: ExamWrongAnswerItem[];
}

// ---------------------------------------------------------------------------
// Excel import (admin)
// ---------------------------------------------------------------------------

/** 1 dong loi khi import Excel - bao loi theo so dong cu the trong file. */
export interface ExamImportRowError {
  /** So thu tu dong trong file Excel (tinh ca dong header = dong 1). */
  row: number;
  message: string;
}

/** Ket qua import Excel - cho phep THANH CONG MOT PHAN (cac dong loi van duoc bao theo so dong). */
export interface ExamImportResult {
  inserted: number;
  errors: ExamImportRowError[];
}
