// Tests cho cac API module duoc them trong Mobile Stage 1.
// Mock toan bo `request` tu api/client de khong can backend thuc su.
import { ApiError } from '../client.js';
import { startPracticeSession, submitPracticeAnswer, completePracticeSession } from '../practice.js';
import { listExamPapers, startExam, submitExam, abandonExam, getExamResult } from '../exam.js';
import { getLeaderboard, getMyRank } from '../leaderboard.js';
import { getProgressSummary, getExamHistory } from '../progress.js';
import { getWrongAnswers, retryWrongAnswer } from '../wrongAnswer.js';
import {
  getUnreadCount,
  listNotifications,
  markAllAsRead,
  markAsRead,
} from '../notifications.js';
import {
  listMySubmissions,
  createSubmission,
  deleteSubmission,
} from '../questionSubmission.js';
import { getBattleConfig, getBattleHistory } from '../battle.js';

// Mock api/client — giu ApiError that de test throw/catch
jest.mock('../client.js', () => {
  class ApiError extends Error {
    code: string;
    status: number;
    constructor(code: string, message: string, status: number) {
      super(message);
      this.name = 'ApiError';
      this.code = code;
      this.status = status;
    }
  }
  return {
    ApiError,
    request: jest.fn(),
  };
});

// Lay mock request de kiem soat ket qua
const { request } = jest.requireMock('../client.js') as {
  request: jest.MockedFunction<(path: string, token: string, opts?: RequestInit) => Promise<unknown>>;
};

const TOKEN = 'test-session-token';

beforeEach(() => {
  request.mockReset();
});

// ---------------------------------------------------------------------------
// Practice API
// ---------------------------------------------------------------------------

describe('Practice API', () => {
  test('startPracticeSession goi POST /api/practice/start voi subjectId', async () => {
    const mockSession = { sessionId: 's1', questions: [], totalQuestions: 5 };
    request.mockResolvedValueOnce(mockSession);

    const result = await startPracticeSession(TOKEN, 'math');

    expect(request).toHaveBeenCalledWith(
      '/api/practice/start',
      TOKEN,
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ subjectId: 'math' }) }),
    );
    expect(result).toEqual(mockSession);
  });

  test('submitPracticeAnswer goi POST /api/practice/answer', async () => {
    const mockAnswer = { isCorrect: true, explanation: 'Vi...', correctAnswer: 2, answeredCount: 1, totalQuestions: 5 };
    request.mockResolvedValueOnce(mockAnswer);

    const result = await submitPracticeAnswer(TOKEN, 's1', 'q1', 2);

    expect(request).toHaveBeenCalledWith(
      '/api/practice/answer',
      TOKEN,
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.isCorrect).toBe(true);
  });

  test('completePracticeSession goi POST /api/practice/complete', async () => {
    const mockResult = { score: 80, pointsEarned: 10 };
    request.mockResolvedValueOnce(mockResult);

    const result = await completePracticeSession(TOKEN, 's1');

    expect(request).toHaveBeenCalledWith(
      '/api/practice/complete',
      TOKEN,
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.score).toBe(80);
  });

  test('startPracticeSession throw ApiError khi request that bai', async () => {
    request.mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'Loi mang', 0));

    await expect(startPracticeSession(TOKEN, 'math')).rejects.toThrow(ApiError);
  });
});

// ---------------------------------------------------------------------------
// Exam API
// ---------------------------------------------------------------------------

