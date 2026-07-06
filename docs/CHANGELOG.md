# Changelog — QuizzGame

> Ghi lại các thay đổi theo từng tính năng/release.
> Format theo [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased] — Anti-Cheat Security Fixes (Feature 011)

**Branch:** `feature/anti-cheat-fixes`

### Fixed
- **Bug 1a**: Nộp bài thi thử trước khi đủ 30% thời gian làm bài → `POST /api/exam/submit` trả 400 `EXAM_SUBMIT_TOO_EARLY`
- **Bug 1b**: Đáp án đúng bị lộ cho câu bỏ trắng trong kết quả thi → `correctAnswer = null` cho câu có `selectedAnswer = {}` (sentinel)
- **Bug 2**: Redis down khiến rate limit luyện tập bị vô hiệu (fail-open) → đổi thành fail-closed, throw `PRACTICE_RATE_LIMIT_EXCEEDED`
- **Bug 3**: `completeSession()` không kiểm tra timeout → thêm elapsed check bên trong `$transaction` với 60s grace
- **Bug 4**: Học sinh có thể mở nhiều tab thi cùng môn → `POST /api/exam/start` kiểm tra IN_PROGRESS session, trả 409 `EXAM_SESSION_ALREADY_ACTIVE`

### Added
- Hằng số `EXAM_MIN_SUBMIT_RATIO = 0.3` trong `exam.types.ts`
- Error class `ExamSubmitTooEarlyError` (HTTP 400)
- Error class `ExamSessionAlreadyActiveError` (HTTP 409)
- Helper `isSentinelUnanswered()` để detect câu bỏ trắng
- 22 unit test mới cho anti-cheat logic

### Changed
- `ExamWrongAnswerItem.correctAnswer`: `Prisma.JsonValue` → `Prisma.JsonValue | null`
- Frontend: hiển thị "Bạn chưa trả lời câu này" thay vì đáp án đúng cho câu bỏ trắng
- Frontend: thông báo "Bạn cần làm thêm X phút nữa" khi nộp bài quá sớm

---

## [Unreleased] — Admin User Management + Dashboard (Feature 008)

**Branch:** `feature/admin-user-management`
**Ngày:** 2026-07-05

### Added

- **Tab Dashboard (📊)** mới trong Admin Panel (`/#admin`): hiển thị 6 chỉ số
  thời gian thực — tổng số tài khoản, user mới tuần này, user mới tháng này,
  tổng phiên thi thử, tỷ lệ đậu (≥ 7.0/10), và số user đang online ngay lúc đó.

- **Tab Người dùng (👥)** mới trong Admin Panel: danh sách toàn bộ user với:
  - Tìm kiếm theo tên hoặc email (không phân biệt hoa thường)
  - Lọc theo quyền hạn (`STUDENT` / `ADMIN`)
  - Lọc theo trạng thái (`Hoạt động` / `Đã khoá`)
  - Phân trang (mặc định 20 user/trang)

- **Modal chi tiết người dùng**: click vào bất kỳ user nào để xem:
  - Thông tin cá nhân đầy đủ (tên, email, SĐT, trường, tỉnh, môn học đã đăng ký)
  - Thống kê học tập (số phiên ôn tập, số lần thi thử, điểm trung bình thi thử)
  - 5 kỳ thi thử gần nhất (tên đề, điểm, trạng thái, thời gian)

- **7 API endpoint mới** cho admin:
  - `GET /api/admin/dashboard`
  - `GET /api/admin/users`
  - `GET /api/admin/users/:id`
  - `PATCH /api/admin/users/:id/block`
  - `POST /api/admin/users/:id/reset-password`
  - `PATCH /api/admin/users/:id/role`
  - `DELETE /api/admin/users/:id`

- **Khoá / Mở khoá tài khoản**: Admin có thể khoá user — người dùng bị khoá
  nhận lỗi `403 USER_BLOCKED` ngay lập tức trên mọi API call.

- **Đặt lại mật khẩu qua Firebase**: Tạo link đặt lại mật khẩu (Firebase Admin
  SDK `generatePasswordResetLink`), hiển thị link để admin tự gửi cho user.

- **Đổi quyền hạn**: Chuyển user từ `STUDENT` sang `ADMIN` và ngược lại.

- **Xóa tài khoản**: Xóa đồng thời Firebase account + DB (Firebase-first để
  đảm bảo user không thể đăng nhập lại).

- **Online tracking (Redis)**: Mỗi request xác thực thành công tự động ghi
  `SET online:{userId} 1 EX 300` — không thêm query DB, không ảnh hưởng hiệu năng.

### Changed

- **`verifyAppToken` middleware** (BE): bổ sung kiểm tra `user.isBlocked` sau khi
  load user từ DB — nếu bị khoá, throw `UserBlockedError` (403) ngay lập tức;
  đồng thời ghi key Redis online tracking (fire-and-forget).

- **Bảng `users`** (BE): thêm 2 cột mới:
  - `isBlocked BOOLEAN DEFAULT false`
  - `role TEXT DEFAULT 'STUDENT'`
  - 2 index mới: `users_isBlocked_idx`, `users_role_idx`

