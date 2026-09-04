# Changelog — QuizzGame

> Ghi lại các thay đổi theo từng tính năng/release.
> Format theo [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased] — Tách App.tsx Vòng 2→7 Gộp (Nợ Kỹ Thuật)

**Branch:** `refactor/split-app-tsx-round-2to5`
**Ngày:** 2026-09-04

### Changed

- **Cấu trúc thư mục frontend** — tách 26 file từ `App.tsx` (6.837 → 358 dòng, giảm 6.479 dòng — đạt mục tiêu dài hạn ≤ 400 dòng)
  - `frontend/src/screens/` — 18 màn hình người dùng (AdGatePage, ProfilePage, LeaderboardPage, PracticePage, PracticeSessionScreen, PracticeResultScreen, ExamPage, ExamSessionScreen, ExamQuestionCard, ExamResultScreen, ProgressPage, WrongAnswersPage, SubmissionsPage, BattleHistoryPage)
  - `frontend/src/screens/admin/` — 8 màn hình admin (AdminPage, AdminSubmissionsPage, AdminReportsPage, AdminExamPage, AdminQuestionBankPage, AdminDashboardPage, AdminUsersPage + adminConstants)
  - `frontend/src/screens/battle/` — màn hình PvP (BattlePage + battleConstants)
  - `frontend/src/screens/practice/` — constants (practiceConstants)
  - `frontend/src/screens/exam/` — utils (examUtils)
  - `frontend/src/components/NotificationPanel.tsx`, `frontend/src/screens/submissionsConstants.ts`
- `App.tsx` chỉ còn: imports + `BattleResumeState` type + `getInitials` + `App()` component (358 dòng)
- Thêm 80 test mới (101 test tổng, 13 file test) cho tất cả file vừa tách

### Ghi chú

- Không thay đổi logic, CSS, behavior, API — chỉ di chuyển code
- Vòng 2→7/7 của kế hoạch refactor nợ kỹ thuật (xem `workflow/handoff/backlog/S1_tech_debt_master_plan.md`)
- `BattleResumeState` duplicate trong App.tsx và BattlePage.tsx là thiết kế chủ ý (tránh circular import — đã S1 duyệt)
- `SUBMISSION_STATUS_LABEL` tách thành `submissionsConstants.ts` riêng (tránh vi phạm `react-refresh/only-export-components`)

---

## [Unreleased] — Tách App.tsx Vòng 1 (Nợ Kỹ Thuật)

**Branch:** `refactor/split-app-tsx-round-1`
**Ngày:** 2026-09-03

### Changed

- **Cấu trúc thư mục frontend** — tách 7 file nhỏ ra khỏi `App.tsx` (7.018 → 6.837 dòng, giảm 181 dòng)
  - `frontend/src/lib/constants.ts` — hằng số toàn cục (SUBJECTS, SUBJECTS_MAP)
  - `frontend/src/components/` — các component tái sử dụng (Spinner, GoogleIcon, AvatarCell)
  - `frontend/src/screens/` — các màn hình auth (LoadingScreen, LoginPage, OnboardingPage)
- Không thay đổi logic, CSS, behavior — chỉ di chuyển code để giảm kích thước file chính

### Ghi chú

- Vòng 1/7 của kế hoạch refactor nợ kỹ thuật (xem `workflow/handoff/backlog/S1_tech_debt_master_plan.md`)
- Thêm 5 test file mới để kiểm thử các component/screen vừa tách (Spinner, GoogleIcon, AvatarCell, LoadingScreen, LoginPage, OnboardingPage)
- App.tsx hiện 6.837 dòng — mục tiêu dài hạn là ≤ 1.500 dòng (vòng 7)

---

## [Unreleased] — Nền móng App Di Động — Mobile Foundation (Đợt 1a)

**Branch:** `feature/mobile-foundation`
**Ngày:** 2026-07-29

### Added