describe('Exam API', () => {
  test('listExamPapers goi GET /api/exam/papers', async () => {
    const mockPapers = { data: [{ id: 'p1', title: 'De 1', subject: 'TOAN', questionCount: 10, durationMinutes: 45, difficulty: 3, description: null }], total: 1, page: 1, pageSize: 10 };
    request.mockResolvedValueOnce(mockPapers);

    const result = await listExamPapers(TOKEN);

    expect(request).toHaveBeenCalledWith(
      expect.stringContaining('/api/exam/papers'),
      TOKEN,
    );
    expect(result.data).toHaveLength(1);
  });

  test('startExam goi POST /api/exam/start voi paperId', async () => {
    const mockSession = { sessionId: 'es1', questions: [] };
    request.mockResolvedValueOnce(mockSession);

    await startExam(TOKEN, 'p1');

    expect(request).toHaveBeenCalledWith(
      '/api/exam/start',
      TOKEN,
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ paperId: 'p1' }) }),
    );
  });

  test('submitExam goi POST /api/exam/submit voi answers', async () => {
    const mockResult = { sessionId: 'es1', score: 90, correctCount: 9, totalCount: 10, pointsAwarded: 50, isPassed: true };
    request.mockResolvedValueOnce(mockResult);

    await submitExam(TOKEN, 'es1', [{ examQuestionId: 'q1', selectedAnswer: 0 }]);

    expect(request).toHaveBeenCalledWith(
      '/api/exam/submit',
      TOKEN,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  test('abandonExam goi POST /api/exam/:id/abandon', async () => {
    request.mockResolvedValueOnce({});
    await abandonExam(TOKEN, 'es1');
    expect(request).toHaveBeenCalledWith(
      '/api/exam/es1/abandon',
      TOKEN,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  test('getExamResult goi GET /api/exam/:id/result', async () => {
    const mockResult = { score: 85, chapterAnalysis: [] };
    request.mockResolvedValueOnce(mockResult);

    await getExamResult(TOKEN, 'es1');

    expect(request).toHaveBeenCalledWith('/api/exam/es1/result', TOKEN);
  });
});

// ---------------------------------------------------------------------------
// Leaderboard API
// ---------------------------------------------------------------------------

describe('Leaderboard API', () => {
  test('getLeaderboard goi GET /api/leaderboard', async () => {
    const mockLB = { data: [], total: 0, page: 1, pageSize: 20 };
    request.mockResolvedValueOnce(mockLB);

    await getLeaderboard(TOKEN, 'TOAN', 1);

    expect(request).toHaveBeenCalledWith(
      expect.stringContaining('/api/leaderboard'),
      TOKEN,
    );
  });

  test('getLeaderboard khong co params van goi duoc', async () => {
    request.mockResolvedValueOnce({ entries: [] });
    await getLeaderboard(TOKEN);
    expect(request).toHaveBeenCalled();
  });

  test('getMyRank goi GET /api/leaderboard/me', async () => {
    const mockRank = { rank: 5, reputationScore: 300, avgScore: 8.5, examCount: 10, trend: null };
    request.mockResolvedValueOnce(mockRank);

    const result = await getMyRank(TOKEN);

    expect(request).toHaveBeenCalledWith(
      expect.stringContaining('/api/leaderboard/me'),
      TOKEN,
    );
    expect(result.rank).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Progress API
// ---------------------------------------------------------------------------

describe('Progress API', () => {
  test('getProgressSummary goi GET /api/progress/summary', async () => {
    const mockSummary = {
      overview: { totalPracticeSessions: 10, totalExamSessions: 5, currentPoints: 500, currentStreak: 3 },
      bestStreak: 7,
      monthComparison: { thisMonth: { practiceSessions: 5, examAvgScore: 80 }, lastMonth: { practiceSessions: 3, examAvgScore: 75 } },
      practiceStatsBySubject: [],
      scoreTrend: [],
      isPremium: false,
      premiumExpiresAt: null,
      streakFreeze: { granted: 1, used: 0, remaining: 1 },
    };
    request.mockResolvedValueOnce(mockSummary);

    const result = await getProgressSummary(TOKEN);

    expect(request).toHaveBeenCalledWith('/api/progress/summary', TOKEN);
    expect(result.overview.currentStreak).toBe(3);
  });

  test('getExamHistory goi GET /api/progress/exam-history', async () => {
    request.mockResolvedValueOnce({ history: [] });
    await getExamHistory(TOKEN);
    expect(request).toHaveBeenCalledWith('/api/progress/exam-history', TOKEN);
  });
});

// ---------------------------------------------------------------------------
// Wrong Answer API
// ---------------------------------------------------------------------------

describe('Wrong Answer API', () => {
  test('getWrongAnswers goi GET /api/wrong-answers', async () => {
    const mockWrong = { data: [], total: 0, page: 1, pageSize: 10 };
    request.mockResolvedValueOnce(mockWrong);

    await getWrongAnswers(TOKEN);

    expect(request).toHaveBeenCalledWith(
      expect.stringContaining('/api/wrong-answers'),
      TOKEN,
    );
  });

  test('retryWrongAnswer goi POST /api/wrong-answers/:id/retry', async () => {
    const mockResult = { isCorrect: false, correctAnswer: 1, explanation: 'Vi...' };
    request.mockResolvedValueOnce(mockResult);

    const result = await retryWrongAnswer(TOKEN, 1, 0);

    expect(request).toHaveBeenCalledWith(
      '/api/wrong-answers/1/retry',
      TOKEN,
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.isCorrect).toBe(false);
  });

  test('retryWrongAnswer throw khi Premium bi tu choi', async () => {
    request.mockRejectedValueOnce(new ApiError('PREMIUM_REQUIRED', 'Can Premium', 403));

    await expect(retryWrongAnswer(TOKEN, 2, 0)).rejects.toMatchObject({
      code: 'PREMIUM_REQUIRED',
    });
  });
});

// ---------------------------------------------------------------------------
// Notifications API
// ---------------------------------------------------------------------------

describe('Notifications API', () => {
  test('getUnreadCount goi GET /api/notifications/unread-count', async () => {
    request.mockResolvedValueOnce({ count: 3 });

    const result = await getUnreadCount(TOKEN);

    expect(request).toHaveBeenCalledWith('/api/notifications/unread-count', TOKEN);
    expect(result.count).toBe(3);
  });

  test('listNotifications goi GET /api/notifications', async () => {
    request.mockResolvedValueOnce({ notifications: [], total: 0 });
    await listNotifications(TOKEN);
    expect(request).toHaveBeenCalledWith(
      expect.stringContaining('/api/notifications'),
      TOKEN,
    );
  });

  test('markAllAsRead goi PATCH /api/notifications/read-all', async () => {
    request.mockResolvedValueOnce({ updated: 3 });
    await markAllAsRead(TOKEN);
    expect(request).toHaveBeenCalledWith(
      '/api/notifications/read-all',
      TOKEN,
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  test('markAsRead goi PATCH /api/notifications/:id/read', async () => {
    request.mockResolvedValueOnce({});
    await markAsRead(TOKEN, 'n1');
    expect(request).toHaveBeenCalledWith(
      '/api/notifications/n1/read',
      TOKEN,
      expect.objectContaining({ method: 'PATCH' }),
    );
  });
});

// ---------------------------------------------------------------------------
// Question Submission API
// ---------------------------------------------------------------------------

describe('Question Submission API', () => {
  test('listMySubmissions goi GET /api/submissions', async () => {
    request.mockResolvedValueOnce({ data: [], total: 0, page: 1, pageSize: 10 });
    await listMySubmissions(TOKEN);
    expect(request).toHaveBeenCalledWith(
      expect.stringContaining('/api/submissions'),
      TOKEN,
    );
  });

  test('createSubmission goi POST /api/submissions', async () => {
    request.mockResolvedValueOnce({ id: 'sub1', status: 'PENDING', subject: 'math', questionType: 'MCQ_4', questionText: 'Test' });

    const payload = {
      subject: 'math',
      questionType: 'MCQ_4' as const,
      questionText: 'Day la cau hoi test',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 0 as number | string[],
    };

    const result = await createSubmission(TOKEN, payload);

    expect(request).toHaveBeenCalledWith(
      '/api/submissions',
      TOKEN,
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.status).toBe('PENDING');
  });

  test('deleteSubmission goi DELETE /api/submissions/:id', async () => {
    request.mockResolvedValueOnce({});
    await deleteSubmission(TOKEN, 'sub1');
    expect(request).toHaveBeenCalledWith(
      '/api/submissions/sub1',
      TOKEN,
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

// ---------------------------------------------------------------------------
// Battle API (REST)
// ---------------------------------------------------------------------------

describe('Battle API', () => {
  test('getBattleConfig goi GET /api/battle/config', async () => {
    const mockConfig = { stakes: [10, 20, 50], currentPoints: 200, minPoints: 10, subjects: [] };
    request.mockResolvedValueOnce(mockConfig);

    const result = await getBattleConfig(TOKEN);

    expect(request).toHaveBeenCalledWith('/api/battle/config', TOKEN);
    expect(result.stakes).toHaveLength(3);
  });

  test('getBattleHistory goi GET /api/battle/history', async () => {
    request.mockResolvedValueOnce({ battles: [], total: 0 });
    await getBattleHistory(TOKEN);
    expect(request).toHaveBeenCalledWith(
      expect.stringContaining('/api/battle/history'),
      TOKEN,
    );
  });
});
