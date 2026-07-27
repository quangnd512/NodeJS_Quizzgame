// Unit test cho cac ham thuan cua module Battle: bonus toc do, noi long tieu chi
// ghep tran, xao dap an, sinh ma phong, quyet dinh bot tra loi.
import { describe, expect, it, vi } from 'vitest';
import {
  acceptsCandidate,
  canMatch,
  computeQuestionPoints,
  computeSpeedBonus,
  decideBotAnswer,
  determineOutcome,
  generateRoomCode,
  getQueueCriteria,
  randomBotDelayMs,
  shouldFallbackToBot,
  shuffleOptionsWithAnswer,
} from '../battle.utils.js';
import { BATTLE_QUESTION_TIME_LIMIT_MS } from '../battle.types.js';

describe('getQueueCriteria', () => {
  it('✅ Happy: < 10s -> STRICT', () => {
    expect(getQueueCriteria(0)).toBe('STRICT');
    expect(getQueueCriteria(9.9)).toBe('STRICT');
  });

  it('✅ Happy: 10-20s -> SUBJECT_ONLY', () => {
    expect(getQueueCriteria(10)).toBe('SUBJECT_ONLY');
    expect(getQueueCriteria(19.9)).toBe('SUBJECT_ONLY');
  });

  it('✅ Happy: >= 20s -> ANY', () => {
    expect(getQueueCriteria(20)).toBe('ANY');
    expect(getQueueCriteria(29.9)).toBe('ANY');
  });
});

describe('shouldFallbackToBot', () => {
  it('❌ Error: 29.9s -> false (chua toi 30s)', () => {
    expect(shouldFallbackToBot(29.9)).toBe(false);
  });

  it('✅ Happy: >= 30s -> true', () => {
    expect(shouldFallbackToBot(30)).toBe(true);
    expect(shouldFallbackToBot(45)).toBe(true);
  });
});

describe('acceptsCandidate', () => {
  const self = { subject: 'TOAN', stake: 100 };

  it('STRICT chi chap nhan dung mon + dung cuoc', () => {
    expect(acceptsCandidate('STRICT', self, { subject: 'TOAN', stake: 100 })).toBe(true);
    expect(acceptsCandidate('STRICT', self, { subject: 'TOAN', stake: 200 })).toBe(false);
    expect(acceptsCandidate('STRICT', self, { subject: 'VAN', stake: 100 })).toBe(false);
  });

  it('SUBJECT_ONLY chap nhan dung mon, moi cuoc', () => {
    expect(acceptsCandidate('SUBJECT_ONLY', self, { subject: 'TOAN', stake: 500 })).toBe(true);
    expect(acceptsCandidate('SUBJECT_ONLY', self, { subject: 'VAN', stake: 100 })).toBe(false);
  });

  it('ANY chap nhan tat ca', () => {
    expect(acceptsCandidate('ANY', self, { subject: 'VAN', stake: 500 })).toBe(true);
  });
});

describe('canMatch', () => {
  it('✅ Happy: 2 nguoi cung vao, cung mon+cuoc -> ghep ngay (ca 2 deu STRICT nhung khop nhau)', () => {
    const a = { subject: 'TOAN', stake: 100, waitedSeconds: 1 };
    const b = { subject: 'TOAN', stake: 100, waitedSeconds: 1 };
    expect(canMatch(a, b)).toBe(true);
  });

  it('❌ Error: khac mon, ca 2 deu con STRICT -> khong ghep', () => {
    const a = { subject: 'TOAN', stake: 100, waitedSeconds: 2 };
    const b = { subject: 'VAN', stake: 100, waitedSeconds: 2 };
    expect(canMatch(a, b)).toBe(false);
  });

  it('Bien: 1 ben da noi long (ANY) nhung ben kia van STRICT va khac mon -> KHONG ghep (ben STRICT tu choi)', () => {
    const a = { subject: 'TOAN', stake: 100, waitedSeconds: 25 }; // ANY
    const b = { subject: 'VAN', stake: 200, waitedSeconds: 2 }; // STRICT
    expect(canMatch(a, b)).toBe(false);
  });

  it('✅ Happy: ca 2 deu da noi long toi SUBJECT_ONLY, cung mon khac cuoc -> ghep', () => {
    const a = { subject: 'TOAN', stake: 100, waitedSeconds: 12 };
    const b = { subject: 'TOAN', stake: 500, waitedSeconds: 15 };
    expect(canMatch(a, b)).toBe(true);
  });

  it('✅ Happy: ca 2 deu ANY, khac mon khac cuoc -> ghep', () => {
    const a = { subject: 'TOAN', stake: 100, waitedSeconds: 25 };
    const b = { subject: 'VAN', stake: 500, waitedSeconds: 22 };
    expect(canMatch(a, b)).toBe(true);
  });
});