- **Thư mục `mobile/` mới hoàn toàn** — ứng dụng di động QuizzGame (React Native + Expo SDK 57 + TypeScript), client thứ 3 của dự án bên cạnh `frontend/` (web) và `backend/`, dùng **chung 1 backend** — không có API mới, không đổi schema database
- **Đăng nhập Google + Apple** (chỉ iOS cho Apple) qua Firebase JS SDK — tái sử dụng `POST /api/auth/login` sẵn có (kiến trúc auth provider-agnostic, không phân biệt web/mobile hay Google/Apple)
- **Onboarding chọn môn học** (1-7 môn, khớp `MIN_SUBJECTS`/`MAX_SUBJECTS` backend) cho user mới (`subjects` rỗng theo `GET /api/users/me`)
- **Khung điều hướng chính học sinh** — 5 tab (Luyện tập/Thi thử/Xếp hạng/Tiến độ/Hồ sơ), 4 tab đầu tạm "Sắp ra mắt", tab Hồ sơ đầy đủ (điểm, môn học, dark mode, đăng xuất)
- **Đăng nhập Admin riêng biệt** qua `X-Admin-Secret` (không qua Firebase/JWT), tách hoàn toàn khỏi luồng học sinh, ưu tiên hiển thị nếu cả 2 cùng đăng nhập
- **Dark mode** — Sáng/Tối/Theo hệ thống, lưu lựa chọn qua các lần tắt/mở app
- **Banner cảnh báo mất mạng** — hiện/ẩn theo sự kiện (không polling), mọi màn hình
- **Giữ phiên đăng nhập 7 ngày** qua `expo-secure-store` (mã hoá phần cứng) — JWT/admin secret/theme, tự động đăng xuất khi 401 (listener pattern tập trung, không cần từng màn hình tự bắt lỗi)
- `docs/api/openapi.yaml` (v1.8.0): bổ sung `POST /api/auth/login` + `GET /api/users/me` vào contract chính thức (đóng khoảng trống tài liệu từ trước Feature 001, không đổi hành vi)

### Fixed (phát hiện trong review S3, trước khi merge)

- `api/hello.ts` thiếu try/catch quanh `JSON.parse` body response — không nhất quán với `parseJsonBody()` trong `client.ts`, có thể ném `SyntaxError` không kiểm soát nếu server/proxy trả về không phải JSON hợp lệ
- `docs/api/drafts/mobile-foundation.yaml` ghi sai contract `POST /api/users/subjects` (`{subjects: string[]}`) — code mobile đã implement đúng theo contract thật (`{subjects: [{id, name?}]}`), chỉ sửa lại draft
- 6 warning lint: `import/no-duplicates` (`react-native-gesture-handler` import 2 lần ở `App.tsx`), 4× biến `err` không dùng trong `catch`

### Ghi chú

- **Không có test tự động** — quyết định có chủ đích (17 dòng DoD gốc đều khung theo hướng xác minh thủ công trên thiết bị thật, `mobile/` chưa có hạ tầng `jest-expo`) — xem `docs/FEATURE_LOG.md` Section 17 mục kỹ thuật #5. Khuyến nghị dựng test tự động từ Đợt 1b.
- Google/Apple Sign-In là native module — cần "dev build" (`expo prebuild` + `expo run:android`/`run:ios`), không chạy trong Expo Go thường sau khi tích hợp.
- Chỉ dựng khung sườn (đăng nhập, điều hướng, dark mode) — 4/5 tab chính tạm "Sắp ra mắt", sẽ lấp dần ở Đợt 1b/1c/1d.

---

## [Unreleased] — Thi đấu đối kháng — PvP Quiz Battle, Đợt 1/MVP (Feature 016)

**Branch:** `feature/battle-mvp`
**Ngày:** 2026-07-22 (cập nhật 2026-07-27 — thay đổi phạm vi muộn sau vòng test thủ công của S5)

### Added

