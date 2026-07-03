// Types va DTOs cho Ngan hang cau hoi (Question Bank).
// Tach rieng khoi exam.types.ts de tranh coupling voi module Thi thu chinh.

import type { Prisma } from '@prisma/client';
import type { ExamQuestionType } from './exam.types.js';

// ---------------------------------------------------------------------------
// DTO: Ngan hang cau hoi
// ---------------------------------------------------------------------------

/** Tom tat 1 cau hoi trong kho (danh sach). */
export interface QuestionBankSummaryDto {
  id: string;
  subject: string;
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

/** Ket qua phan trang danh sach kho cau hoi. */
export interface QuestionBankListResult {
  items: QuestionBankSummaryDto[];
  total: number;
  page: number;
  pageSize: number;
}

/** Thong tin su dung cua 1 cau hoi trong kho (dung truoc khi xoa). */
export interface QuestionBankUsageDto {
  examPapers: Array<{
    paperId: string;
    paperTitle: string;
    subject: string;
    isActive: boolean;
    hasActiveSession: boolean;
  }>;
  totalExamPapers: number;
  hasActiveSession: boolean;
}

// ---------------------------------------------------------------------------
// Input: Admin tao/sua cau hoi trong kho
// ---------------------------------------------------------------------------

/** Input tao moi cau hoi trong kho. */
export interface CreateQuestionBankInput {
  subject: string;
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

/** Input cap nhat cau hoi trong kho — moi truong deu tuy chon. */
export type UpdateQuestionBankInput = Partial<CreateQuestionBankInput> & { isActive?: boolean };

/** Bo loc khi lay danh sach kho cau hoi. */
export interface QuestionBankFilter {
  subject?: string;
  chapter?: string;
  difficulty?: number;
  search?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

/** Input them nhieu cau tu kho vao de thi. */
export interface AddFromBankInput {
  questionBankIds: string[];
}

/** Ket qua them cau tu kho vao de thi. */
export interface AddFromBankResult {
  added: number;
  skipped: number;
}

/** Input lay cau tu kho tu dong theo ti le do kho. */
export interface AutoFillFromBankInput {
  /** So luong cau hoi can lay (tong). */
  count: number;
}

/** Ket qua lay cau tu dong (mo rong AddFromBankResult de ro rang hon). */
export interface AutoFillFromBankResult extends AddFromBankResult {
  /** So cau khong du trong kho theo tung do kho. */
  shortage: number;
}
