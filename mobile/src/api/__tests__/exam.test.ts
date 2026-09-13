// Test cho API Thi thử — xác nhận startExam ném ApiError(409) khi server trả 409 Conflict
// (phiên thi dở dang chưa đóng). Đây là bug HP2 mà ExamListScreen phải bắt và xử lý.
import { startExam, getActiveExamSession, abandonExam } from '../exam';

jest.mock('../../config/env', () => ({ API_BASE_URL: 'http://localhost:4000' }));

const g = globalThis as unknown as { fetch: jest.Mock };

function mockFetch(status: number, body: object): void {
  g.fetch = jest.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

const TOKEN = 'test-token';
const SUBJECT_ID = 'math';

describe('startExam — xử lý 409 Conflict', () => {
  /**
   * Happy path: server trả 201/200 → trả về StartExamResult.
   */
  it('happy path: trả StartExamResult khi server trả 200', async () => {
    mockFetch(200, {
      sessionId: 'sess-1',
      examPaperId: 'paper-1',
      subject: SUBJECT_ID,
      title: 'Toán thi thử',
      durationMinutes: 45,
      startedAt: '2026-09-08T00:00:00.000Z',
      questions: [],
    });

    const result = await startExam(TOKEN, SUBJECT_ID);
    expect(result.sessionId).toBe('sess-1');
    expect(result.subject).toBe(SUBJECT_ID);
  });

  /**
   * Edge case (bug HP2): server trả 409 khi đang có phiên thi dở dang.
   * ExamListScreen phải bắt ApiError với status === 409 rồi fetch active session + hiện dialog.
   */
  it('edge case: ném ApiError với status 409 khi server báo EXAM_IN_PROGRESS', async () => {
    mockFetch(409, {
      error: 'EXAM_IN_PROGRESS',
      message: 'Bạn đang có phiên thi chưa hoàn thành.',
    });

    await expect(startExam(TOKEN, SUBJECT_ID)).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      code: 'EXAM_IN_PROGRESS',
    });
  });

  /**
   * Error case: server trả 404 khi không có đề thi cho môn này.
   */
  it('error case: ném ApiError với status 404 khi không có đề thi', async () => {
    mockFetch(404, {
      error: 'EXAM_NOT_FOUND',
      message: 'Không có đề thi nào cho môn này.',
    });

    await expect(startExam(TOKEN, SUBJECT_ID)).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
    });
  });
});

describe('getActiveExamSession', () => {
  it('trả session khi có phiên thi đang dở', async () => {
    mockFetch(200, {
      session: {
        id: 'sess-1',
        title: 'Toán thi thử',
        subject: 'math',
        remainingSeconds: 1200,
      },
    });

    const { session } = await getActiveExamSession(TOKEN);
    expect(session).not.toBeNull();
    expect(session?.id).toBe('sess-1');
  });

  it('trả session null khi không có phiên thi dở', async () => {
    mockFetch(200, { session: null });

    const { session } = await getActiveExamSession(TOKEN);
    expect(session).toBeNull();
  });
});

describe('abandonExam', () => {
  it('trả success khi hủy phiên thi thành công', async () => {
    mockFetch(200, { success: true });

    const result = await abandonExam(TOKEN, 'sess-1');
    expect(result.success).toBe(true);
  });

  it('ném ApiError khi phiên thi không tồn tại', async () => {
    mockFetch(404, {
      error: 'EXAM_SESSION_NOT_FOUND',
      message: 'Phiên thi không tồn tại.',
    });

    await expect(abandonExam(TOKEN, 'invalid-id')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
    });
  });
});