- **`app.ts`** (BE): đăng ký `adminUsersRouter` tại `/api/admin`; thêm 4 error
  code mới vào `ERROR_CODE_TO_HTTP_STATUS`.

- **Admin Dashboard (FE)**: trước đây chỉ có 1 tab "Báo cáo câu hỏi" và 1 tab
  "Đề thi thử" — giờ có thêm 2 tab đầu: "📊 Dashboard" (tab mặc định khi vào)
  và "👥 Người dùng". Thứ tự tab mới: Dashboard → Người dùng → Báo cáo → Đề thi.

### Migration

Migration: `backend/prisma/migrations/20260705120000_add_user_isblocked_role/`

```sql
ALTER TABLE "users" ADD COLUMN "isBlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'STUDENT';
CREATE INDEX "users_isBlocked_idx" ON "users"("isBlocked");
CREATE INDEX "users_role_idx" ON "users"("role");
```

Chạy migration:
```bash
cd backend
npx prisma migrate dev
# Hoặc nếu có drift: npx prisma db push
```

---

## [Feature 010] — Ôn câu sai (Wrong Answer Review)

**Branch:** `feature/wrong-answer-review`
**Commit:** `07a9568`
**Ngày:** 2026-07-05

### Added

- Tính năng Ôn câu sai: người dùng xem lại và làm lại các câu hỏi đã trả lời
  sai trong phiên Ôn tập hoặc Thi thử.
- API `GET /api/wrong-answers` (list, filter theo môn, phân trang).
- API `POST /api/wrong-answers/:id/retry` (làm lại 1 câu, hỗ trợ cả 3 loại
  câu hỏi MCQ_4, TRUE_FALSE_4, FILL_BLANK).
- Bảng `wrong_answers`: lưu câu sai với TTL 14 ngày (tự làm sạch theo thời gian).

---

## [Feature 009] — Question Bank (Ngân hàng câu hỏi)

**Ngày:** 2026-07-01

### Added

- Kho câu hỏi toàn cục (`question_bank`) tách biệt với đề thi.
- Admin CRUD câu hỏi trong kho; kiểm tra usage trước khi xóa (hard-delete).
- Thêm câu từ kho vào đề: `from-bank` (chọn thủ công) và `auto-fill` (tự động
  theo tỷ lệ 50/30/20% dễ/trung bình/khó).

---

## [Feature 007] — Leaderboard + Avatar

**Ngày:** 2026-06-28

### Added

- Bảng xếp hạng theo Điểm Uy Tín (AVG - 0.5×STDDEV) × (1-1/(n+1)).
- Podium Top 3, xu hướng 30 ngày (↑↓→), filter môn.
- Upload/xóa avatar (Multer, JPG/PNG ≤ 2MB).

---

## [Feature 006] — Progress Dashboard (Tiến độ học tập)

**Ngày:** 2026-06-25

### Added

- Tổng quan học tập: phiên ôn, lần thi, điểm, chuỗi streak; so sánh tháng.
- Thống kê theo môn, sparkline điểm 30 phiên gần nhất.
- Lịch sử thi thử phân trang; 9 query chạy song song (Promise.all).

---

## [Feature 005] — Exam Module (Thi thử)

**Ngày:** 2026-06-20

### Added

- Phiên thi thử đầy đủ: 3 dạng câu (MCQ_4, TRUE_FALSE_4, FILL_BLANK).
- Trừ 60 điểm phí vào thi; thưởng điểm 0/10/20/50/120 theo bậc điểm số.
- Chọn đề công bằng round-robin; hết giờ + grace period.
- Admin CRUD đề thi + câu hỏi; import Excel.

---

## [Feature 004] — Practice Module (Ôn tập thích nghi)

**Ngày:** 2026-06-09

### Added

- Rút 15 câu ngẫu nhiên theo độ khó (5+5+5), ưu tiên câu chưa làm 24h.
- Idempotent answer submission; cộng điểm atomic khi hoàn thành.
- Rate limit 10 phiên/giờ/user (Redis); cleanup cron lúc 3 AM.
- Admin CRUD câu hỏi, bulk import, quản lý báo cáo câu sai.

---

## [Feature 003] — Auth + Onboarding

**Ngày:** 2026-06-08

### Added

- Đăng nhập Firebase → JWT session token 7 ngày.
- Middleware `verifyFirebaseToken` (chỉ `/login`) và `verifyAppToken` (mọi route).
- Chọn môn học (onboarding), cập nhật hồ sơ cá nhân (`GET/PUT /api/users/*`).

---

## [Feature 002] — PointsService

**Ngày:** 2026-06-08

### Added

- Hệ thống điểm tích lũy atomic với optimistic locking (version field).
- `addPoints`, `deductPoints`, `transferPoints`, `getBalance`, `getHistory`.

---

## [Feature 001] — Hello World (Scaffold)

**Ngày:** 2026-06-08

### Added

- Khung dự án ban đầu: Express + React + Vite + TypeScript.
- Proxy dev, CORS, health check, error handler tập trung.
