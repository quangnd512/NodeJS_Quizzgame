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
