# Releases — QuizzGame

> Lịch sử release chính thức. Được cập nhật bởi S7-DongGoi sau mỗi lần merge vào master.

---

## v1.8.1 — 2026-07-07

### Anti-Cheat Security Fixes (Feature 011)

#### Fixed
- **Bug 1a**: Nộp bài trước 30% thời gian → `EXAM_SUBMIT_TOO_EARLY` (400), frontend hiển thị "Bạn cần làm thêm X phút nữa"
- **Bug 1b**: Đáp án đúng bị lộ cho câu bỏ trắng → `correctAnswer = null`, frontend hiển thị "Bạn chưa trả lời câu này"
- **Bug 2**: Redis down khiến rate limit luyện tập vô hiệu → đổi sang fail-closed, chặn luôn khi Redis lỗi
- **Bug 3**: Practice session không kiểm tra timeout → thêm elapsed check trong `$transaction` (17 phút + 60s grace)
- **Bug 4**: Mở nhiều tab thi cùng môn → `EXAM_SESSION_ALREADY_ACTIVE` (409)
- **Bonus**: Zod schema không nhận sentinel `{}` → thêm `z.object({}).strict()`
- **Bonus**: Auto-submit không trigger khi hết giờ → thay bằng `setTimeout` + Latest Ref Pattern

#### Added
- Hằng số `EXAM_MIN_SUBMIT_RATIO = 0.3`
- Error class `ExamSubmitTooEarlyError` (HTTP 400)
- Error class `ExamSessionAlreadyActiveError` (HTTP 409)
- Helper `isSentinelUnanswered()` (exported, có unit test)
- 22 unit test mới cho anti-cheat logic
- `docs/guides/troubleshooting.md`: hướng dẫn xử lý 6 lỗi phổ biến
- `docs/adr/009-anti-cheat-sentinel-fail-closed.md`: ADR về sentinel và fail-closed

**Migration**: Không cần migration DB.

---

## v1.8.0 — 2026-07-06

### Admin User Management + Dashboard (Feature 008)

#### Added
- **Dashboard admin**: 6 thống kê tổng quan (tổng user, đang online, bị khoá, admin, lượt thi hôm nay, lượt luyện tập hôm nay)
- **Tab Người dùng**: danh sách phân trang (10/trang), tìm kiếm theo tên/email, lọc theo trạng thái khoá/mở
- **Modal chi tiết user**: xem toàn bộ thông tin tài khoản
- **Khoá/Mở khoá tài khoản**: đá user ra ngay lập tức qua middleware `isBlocked`
- **Đổi mật khẩu**: gửi reset password link Firebase cho user
- **Đổi phân quyền**: học sinh ↔ admin
- **Xoá tài khoản**: Firebase-first delete (xoá Firebase trước DB để tránh zombie account)
- **Online tracking**: Redis TTL 5 phút per request (fire-and-forget, không block request)
- 7 API endpoints mới: `GET /api/admin/dashboard`, `GET/PATCH /api/admin/users`, `GET /api/admin/users/:id`, `POST /api/admin/users/:id/block`, `POST /api/admin/users/:id/reset-password`, `DELETE /api/admin/users/:id`

#### Changed
- `verifyAppToken` middleware: thêm check `isBlocked` → trả 403 ngay lập tức nếu tài khoản bị khoá
- Default page size: 20 → 10 (cả BE lẫn FE) để dễ test phân trang

#### Migration cần chạy trên production
- `npx prisma migrate deploy` — thêm cột `isBlocked` (default false) và `role` (default "student") vào bảng `users`
- Biến môi trường mới: không có

---

## v1.7.0 — 2026-07-05

### Ôn Câu Sai — Wrong Answer Review (Feature 010)

_(Merge trước khi áp dụng RELEASES.md)_

---

## v1.6.0 — 2026-07-04

### Progress Dashboard — Thống kê tiến độ học sinh (Feature 007)

_(Merge trước khi áp dụng RELEASES.md)_

---

## v1.5.0 — 2026-07-04

### Leaderboard — Bảng xếp hạng (Feature 006)

_(Merge trước khi áp dụng RELEASES.md)_

---

## v1.4.0 — 2026-07-03

### Question Bank — Ngân hàng câu hỏi (Feature 005)

_(Merge trước khi áp dụng RELEASES.md)_

---

## v1.3.0 — 2026-07-03

### Exam Module — Thi thử (Feature 004)

_(Merge trước khi áp dụng RELEASES.md)_

---

## v1.2.0 — 2026-06-13

### Admin Dashboard — Quản lý báo cáo câu hỏi (Feature 003)

_(Merge trước khi áp dụng RELEASES.md)_

---

## v1.1.0 — 2026-06-09

### Practice Module — Ôn tập thích nghi (Feature 002)

_(Merge trước khi áp dụng RELEASES.md)_

---

## v1.0.0

### Auth + Onboarding (Feature 001)

_(Phiên bản khởi đầu)_
