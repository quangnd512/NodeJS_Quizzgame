// Goi API cong khai (khong can dang nhap) - dung de kiem tra ket noi Mobile <-> Backend
// luc phat trien (TASK 2). Xem backend/src/routes/hello.route.ts.
import { API_BASE_URL } from '../config/env';
import { ApiError } from './client';

export interface HelloResponse {
  message: string;
  servedAt: string;
}

/** `GET /api/hello` - khong can header xac thuc nao. */
export async function getHello(): Promise<HelloResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/hello`);
  } catch (err) {
    throw new ApiError('NETWORK_ERROR', 'Khong the ket noi den may chu. Vui long kiem tra ket noi mang.', 0);
  }

  const text = await res.text();
  const body = text ? (JSON.parse(text) as { error?: string; message?: string } & Partial<HelloResponse>) : {};

  if (!res.ok) {
    throw new ApiError(body.error ?? 'UNKNOWN_ERROR', body.message ?? `Loi HTTP ${res.status}`, res.status);
  }

  return body as HelloResponse;
}
