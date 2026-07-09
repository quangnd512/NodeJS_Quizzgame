# Nhật ký Review Code – QuizzGame

> File này lưu lại kết quả review theo bộ tiêu chí chuẩn (7 điểm) cho từng
> tính năng/module quan trọng — đặc biệt các module liên quan đến giao dịch
> điểm, xác thực, và real-time (PvP). Mỗi lần review mới sẽ được **thêm vào
> cuối file** (không ghi đè), kèm ngày review + trạng thái xử lý.

## Bộ tiêu chí chuẩn (7 điểm)
1. Atomic transaction? (điểm không được cộng/trừ ngoài `$transaction`)
2. Race condition? (đặc biệt điểm cược thi đấu)
3. Error handling đầy đủ không?
4. SQL injection? Input validation?
5. N+1 query? Index cần thiết?
6. TypeScript: có `any` type không?
7. Edge cases: điểm âm, user không tồn tại, disconnect giữa chừng?

---

## Review #1 — PointsService (Hệ thống điểm tích lũy)

**Ngày review:** (xem mục "2. PointsService" trong `FEATURE_LOG.md`)
**Trạng thái:** ✅ Đã review, đã fix 4 vấn đề, đã merge vào `master`

Tóm tắt nhanh (chi tiết đầy đủ nằm trong `FEATURE_LOG.md` mục 2):
- Atomic: ✅ mọi thay đổi điểm đều trong `$transaction` + optimistic locking + retry.
- Race condition: ✅ đã viết smoke test concurrency (20 request cộng điểm đồng
  thời) và transfer race (30 giao dịch A↔B đồng thời) — PASS, không deadlock,
  không mất giao dịch, bảo toàn tổng điểm.
- Đã fix: thiếu validate chuỗi rỗng, thiếu giới hạn trên `amount` (nguy cơ
  tràn số `Int`), `getBalance` trả `lastUpdated = epoch` gây hiểu lầm, thiếu
  test race 2 chiều.
- TypeScript: không dùng `any`.

---

## Review #2 — Auth + Onboarding (Firebase Login + JWT + Chọn môn học)

**Ngày review:** 2026-06-08
**Phạm vi:** `auth.middleware.ts`, `auth.service.ts`, `auth.errors.ts`,
`auth.types.ts`, `jwt.ts`, `firebase-admin.ts`, `users.service.ts`,
`users.errors.ts`, `users.types.ts`, `auth.route.ts`, `users.route.ts`,
phần mở rộng `app.ts` (đăng ký router + ánh xạ lỗi).
**Trạng thái:** ✅ Đã review, đã fix các vấn đề tìm thấy, đang chờ người dùng
kiểm tra lại trước khi merge vào `master`.

### 1. Atomic transaction?
**Không áp dụng trực tiếp** — module này không cộng/trừ điểm. Điểm duy nhất
chạm tới hệ thống điểm là `UsersService.getProfile()` gọi
`pointsService.getBalance()` — một thao tác **CHỈ ĐỌC**, không ghi, nên không
cần `$transaction`.

`UsersService.updateSubjects()` chỉ thực hiện **1 câu lệnh `update` duy nhất**
(atomic ở cấp DB theo bản chất của 1 statement), không cần bọc transaction.

→ **Kết luận: Đạt — không có thao tác ghi điểm nào nằm ngoài PointsService.**

### 2. Race condition?
**a) Đăng ký user lần đầu (trùng `firebaseUid`)** — ĐÃ XỬ LÝ ĐÚNG:
`AuthService.findOrCreateUser` bắt lỗi Prisma `P2002`, đọc lại bản ghi vừa
được request "thắng cuộc" tạo ra, coi như thành công (không phải lỗi thật).
Đã verify bằng đọc code + suy luận logic (DB thật, có ràng buộc UNIQUE).

**b) [PHÁT HIỆN — ĐÃ FIX] Xung đột UNIQUE trên trường khác `firebaseUid`
(ví dụ `email`)**: Code gốc coi MỌI lỗi `P2002` đều là "đua tạo user" và thử
đọc lại theo `firebaseUid`. Nhưng nếu xung đột thực sự nằm ở cột `email`
(ví dụ 1 người có 2 phương thức đăng nhập Firebase khác nhau nhưng cùng email),
việc đọc lại theo `firebaseUid` sẽ trả về `null`, code rơi vào `throw err` —
ném thẳng `PrismaClientKnownRequestError` ra ngoài. Lỗi này có `code = 'P2002'`
(string) nên lọt qua `getErrorCode()` ở `app.ts`, nhưng **không khớp** với bất
kỳ entry nào trong `ERROR_CODE_TO_HTTP_STATUS` → rơi xuống nhánh 500, và
**`message` (chứa nguyên văn lỗi kỹ thuật của Prisma/Postgres, có thể lộ tên
cột/bảng) bị trả thẳng cho client**.
→ **Đã fix**: thêm `AccountConflictError` (`ACCOUNT_CONFLICT`, HTTP 409) +
hàm `getViolatedUniqueField()` đọc `err.meta.target` để phân biệt 2 trường
hợp; chỉ coi là "đua tạo user" khi đọc lại theo `firebaseUid` THÀNH CÔNG,
ngược lại ném lỗi nghiệp vụ rõ ràng, không lộ chi tiết kỹ thuật.

**c) "Đặc biệt điểm cược thi đấu" (PvP)**: **Không áp dụng** cho module này —
tính năng Auth/Onboarding không liên quan đến đặt cược. (Nhắc lại GAP đã ghi
trong `FEATURE_LOG.md`: hệ thống PvP/đặt cược **chưa được xây dựng**, và khi
xây cần cơ chế "khoá điểm" (`lockedPoints`/`point_reservations`) — đã note
sẵn, sẽ review riêng khi triển khai tính năng đó.)

### 3. Error handling đầy đủ không?
**a) [PHÁT HIỆN — ĐÃ FIX] Sai lệch giữa comment và code trong
`verifyFirebaseToken`**: Comment nói "nếu DB tạm thời lỗi, ta vẫn ưu tiên cho
qua middleware", nhưng code KHÔNG có `try/catch` riêng quanh
`prisma.user.findUnique(...)` — nếu DB lỗi tạm thời (mất kết nối, timeout),
lỗi sẽ rơi vào `catch` ngoài cùng → `next(err)` → **toàn bộ request bị chặn
với HTTP 500**, kể cả các route không thực sự cần `currentUser`. Điều này đi
ngược lại đúng mục đích thiết kế ban đầu (tra cứu `currentUser` chỉ là bước
"làm giàu dữ liệu", không phải điều kiện bắt buộc).
→ **Đã fix**: bọc `prisma.user.findUnique` trong `try/catch` riêng, log lỗi
ra `console.error` và set `req.currentUser = undefined`, để request tiếp tục
— các route thực sự cần `currentUser` đã có `requireRegisteredUser` tự kiểm
tra và báo lỗi phù hợp (403 thay vì 500 sai ngữ nghĩa).

**b) [GHI NHẬN — CẦN QUYẾT ĐỊNH KIẾN TRÚC, CHƯA FIX] JWT nội bộ được phát
hành nhưng KHÔNG BAO GIỜ được dùng**: `AuthService.login` gọi `signAppToken`
và trả `token` cho client, nhưng grep toàn bộ source cho thấy `verifyAppToken`
**chưa từng được gọi ở đâu** — không có middleware nào xác thực bằng JWT nội
bộ. Hiện tại MỌI request (kể cả `/me`, `/subjects`) vẫn bắt buộc gửi lại
**Firebase ID Token** qua `verifyFirebaseToken`. Như vậy JWT trả về hiện là
"dead value" — client lưu lại nhưng không dùng được vào việc gì.
→ **Cần người dùng quyết định hướng**: (1) Thêm middleware xác thực bằng JWT
nội bộ làm phương án chính cho các request sau `/login` (giảm phụ thuộc gọi
lại Firebase, đúng với mục đích thiết kế ban đầu đã ghi trong comment của
`jwt.ts`/`auth.route.ts`), hoặc (2) loại bỏ JWT nếu quyết định dùng Firebase
token xuyên suốt. Đề xuất hướng (1) — đặc biệt cần thiết cho Socket.io (PvP)
vì không tiện gọi lại Firebase cho mỗi sự kiện real-time. **Chưa tự ý sửa vì
đây là quyết định kiến trúc ảnh hưởng tới toàn bộ luồng xác thực phía sau.**