- **Thi đấu đối kháng (PvP Quiz Battle)**: chế độ thi đấu trực tiếp 2 người chơi (hoặc 1 người + bot), 10 câu MCQ_4 cùng môn, trả lời realtime, cược điểm (50/100/200/500, giống nhau cho mọi user ở Đợt 1)
- **Kết nối realtime Socket.io** — LẦN ĐẦU dự án dùng kết nối realtime (trước đó toàn bộ API là REST thuần), namespace `/battle`, xác thực tái sử dụng JWT session token nội bộ hiện có
- **Ghép trận tự động**, nới lỏng tiêu chí dần theo thời gian chờ (0-10s đúng môn+cược → 10-20s đúng môn → 20-30s bất kỳ), tự động ghép với **bot** (tỉ lệ đúng ~65%) sau 30 giây không tìm được đối thủ
- **Mời bạn bè qua mã phòng** 6 ký tự — bỏ qua hàng đợi thường
- **Chấm điểm theo THỜI GIAN SERVER** (không tin thời gian client gửi lên) — 10 điểm cơ bản + bonus tốc độ 0-3 điểm/câu đúng, tối đa 130 điểm/trận
- **Xử lý mất kết nối**: chờ 30 giây, xử thắng kỹ thuật nếu không quay lại kịp, huỷ hoàn cược nếu cả 2 cùng mất kết nối, reconnect giữ nguyên điểm đã tích luỹ nếu quay lại kịp
- **3 endpoint REST**: `GET /api/battle/config` (mức cược hợp lệ + số dư điểm), `GET /api/battle/history` (lịch sử trận, phân trang, mở cho tất cả — chưa khoá Premium ở Đợt 1), `GET /api/battle/active` (**mới**, xem mục "Thay đổi phạm vi muộn" bên dưới)
- **DB mới**: model `BattleMatch`, `BattleAnswer`; 4 giá trị `PointReason` mới (`PVP_LOCK_BET`, `PVP_WIN`, `PVP_CANCELLED_REFUND`, `PVP_DRAW_REFUND`)
- Màn hình FE mới: chọn môn/cược, chờ ghép trận, thi đấu realtime, kết quả, lịch sử trận đấu

### Fixed (phát hiện trong review S3, trước khi merge)

- Tạo trận + khoá cược là 3 bước rời rạc kèm "hoàn cược thủ công" khi lỗi → gộp thành 1 transaction duy nhất (giống pattern `ExamService.startExam`), tránh "trận ma" mồ côi nếu lỗi giữa chừng
- Trả điểm và chốt trạng thái trận là 2 bước tách rời → gộp 1 transaction, tránh tình trạng "đã trả điểm nhưng trận mãi IN_PROGRESS" nếu lỗi giữa chừng
- Race condition: bổ sung Compare-And-Swap ở tầng DB chống thanh toán điểm 2 lần cho cùng 1 trận (trước đây chỉ có cờ in-memory, không đủ khi scale nhiều instance)
- Lịch sử trận đấu suy sai kết quả thắng/thua khi có thắng kỹ thuật do mất kết nối (so sánh điểm số thô thay vì dùng `winnerId` đã lưu)
- Bug rò rỉ phòng: bấm "Huỷ tìm trận" trong lúc chờ bạn bè vào phòng riêng không xoá phòng trên server — người khác vẫn nhập được mã, trừ điểm ngoài ý muốn

### Fixed (phát hiện bằng tay trong vòng test thủ công của S5, sau đó bổ sung test tự động theo yêu cầu làm lại của S8)

- 2 đồng hồ đếm giờ (20.5s/câu và 30s chờ mất kết nối) chạy độc lập → trận tự "nhảy câu" 0 điểm oan trước khi đủ 30 giây thật; sửa: tạm dừng hẳn đồng hồ câu hỏi trong lúc chờ, khởi động lại (fresh) khi đối thủ kết nối lại
- Lỗ hổng bảo mật: 1 user mở 2 kết nối cùng tài khoản có thể vào được 2 trận cùng lúc, khoá cược 2 lần → chặn bằng `hasActiveMatch()`, mã lỗi mới `BATTLE_ALREADY_IN_MATCH`

### Changed — thay đổi phạm vi muộn (theo yêu cầu người dùng phát sinh trong lúc S5 test thủ công, không phải bug)

- **Ẩn hoàn toàn danh tính bot khỏi người chơi**: đối thủ bot không còn hiện "Máy 🤖" — nay hiện 1 trong 12 tên giả kiểu người thật, deterministic theo `matchId` (khớp nhau lúc đang chơi và lúc xem lại lịch sử). Áp dụng ở `battle:match-found`, `GET /api/battle/history`, `GET /api/battle/active`. `isBotMatch` vẫn đúng sự thật trong response, chỉ tầng hiển thị bị "nguỵ trang"
- **Tự động vào lại trận đang dở** sau khi tải lại trang/đăng nhập lại: endpoint mới `GET /api/battle/active` đọc state in-memory, tự đưa user vào thẳng đúng trận nếu còn sống, hoặc hiện thẳng màn kết quả nếu trận đã tự kết thúc trong lúc rời app (dùng `localStorage` để phát hiện)
- Đếm ngược mất kết nối hiện đúng theo giây thật ("chờ 30s… 29s…"), không còn đứng yên tĩnh; đổi thành "đang xử lý…" khi về 0