describe('computeSpeedBonus', () => {
  it('✅ Happy: tra loi ngay lap tuc (0ms) -> bonus toi da (3)', () => {
    expect(computeSpeedBonus(0, BATTLE_QUESTION_TIME_LIMIT_MS)).toBe(3);
  });

  it('✅ Happy: tra loi luc con 1 chut thoi gian (19.9s/20s) -> bonus 0', () => {
    expect(computeSpeedBonus(19_900, BATTLE_QUESTION_TIME_LIMIT_MS)).toBe(0);
  });

  it('❌ Error: tra loi dung luc het gio (20000ms) -> bonus 0', () => {
    expect(computeSpeedBonus(20_000, BATTLE_QUESTION_TIME_LIMIT_MS)).toBe(0);
  });

  it('❌ Error: qua gio (25000ms, vuot timeLimit) -> bonus 0 (khong am)', () => {
    expect(computeSpeedBonus(25_000, BATTLE_QUESTION_TIME_LIMIT_MS)).toBe(0);
  });

  it('Bien: elapsedMs am (du khong nen xay ra) -> khong crash, coi nhu 0ms -> bonus toi da', () => {
    expect(computeSpeedBonus(-500, BATTLE_QUESTION_TIME_LIMIT_MS)).toBe(3);
  });

  it('phan bo deu theo 4 bac (0-3), moi bac ~5s: [0-5000]=3, (5000-10000]=2, (10000-15000]=1, (15000-20000)=0', () => {
    expect(computeSpeedBonus(0, BATTLE_QUESTION_TIME_LIMIT_MS)).toBe(3);
    expect(computeSpeedBonus(5_000, BATTLE_QUESTION_TIME_LIMIT_MS)).toBe(3);
    expect(computeSpeedBonus(5_001, BATTLE_QUESTION_TIME_LIMIT_MS)).toBe(2);
    expect(computeSpeedBonus(10_000, BATTLE_QUESTION_TIME_LIMIT_MS)).toBe(2);
    expect(computeSpeedBonus(10_001, BATTLE_QUESTION_TIME_LIMIT_MS)).toBe(1);
    expect(computeSpeedBonus(15_000, BATTLE_QUESTION_TIME_LIMIT_MS)).toBe(1);
    expect(computeSpeedBonus(15_001, BATTLE_QUESTION_TIME_LIMIT_MS)).toBe(0);
    expect(computeSpeedBonus(19_999, BATTLE_QUESTION_TIME_LIMIT_MS)).toBe(0);
  });

  it('Bien: bonus KHONG BAO GIO tang khi thoi gian tra loi tang (don dieu giam)', () => {
    const samples = [0, 1000, 4999, 5000, 5001, 9999, 15000, 15001, 19999, 20000];
    const bonuses = samples.map((ms) => computeSpeedBonus(ms, BATTLE_QUESTION_TIME_LIMIT_MS));
    for (let i = 1; i < bonuses.length; i++) {
      expect(bonuses[i]).toBeLessThanOrEqual(bonuses[i - 1]!);
    }
  });
});

