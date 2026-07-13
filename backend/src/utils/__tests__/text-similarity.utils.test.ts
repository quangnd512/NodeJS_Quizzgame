// Unit test cho text-similarity.utils.ts — hàm so khớp trùng lặp câu hỏi (Jaccard
// similarity trên tập từ đã chuẩn hoá). Test riêng normalizeText + textSimilarity
// vì đây là logic thuần (pure function), không phụ thuộc DB — dễ test đầy đủ edge case.
import { describe, it, expect } from 'vitest';
import { normalizeText, textSimilarity } from '../text-similarity.utils.js';

describe('normalizeText', () => {
  it('✅ bỏ dấu tiếng Việt + hạ chữ thường', () => {
    expect(normalizeText('Thủ đô của Việt Nam là gì?')).toBe('thu do cua viet nam la gi');
  });

  it('✅ xử lý đúng chữ "đ" (không tách dấu qua NFD như ký tự khác)', () => {
    expect(normalizeText('Đây là ĐÁP ÁN đúng')).toBe('day la dap an dung');
  });

  it('⚠️ edge case: bỏ ký tự đặc biệt/dấu câu, gộp khoảng trắng thừa', () => {
    expect(normalizeText('  A, B!!  C?  ')).toBe('a b c');
  });

  it('⚠️ edge case: chuỗi rỗng trả về chuỗi rỗng', () => {
    expect(normalizeText('')).toBe('');
  });
});

describe('textSimilarity', () => {
  it('✅ 2 câu giống hệt nhau → similarity = 1.0', () => {
    expect(textSimilarity('2 cộng 2 bằng mấy?', '2 cộng 2 bằng mấy?')).toBe(1);
  });

  it('✅ 2 câu chỉ khác dấu câu/khoảng trắng vẫn coi là trùng (sau chuẩn hoá)', () => {
    expect(textSimilarity('Thủ đô của Việt Nam?', 'thu do cua viet nam')).toBe(1);
  });

  it('✅ 2 câu hoàn toàn khác nhau → similarity thấp (dưới ngưỡng 0.6)', () => {
    const s = textSimilarity('Thủ đô của Việt Nam là gì?', 'Phương trình bậc hai có bao nhiêu nghiệm?');
    expect(s).toBeLessThan(0.6);
  });

  it('⚠️ edge case: 1 trong 2 chuỗi rỗng (hoặc chỉ toàn ký tự đặc biệt) → similarity = 0', () => {
    expect(textSimilarity('', 'Một câu hỏi bất kỳ')).toBe(0);
    expect(textSimilarity('!!!???', 'Một câu hỏi bất kỳ')).toBe(0);
  });

  it('⚠️ edge case: cả 2 chuỗi đều rỗng → similarity = 0 (không chia cho 0)', () => {
    expect(textSimilarity('', '')).toBe(0);
  });

  it('✅ so khớp không phân biệt hoa/thường và thứ tự từ (dùng tập hợp, không phải câu nguyên văn)', () => {
    expect(textSimilarity('Việt Nam Thủ đô', 'thủ đô việt nam')).toBe(1);
  });
});
