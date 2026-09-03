[BACKLOG — BẢO MẬT, ưu tiên TRUNG BÌNH-CAO]

# Vá 20 lỗ hổng mức `high` trong thư viện

## Số liệu đo được 2026-09-03 (lần quét đầu tiên)

| Phần | Critical | High | Moderate |
|---|---|---|---|
| backend | 0 | **8** | 12 |
| frontend | 0 | **4** | 1 |
| mobile | 0 | **8** | 15 |

Không có `critical` — nghĩa là chưa có gì phải sửa khẩn cấp trong đêm.
Nhưng 20 lỗ hổng `high` là con số cần giảm dần.

## Đáng chú ý nhất (backend — có thể khai thác thật)

| Thư viện | Vấn đề |
|---|---|
| **`multer`** | Từ chối dịch vụ (DoS) qua tên trường lồng sâu. Backend dùng multer để tải ảnh câu hỏi → **kẻ tấn công gửi request đặc biệt có thể làm treo server**. Đây là cái đáng lo nhất |
| `form-data` | CRLF injection qua tên field/filename không được escape |
| `nanoid` | Có thể lặp vô hạn khi truyền size âm |
| `postcss` | Đọc được file `.map` tuỳ ý khi `from` không được đặt |
| `deepmerge-ts` / `@prisma/config` | Tràn stack khi merge object đệ quy |

## Cách xử lý đề xuất

**Bước 1 — Thử cách an toàn trước** (không đổi major version):
```bash
cd backend && npm audit fix
# rồi CHẠY LẠI TOÀN BỘ TEST trước khi tin
npm test && npm run build
```
Làm tương tự cho `frontend/` và `mobile/`.

**Bước 2 — Ưu tiên `multer`** vì đây là lỗ hổng chạm được từ bên ngoài. Nếu `npm audit fix`
không xử lý được, cần nâng major version → phải kiểm tra kỹ luồng tải ảnh còn chạy đúng không.

**Bước 3 — Để Dependabot làm phần còn lại.** `.github/dependabot.yml` đã bật, hàng tuần
sẽ tạo PR nâng version. PR nào có nhãn `security` thì ưu tiên merge.

## Lưu ý quan trọng
⚠️ **KHÔNG chạy `npm audit fix --force`.** Lệnh đó nâng major version bừa bãi, gần như
chắc chắn làm hỏng app. Đã có tiền lệ trong dự án này: `npm install` sai cách từng làm
hỏng toàn bộ `node_modules` (xem `docs/LESSONS_LEARNED.md`).

⚠️ Sau mỗi lần vá, **bắt buộc chạy lại đủ 3 lệnh** của phần đó (test/typecheck/lint) —
vá bảo mật mà làm hỏng tính năng thì lợi bất cập hại.

## Theo dõi
CI (`.github/workflows/security.yml`) in bảng số lỗ hổng vào tab Summary mỗi lần chạy.
Con số này phải **giảm dần**. Nếu tăng → có thư viện mới mang lỗ hổng vào.

📄 Phát hiện bởi lần chạy Security workflow đầu tiên, 2026-09-03
