import type { SubmissionStatus } from '../lib/api.js';

export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  PENDING:  '🟡 Chờ duyệt',
  APPROVED: '✅ Đã duyệt',
  REJECTED: '❌ Từ chối',
};