### Docs

- Cập nhật `docs/api/drafts/battle-mvp.yaml` khớp 2 điểm lệch so với implementation: phân trang `limit/offset` (không phải `page`), mô hình thanh toán escrow (không dùng `transferPoints`); bổ sung endpoint `/active` + mã lỗi mới + ghi chú ẩn danh tính bot
- Merge contract Battle vào `docs/api/openapi.yaml` (nay 3 REST endpoint + extension `x-socketio-namespaces` mô tả toàn bộ sự kiện Socket.io — OpenAPI 3.0 không có cú pháp chuẩn cho WebSocket/Socket.io), bump v1.7.0→v1.7.1
- Bổ sung `battle.engine.service.test.ts` (6 test mới, S3) phủ đúng 2 bug ở mục "Fixed" thứ 2 — trước đó tầng điều phối realtime hoàn toàn không có test tự động

---

## [Unreleased] — Khung Free/Premium (Feature 015)

**Branch:** `feature/premium-framework`
**Ngày:** 2026-07-17

### Added

- **Khung Free/Premium**: mọi tài khoản là Free hoặc Premium, xác định qua công tắc toàn cục "Mặc định Premium cho tất cả" (**BẬT SẴN** từ đầu) HOẶC hạn `premiumExpiresAt` cấp thủ công còn hiệu lực
- **Admin cấp Premium thủ công theo tháng** (1-24) cho từng user — cộng dồn nếu đang Premium còn hạn, kích hoạt mới (reset thẻ bảo hiểm chuỗi) nếu đang Free/hết hạn
- **Công tắc toàn cục "Mặc định Premium cho tất cả"** trên Admin Dashboard — bật/tắt có hiệu lực ngay lập tức cho mọi user
- **Gate đổi môn học**: Free phải "xem quảng cáo" giả lập (đếm ngược 5 giây) để mở khoá 1 lượt đổi môn (token Redis single-use, TTL 300s); Premium đổi thoải mái
- **Khoá hoàn toàn "Ôn lại câu sai"** cho Free — chặn ở backend (middleware `requirePremium`), không chỉ ẩn UI
- **Khoá hoàn toàn "Lịch sử thi thử"** cho Free (trong trang Tiến độ học tập) — `GET /api/progress/exam-history` trả 403, không trả dữ liệu kể cả rỗng
- **Thẻ bảo hiểm chuỗi (Streak Freeze)**: Premium được cấp 3 thẻ khi kích hoạt, mỗi thẻ tự động "bắc cầu" 1 khoảng trống đúng 1 ngày trong lịch sử ôn tập, không làm đứt streak
- **Cron cảnh báo Premium sắp hết hạn** — quét hằng ngày 3:05 AM, gửi thông báo trước 24h, chỉ gửi 1 lần/hạn
- **2 loại thông báo mới**: `PREMIUM_GRANTED`, `PREMIUM_EXPIRING_SOON`
- **7 endpoint mới**: `POST /api/users/subjects/ad-unlock`, `PATCH /api/admin/users/:id/grant-premium`, `GET/PATCH /api/admin/settings/premium-default`
- Bảng `app_settings` (singleton) — cấu hình toàn cục dùng chung cho các tính năng sau này
- Badge "⭐ Premium" ở Trang cá nhân, banner nâng cấp cho các tính năng bị khoá, form cấp Premium trong Admin Dashboard

### Changed

- `GET /api/users/me` (UserMeDto), `GET /api/progress/summary` mở rộng thêm field Premium (không breaking — chỉ thêm field)
- `POST /api/users/subjects` — Free bắt buộc có token ad-unlock còn hiệu lực; Premium không đổi hành vi

### Fixed (phát hiện trong review S3, trước khi merge)

