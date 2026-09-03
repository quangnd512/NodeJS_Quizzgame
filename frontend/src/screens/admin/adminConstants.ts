import type { SubmissionStatus, ExamQuestionType } from '../../lib/api.js';
import { REPORT_REASONS } from '../practice/practiceConstants.js';

export const ADMIN_PAGE_SIZE = 20;

export const REPORT_STATUS_LABEL: Record<string, string> = {
  PENDING:   'Chờ xử lý',
  REVIEWED:  'Đã xem',
  FIXED:     'Đã sửa',
  DISMISSED: 'Đã bỏ qua',
};

export const REPORT_REASON_LABEL: Record<string, string> = Object.fromEntries(
  REPORT_REASONS.map((r) => [r.value, r.label]),
);

export const ADMIN_SUBMISSION_STATUSES: SubmissionStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

export const QUESTION_TYPE_LABEL: Record<ExamQuestionType, string> = {
  MCQ_4: 'Trắc nghiệm 4 đáp án',
  TRUE_FALSE_4: 'Đúng/Sai 4 ý',
  FILL_BLANK: 'Điền đáp án',
};

export const QB_PAGE_SIZE = 20;

export const USERS_PAGE_SIZE = 10;