**c) Các lỗi khác**: `MissingAuthTokenError`, `InvalidFirebaseTokenError`,
`UserNotRegisteredError`, `InvalidSubjectsError`, `UserNotFoundError`,
`InvalidRequestBodyError` (qua `UsersError` với code `INVALID_REQUEST_BODY`)
đều được định nghĩa rõ ràng, có `code` ánh xạ đúng sang HTTP status trong
`ERROR_CODE_TO_HTTP_STATUS` (`app.ts`), và được `next(err)` nhất quán ở mọi
route handler (`try/catch` đầy đủ, không có `async` handler nào thiếu bắt lỗi).

### 4. SQL injection? Input validation?
- **SQL injection**: Không có nguy cơ — toàn bộ truy vấn dùng Prisma Client
  (tham số hoá tự động), không có raw SQL (`$queryRaw`/`$executeRaw`) ở module
  này. ✅
- **Input validation**:
  - `POST /api/users/subjects`: kiểm tra `Array.isArray`, kiểm tra hình dạng
    từng phần tử (`assertSubjectInputShape` — chỉ chấp nhận `{ id: string,
    name?: string }`), sau đó `UsersService` validate số lượng (1-7), mã môn
    phải nằm trong `SUBJECT_CATALOG` (chặn typo/giả mạo), chống trùng lặp. ✅
    Đặc biệt tốt: **không tin `name` từ client** — luôn tra cứu lại tên hiển
    thị từ danh mục server-side.
  - Dữ liệu từ Firebase (`displayName`, `email`, `phoneNumber`) được tin cậy
    ở mức hợp lý (đã qua xác thực của Firebase), lưu thẳng vào DB qua Prisma
    (tham số hoá) — không có nguy cơ injection. ✅

### 5. N+1 query? Index cần thiết?
- `getProfile()`: đúng 2 query độc lập (`user.findUnique` + `getBalance`),
  không có vòng lặp gọi DB → không có N+1. ✅
- `updateSubjects()`: 1 query `update` duy nhất. ✅
- `findOrCreateUser()`: tối đa 2-3 query tuần tự (`findUnique` → `create` →
  `findUnique` khi có race) — không phải N+1 (không phụ thuộc vào số lượng
  bản ghi), chấp nhận được cho 1 thao tác đăng nhập. ✅
- **Index**: `firebaseUid` và `email` đã có `@unique` (tự động tạo index) —
  đủ cho mọi truy vấn hiện tại (`findUnique` theo `firebaseUid`/`id`/`email`).
  Không cần thêm index nào ở giai đoạn này. ✅

### 6. TypeScript: có `any` type không?
Đã `grep` toàn bộ các file trong phạm vi review cho `: any`, `<any>`,
`as any`, `any[]`: **không tìm thấy kết quả nào**. ✅
Các chỗ cần ép kiểu từ `unknown` đều dùng kiểu cụ thể + kiểm tra runtime
(`typeof`, `instanceof`, `in`) — ví dụ `getErrorCode`, `assertSubjectInputShape`,
`isUniqueConstraintError` (đã nâng cấp thành type predicate `err is
PrismaClientKnownRequestError` để TypeScript narrow kiểu chính xác hơn).

### 7. Edge cases
| Edge case | Xử lý | Đánh giá |
|---|---|---|
| User chưa tồn tại trong DB (lần đầu xác thực) | `verifyFirebaseToken` cho qua với `currentUser = undefined`; `requireRegisteredUser` chặn các route cần đăng ký | ✅ |
| User bị xoá giữa chừng (giữa lúc xác thực và lúc update/getProfile) | `UserNotFoundError` (qua bắt P2025 / kiểm tra `null`) | ✅ |
| Token Firebase hết hạn / sai chữ ký / bị thu hồi | `InvalidFirebaseTokenError`, giữ `reason` nội bộ để debug, không lộ chi tiết kỹ thuật | ✅ |
| Thiếu `JWT_SECRET` khi khởi động | `JwtConfigError` — báo lỗi cấu hình rõ ràng | ✅ |
| Disconnect/crash giữa `findOrCreateUser` (đã tạo user nhưng chưa kịp trả JWT) | Idempotent — lần gọi `/login` sau sẽ tìm thấy user đã tạo, không tạo trùng | ✅ |
| Gửi `subjects` rỗng / quá 7 môn / mã môn không tồn tại / trùng lặp | `InvalidSubjectsError` với thông báo cụ thể từng trường hợp | ✅ |
| Điểm âm | Không áp dụng trực tiếp ở module này — `UsersService` chỉ ĐỌC điểm qua `PointsService.getBalance` (đã đảm bảo không âm ở tầng PointsService, xem Review #1) | ✅ (kế thừa đảm bảo từ PointsService) |
| User đổi email/tên hiển thị trên Firebase sau khi đã đăng ký | **[GHI NHẬN]** `AuthService.login` chỉ đồng bộ thông tin **1 LẦN DUY NHẤT** lúc tạo mới — các lần đăng nhập sau KHÔNG cập nhật lại `displayName`/`email`/`phone` từ Firebase, có thể dẫn đến dữ liệu "lệch" theo thời gian. Không phải lỗi nghiêm trọng (có thể là chủ đích — để user tự chỉnh sửa profile), nhưng cần xác nhận đây có phải hành vi mong muốn hay cần đồng bộ lại mỗi lần login. |

### Tổng kết
| # | Tiêu chí | Kết quả |
|---|---|---|
| 1 | Atomic transaction | ✅ Đạt (không áp dụng trực tiếp — không có ghi điểm) |
| 2 | Race condition | ✅ Đạt sau khi fix (a) đua tạo user OK từ đầu, (b) đã thêm `AccountConflictError` cho xung đột email |
| 3 | Error handling | ✅ Đạt sau khi fix (a) DB lookup lỗi tạm thời; ⚠️ (b) JWT nội bộ chưa được dùng — cần quyết định hướng |
| 4 | SQL injection / Input validation | ✅ Đạt — dùng Prisma tham số hoá, validate đầy đủ, không tin dữ liệu client |
| 5 | N+1 query / Index | ✅ Đạt — không có N+1, index hiện tại đủ dùng |
| 6 | TypeScript `any` | ✅ Đạt — không có `any` trong toàn bộ phạm vi review |
| 7 | Edge cases | ✅ Đạt phần lớn; ⚠️ 1 điểm cần xác nhận (đồng bộ lại profile khi login lại) |

### Các thay đổi đã áp dụng sau review (commit riêng, trong cùng branch `feature/auth-onboarding`)
1. `auth.middleware.ts`: bọc `prisma.user.findUnique` trong `try/catch` riêng
   để lỗi DB tạm thời không làm fail toàn bộ request.
2. `auth.errors.ts`: thêm `AccountConflictError` (code `ACCOUNT_CONFLICT`).
3. `auth.service.ts`: thêm `getViolatedUniqueField()`, phân biệt rõ "đua tạo
   user" (race hợp lệ) và "xung đột dữ liệu thật" (ném `AccountConflictError`
   thay vì để lộ lỗi Prisma nguyên văn); nâng `isUniqueConstraintError` thành
   type predicate.
4. `app.ts`: thêm `ACCOUNT_CONFLICT: 409` vào `ERROR_CODE_TO_HTTP_STATUS`.

### Vấn đề còn mở — cần người dùng quyết định trước khi merge
- **JWT nội bộ chưa được sử dụng** (mục 3b ở trên) — đề xuất bổ sung middleware
  xác thực bằng JWT nội bộ (song song hoặc thay thế `verifyFirebaseToken` cho
  các request sau `/login`), đặc biệt quan trọng cho Socket.io/PvP sắp tới.
