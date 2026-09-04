import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  defaultAnswerFor,
  toSubmitAnswer,
  describeExamAnswer,
  examDraftKey,
  saveDraftAnswers,
  loadDraftAnswers,
  clearDraftAnswers,
} from '../examUtils.js';

// ── defaultAnswerFor ──────────────────────────────────────────────────────────

describe('defaultAnswerFor', () => {
  it('MCQ_4 → -1 (chưa chọn)', () => {
    expect(defaultAnswerFor('MCQ_4')).toBe(-1);
  });

  it('TRUE_FALSE_4 → mảng rỗng', () => {
    expect(defaultAnswerFor('TRUE_FALSE_4')).toEqual([]);
  });

  it('FILL_BLANK → chuỗi rỗng', () => {
    expect(defaultAnswerFor('FILL_BLANK')).toBe('');
  });
});

// ── toSubmitAnswer ────────────────────────────────────────────────────────────

describe('toSubmitAnswer', () => {
  it('MCQ_4 chưa chọn (value = -1) → {}', () => {
    expect(toSubmitAnswer('MCQ_4', -1)).toEqual({});
  });

  it('MCQ_4 đã chọn → trả về index', () => {
    expect(toSubmitAnswer('MCQ_4', 2)).toBe(2);
  });

  it('TRUE_FALSE_4 chưa trả lời (mảng rỗng) → {}', () => {
    expect(toSubmitAnswer('TRUE_FALSE_4', [])).toEqual({});
  });

  it('TRUE_FALSE_4 đã trả lời → giữ nguyên mảng', () => {
    const ans = [true, false, true, true];
    expect(toSubmitAnswer('TRUE_FALSE_4', ans)).toEqual(ans);
  });

  it('FILL_BLANK chuỗi rỗng → {}', () => {
    expect(toSubmitAnswer('FILL_BLANK', '')).toEqual({});
  });

  it('FILL_BLANK đã điền → giữ nguyên chuỗi', () => {
    expect(toSubmitAnswer('FILL_BLANK', 'Hà Nội')).toBe('Hà Nội');
  });
});

// ── describeExamAnswer ────────────────────────────────────────────────────────

describe('describeExamAnswer', () => {
  const opts = ['Alpha', 'Beta', 'Gamma', 'Delta'];

  it('MCQ_4 chưa trả lời → "Chưa trả lời"', () => {
    expect(describeExamAnswer('MCQ_4', opts, {})).toBe('Chưa trả lời');
  });

  it('MCQ_4 chọn đáp án 0 → "A. Alpha"', () => {
    expect(describeExamAnswer('MCQ_4', opts, 0)).toBe('A. Alpha');
  });

  it('MCQ_4 chọn đáp án 2 → "C. Gamma"', () => {
    expect(describeExamAnswer('MCQ_4', opts, 2)).toBe('C. Gamma');
  });

  it('TRUE_FALSE_4 chưa trả lời → "Chưa trả lời"', () => {
    expect(describeExamAnswer('TRUE_FALSE_4', opts, [])).toBe('Chưa trả lời');
  });

  it('TRUE_FALSE_4 đã trả lời → chuỗi Đúng/Sai', () => {
    const result = describeExamAnswer('TRUE_FALSE_4', opts, [true, false, true, false]);
    expect(result).toContain('A: Đúng');
    expect(result).toContain('B: Sai');
  });

  it('FILL_BLANK chuỗi rỗng → "Chưa trả lời"', () => {
    expect(describeExamAnswer('FILL_BLANK', null, '')).toBe('Chưa trả lời');
  });

  it('FILL_BLANK đã điền → trả về chuỗi', () => {
    expect(describeExamAnswer('FILL_BLANK', null, 'Hà Nội')).toBe('Hà Nội');
  });

  it('FILL_BLANK mảng đáp án → join bằng " / "', () => {
    expect(describeExamAnswer('FILL_BLANK', null, ['a', 'b'])).toBe('a / b');
  });
});

// ── examDraftKey ──────────────────────────────────────────────────────────────

describe('examDraftKey', () => {
  it('trả về key có sessionId', () => {
    expect(examDraftKey('abc123')).toContain('abc123');
  });

  it('hai sessionId khác nhau → key khác nhau', () => {
    expect(examDraftKey('id1')).not.toBe(examDraftKey('id2'));
  });
});

// ── localStorage helpers ──────────────────────────────────────────────────────

describe('saveDraftAnswers / loadDraftAnswers / clearDraftAnswers', () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { localStorage.clear(); });

  it('lưu rồi đọc lại đúng dữ liệu', () => {
    const sid = 'test-session-42';
    const answers = new Map<string, unknown>([
      ['q1', 0],
      ['q2', [true, false, true, false]],
      ['q3', 'Hà Nội'],
    ]);
    saveDraftAnswers(sid, answers as never);
    const loaded = loadDraftAnswers(sid);
    expect(loaded.get('q1')).toBe(0);
    expect(loaded.get('q3')).toBe('Hà Nội');
  });

  it('loadDraftAnswers trả về Map rỗng khi chưa có', () => {
    expect(loadDraftAnswers('nonexistent')).toEqual(new Map());
  });

  it('clearDraftAnswers xoá key khỏi localStorage', () => {
    const sid = 'session-clear';
    saveDraftAnswers(sid, new Map([['q1', 1]]));
    clearDraftAnswers(sid);
    expect(loadDraftAnswers(sid)).toEqual(new Map());
  });
});
