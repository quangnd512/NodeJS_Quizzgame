// Goi API admin dung de XAC THUC secret (TASK 9) - chua co man hinh chuc nang admin thuc su o
// dot nay (chi khung dieu huong placeholder), nen hien chi can 1 endpoint "nhe" de kiem tra
// X-Admin-Secret co dung hay khong.
import { adminRequest } from './client';

/**
 * Dung `GET /api/admin/settings/premium-default` lam "phep thu" xac thuc admin secret - day la
 * endpoint doc 1 gia tri boolean don gian (khong quet/tinh toan DB nang nhu dashboard), phu hop
 * lam request "ping" chi de kiem tra quyen truy cap ma khong ton chi phi khong can thiet.
 *
 * @throws ApiError (code ADMIN_UNAUTHORIZED, status 401) neu secret sai.
 */
export async function verifyAdminSecret(secret: string): Promise<void> {
  await adminRequest<{ enabled: boolean }>('/api/admin/settings/premium-default', secret);
}