describe('computeQuestionPoints', () => {
  it('❌ Error: tra loi SAI -> 0 diem du tra loi rat nhanh', () => {
    expect(computeQuestionPoints(false, 0, BATTLE_QUESTION_TIME_LIMIT_MS)).toBe(0);
  });

  it('✅ Happy: tra loi DUNG ngay lap tuc -> 10 co ban + 3 bonus = 13', () => {
    expect(computeQuestionPoints(true, 0, BATTLE_QUESTION_TIME_LIMIT_MS)).toBe(13);
  });

  it('✅ Happy: tra loi DUNG nhung sat gio -> 10 co ban + 0 bonus = 10', () => {
    expect(computeQuestionPoints(true, 19_999, BATTLE_QUESTION_TIME_LIMIT_MS)).toBe(10);
  });

  it('🔒 Security: clientTimeMs gia mao KHONG anh huong ket qua - ham chi nhan elapsedMs (server-time), khong co tham so client nao khac co the lam sai lech diem', () => {
    // Kiem chung gian tiep: ham khong nhan bat ky tham so nao khac ngoai elapsedMs (server-time) + timeLimitMs.
    // Goi 2 lan voi cung elapsedMs server-time phai luon ra CUNG 1 ket qua, bat ke "client" muon khai gi.
    const a = computeQuestionPoints(true, 2_000, BATTLE_QUESTION_TIME_LIMIT_MS);
    const b = computeQuestionPoints(true, 2_000, BATTLE_QUESTION_TIME_LIMIT_MS);
    expect(a).toBe(b);
  });
});

describe('shuffleOptionsWithAnswer', () => {
  it('✅ Happy: giu nguyen NOI DUNG 4 phuong an (chi doi vi tri), va vi tri dap an dung tro dung noi dung dap an dung ban dau', () => {
    const options = ['A', 'B', 'C', 'D'];
    const correctIndex = 2; // 'C'
    const { options: shuffled, correctIndex: newIndex } = shuffleOptionsWithAnswer(options, correctIndex);

    expect(shuffled.slice().sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(shuffled[newIndex]).toBe('C');
  });

  it('Bien: chi 1 phuong an -> khong xao duoc gi, correctIndex giu nguyen 0', () => {
    const { options, correctIndex } = shuffleOptionsWithAnswer(['A'], 0);
    expect(options).toEqual(['A']);
    expect(correctIndex).toBe(0);
  });
});

describe('generateRoomCode', () => {
  it('✅ Happy: luon tra ve chuoi 6 ky tu, chi gom chu HOA/so (khong co 0/O/1/I de tranh nham lan)', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    }
  });
});

describe('determineOutcome', () => {
  it('✅ Happy: diem cao hon -> WIN', () => {
    expect(determineOutcome(100, 80)).toBe('WIN');
  });
  it('❌ Error: diem thap hon -> LOSE', () => {
    expect(determineOutcome(80, 100)).toBe('LOSE');
  });
  it('Bien: bang diem -> DRAW', () => {
    expect(determineOutcome(90, 90)).toBe('DRAW');
  });
});

describe('decideBotAnswer', () => {
  it('✅ Happy: randomFn < correctRate -> bot tra loi DUNG, chon dung vi tri dap an dung', () => {
    const result = decideBotAnswer(2, 4, 0.65, () => 0.1);
    expect(result).toEqual({ isCorrect: true, selectedOption: 2 });
  });

  it('❌ Error: randomFn >= correctRate -> bot tra loi SAI, chon 1 vi tri KHAC dap an dung', () => {
    // randomFn tra ve 0.9 cho lan goi dau (quyet dinh dung/sai), roi 0 cho lan goi thu 2 (chon vi tri sai dau tien trong danh sach con lai)
    const values = [0.9, 0];
    let call = 0;
    const result = decideBotAnswer(2, 4, 0.65, () => values[call++] ?? 0);
    expect(result.isCorrect).toBe(false);
    expect(result.selectedOption).not.toBe(2);
    expect([0, 1, 3]).toContain(result.selectedOption);
  });
});

describe('randomBotDelayMs', () => {
  it('✅ Happy: luon nam trong khoang [min, max]', () => {
    const spy = vi.fn().mockReturnValue(0);
    expect(randomBotDelayMs(3000, 18000, spy)).toBe(3000);

    const spyMax = vi.fn().mockReturnValue(0.999999);
    expect(randomBotDelayMs(3000, 18000, spyMax)).toBeLessThanOrEqual(18000);
  });
});
