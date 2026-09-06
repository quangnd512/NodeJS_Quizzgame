// Test cho API client (request, adminRequest, postFirebaseLogin, unauthorized listener).
// Mock fetch de test offline, khong can backend that.
import {
  request,
  adminRequest,
  postFirebaseLogin,
  setSessionUnauthorizedListener,
  setAdminUnauthorizedListener,
  ApiError,
} from '../client';

// Mock bien moi truong
jest.mock('../../config/env', () => ({ API_BASE_URL: 'http://localhost:4000' }));

// globalThis duoc cast kieu de ghi de fetch (fetch la global trong React Native runtime).
// Dung "as unknown as" thay vi "as any" de tranh vi pham rule no-explicit-any.
const g = globalThis as unknown as { fetch: jest.Mock };

// Helper tao mock Response
function mockFetch(status: number, body: object | null = null): void {
  const bodyText = body !== null ? JSON.stringify(body) : '';
  g.fetch = jest.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(bodyText),
  });
}

beforeEach(() => {
  setSessionUnauthorizedListener(null);
  setAdminUnauthorizedListener(null);
});

// ─── request() ────────────────────────────────────────────────────────────────

describe('request()', () => {
  // Happy path — server tra ve 200 + JSON hop le
  it('tra ve du lieu khi response ok', async () => {
    mockFetch(200, { items: [1, 2, 3], total: 3 });
    const result = await request<{ items: number[]; total: number }>(
      '/api/test',
      'token-abc',
    );
    expect(result.items).toEqual([1, 2, 3]);
    expect(result.total).toBe(3);
  });

  // Happy path — kiem tra header Authorization duoc dinh kem
  it('gui Authorization header dung format Bearer', async () => {
    mockFetch(200, {});
    await request('/api/test', 'my-jwt-token');
    const fetchCall = g.fetch.mock.calls[0] as [string, RequestInit];
    const headers = fetchCall[1].headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer my-jwt-token');
  });

  // Edge case — body rong (204 No Content) khong crash
  it('xu ly response body rong (204) an toan', async () => {
    mockFetch(204, null);
    const result = await request('/api/test', 'token');
    expect(result).toEqual({});
  });

  // Error case — server tra ve 4xx voi error code
  it('nem ApiError voi code va status khi server tra loi loi', async () => {
    mockFetch(400, { error: 'VALIDATION_ERROR', message: 'Invalid input' });
    await expect(request('/api/test', 'token')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Invalid input',
      status: 400,
    });
  });

  // Error case — server tra ve 401 → goi sessionUnauthorizedListener
  it('goi sessionUnauthorizedListener khi nhan 401', async () => {
    const listener = jest.fn();
    setSessionUnauthorizedListener(listener);
    mockFetch(401, { error: 'UNAUTHORIZED', message: 'Token expired' });
    await expect(request('/api/test', 'expired-token')).rejects.toMatchObject({ status: 401 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  // Error case — mat mang (fetch nem loi) → ApiError voi code NETWORK_ERROR
  it('nem ApiError NETWORK_ERROR khi mat ket noi mang', async () => {
    g.fetch = jest.fn().mockRejectedValueOnce(new Error('Network failure'));
    await expect(request('/api/test', 'token')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      status: 0,
    });
  });

  // Edge case — body khong phai JSON (HTML loi tu proxy) khong crash
  it('xu ly body khong phai JSON an toan (loi proxy HTML)', async () => {
    g.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: () => Promise.resolve('<html>Service Unavailable</html>'),
    });
    await expect(request('/api/test', 'token')).rejects.toMatchObject({
      code: 'UNKNOWN_ERROR',
      status: 503,
    });
  });
});

// ─── adminRequest() ───────────────────────────────────────────────────────────

describe('adminRequest()', () => {
  // Happy path — dung X-Admin-Secret thay vi Authorization
  it('gui X-Admin-Secret header (khong phai Authorization)', async () => {
    mockFetch(200, { ok: true });
    await adminRequest('/api/admin/test', 'admin-secret');
    const fetchCall = g.fetch.mock.calls[0] as [string, RequestInit];
    const headers = fetchCall[1].headers as Record<string, string>;
    expect(headers['X-Admin-Secret']).toBe('admin-secret');
    expect(headers['Authorization']).toBeUndefined();
  });

  // Error case — admin 401 → goi adminUnauthorizedListener, KHONG goi sessionListener
  it('goi adminUnauthorizedListener khi nhan 401, khong goi session listener', async () => {
    const sessionListener = jest.fn();
    const adminListener = jest.fn();
    setSessionUnauthorizedListener(sessionListener);
    setAdminUnauthorizedListener(adminListener);
    mockFetch(401, { error: 'UNAUTHORIZED', message: 'Bad secret' });
    await expect(adminRequest('/api/admin/test', 'wrong-secret')).rejects.toMatchObject({ status: 401 });
    expect(adminListener).toHaveBeenCalledTimes(1);
    expect(sessionListener).not.toHaveBeenCalled();
  });
});

// ─── postFirebaseLogin() ──────────────────────────────────────────────────────

describe('postFirebaseLogin()', () => {
  // Happy path — doi Firebase ID Token lay session token
  it('goi POST /api/auth/login voi Firebase Bearer token', async () => {
    mockFetch(200, { token: 'session-jwt-123' });
    const result = await postFirebaseLogin<{ token: string }>('firebase-id-token');
    expect(result.token).toBe('session-jwt-123');
    const fetchCall = g.fetch.mock.calls[0] as [string, RequestInit];
    expect(fetchCall[0]).toContain('/api/auth/login');
    const headers = fetchCall[1].headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer firebase-id-token');
  });

  // Error case — Firebase token sai → nem ApiError KHONG goi session listener
  it('nem ApiError khi Firebase token sai, KHONG goi sessionUnauthorizedListener', async () => {
    const listener = jest.fn();
    setSessionUnauthorizedListener(listener);
    mockFetch(401, { error: 'INVALID_FIREBASE_TOKEN', message: 'Token invalid' });
    await expect(postFirebaseLogin('bad-firebase-token')).rejects.toMatchObject({
      code: 'INVALID_FIREBASE_TOKEN',
    });
    // postFirebaseLogin KHONG duoc goi sessionUnauthorizedListener (no chua co session)
    expect(listener).not.toHaveBeenCalled();
  });
});

// ─── ApiError ────────────────────────────────────────────────────────────────

describe('ApiError', () => {
  // Happy path — la instance cua Error, co cac truong dac trung
  it('ke thua Error va co code + status', () => {
    const err = new ApiError('MY_CODE', 'My message', 422);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('MY_CODE');
    expect(err.message).toBe('My message');
    expect(err.status).toBe(422);
    expect(err.name).toBe('ApiError');
  });
});
