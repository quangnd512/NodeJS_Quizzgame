# Releases — QuizzGame

> Lịch sử release chính thức. Được cập nhật bởi S7-DongGoi sau mỗi lần merge vào master.

---

## v1.11.0 — 2026-07-13

### Notifications — Thông báo hệ thống (Feature 013)

#### Added
- **Bảng DB `notifications`** với enum `NotificationType` (5 loại: STREAK_MILESTONE, RANK_UP, RANK_DOWN, REPORT_RESOLVED, NEW_EXAM_PAPER)
- **`NotificationService`** — 5 methods: createNotification, getNotifications, getUnreadCount, markAsRead, markAllAsRead
- **4 API endpoints**: `GET /api/notifications`, `GET /api/notifications/unread-count`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`
- **Streak milestone trigger** trong `practice.completeSession()` — notify khi đạt [7, 14, 30, 60, 100] ngày liên tiếp (chỉ lần đầu trong ngày)
- **Rank change trigger** trong `exam.submitExam()` — query rank trước và sau khi nộp bài, notify nếu hạng thay đổi
- **Report resolved trigger** trong `practice.updateReport()` — notify khi admin chuyển trạng thái từ PENDING
- **New exam paper trigger** trong `exam.updateExamPaper()` — batch notify tất cả user học môn đó khi đề thi được bật active
- **Bell icon 🔔** trong ProfilePage header với badge đỏ hiện số thông báo chưa đọc
- **NotificationPanel** (drawer slide-in) — đánh dấu đọc từng/tất cả thông báo, điều hướng sang màn hình tương ứng theo `targetScreen` (progress/leaderboard/exam) khi bấm vào thông báo
- **NotificationToast** — toast pop-up 7 giây khi có thông báo mới
- **Polling 30 giây** trong App component — gọi `/unread-count`, cập nhật badge và trigger toast, re-poll khi tab được focus lại
- **`src/utils/streak.utils.ts`** — tách `computeStreaks()` và `STREAK_MILESTONES` ra shared utility
- **`leaderboardService.getUserCurrentRank()`** — slim query chỉ lấy hạng hiện tại

#### Changed
- `progress.service.ts` — import `computeStreaks` từ utils thay vì định nghĩa lại logic
- `exam.service.ts` — thêm rank-before query trước vòng retry transaction
- `practice.service.ts` — `updateReport()` thêm pre-query lấy userId + status trước khi update

#### Migration cần chạy trên production
- `npx prisma migrate deploy` (migration mới: `20260709100000_add_notifications`)

#### Biến môi trường mới
_(không có)_

---

## v1.10.0 — 2026-07-09

### Exam UX Improvements (Feature 012)

#### Added
- **Exam Resume**: Khi lỡ thoát app giữa bài thi, mở lại sẽ thấy ngay modal "Bài thi đang dở" trên màn hình chính — chọn Tiếp tục để vào lại với đồng hồ đúng và đáp án cũ được khôi phục, hoặc Huỷ để bỏ bài
- **Auto-submit khi hết giờ lúc resume**: Nếu quay lại sau khi bài đã hết giờ, hệ thống tự nộp bài với đáp án đã lưu và hiển thị kết quả
- **Exit Button (✕)**: Nút thoát ở góc trên màn hình làm bài — click → xác nhận 2 bước → huỷ bài có kiểm soát
- **Trạng thái ABANDONED**: Enum mới phân biệt "người dùng chủ động huỷ" vs "hết giờ" (EXPIRED)
- **localStorage Draft**: Đáp án được lưu tự động sau mỗi lần chọn, dùng để khôi phục khi resume
- **2 endpoint mới**: `GET /api/exam/active`, `POST /api/exam/:id/abandon`
- **12 unit test mới** (tổng 78/78 PASS)

#### Migration cần chạy trên production
_(không có migration DB mới — chỉ thêm giá trị ABANDONED vào logic, không đổi schema)_

#### Biến môi trường mới
_(không có)_

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
