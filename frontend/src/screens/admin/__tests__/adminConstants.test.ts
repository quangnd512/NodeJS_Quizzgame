import { describe, it, expect } from 'vitest';
import {
  ADMIN_PAGE_SIZE,
  REPORT_STATUS_LABEL,
  REPORT_REASON_LABEL,
  ADMIN_SUBMISSION_STATUSES,
  QUESTION_TYPE_LABEL,
  QB_PAGE_SIZE,
  USERS_PAGE_SIZE,
} from '../adminConstants.js';

describe('page size constants', () => {
  it('ADMIN_PAGE_SIZE là số dương', () => {
    expect(ADMIN_PAGE_SIZE).toBeGreaterThan(0);
  });

  it('QB_PAGE_SIZE là số dương', () => {
    expect(QB_PAGE_SIZE).toBeGreaterThan(0);
  });

  it('USERS_PAGE_SIZE là số dương', () => {
    expect(USERS_PAGE_SIZE).toBeGreaterThan(0);
  });
});

describe('REPORT_STATUS_LABEL', () => {
  it('có nhãn cho PENDING', () => {
    expect(typeof REPORT_STATUS_LABEL['PENDING']).toBe('string');
  });

  it('có nhãn cho FIXED', () => {
    expect(typeof REPORT_STATUS_LABEL['FIXED']).toBe('string');
  });

  it('có nhãn cho DISMISSED', () => {
    expect(typeof REPORT_STATUS_LABEL['DISMISSED']).toBe('string');
  });
});

describe('REPORT_REASON_LABEL', () => {
  it('là object không rỗng', () => {
    expect(Object.keys(REPORT_REASON_LABEL).length).toBeGreaterThan(0);
  });

  it('tất cả giá trị là chuỗi', () => {
    for (const v of Object.values(REPORT_REASON_LABEL)) {
      expect(typeof v).toBe('string');
    }
  });
});

describe('ADMIN_SUBMISSION_STATUSES', () => {
  it('có đúng 3 trạng thái', () => {
    expect(ADMIN_SUBMISSION_STATUSES).toHaveLength(3);
  });

  it('chứa PENDING, APPROVED, REJECTED', () => {
    expect(ADMIN_SUBMISSION_STATUSES).toContain('PENDING');
    expect(ADMIN_SUBMISSION_STATUSES).toContain('APPROVED');
    expect(ADMIN_SUBMISSION_STATUSES).toContain('REJECTED');
  });
});

describe('QUESTION_TYPE_LABEL', () => {
  it('có nhãn cho MCQ_4', () => {
    expect(typeof QUESTION_TYPE_LABEL['MCQ_4']).toBe('string');
  });

  it('có nhãn cho TRUE_FALSE_4', () => {
    expect(typeof QUESTION_TYPE_LABEL['TRUE_FALSE_4']).toBe('string');
  });

  it('có nhãn cho FILL_BLANK', () => {
    expect(typeof QUESTION_TYPE_LABEL['FILL_BLANK']).toBe('string');
  });
});
