# Releases — QuizzGame

> Lịch sử release chính thức. Được cập nhật bởi S7-DongGoi sau mỗi lần merge vào master.

---

## v1.13.0 — 2026-07-19

### Khung Free/Premium (Feature 015)

**Branch:** `feature/premium-framework`

#### Added

- **Khung Free/Premium**: mọi tài khoản là Free hoặc Premium, xác định qua công tắc toàn cục "Mặc định Premium cho tất cả" (**BẬT SẴN** từ đầu) HOẶC hạn `premiumExpiresAt` cấp thủ công còn hiệu lực
- **Admin cấp Premium thủ công theo tháng** (1-24) cho từng user — cộng dồn nếu đang Premium còn hạn, kích hoạt mới (reset thẻ bảo hiểm chuỗi) nếu đang Free/hết hạn
- **Công tắc toàn cục "Mặc định Premium cho tất cả"** trên Admin Dashboard — bật/tắt có hiệu lực ngay lập tức cho mọi user
- **Gate đổi môn học**: Free phải "xem quảng cáo" giả lập (đếm ngược 5 giây) để mở khoá 1 lượt đổi môn (token Redis single-use, TTL 300s); Premium đổi thoải mái
- **Khoá hoàn toàn "Ôn lại câu sai"** cho Free — chặn ở backend (middleware `requirePremium`), không chỉ ẩn UI
- **Khoá hoàn toàn "Lịch sử thi thử"** cho Free (trong trang Tiến độ học tập) — `GET /api/progress/exam-history` trả 403, không trả dữ liệu kể cả rỗng
- **Khoá "Thống kê theo môn" + "Xu hướng điểm"** ở trang Tiến độ cho Free (bổ sung phạm vi từ S5) — chặn ở backend (trả mảng rỗng), không chỉ ẩn UI
- **Thẻ bảo hiểm chuỗi (Streak Freeze)**: Premium được cấp 3 thẻ khi kích hoạt, mỗi thẻ tự động "bắc cầu" 1 khoảng trống đúng 1 ngày trong lịch sử ôn tập, không làm đứt streak
- **Cron cảnh báo Premium sắp hết hạn** — quét hằng ngày 3:05 AM, gửi thông báo trước 24h, chỉ gửi 1 lần/hạn
- **2 loại thông báo mới**: `PREMIUM_GRANTED`, `PREMIUM_EXPIRING_SOON`
- **7 endpoint mới**: `POST /api/users/subjects/ad-unlock`, `PATCH /api/admin/users/:id/grant-premium`, `GET/PATCH /api/admin/settings/premium-default`
- Bảng `app_settings` (singleton) — cấu hình toàn cục dùng chung cho các tính năng sau này
- Badge "⭐ Premium" ở Trang cá nhân, banner nâng cấp cho các tính năng bị khoá, form cấp Premium trong Admin Dashboard

#### Changed

- `GET /api/users/me` (UserMeDto), `GET /api/progress/summary` mở rộng thêm field Premium (không breaking — chỉ thêm field)
- `POST /api/users/subjects` — Free bắt buộc có token ad-unlock còn hiệu lực; Premium không đổi hành vi

#### Fixed

- Race condition khi 2 admin cùng cấp Premium cho 1 user gần như đồng thời — có thể làm mất hoàn toàn 1 trong 2 lần cấp (lost update) → sửa bằng Compare-And-Swap có retry
- Token mở khoá quảng cáo bị tiêu thụ trước khi validate xong dữ liệu đổi môn → sửa bằng cách đổi thứ tự validate trước, tiêu thụ token sau
- Lỗi CI lint `react-hooks/set-state-in-effect` ở `AdGatePage` (phát hiện qua CI thật sau khi push, không xác minh được cục bộ do sandbox treo I/O với eslint)

**Migration cần chạy trên production:**
- `npx prisma migrate deploy` — áp dụng migration mới: `add_premium_framework` (thêm bảng `app_settings`, cột Premium trên `User`, giá trị enum `NotificationType` mới)
- Không có biến môi trường mới cần thêm

---

## v1.12.0 — 2026-07-15

### Quản lý câu hỏi — Học sinh đóng góp câu hỏi + Thiết kế lại báo cáo (Feature 014)