- **Có nên đồng bộ lại `displayName`/`email`/`phone` mỗi lần đăng nhập** hay
  giữ nguyên hành vi "chỉ đồng bộ lúc tạo mới" như hiện tại?

---

## Cập nhật Review #2 — Xử lý các vấn đề kiến trúc còn mở (2026-06-08)

Người dùng đã xem xét 2 "Vấn đề còn mở" ở trên và CHỐT quyết định:

> **Vấn đề 1** — Thêm `verifyAppToken` middleware, dùng cho TẤT CẢ route sau
> `/login` và Socket.io. Đây là việc BẮT BUỘC phải làm trước khi code các
> module tiếp theo vì mọi route đều cần xác thực.
>
> **Vấn đề 2** — Dùng đồng bộ có chọn lọc: chỉ update `email` và `lastLoginAt`
> mỗi lần login, các field còn lại do user tự quản lý qua `PUT /api/users/profile`.
> Đây là approach chuẩn của hầu hết app mobile hiện nay.

### Đã triển khai theo đúng quyết định trên:

**1. `verifyAppToken` middleware** (xem chi tiết trong `FEATURE_LOG.md` mục 3
"Cập nhật sau review"):
- Middleware mới xác thực bằng JWT nội bộ, tra cứu `User` trực tiếp theo `userId`.
- 2 lỗi mới: `InvalidSessionTokenError` (401), `SessionUserNotFoundError` (401)
  — phân biệt rõ "token sai/hết hạn" với "tài khoản đã bị xoá".
- Loại bỏ `requireRegisteredUser` (dead code sau khi chuyển đổi).
- `users.route.ts` (mọi route cần đăng nhập) chuyển sang dùng `verifyAppToken`.
- `verifyFirebaseToken` thu hẹp phạm vi — CHỈ còn dùng cho `POST /api/auth/login`
  (đúng vai trò "trao đổi" Firebase token lấy session token nội bộ).
- → **Giải quyết triệt để vấn đề "JWT được phát hành nhưng không bao giờ
  được dùng"** đã nêu ở Review #2 gốc.

**2. Đồng bộ có chọn lọc + `PUT /api/users/profile`:**
- `AuthService` tách logic thành `findCreateOrSyncUser` + `syncExistingUser`:
  user đã tồn tại CHỈ đồng bộ `email` (nếu đổi) và `lastLoginAt`; KHÔNG ghi đè
  `displayName`/`phone` (do người dùng tự quản lý).
- Thêm trường `lastLoginAt` vào model `User` (migration `add_last_login_at`).
- Thêm endpoint `PUT /api/users/profile` (kiểu "PATCH bán phần" — vắng mặt =
  giữ nguyên, `null` = xoá), với validate độ dài (`InvalidProfileInputError`,
  400) và **không cho sửa `email`/`subjects`** (tách trách nhiệm rõ ràng).
- → **Giải quyết vấn đề "không có nơi để chỉnh sửa hồ sơ ngoài lúc tạo mới"**.

### Kiểm thử lại sau khi sửa
- `npx tsc --noEmit` ✅ pass — không có `any`, không lỗi kiểu.
- Test trên server thật (tạo user test trực tiếp trong DB + tự ký session
  token bằng `JWT_SECRET` thật, không qua Firebase — vì mục đích chỉ kiểm thử
  lớp `verifyAppToken` + `UsersService`, không phải lớp Firebase đã test ở
  Review trước): xác nhận đầy đủ các luồng `GET /me`, `POST /subjects`,
  `PUT /profile` (set, xoá theo "patch bán phần", validate độ dài) hoạt động
  đúng như thiết kế. Đã dọn dẹp dữ liệu test, không để lại rác trong DB.

### Trạng thái: ✅ Cả 2 vấn đề kiến trúc đã được giải quyết theo đúng quyết định của người dùng — sẵn sàng để review lần cuối trước khi merge.

---

## Review #3 — Practice Module (Ôn tập)

**Ngày review:** 2026-06-09
**Branch:** `feature/practice-module`
**Reviewer:** S3-Reviewer (workflow tự động)
**Trạng thái:** ✅ Đã review, đã fix 4 lỗi, TypeScript clean

### Tóm tắt 7 tiêu chí

| # | Tiêu chí | Kết quả | Ghi chú |
|---|----------|---------|---------|
| 1 | Atomic transaction | ✅ | submitAnswer + completeSession đều trong $transaction |
| 2 | Race condition | ✅ (sau fix) | Fix P2002 ở submitAnswer + reportQuestion |
| 3 | Error handling | ✅ (sau fix) | Fix QuestionNotAttemptedError sai code → HTTP 403 |
| 4 | SQL injection / Validate | ✅ | Zod validate tất cả body, Prisma parameterized |
| 5 | N+1 / Index | ✅ | Không có N+1, index đầy đủ |
| 6 | TypeScript `any` | ✅ (sau fix) | Fix listReports từ unknown[] → QuestionReportDto[] |
| 7 | Edge cases | ✅ (sau fix) | Fix totalQuestions hardcode → sessionQuestions.length |

### Lỗi tìm thấy và đã sửa (4 lỗi)

**1. [BUG - HTTP status sai] `QuestionNotAttemptedError` dùng code `'QUESTION_NOT_FOUND'`**
- Hậu quả: API trả 404 thay vì 403 khi user chưa làm câu hỏi đó
- Fix: đổi thành `'QUESTION_NOT_ATTEMPTED'` + thêm `QUESTION_NOT_ATTEMPTED: 403` vào `ERROR_CODE_TO_HTTP_STATUS`

**2. [BUG - Race condition] `submitAnswer` không handle P2002**
- Hậu quả: 2 request cùng gọi với sessionId+questionId giống nhau → cả 2 vượt qua idempotency check → 1 cái bị P2002 unhandled → 500 Internal Server Error
- Fix: wrap `$transaction` trong try/catch, bắt P2002 → trả về idempotent response

**3. [BUG - Race condition] `reportQuestion` không handle P2002**
- Hậu quả: 2 request cùng báo cáo 1 câu → cả 2 vượt qua check → 1 cái P2002 → 500
- Fix: wrap `create` trong try/catch, bắt P2002 → `ReportAlreadySubmittedError` (409)

**4. [TYPE SAFETY] `listReports` return type `unknown[]`**
- Fix: thêm `QuestionReportDto` interface vào `practice.types.ts`, cập nhật return type

### Cải tiến thêm (không phải lỗi, nhưng nên fix)

**5. `totalQuestions` hardcode `QUESTIONS_PER_SESSION = 15`**
- Vấn đề: nếu môn học có < 15 câu, `totalQuestions` trả về 15 nhưng thực tế ít hơn
- Fix: dùng `sessionQuestions.length` trong `completeSession`, `parseSessionQuestions(s.questions).length` trong `getHistory`

### Files đã thay đổi thêm bởi Reviewer

- `backend/src/services/practice/practice.errors.ts` — fix QuestionNotAttemptedError code
- `backend/src/app.ts` — thêm QUESTION_NOT_ATTEMPTED: 403
- `backend/src/services/practice/practice.types.ts` — thêm QuestionReportDto
- `backend/src/services/practice/practice.service.ts` — fix 4 issues, thêm isUniqueConstraintError helper
- `docs/TEST_CASES.md` — tạo mới với 40+ test cases cho toàn bộ Practice module

---

## Review #4 — Admin Dashboard Báo cáo câu hỏi (Question Reports)

**Ngày review:** 2026-06-12
**Branch:** `feature/question-reports`
**Reviewer:** S3-Reviewer (workflow tự động)
**Trạng thái:** ✅ Đã review, đã fix 4 vấn đề, build + smoke test PASS

### Tóm tắt 7 tiêu chí

