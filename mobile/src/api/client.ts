// API client dung chung cho toan bo app mobile - boc cac cuoc goi `fetch` den backend Express.
//
// Kien truc GIONG frontend/src/lib/api.ts (web) de de doi chieu/bao tri, nhung co them 1 co che
// MOI ma web chua can: "unauthorized listener" - cho phep `AuthContext`/`AdminAuthContext` dang ky
// 1 ham callback duoc goi TU DONG moi khi server tra ve 401 (JWT/admin secret het han hoac sai) -
// phuc vu TASK 6 (tu dong dang xuat ve man Dang nhap khi JWT khong con hop le), khong can moi man
// hinh phai tu bat loi 401 rieng le.
import { API_BASE_URL } from '../config/env';

/** Loi tra ve tu API (co truong `error` (ma loi) va `message` (mo ta)). */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

type UnauthorizedListener = () => void;

// Dang ky duy nhat 1 listener tai 1 thoi diem la du cho nhu cau hien tai (app chi co 1 AuthContext
// va 1 AdminAuthContext dang hoat dong cung luc) - don gian hon dung event emitter day du.
let sessionUnauthorizedListener: UnauthorizedListener | null = null;
let adminUnauthorizedListener: UnauthorizedListener | null = null;

/** Dang ky callback duoc goi khi mot request dung SESSION TOKEN (JWT noi bo) nhan ve 401. */
export function setSessionUnauthorizedListener(listener: UnauthorizedListener | null): void {
  sessionUnauthorizedListener = listener;
}

/** Dang ky callback duoc goi khi mot request dung ADMIN SECRET nhan ve 401. */
export function setAdminUnauthorizedListener(listener: UnauthorizedListener | null): void {
  adminUnauthorizedListener = listener;
}

/** Doc body response an toan: tra ve {} neu body rong (vd. 204, loi proxy mang). */
async function parseJsonBody<T>(res: Response): Promise<{ error?: string; message?: string } & Partial<T>> {
  const text = await res.text();
  if (!text) return {} as { error?: string; message?: string } & Partial<T>;
  try {
    return JSON.parse(text) as { error?: string; message?: string } & Partial<T>;
  } catch {
    // Body khong phai JSON hop le (vi du: trang loi HTML tu proxy/CDN) - tranh crash app.
    return {} as { error?: string; message?: string } & Partial<T>;
  }
}

/**
 * Goi API can dang nhap (dinh kem "Authorization: Bearer <session-token>").
 * Neu server tra ve 401 -> bao cho `sessionUnauthorizedListener` (neu co dang ky) TRUOC khi nem loi,
 * de AuthContext co the tu dong xoa token + dieu huong ve man Dang nhap.
 */
export async function request<T>(
  path: string,
  sessionToken: string,
  options: RequestInit = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
        ...options.headers,
      },
    });
  } catch {
    // Loi mang (mat ket noi, backend khong chay, sai IP...) - khong phai loi tu server.
    throw new ApiError('NETWORK_ERROR', 'Khong the ket noi den may chu. Vui long kiem tra ket noi mang.', 0);
  }

  const body = await parseJsonBody<T>(res);

  if (!res.ok) {
    if (res.status === 401) {
      sessionUnauthorizedListener?.();
    }
    throw new ApiError(body.error ?? 'UNKNOWN_ERROR', body.message ?? `Loi HTTP ${res.status}`, res.status);
  }

  return body as T;
}

/**
 * Goi API admin (dinh kem header "X-Admin-Secret") - KHONG dung JWT/Firebase, xem
 * `backend/src/middleware/admin.middleware.ts`.
 */
export async function adminRequest<T>(
  path: string,
  secret: string,
  options: RequestInit = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Secret': secret,
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Khong the ket noi den may chu. Vui long kiem tra ket noi mang.', 0);
  }

  const body = await parseJsonBody<T>(res);

  if (!res.ok) {
    if (res.status === 401) {
      adminUnauthorizedListener?.();
    }
    throw new ApiError(body.error ?? 'UNKNOWN_ERROR', body.message ?? `Loi HTTP ${res.status}`, res.status);
  }

  return body as T;
}

/**
 * Goi `POST /api/auth/login` - truong hop DUY NHAT dung Firebase ID Token thay vi session token
 * (vi day chinh la request DOI Firebase token lay session token). KHONG di qua `request()` o tren
 * vi khong the/khong nen kich hoat `sessionUnauthorizedListener` cho request nay (chua he co session
 * de "het han" - 401 o day nghia la Firebase token sai, khac ban chat voi JWT noi bo het han).
 */
export async function postFirebaseLogin<T>(firebaseIdToken: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${firebaseIdToken}` },
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Khong the ket noi den may chu. Vui long kiem tra ket noi mang.', 0);
  }

  const body = await parseJsonBody<T>(res);

  if (!res.ok) {
    throw new ApiError(body.error ?? 'UNKNOWN_ERROR', body.message ?? `Loi HTTP ${res.status}`, res.status);
  }

  return body as T;
}