- Race condition khi 2 admin cùng cấp Premium cho 1 user gần như đồng thời — có thể làm mất hoàn toàn 1 trong 2 lần cấp (lost update) → sửa bằng Compare-And-Swap có retry
- Token mở khoá quảng cáo bị tiêu thụ trước khi validate xong dữ liệu đổi môn — request sai định dạng vẫn "đốt" token oan → sửa bằng cách đổi thứ tự validate trước, tiêu thụ token sau

### Docs

- Sửa 12 endpoint (`/api/admin/question-bank*`, `/api/leaderboard*`, `/api/users/me/avatar`, `/api/progress/*`, `/api/wrong-answers*`) trong `docs/api/openapi.yaml` bị lồng sai vào `components:` do lỗi indent YAML từ vòng trước — đã chuyển đúng về `paths:` (không đổi nội dung, chỉ đổi vị trí cấu trúc)
- Sửa 8 chỗ tham chiếu `bearerAuth` (không tồn tại trong `securitySchemes`) thành `SessionToken` đúng quy ước của file

---

## [Unreleased] — Quản lý câu hỏi — Học sinh đóng góp câu hỏi + Report Redesign (Feature 014)

**Branch:** `feature/question-management-hub`
**Ngày:** 2026-07-13

### Added

- **Học sinh đóng góp câu hỏi (Submissions)**: học sinh gửi câu hỏi trắc nghiệm 4 đáp án (tối đa 5 câu/ngày) → admin duyệt (vào ngân hàng câu hỏi + thưởng **30 điểm**) hoặc từ chối (kèm lý do bắt buộc)
- **Điểm thưởng "usage"**: mỗi lần câu hỏi (đã duyệt) được admin chủ động thêm vào 1 đề thi thật (`from-bank`), học sinh nhận thêm **+5 điểm/lần**, tối đa **100 điểm/câu**
- **Cảnh báo trùng lặp** (chỉ cảnh báo, không chặn duyệt): so khớp Jaccard similarity thô giữa câu học sinh gửi và các câu ACTIVE cùng môn trong kho, ngưỡng 60%
- **3 loại thông báo mới**: `SUBMISSION_APPROVED`, `SUBMISSION_REJECTED`, `SUBMISSION_USED`
- **Trang "✍️ Gửi câu hỏi"** (học sinh) — form gửi câu mới + danh sách "Câu đã gửi" (xem trạng thái, sửa/xoá khi còn PENDING)
- **Trang Admin "Câu hỏi"** (gộp tab mới) — 2 sub-tab: "Bài học sinh gửi" (duyệt/từ chối, xem cảnh báo trùng lặp) và "Báo cáo lỗi" (mục dưới), kèm badge tổng số việc chờ xử lý
- **7 API endpoint mới**: `POST/GET /api/submissions`, `GET/PUT/DELETE /api/submissions/:id`, `GET /api/admin/submissions`, `POST /api/admin/submissions/:id/approve`, `POST /api/admin/submissions/:id/reject`
- **Report Redesign — JOIN đầy đủ nội dung câu hỏi**: `GET /api/admin/questions/reports` giờ trả kèm nội dung câu hỏi đầy đủ (`question`), không chỉ `questionId` thô; thêm lọc theo `subject`/`reason`
- **Report Redesign — endpoint gộp `resolve`**: `PATCH /api/admin/questions/reports/:id/resolve` xử lý 1 báo cáo (`FIXED`/`DISMISSED`), hỗ trợ sửa nội dung câu hỏi ngay tại chỗ (`questionUpdate`), tự động đóng theo mọi báo cáo `PENDING` khác cùng câu hỏi (batch), tự kích hoạt lại câu hỏi nếu đang bị auto-hide
- **Bảng `question_edit_history`**: lưu snapshot nội dung câu hỏi trước mỗi lần admin sửa qua luồng resolve báo cáo
- **Form "Sửa & Đánh dấu đã sửa"** (Admin) — sửa nội dung câu hỏi ngay trong trang xử lý báo cáo, không cần chuyển sang trang Ngân hàng câu hỏi
- **`text-similarity.utils.ts`** — `normalizeText()` + `textSimilarity()` (Jaccard similarity trên tập từ đã chuẩn hoá, bỏ dấu tiếng Việt)

### Changed

