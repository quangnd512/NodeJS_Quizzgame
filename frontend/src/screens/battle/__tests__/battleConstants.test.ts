import { describe, it, expect } from 'vitest';
import {
  BATTLE_ACTIVE_MATCH_KEY,
  BATTLE_QUEUE_CRITERIA_LABEL,
  BATTLE_RESULT_LABEL,
  BATTLE_HISTORY_PAGE_SIZE,
  BATTLE_HISTORY_RESULT_LABEL,
} from '../battleConstants.js';

describe('BATTLE_ACTIVE_MATCH_KEY', () => {
  it('là chuỗi không rỗng', () => {
    expect(typeof BATTLE_ACTIVE_MATCH_KEY).toBe('string');
    expect(BATTLE_ACTIVE_MATCH_KEY.length).toBeGreaterThan(0);
  });
});

describe('BATTLE_QUEUE_CRITERIA_LABEL', () => {
  it('có nhãn cho STRICT', () => {
    expect(typeof BATTLE_QUEUE_CRITERIA_LABEL['STRICT']).toBe('string');
  });

  it('có nhãn cho SUBJECT_ONLY', () => {
    expect(typeof BATTLE_QUEUE_CRITERIA_LABEL['SUBJECT_ONLY']).toBe('string');
  });

  it('có nhãn cho ANY', () => {
    expect(typeof BATTLE_QUEUE_CRITERIA_LABEL['ANY']).toBe('string');
  });
});

describe('BATTLE_RESULT_LABEL', () => {
  const cases = ['WIN', 'LOSE', 'DRAW', 'OPPONENT_LEFT_WIN', 'CANCELLED_BOTH_LEFT'] as const;

  it('có đủ 5 kết quả trận đấu', () => {
    expect(Object.keys(BATTLE_RESULT_LABEL)).toHaveLength(5);
  });

  for (const result of cases) {
    it(`${result} có text, icon, cls`, () => {
      const entry = BATTLE_RESULT_LABEL[result];
      expect(typeof entry.text).toBe('string');
      expect(typeof entry.icon).toBe('string');
      expect(typeof entry.cls).toBe('string');
    });
  }
});

describe('BATTLE_HISTORY_PAGE_SIZE', () => {
  it('là số nguyên dương', () => {
    expect(typeof BATTLE_HISTORY_PAGE_SIZE).toBe('number');
    expect(BATTLE_HISTORY_PAGE_SIZE).toBeGreaterThan(0);
  });
});

describe('BATTLE_HISTORY_RESULT_LABEL', () => {
  const keys = ['WIN', 'LOSE', 'DRAW'] as const;

  it('có nhãn cho WIN, LOSE, DRAW', () => {
    expect(Object.keys(BATTLE_HISTORY_RESULT_LABEL)).toHaveLength(3);
  });

  for (const k of keys) {
    it(`${k} có text và cls`, () => {
      expect(typeof BATTLE_HISTORY_RESULT_LABEL[k].text).toBe('string');
      expect(typeof BATTLE_HISTORY_RESULT_LABEL[k].cls).toBe('string');
    });
  }
});