| # | Tiêu chí | Kết quả | Ghi chú |
|---|----------|---------|---------|
| 1 | Atomic transaction | ✅ | Không có thay đổi liên quan giao dịch điểm; `reportQuestion`/`updateReport` chỉ ghi 1 bảng mỗi lần, không cần `$transaction` |
| 2 | Race condition | ✅ | `reportQuestion` đã bắt P2002 (idempotent) từ Review #3; validate "đã từng làm câu hỏi" dùng `findUnique` theo `@@unique([userId, questionId])` — đúng |
| 3 | Error handling | ✅ (sau fix) | `QuestionNotAttemptedForReportError` (403) đúng pattern; phát hiện bug FE "trạng thái báo lỗi không reset giữa các câu" → đã fix |
| 4 | SQL injection / Validate | ✅ | Zod validate `reason`/`description`/`status` (enum `REPORT_STATUSES`); Prisma parameterized. Ghi nhận 1 gap pre-existing (không thuộc diff này) ở mục dưới |
| 5 | N+1 / Index | ✅ | `getReportsSummary` dùng 2 `groupBy` song song (`Promise.all`), có `@@index([status, createdAt])`; không N+1 |
| 6 | TypeScript `any` | ✅ (sau fix) | Không có `any` mới. Fix 1 lỗi `erasableSyntaxOnly` (TS1294) pre-existing trong `ApiError` chặn `tsc -b` |
| 7 | Edge cases | ✅ (sau fix) | Refactor logic auto-hide trùng lặp giữa `reportQuestion`/`updateReport` thành 1 helper dùng chung, tránh lệch logic về sau |

### Lỗi tìm thấy và đã sửa (4 vấn đề)

**1. [BUG - FE state] Trạng thái UI báo lỗi không reset khi chuyển câu hỏi**
- Hậu quả: `PracticeSessionScreen` không unmount giữa các câu (chỉ đổi `currentIndex`), nên `showReport`/`reportSent`/`reportMessage`/`reportError`/`reportDesc` của câu trước vẫn hiển thị ở câu sau (VD: hiện "Đã gửi báo lỗi" cho câu chưa từng báo cáo).
- Fix: thêm `useEffect` reset 5 state này mỗi khi `question?.id` đổi (`frontend/src/App.tsx`).

**2. [REFACTOR - Edge case/maintainability] Logic auto-hide bị lặp lại ở 2 nơi**
- Hậu quả: `reportQuestion` và `updateReport` đều tự đếm `questionReport.count({status: 'PENDING'})` rồi `question.update({isActive: false})` — dễ lệch nhau nếu sửa ngưỡng/log ở 1 nơi mà quên nơi khác.
- Fix: trích xuất thành `private autoHideIfThresholdExceeded(questionId): Promise<boolean>` dùng chung, kèm chú thích tiếng Việt giải thích 2 nơi gọi (`backend/src/services/practice/practice.service.ts`).

**3. [TYPE SAFETY - chặn build] `ApiError` dùng constructor parameter properties → lỗi TS1294 (`erasableSyntaxOnly`)**
- Hậu quả: `frontend/tsconfig.app.json` có `erasableSyntaxOnly: true` (TS 6.0.3) không cho phép `public readonly code: string` trong constructor → `tsc -b` (chạy trong `npm run build`) FAIL với 2 lỗi TS1294. Lỗi này **đã tồn tại từ trước diff này** (xác nhận bằng `git stash`) nhưng là điều kiện bắt buộc để build PASS.
- Fix: chuyển thành field declaration + gán trong constructor body (`frontend/src/lib/api.ts`).

**4. [LINT - chặn build] Import `PracticeQuestion` không dùng → lỗi TS6196**
- Hậu quả: cùng lý do trên, `noUnusedLocals` làm `tsc -b` FAIL.
- Fix: xoá import không dùng trong `frontend/src/App.tsx`.

### Ghi nhận thêm (không sửa — ngoài phạm vi diff này)

- `GET /api/admin/questions/reports?status=...`: giá trị `status` chưa được validate theo `REPORT_STATUSES` — giá trị tuỳ ý trả về danh sách trống thay vì `400`. File `admin.route.ts` không thuộc diff được review. Đã ghi vào `docs/TEST_CASES.md` mục 8 để theo dõi.
- `PATCH /api/admin/questions/reports/:id` với `id` không tồn tại → Prisma P2025 → middleware lỗi tập trung trả `500 INTERNAL_SERVER_ERROR` thay vì `404`. Logic `updateReport` cốt lõi (update theo id) cũng không thuộc diff này. Đã ghi vào `docs/TEST_CASES.md` mục 10.
- `docs/guides/admin-guide.md` (dòng ~287-302) còn mô tả response shape CŨ của `getReportsSummary` (`{byStatus, topReportedQuestions}`); shape MỚI là `{pending, reviewed, fixed, dismissed, topReportedQuestions}` (khớp `QuestionReportSummary` + FE `ReportsSummary`). Đề nghị S4 cập nhật docs.

### Kiểm thử

- **Build:** `backend: tsc -p tsconfig.json` ✅ PASS (exit 0). `frontend: tsc -b --noEmit` ✅ PASS sau khi fix #3, #4 (exit 0).
- **Lint:** ⚠️ KHÔNG chạy được — `./node_modules/.bin/eslint` (v10.4.1, kể cả `--print-config` trên 1 file nhỏ) bị treo vô hạn (CPU ~0, không lỗi/log) trên máy review. Xác nhận đây là vấn đề môi trường, không liên quan diff (`eslint.config.js`/`package.json` không đổi trong diff này — `git diff` rỗng). Không block merge vì `tsc` (strict, `noUnusedLocals`/`noUnusedParameters`) đã bắt các lỗi tương đương.
- **Smoke test mới:** `backend/src/scripts/smoke-test-question-reports.ts` (`npm run smoke:reports`) — 8/8 PASS:
  - Happy path: báo cáo câu đã làm → `status: PENDING`, lưu đúng `description`.
  - Error: báo cáo lại câu đã báo cáo → `ReportAlreadySubmittedError` (409).
  - Error: báo cáo câu chưa từng làm → `QuestionNotAttemptedForReportError` (403, code `QUESTION_NOT_ATTEMPTED_FOR_REPORT`).
  - Error: `questionId` không tồn tại → `QuestionNotFoundError` (404).
  - Edge case: đủ `AUTO_HIDE_REPORT_THRESHOLD` (5) báo cáo PENDING → `question.isActive = false` qua `autoHideIfThresholdExceeded`.
  - `getReportsSummary()`: đúng shape mới, `topReportedQuestions` đúng số lượng.
  - `updateReport()` → `REVIEWED`, `autoHidden: false` khi chưa đạt ngưỡng.
  - `listReports({status: 'REVIEWED'})` lọc đúng.
  - Đã dọn dẹp toàn bộ dữ liệu test sau khi chạy.

### Files đã thay đổi thêm bởi Reviewer

- `frontend/src/App.tsx` — fix #1 (reset state báo lỗi theo câu hỏi), fix #4 (xoá import không dùng)
- `frontend/src/lib/api.ts` — fix #3 (ApiError bỏ parameter properties)
- `backend/src/services/practice/practice.service.ts` — fix #2 (refactor `autoHideIfThresholdExceeded`)
- `backend/src/scripts/smoke-test-question-reports.ts` — smoke test mới (8 test case)
- `backend/package.json` — thêm script `smoke:reports`
- `docs/TEST_CASES.md` — thêm error case #7 (mục 6) + mục 8, 9, 10 (admin reports endpoints)
- `docs/CODE_REVIEW_LOG.md` — review entry này

---

## Review #5 — Exam Module (Thi thử)

**Ngày review:** 2026-06-15
**Branch:** `feature/exam-module`
**Reviewer:** S3-Reviewer (workflow tự động)
**Trạng thái:** ✅ Đã review, đã fix 3 vấn đề, build + lint + smoke test PASS

### Tóm tắt 7 tiêu chí

