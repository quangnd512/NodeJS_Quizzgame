import { describe, it, expect } from 'vitest';
import {
  DIFF_LABEL,
  OPTION_LABELS,
  SESSION_SECONDS,
  REPORT_REASONS,
} from '../practiceConstants.js';

describe('DIFF_LABEL', () => {
  it('có đủ 3 mức độ khó', () => {
    expect(Object.keys(DIFF_LABEL)).toHaveLength(3);
  });

  it('mức 1 là Dễ', () => {
    expect(DIFF_LABEL[1]).toBe('Dễ');
  });

  it('mức 2 là Trung bình', () => {
    expect(DIFF_LABEL[2]).toBe('Trung bình');
  });

  it('mức 3 là Khó', () => {
    expect(DIFF_LABEL[3]).toBe('Khó');
  });
});

describe('OPTION_LABELS', () => {
  it('có đúng 4 nhãn', () => {
    expect(OPTION_LABELS).toHaveLength(4);
  });

  it('nhãn lần lượt là A, B, C, D', () => {
    expect(OPTION_LABELS).toEqual(['A', 'B', 'C', 'D']);
  });
});

describe('SESSION_SECONDS', () => {
  it('bằng 17 phút (1020 giây)', () => {
    expect(SESSION_SECONDS).toBe(17 * 60);
  });
});

describe('REPORT_REASONS', () => {
  it('là mảng không rỗng', () => {
    expect(REPORT_REASONS.length).toBeGreaterThan(0);
  });

  it('mỗi phần tử có value và label', () => {
    for (const r of REPORT_REASONS) {
      expect(typeof r.value).toBe('string');
      expect(typeof r.label).toBe('string');
    }
  });

  it('không có value trùng nhau', () => {
    const values = REPORT_REASONS.map((r) => r.value);
    expect(new Set(values).size).toBe(values.length);
  });
});
