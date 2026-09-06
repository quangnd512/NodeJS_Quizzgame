// Test cho practice API — kiem tra request shape va response parsing.
import {
  startPracticeSession,
  answerQuestion,
  completeSession,
  getPracticeHistory,
  getPracticeStats,
} from '../practice';

jest.mock('../../config/env', () => ({ API_BASE_URL: 'http://localhost:4000' }));

const g = globalThis as unknown as { fetch: jest.Mock };

function mockFetch(status: number, body: object | unknown[]): void {
  g.fetch = jest.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

// ─── startPracticeSession ─────────────────────────────────────────────────────

describe('startPracticeSession()', () => {
  // Happy path
  it('goi GET /api/practice/start?subject=TOAN va tra ve session', async () => {
    const mockSession = {
      sessionId: 'sess-1',
      subject: 'TOAN',
      questions: [{ id: 'q1', subject: 'TOAN', chapter: null, difficulty: 1, question: 'Câu 1?', options: ['A', 'B', 'C', 'D'] }],
    };
    mockFetch(200, mockSession);
    const result = await startPracticeSession('token', 'TOAN');
    expect(result.sessionId).toBe('sess-1');
    expect(result.questions).toHaveLength(1);
    const fetchCall = g.fetch.mock.calls[0] as [string, RequestInit | undefined];
    expect(fetchCall[0]).toContain('/api/practice/start?subject=TOAN');
    expect(fetchCall[1]?.method).toBeUndefined(); // GET mac dinh
  });

  // Error case
  it('nem loi khi server tra 500', async () => {
    mockFetch(500, { error: 'INTERNAL_ERROR', message: 'Server error' });
    await expect(startPracticeSession('token', 'LY')).rejects.toMatchObject({ status: 500 });
  });
});

// ─── answerQuestion ───────────────────────────────────────────────────────────

describe('answerQuestion()', () => {
  // Happy path — nop dap an dung
  it('goi POST /api/practice/answer voi body dung va tra ve ket qua', async () => {
    const mockResult = {
      isCorrect: true,
      correctAnswer: 2,
      explanation: 'Giai thich',
      answeredCount: 1,
      totalQuestions: 10,
    };
    mockFetch(200, mockResult);
    const result = await answerQuestion('token', 'sess-1', 'q-1', 2);
    expect(result.isCorrect).toBe(true);
    expect(result.correctAnswer).toBe(2);
    const fetchCall = g.fetch.mock.calls[0] as [string, RequestInit];
    expect((fetchCall[1] as RequestInit).method).toBe('POST');
    const sentBody = JSON.parse(fetchCall[1].body as string) as Record<string, unknown>;
    expect(sentBody).toEqual({ sessionId: 'sess-1', questionId: 'q-1', selectedOption: 2 });
  });

  // Edge case — nop dap an sai → isCorrect: false, van ok (khong phai loi)
  it('tra ve isCorrect: false khi chon sai ma khong nem loi', async () => {
    mockFetch(200, { isCorrect: false, correctAnswer: 0, explanation: null, answeredCount: 1, totalQuestions: 10 });
    const result = await answerQuestion('token', 'sess-1', 'q-1', 3);
    expect(result.isCorrect).toBe(false);
  });
});

// ─── completeSession ──────────────────────────────────────────────────────────

describe('completeSession()', () => {
  // Happy path
  it('goi POST /api/practice/complete voi sessionId va tra ve ket qua', async () => {
    mockFetch(200, { sessionId: 'sess-1', score: 80, pointsEarned: 40, totalQuestions: 10 });
    const result = await completeSession('token', 'sess-1');
    expect(result.score).toBe(80);
    expect(result.pointsEarned).toBe(40);
    const fetchCall = g.fetch.mock.calls[0] as [string, RequestInit];
    expect(fetchCall[1].method).toBe('POST');
    const body = JSON.parse(fetchCall[1].body as string) as Record<string, unknown>;
    expect(body).toEqual({ sessionId: 'sess-1' });
  });
});

// ─── getPracticeHistory ───────────────────────────────────────────────────────

describe('getPracticeHistory()', () => {
  // Happy path — danh sach cac phien luyen tap
  it('goi GET /api/practice/history va tra ve items + total', async () => {
    mockFetch(200, { items: [], total: 0 });
    const result = await getPracticeHistory('token');
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    const fetchCall = g.fetch.mock.calls[0] as [string, RequestInit | undefined];
    expect(fetchCall[0]).toContain('/api/practice/history');
  });
});

// ─── getPracticeStats ─────────────────────────────────────────────────────────

describe('getPracticeStats()', () => {
  // Happy path — thong ke theo mon
  it('goi GET /api/practice/stats va tra ve mang thong ke', async () => {
    const stats = [{ subject: 'TOAN', totalSessions: 5, avgScore: 75, bestScore: 90 }];
    mockFetch(200, stats);
    const result = await getPracticeStats('token');
    expect(result).toHaveLength(1);
    expect(result[0].subject).toBe('TOAN');
  });

  // Edge case — mang rong khi chua co phien nao
  it('tra ve mang rong khi nguoi dung chua luyen tap', async () => {
    mockFetch(200, []);
    const result = await getPracticeStats('token');
    expect(result).toEqual([]);
  });
});