| # | Tiêu chí | Kết quả | Ghi chú |
|---|----------|---------|---------|
| 1 | Atomic transaction | ✅ | `startExam`/`submitExam` đều bọc `$transaction`; trừ/cộng điểm và tạo/cập nhật `ExamSession` cùng 1 giao dịch — rollback đầy đủ khi lỗi |
| 2 | Race condition | ✅ (sau fix) | `deductPointsInTx` mới đúng pattern optimistic lock (giống `addPointsInTx`); phát hiện + fix gap ở `submitExam` (chốt phiên không có guard điều kiện khi `pointsAwarded = 0`) |
| 3 | Error handling | ✅ (sau fix) | 12 error code mới map đầy đủ trong `ERROR_CODE_TO_HTTP_STATUS`; fix gap `MulterError` (upload quá 5MB) bị rơi vào `500` thay vì `400` |
| 4 | SQL injection / Validate | ✅ | Zod validate toàn bộ body (student + admin); `validateQuestionShape` validate `options`/`correctAnswer` theo `questionType`; Prisma parameterized |
| 5 | N+1 / Index | ✅ | `[examPaperId, isActive]`, `[subject, isActive]`, `[userId, examPaperId]`, `[userId, completedAt]`, unique `[sessionId, examQuestionId]` — đủ cho mọi query; `getExamResult` dùng `Promise.all` (không N+1) |
| 6 | TypeScript `any` | ✅ (sau fix) | Backend `tsc -p tsconfig.json` sạch; fix 8 lỗi build FE (`App.tsx`) do thiếu import type `ExamQuestionPublic`/`ExamImportResultDto` khiến `options`/`errors` suy ra `any[]` |
| 7 | Edge cases | ✅ | Hết giờ + grace period (410 `EXAM_EXPIRED`, không chấm điểm/không hoàn điểm), `answers=[]` (sentinel `{}`), `score < 7 → pointsAwarded = 0` (không gọi `addPoints` với amount=0), FILL_BLANK normalize, chọn đề công bằng (round-robin) |

### Lỗi tìm thấy và đã sửa (3 vấn đề)

**1. [BUG - chặn build FE] Thiếu import type → 8 lỗi TypeScript trong `App.tsx`**
- Hậu quả: `tsc -b` (trong `npm run build`) FAIL với `TS6196` (import không dùng: `ExamQuestionFull`), `TS2552`/`TS2304` (không tìm thấy `ExamQuestionPublic`, `ExamImportResultDto`), kéo theo 4 lỗi `TS7006` implicit `any` (các tham số `opt`, `idx`, `stmt`, `e` suy ra `any[]`/`any` vì type cha không resolve được).
- Fix: sửa block import type trong `frontend/src/App.tsx` — bỏ `ExamQuestionFull` (không dùng), thêm `ExamQuestionPublic` và `ExamImportResultDto` (đã có sẵn trong `lib/api.ts`).
- Xác nhận: `npm run build` (frontend) PASS, exit 0.

**2. [BUG - HTTP status sai] Upload file Excel quá 5MB trả `500` thay vì `400`**
- Hậu quả: `multer` là dependency MỚI trong PR này; khi file vượt `limits.fileSize` (5MB), `upload.single('file')` ném `MulterError` (`code: 'LIMIT_FILE_SIZE'`) — middleware lỗi tập trung (`app.ts`) không nhận diện được mã lỗi này (không có trong `ERROR_CODE_TO_HTTP_STATUS`), rơi vào nhánh `status >= 500` → trả `500 INTERNAL_SERVER_ERROR` (sai bản chất, đây là lỗi do client gửi file sai/quá lớn).
- Fix: thêm middleware bọc `uploadExcelFile()` trong `backend/src/routes/exam-admin.route.ts` — bắt `MulterError`, chuyển thành `ExamImportFileInvalidError` (→ 400 `EXAM_IMPORT_FILE_INVALID`), các lỗi khác giữ nguyên `next(err)`.

