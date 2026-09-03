import { describe, it, expect } from 'vitest';
import { SUBMISSION_STATUS_LABEL } from '../submissionsConstants.js';

describe('SUBMISSION_STATUS_LABEL', () => {
  it('có đủ 3 trạng thái', () => {
    expect(Object.keys(SUBMISSION_STATUS_LABEL)).toHaveLength(3);
  });

  it('PENDING có nhãn', () => {
    expect(typeof SUBMISSION_STATUS_LABEL['PENDING']).toBe('string');
    expect(SUBMISSION_STATUS_LABEL['PENDING'].length).toBeGreaterThan(0);
  });

  it('APPROVED có nhãn', () => {
    expect(typeof SUBMISSION_STATUS_LABEL['APPROVED']).toBe('string');
    expect(SUBMISSION_STATUS_LABEL['APPROVED'].length).toBeGreaterThan(0);
  });

  it('REJECTED có nhãn', () => {
    expect(typeof SUBMISSION_STATUS_LABEL['REJECTED']).toBe('string');
    expect(SUBMISSION_STATUS_LABEL['REJECTED'].length).toBeGreaterThan(0);
  });

  it('3 nhãn khác nhau', () => {
    const labels = Object.values(SUBMISSION_STATUS_LABEL);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