**Branch:** `feature/question-management-hub`

#### Added

- **Học sinh đóng góp câu hỏi (Submissions)**: học sinh gửi câu hỏi (tối đa 5 câu/ngày, hiện dạng modal khi vượt) → admin duyệt (vào ngân hàng câu hỏi + thưởng **30 điểm**) hoặc từ chối (kèm lý do bắt buộc). Hỗ trợ 3 dạng câu hỏi: MCQ_4/TRUE_FALSE_4/FILL_BLANK (giống module Thi thử)
- **Điểm thưởng "usage"**: mỗi lần câu hỏi (đã duyệt) được admin chủ động thêm vào 1 đề thi thật (`from-bank`), học sinh nhận thêm **+5 điểm/lần**, tối đa **100 điểm/câu** (chống lost-update bằng Compare-And-Swap)
- **Cảnh báo trùng lặp** khi gửi câu hỏi — so khớp Jaccard similarity với câu ACTIVE cùng môn trong kho (ngưỡng 60%), hiện kèm đầy đủ nội dung câu trong kho để admin đối chiếu trực tiếp
- **3 loại thông báo mới**: `SUBMISSION_APPROVED`, `SUBMISSION_REJECTED`, `SUBMISSION_USED`
- **Trang "✍️ Gửi câu hỏi"** (học sinh) — form gửi câu mới + danh sách "Câu đã gửi" (xem trạng thái, sửa/xoá khi còn PENDING)
- **Trang Admin "Câu hỏi"** (gộp tab mới) — 2 sub-tab: "Bài học sinh gửi" và "Báo cáo lỗi", kèm badge tổng số việc chờ xử lý
- **Report Redesign**: `GET /api/admin/questions/reports` trả kèm nội dung câu hỏi đầy đủ; endpoint gộp `PATCH /api/admin/questions/reports/:id/resolve` (sửa nội dung câu hỏi ngay tại chỗ, tự đóng batch mọi báo cáo PENDING khác cùng câu, tự kích hoạt lại câu nếu đang auto-hide)
- **Lọc liên động 3 dropdown** (status/subject/reason) ở trang Báo cáo lỗi — endpoint mới `GET /api/admin/questions/reports/facets`
- **Báo cáo lại sau khi đã xử lý**: học sinh có thể báo cáo lại 1 câu sau khi report cũ đã FIXED/DISMISSED (cần xác nhận qua `confirmResubmit`) — ràng buộc "tối đa 1 report PENDING/user/câu" chuyển sang partial unique index
- **Bảng `question_edit_history`** — lưu snapshot nội dung câu hỏi trước mỗi lần admin sửa qua luồng resolve báo cáo

#### Changed

- ⚠️ **Breaking**: `PATCH /api/admin/questions/reports/:id` (cũ) đã bị **xoá**, thay bằng `PATCH /api/admin/questions/reports/:id/resolve`
- ⚠️ **Breaking**: `GET /api/admin/questions/reports/summary` đổi field `pending`→`pendingReports`, `reviewed`→`pendingQuestions`
- ⚠️ **Đổi hành vi auto-hide**: `status=FIXED` giờ **tự động** set `isActive=true` nếu câu đang bị auto-hide

#### Fixed

- Race condition khi 2 admin cùng duyệt 1 submission (claim-pattern `updateMany` điều kiện `status=PENDING`)
- Race condition khi học sinh sửa/xoá đúng lúc admin vừa xử lý xong submission
- Lost update trên điểm "usage" khi 2 `addFromBank` chạy song song cùng 1 câu (Compare-And-Swap có retry)
- Race condition double-resolve trong `resolveReport()` (phát hiện ở vòng review S8 lần 2 — cùng lớp lỗi với 3 mục trên nhưng bị bỏ sót ban đầu) — thêm claim-pattern + `ReportNotPendingError` (409)

**Migration cần chạy trên production:**
- `npx prisma migrate deploy` — áp dụng 3 migration mới: `add_student_submissions_and_edit_history`, `submission_question_types`, `report_resubmit_after_resolved` (migration cuối dùng raw SQL cho partial unique index có điều kiện, có backfill trước khi set NOT NULL — an toàn cho dữ liệu hiện có)
- Không có biến môi trường mới cần thêm

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