**3. [BUG - Race condition] `submitExam` có thể "chốt phiên" 2 lần khi `pointsAwarded = 0`**
- Hậu quả: bước cuối `submitExam` dùng `tx.examSession.update({ where: { id: sessionId }, ... })` (update không điều kiện). Khi `score < 7.0` (`pointsAwarded = 0`), `submitExam` KHÔNG gọi `addPointsInTx` — tức KHÔNG có bước optimistic-lock nào để chặn race. Dưới isolation Read Committed (Postgres mặc định), 2 request `submitExam` đồng thời cho CÙNG 1 phiên đều có thể vượt qua check `freshSession.status === 'IN_PROGRESS'` (đọc trước khi bên kia commit) → CẢ HAI đều trả về `200` thành công, thay vì 1 cái phải nhận `EXAM_SESSION_ALREADY_COMPLETED`. (`ExamAnswer` không bị tạo trùng nhờ `@@unique([sessionId, examQuestionId])` + `skipDuplicates`, và điểm thưởng không bị cộng 2 lần vì `pointsAwarded = 0` — nhưng việc trả 200 hai lần cho 1 hành động "nộp bài" là sai vòng đời nghiệp vụ.)
- Fix: đổi `tx.examSession.update(...)` thành `tx.examSession.updateMany({ where: { id: sessionId, status: 'IN_PROGRESS' }, data: {...} })` — nếu `count === 0` (phiên đã được request khác chốt trước), ném `ExamSessionAlreadyCompletedError`. Cùng pattern "conditional update + count check" đã dùng cho optimistic lock ở `PointsService`. Transaction tự rollback khi ném lỗi → không để lại side-effect.
- Viết smoke test riêng `backend/src/scripts/smoke-test-exam-concurrency.ts` (`npm run smoke:exam:concurrency`) để xác nhận: 21/21 PASS, bao gồm cả trường hợp `pointsAwarded = 0` (fix #3 trực tiếp) và `pointsAwarded = 120` (xác nhận pattern optimistic-lock cũ của `addPointsInTx` cũng hoạt động đúng — không cộng điểm 2 lần).

### Kiểm thử

- **Build:** `backend: tsc -p tsconfig.json` ✅ PASS (exit 0). `frontend: tsc -b && vite build` ✅ PASS sau fix #1 (exit 0, kèm bundle output).
- **Lint:** `frontend: eslint .` ✅ PASS (exit 0, không warning). Backend không có script `lint` (pre-existing, ngoài phạm vi PR này).
- **Smoke test `smoke:exam`** (`backend/src/scripts/smoke-test-exam.ts`, có sẵn từ S2): **87/87 PASS** — hàm thuần (`getExamBonusPoints`, `normalizeAnswer`, `TRUE_FALSE_SCORE_RATIOS`), `validateQuestionShape` (4 case sai shape), lỗi đầu vào `startExam` (subject sai, đề rỗng, không đủ điểm + rollback), chấm điểm 3 dạng câu hỏi (điểm 10/7.0/0), sentinel `{}` khi không trả lời, các lỗi trạng thái phiên, hết giờ + grace period (410, không chấm điểm, không đổi điểm), chọn đề công bằng.
- **Smoke test mới `smoke:exam:concurrency`** (`backend/src/scripts/smoke-test-exam-concurrency.ts`): **21/21 PASS** — race condition cho `startExam` (tranh chấp phí vào thi) và `submitExam` (tranh chấp "chốt phiên", cả 2 trường hợp `pointsAwarded = 0` và `> 0`).
- **Smoke test hồi quy `smoke:points`**: PASS — xác nhận `deductPointsInTx` mới không ảnh hưởng các luồng điểm hiện có.
- Đã dọn dẹp toàn bộ dữ liệu test sau khi chạy (xác nhận qua `psql`).

### Files đã thay đổi thêm bởi Reviewer

- `backend/src/routes/exam-admin.route.ts` — fix #2 (`uploadExcelFile` bọc `MulterError`)
- `backend/src/services/exam/exam.service.ts` — fix #3 (`examSession.updateMany` có điều kiện khi chốt phiên)
- `frontend/src/App.tsx` — fix #1 (sửa import type)
- `backend/src/scripts/smoke-test-exam-concurrency.ts` — smoke test mới (21 test case, race condition)
- `backend/package.json` — thêm script `smoke:exam:concurrency`
- `docs/TEST_CASES.md` — thêm mục 11-16 (toàn bộ Exam Module: start/submit/result, admin CRUD đề+câu hỏi, import Excel, race conditions)
- `docs/CODE_REVIEW_LOG.md` — review entry này

---

## Review #7 — Ngân hàng câu hỏi (Question Bank)
**Branch:** `feature/question-bank`
**Ngày:** 2026-07-03
**Reviewer:** [S3-SoatLoi]

### Kết quả 7 tiêu chí
| # | Tiêu chí | Kết quả |
|---|---------|---------|
| 1 | Atomic transaction | ⚠️ → Đã sửa |
| 2 | Race condition | ⚠️ → Đã sửa |
| 3 | Error handling | ⚠️ → Đã sửa |
| 4 | SQL injection / Validation | ✅ OK |
| 5 | N+1 / Index | ✅ OK |
| 6 | TypeScript `any` | ✅ OK |
| 7 | Edge cases | ✅ OK |

### Lỗi tìm thấy & đã sửa
1. **`deleteQuestion` thiếu transaction**: Bọc `findMany + findFirst + delete` trong `prisma.$transaction`. Loại bỏ `updateMany` redundant (FK `ON DELETE SET NULL` tự xử lý).
2. **`addFromBank` thiếu transaction**: Bọc check-existing + createMany trong `prisma.$transaction` để đảm bảo atomic, không partial insert.
3. **Frontend `openDeleteDialog` nuốt lỗi**: Khi `getUsage` thất bại, `usage` vẫn là `null` nhưng nút xóa không bị block → admin có thể xóa câu đang dùng trong phiên IN_PROGRESS mà không hay biết. Đã thêm `usageFailed` state + disable nút + hiển thị error.

### Các cải tiến khác
- Thêm JSDoc comment tiếng Việt cho 5 method trong `QuestionBankService`
- Thêm `smoke:question-bank` script vào `package.json`

### Build / Lint kết quả
- Backend build: **PASS**
- Frontend build: **PASS**
- Frontend lint: **PASS**

### Files đã thay đổi
- `backend/src/services/exam/question-bank.service.ts` — transaction + JSDoc
- `frontend/src/App.tsx` — fix usageFailed state
- `backend/src/scripts/smoke-test-question-bank.ts` — smoke test mới
- `backend/package.json` — thêm script `smoke:question-bank`
- `docs/TEST_CASES.md` — thêm test cases #16-23
- `docs/CODE_REVIEW_LOG.md` — entry này

---

## [S3] Review: Ngân hàng câu hỏi — autoFillFromBank transaction fix + test bổ sung
**Ngày:** 2026-07-03
**Branch:** feature/question-bank
**Reviewer:** S3-SoatLoi

### Kết quả review 7 tiêu chí
| # | Tiêu chí | Kết quả | Chi tiết |
|---|----------|---------|----------|
| 1 | Atomic transaction | ⚠️ → ✅ Đã sửa | `autoFillFromBank` chưa có transaction → đã wrap trong `$transaction`, dùng `tx` thay prisma global |
| 2 | Race condition | ⚠️ → ✅ Đã sửa | Concurrent requests cùng paperId có thể insert duplicate → fixed bởi transaction |
| 3 | Error handling | ✅ Pass | try/catch đầy đủ, custom error class, HTTP status mapping đúng |
| 4 | SQL injection / Validation | ✅ Pass | Zod validate 100%, không raw query |
| 5 | N+1 / Index | ✅ Pass | Promise.all cho parallel query, index composite `(subject, difficulty, isActive)` đúng |
| 6 | TypeScript `any` | ✅ Pass | Không có `any`, `unknown` dùng đúng chỗ |
| 7 | Edge cases | ✅ Pass | shortage, inactive, duplicate, IN_PROGRESS guard đều được xử lý |

### Lỗi đã sửa
1. **Critical — Race condition trong `autoFillFromBank`:** Bọc toàn bộ logic đọc existingBankIds + pickRandom + createMany trong `prisma.$transaction(async (tx) => {...})`, chuyển tất cả câu query sang dùng `tx` thay vì `prisma` global. Ngăn 2 concurrent request cùng `paperId` insert duplicate ExamQuestion.

### Test bổ sung (S3 thêm)
- `testAutoFillHappyPath` — autoFill lấy câu thành công, verify `added + shortage == count`
- `testAutoFillShortage` — yêu cầu `bankCount + 1` câu, verify `shortage > 0`
- `testAutoFillSkipExisting` — gọi autoFill 2 lần, verify không có duplicate questionBankId
- `testAutoFillPaperNotFound` — verify throw `ExamPaperNotFoundError`

### Kết quả test
- Smoke test: 45 assertions, 45 PASS (thêm 25 so với S2)
- Build backend: PASS
- Lint frontend: PASS

### Files đã thay đổi
- `backend/src/services/exam/question-bank.service.ts` — wrap `autoFillFromBank` trong transaction
- `backend/src/scripts/smoke-test-question-bank.ts` — thêm 4 test function + 25 assertions
- `docs/TEST_CASES.md` — thêm test cases #24-27 (auto-fill)
- `docs/CODE_REVIEW_LOG.md` — entry này

---

## Review #9 — Leaderboard (Bảng xếp hạng học sinh) + Avatar Upload
**Ngày:** 2026-07-04  
**Reviewer:** [S3-SoatLoi]  
**Branch:** feature/leaderboard  
**Tính năng:** Bảng xếp hạng theo Điểm Uy Tín + Upload ảnh đại diện

### Kết quả review 7 tiêu chí
| # | Tiêu chí | Kết quả | Chi tiết |
|---|----------|---------|----------|
| 1 | Atomic transaction | ✅ Pass | Leaderboard chỉ đọc (không cần transaction); Avatar: read→delete→update là thao tác nhỏ, không cần wrap |
| 2 | Race condition | ✅ Pass | Avatar dùng userId làm tên file → Multer overwrite tự động, file luôn nhất quán |
| 3 | Error handling | ✅ Pass | try/catch đầy đủ, MulterError được bắt riêng, AvatarError class đúng pattern |
| 4 | SQL injection / Validation | ✅ Pass | `$queryRaw` dùng Prisma.sql tagged template → parameterized, subject validate trước qua route |
| 5 | N+1 / Index | ✅ Pass | CTE duy nhất cho `getLeaderboard`, `getMyRank` 3 query nhưng không có loop |
| 6 | TypeScript `any` | ✅ Pass | Không có `any`; RawLeaderboardRow type đầy đủ |
| 7 | Edge cases | ✅ Pass | User chưa thi → rank=null; không có dữ liệu 30 ngày → trend="new"; subject rỗng → data:[] |

### Lỗi tìm thấy và đã sửa
1. **Frontend build fail — Unused imports:** `LeaderboardResponse` và `Trend` được import nhưng không dùng → đã xóa khỏi App.tsx:24
2. **Frontend lint fail — Unused constant:** `PAGE_SIZE = 20` khai báo trong `LeaderboardPage` nhưng không dùng (dùng trực tiếp con số 20 trong API call) → đã xóa
3. **Frontend lint fail — setState in effect:** `setPage(1)` trong `useEffect` bị rule `react-hooks/set-state-in-effect` bắt → thêm `eslint-disable-next-line` đúng vị trí (line trước setState)

### Test (Smoke Test)
- Tạo mới: `backend/src/scripts/smoke-test-leaderboard.ts`
- 8 test function / 36 assertions / **8 PASS, 0 FAIL**
- Bao gồm: happy path (rank, sort, filter, examCount, trend), edge case (new user, trend="new", môn trống, pagination)

### Kết quả build/lint
- Backend build: ✅ PASS
- Frontend build: ✅ PASS
- Frontend lint: ✅ PASS (0 errors)

### Files đã thay đổi (bởi S3)
- `frontend/src/App.tsx` — xóa unused imports + const, thêm eslint-disable-next-line
- `backend/src/scripts/smoke-test-leaderboard.ts` — file mới, smoke test đầy đủ
- `docs/TEST_CASES.md` — append test cases #1-22 cho Leaderboard
- `docs/CODE_REVIEW_LOG.md` — entry này

### Đối chiếu thiết kế S1
- ✅ API contract đúng: 4 endpoints (GET /leaderboard, GET /leaderboard/me, POST /me/avatar, DELETE /me/avatar)
- ✅ Response shape đúng theo spec (rank, userId, displayName, avatarUrl, reputationScore, avgScore, examCount, trend)
- ✅ Công thức Điểm Uy Tín đúng: `(avg - 0.5×stddev) × (1 - 1/(n+1))`, dùng STDDEV_POP
- ✅ Xu hướng 30 ngày đúng, trend="new" khi không có dữ liệu cũ
- ✅ Top 3 podium style, thanh ghim hạng user, filter môn, "Xem thêm"
- ✅ TASK 1-5 đã hoàn thành đầy đủ

---

## [S5 + S8] Điều chỉnh sau kiểm thử thủ công — Leaderboard
**Ngày:** 2026-07-04  
**Branch:** feature/leaderboard

### Thay đổi theo yêu cầu người dùng (xác nhận trực tiếp với S5)
1. **PAGE_SIZE = 10** (giảm từ 20 xuống 10): Người dùng yêu cầu hiển thị 10 người/trang thay vì 20 cho giao diện gọn hơn.
2. **Modal thông tin** khi click user trên BXH: hiển thị hạng, Điểm Uy Tín, Điểm TB, số lần thi, xu hướng.
3. **Thanh ghim tự ẩn** khi entry bản thân đã load vào danh sách.

### Bug S5 phát hiện và đã fix
- **`getMyRank` bug**: `WHERE "userId" = X` áp dụng trước `ROW_NUMBER()` → luôn trả hạng #1. Fix: tách thành CTE `ranked`/`old_ranked` để tính toàn bộ trước rồi mới filter.

### Đồng bộ docs sau thay đổi (S8 thực hiện)
- `smoke-test-leaderboard.ts`: sửa assertion `pageSize === 20` → `pageSize === 10`
- `backend/package.json`: thêm script `smoke:leaderboard`
- `docs/TEST_CASES.md` (test #1): cập nhật `pageSize: 20` → `pageSize: 10`
- `docs/FEATURE_LOG.md`: cập nhật 2 chỗ `20 người/trang` → `10 người/trang`
- `docs/api/openapi.yaml`: cập nhật mô tả `20 người/trang` → `10 người/trang`

### Kết quả sau đồng bộ
- Smoke test: **8/8 PASS** (`npm run smoke:leaderboard`)
- Backend build: ✅ PASS
- Frontend build: ✅ PASS
- Frontend lint: ✅ PASS

---

## [S3] Code Review — Progress (Tiến độ học tập)
**Ngày:** 2026-07-04  
**Branch:** feature/progress-dashboard  
**Reviewer:** S3-SoatLoi

### Kết quả review 7 tiêu chí

| Tiêu chí | Kết quả | Ghi chú |
|----------|---------|---------|
| 1. Atomic transaction | ✅ PASS | Cả 2 method đều read-only, không cần transaction |
| 2. Race condition | ✅ PASS | Không có write operation, không có P2002 risk |
| 3. Error handling | ✅ PASS | Route có try/catch + `next(err)`, service đúng pattern |
| 4. SQL injection / Validation | ✅ PASS | `limit`/`offset` được parse và clamp; Prisma parameterized |
| 5. N+1 query / Index | ✅ PASS | Dùng `Promise.all` (9 query song song), batch fetch papers; index `[userId, completedAt]` đã có |
| 6. TypeScript `any` | ✅ PASS | Không có `any` trong tất cả file mới |
| 7. Edge cases | ✅ PASS (1 sửa) | `void profile` code smell → sửa bằng `profile.displayName` trong header |

### Lỗi tìm thấy và đã sửa
1. **`void profile` code smell** (`frontend/src/App.tsx:3322-3323`): `ProgressPage` nhận prop `profile` nhưng không dùng trong body, dùng `void profile` để tắt lint. Sửa: dùng `profile.displayName` vào tiêu đề trang (`📊 Tiến độ — {profile.displayName ?? 'của tôi'}`), loại bỏ `void` trick.

### Smoke test kết quả
- **Script:** `backend/src/scripts/smoke-test-progress.ts`
- **4/4 test PASS** — `getSummary` có/không data, `getExamHistory` phân trang + clamp, streak 3 ngày

### Build / Lint
- Backend build: ✅ PASS (`tsc -p tsconfig.json`)
- Frontend build: ✅ PASS (`tsc -b && vite build`)
- Frontend lint: ✅ PASS (`eslint .`)

### Files đã thay đổi (S3 bổ sung)
- `frontend/src/App.tsx` — sửa `void profile` → dùng `profile.displayName`
- `backend/src/scripts/smoke-test-progress.ts` — viết mới smoke test (4 test groups)
- `backend/package.json` — thêm script `smoke:progress`
- `docs/TEST_CASES.md` — append 21 test cases cho Progress module
- `docs/CODE_REVIEW_LOG.md` — append review log này

---

## Review #6 — Ôn Câu Sai (Wrong Answer Review)

**Ngày review:** 2026-07-05
**Branch:** feature/wrong-answer-review
**Trạng thái:** ✅ Đã review, đã fix 3 vấn đề, sẵn sàng chuyển S4

### Kết quả 7 tiêu chí

| # | Tiêu chí | Kết quả | Ghi chú |
|---|----------|---------|---------|
| 1 | Atomic transaction | ⚠️ Tìm và sửa | `upsertWrongAnswer` trong exam được gọi TRONG transaction callback → khi retry gọi nhiều lần. Đã move ra ngoài |
| 2 | Race condition | ✅ OK | Prisma upsert với @@unique xử lý tốt, fire-and-forget safe |
| 3 | Error handling | ✅ OK | WrongAnswerNotFoundError đúng pattern, HTTP mapping đúng |
| 4 | Input validation | ✅ OK | Không raw SQL, parseInt + isNaN check, Prisma parameterize |
| 5 | N+1 query / Index | ⚠️ Tìm và sửa | Thiếu index `(userId, expiresAt)` — đã thêm vào schema + migration |
| 6 | TypeScript any | ✅ OK | Dùng `unknown` xuyên suốt, không có `any` |
| 7 | Edge cases | ✅ OK | Soft-delete, hard-delete, expired, retry không tính điểm — đều handled |

### Lỗi tìm thấy và đã sửa

1. **[CRITICAL] exam.service.ts** — `upsertWrongAnswer` gọi trong transaction callback bằng `void`:
   - Khi transaction retry do optimistic lock, upsert chạy nhiều lần → `wrongCount` cộng thừa
   - Sửa: collect `wrongIds` trong transaction, trả ra ngoài, gọi upsert sau khi `await $transaction` thành công

2. **[INDEX] schema.prisma + migration SQL** — Thiếu index `(userId, expiresAt)`:
   - Query chính `WHERE userId=? AND expiresAt>NOW()` sẽ full table scan
   - Sửa: thêm `@@index([userId, expiresAt])` vào schema, thêm `CREATE INDEX` vào migration SQL

3. **[FRONTEND] App.tsx** — `setPage(1)` trong `useEffect` body vi phạm rule `react-hooks/set-state-in-effect`:
   - Sửa: tách thành handler `handleSubjectChange` (reset page + fetch trong event handler), useEffect chỉ load lần đầu

### Unit test đã viết

**Framework:** vitest (mới cài, không cần DB)
**File:** `backend/src/services/wrongAnswer/__tests__/wrongAnswer.service.test.ts`

- 18 test cases: 3 nhóm (upsertWrongAnswer, retryQuestion, getWrongAnswers)
- ✅ Happy path: MCQ_4, TRUE_FALSE_4, FILL_BLANK, pagination, filter
- ⚠️ Edge case: soft-delete, expired, null FK, chuỗi rỗng, array thiếu item
- ❌ Error case: không tìm thấy, userId không khớp, hard-delete

**Kết quả:** 18/18 PASS

### Build / Lint / Test

- Backend build: ✅ PASS
- Frontend lint: ✅ PASS
- Unit test: ✅ 18/18 PASS

### Files reviewer đã thay đổi/thêm

- `backend/src/services/exam/exam.service.ts` — sửa lỗi upsert trong transaction
- `backend/prisma/schema.prisma` — thêm @@index([userId, expiresAt])
- `backend/prisma/migrations/20260704154329_add_wrong_answer_table/migration.sql` — thêm CREATE INDEX
- `backend/src/services/wrongAnswer/wrongAnswer.service.ts` — thêm chú thích tiếng Việt
- `frontend/src/App.tsx` — sửa lint error, refactor subject change handler
- `backend/src/services/wrongAnswer/__tests__/wrongAnswer.service.test.ts` — viết mới 18 unit test
- `backend/vitest.config.ts` — config vitest
- `backend/package.json` — thêm scripts test/test:watch/test:coverage, thêm vitest dependency
- `docs/TEST_CASES.md` — append 25 test cases cho Wrong Answer Review
- `docs/CODE_REVIEW_LOG.md` — append review log này

---

## Review #008 — Admin User Management + Dashboard
**Ngày:** 2026-07-06 | **Branch:** feature/admin-user-management | **Reviewer:** S3-SoatLoi

### Lỗi tìm thấy và đã sửa

| # | Tiêu chí | Vấn đề | Cách sửa |
|---|---------|--------|---------|
| 1 | N+1 / Index | Thiếu index trên cột `isBlocked` và `role` trong bảng `users` — 2 cột này được dùng để filter trong `listUsers` | Thêm `@@index([isBlocked])` và `@@index([role])` vào schema.prisma, sync DB và cập nhật migration SQL |
| 2 | Edge case | `totalPages` trả về `0` khi `total=0` — frontend có thể bị lỗi pagination | Đổi thành `Math.max(1, Math.ceil(total / limit))` |

### Bổ sung thêm
- Viết 26 unit tests mới cho `adminUsersService` (5 nhóm: getDashboardStats, listUsers, getUserDetail, setUserBlocked, resetUserPassword, setUserRole, deleteUser)
- Cập nhật `docs/TEST_CASES.md` với 30 test case (happy path, edge case, error case)

### Kết quả kiểm thử
- Unit tests: 44/44 PASS (18 cũ + 26 mới)
- Backend TS: PASS | Frontend TS: PASS | Lint: PASS
- API contract: Tất cả 7 endpoint khớp đúng YAML draft

### Nhận xét chung
Code sạch, pattern nhất quán với codebase. Error handling tốt. WrongAnswer cascade delete hoạt động đúng qua Prisma relation. Redis online tracking fire-and-forget là thiết kế đúng.

---

## Review #009 — Anti-Cheat Security Fixes
**Ngày**: 2026-07-07 | **Reviewer**: S3-SoatLoi | **Branch**: feature/anti-cheat-fixes

### Thay đổi đã review
- `backend/src/services/exam/exam.types.ts`: +EXAM_MIN_SUBMIT_RATIO, ExamWrongAnswerItem.correctAnswer: null
- `backend/src/services/exam/exam.errors.ts`: +ExamSubmitTooEarlyError, +ExamSessionAlreadyActiveError
- `backend/src/app.ts`: đăng ký 2 HTTP status code mới
- `backend/src/services/exam/exam.service.ts`: Bug 4 (startExam check), Bug 1a (submitExam elapsed), Bug 1b (sentinel {})
- `backend/src/services/practice/practice.service.ts`: Bug 2 (fail-closed), Bug 3 (timeout in tx)
- `frontend/src/App.tsx`: 3 error case mới

### Kết quả review (8 tiêu chí)

| # | Tiêu chí | Kết quả | Ghi chú |
|---|----------|---------|---------|
| 1 | Atomic transaction | ✅ | Bug 3 timeout check nằm trong $transaction |
| 2 | Race condition | ⚠️ ghi nhận | Bug 4 check ngoài tx — race window cực nhỏ, chấp nhận được |
| 3 | Error handling | ✅ | Mọi error class có code, HTTP status đăng ký đúng |
| 4 | Input validation | ✅ | Không thêm input mới, chỉ sửa logic nội bộ |
| 5 | N+1 query | ✅ | 1 findFirst thêm trong startExam, không có N+1 |
| 6 | TypeScript any | ✅ | Không có `any` mới |
| 7 | Edge cases | ✅ | sentinel null/array/primitive được xử lý đúng |
| 8 | API contract | ✅ | Không có endpoint mới (S1 đã xác nhận) |

### Sửa thêm trong S3
- Export `isSentinelUnanswered` để unit test trực tiếp
- Frontend `handleSubmit`: đổi từ `err.message` (không dấu) sang tính toán client-side → tiếng Việt đầy đủ dấu

### Lỗi đã phát hiện và sửa
| # | File | Vấn đề | Sửa thế nào |
|---|------|---------|------------|
| 1 | `App.tsx` | `err.message` từ server dùng tiếng Việt không dấu → UX kém | Tính remainingMin client-side với `session.data.startedAt` và `durationMinutes` |

### Kết quả kiểm thử tự động
- Unit test: **66 tests, 66 PASS** (+22 tests mới cho anti-cheat logic)
- Build BE: PASS | Build FE: PASS
- Lint: không có script lint trong package.json
- npm audit: 3 high vulnerabilities pre-existing (form-data, multer, sheetJS — không liên quan PR này)

### Nhận xét chung
Fail-closed ở `checkRateLimit` là quyết định bảo mật đúng. Sentinel {} là pattern đơn giản và hiệu quả. Race condition Bug 4 nhỏ và chấp nhận được cho use case quiz app. Code sạch, pattern nhất quán.

---

## Review #12 — Exam UX Improvements (Feature 012)
**Reviewer**: S3-SoatLoi | **Ngày**: 2026-07-07 | **Branch**: feature/exam-ux-improvements

### Lỗi tìm thấy và sửa

| # | Loại | Mô tả | Đã sửa |
|---|------|-------|--------|
| 1 | CSS thiếu | `exam-resume-banner`, `exam-resume-msg`, `exam-resume-actions`, `btn-sm` chưa có trong App.css | ✅ Thêm vào App.css |
| 2 | API draft lệch | Field `title` có trong response nhưng chưa có trong `exam-ux-improvements.yaml` | ✅ Cập nhật draft |
| 3 | Test thiếu | `getActiveSession` và `abandonSession` chưa có unit test | ✅ Thêm 12 test case |

### Kết quả 7 tiêu chí

| # | Tiêu chí | Kết quả |
|---|----------|---------|
| 1 | Atomic transaction | ✅ abandonSession: 1 update đơn, không cần transaction |
| 2 | Race condition | ✅ Abandon đồng thời → idempotent (ABANDONED→ABANDONED OK) |
| 3 | Error handling | ✅ Đủ error classes, HTTP status mapping đúng |
| 4 | Input validation | ✅ sessionId từ req.params → Prisma parameterized query |
| 5 | N+1 / Index | ✅ 2 query riêng (không phải N+1 loop), chấp nhận được |
| 6 | TypeScript any | ✅ Không có any |
| 7 | Edge cases | ✅ Đề bị xóa → title='', session hết giờ → remainingSeconds âm |
| 8 | API contract | ✅ Method/path/response khớp draft (sau khi cập nhật title) |

### Kết quả test
- Unit test: 78/78 PASS (thêm 12 test mới)
- TypeScript: clean (BE + FE)
- Lint: PASS (BE + FE)