- ⚠️ **Breaking**: `PATCH /api/admin/questions/reports/:id` (cũ) đã bị **xoá**, thay bằng `PATCH /api/admin/questions/reports/:id/resolve` — chỉ nhận `FIXED`/`DISMISSED` (không còn `REVIEWED`)
- ⚠️ **Breaking**: `GET /api/admin/questions/reports/summary` đổi field `pending`→`pendingReports`, `reviewed`→`pendingQuestions` (ý nghĩa khác hẳn: số dòng báo cáo vs số câu hỏi khác nhau)
- ⚠️ **Đổi hành vi auto-hide**: trước đây xử lý xong báo cáo KHÔNG tự hiện lại câu hỏi bị ẩn (phải khôi phục thủ công); từ nay `status=FIXED` sẽ **tự động** set `isActive=true` nếu câu đang bị auto-hide
- Tab Admin Dashboard "Báo cáo câu hỏi" đổi tên/vị trí thành sub-tab "Báo cáo lỗi" bên trong tab cha "Câu hỏi" (cùng chỗ với "Bài học sinh gửi")
- `question-bank.service.ts` `addFromBank()` — thêm side-effect fire-and-forget cộng điểm usage (Compare-And-Swap, không áp dụng cho `auto-fill`)

### Fixed (phát hiện trong review S3, trước khi merge)

- Race condition khi 2 admin cùng duyệt 1 submission — có thể tạo 2 bản ghi Ngân hàng câu hỏi trùng lặp + thưởng điểm 2 lần → sửa bằng "claim" pattern (`updateMany` điều kiện `status=PENDING`)
- Race condition khi học sinh sửa/xoá đúng lúc admin vừa xử lý xong submission → đổi `update`/`delete` đơn thành `updateMany`/`deleteMany` có điều kiện
- Lost update trên điểm "usage" khi 2 `addFromBank` chạy song song cho cùng 1 câu hỏi (có thể vô hiệu hoá trần 100đ/câu) → sửa bằng Compare-And-Swap có retry

---

## [v1.11.0] — Notifications — Thông báo hệ thống (Feature 013)

**Branch:** `feature/notifications` (đã merge vào `master`)
**Ngày:** 2026-07-13

### Added

- **Bảng DB `notifications`** với enum `NotificationType` (5 loại: STREAK_MILESTONE, RANK_UP, RANK_DOWN, REPORT_RESOLVED, NEW_EXAM_PAPER)
- **`NotificationService`** — 5 methods: createNotification, getNotifications, getUnreadCount, markAsRead, markAllAsRead
- **4 API endpoints**: `GET /api/notifications`, `GET /api/notifications/unread-count`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`
- **Streak milestone trigger** trong `practice.completeSession()` — notify khi đạt [7, 14, 30, 60, 100] ngày liên tiếp (chỉ lần đầu trong ngày)
- **Rank change trigger** trong `exam.submitExam()` — query rank trước và sau khi nộp bài, notify nếu hạng thay đổi
- **Report resolved trigger** trong `practice.updateReport()` — notify khi admin chuyển trạng thái từ PENDING
- **New exam paper trigger** trong `exam.updateExamPaper()` — batch notify tất cả user học môn đó khi đề thi được bật active
- **Bell icon 🔔** trong ProfilePage header với badge đỏ hiện số thông báo chưa đọc
- **NotificationPanel** (drawer slide-in) với chức năng đánh dấu đọc từng/tất cả thông báo, và điều hướng sang màn hình tương ứng theo `targetScreen` (progress/leaderboard/exam) khi bấm vào một thông báo
- **NotificationToast** — toast pop-up 7 giây khi có thông báo mới
- **Polling 30 giây** trong App component — gọi `/unread-count`, cập nhật badge và trigger toast
- **`src/utils/streak.utils.ts`** — tách `computeStreaks()` và `STREAK_MILESTONES` ra shared utility (tránh circular dependency)
- **`leaderboardService.getUserCurrentRank()`** — slim query chỉ lấy hạng hiện tại (không kèm trend)

### Changed

- `progress.service.ts` — import `computeStreaks` từ utils thay vì define lại cùng logic
- `exam.service.ts` — thêm rank-before query trước vòng retry transaction
- `practice.service.ts` — `updateReport()` thêm pre-query để lấy userId và status trước khi update

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
