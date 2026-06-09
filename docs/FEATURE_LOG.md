# Nhật ký tính năng – QuizzGame

> File này ghi lại **luồng chạy chi tiết** của từng tính năng đã được phát triển.
> Mỗi khi có một chức năng mới hoàn thành, hãy thêm một mục mới vào cuối file
> theo đúng mẫu (template) ở bên dưới, để bất kỳ ai (kể cả AI agent sau này)
> đọc vào đều hiểu được: tính năng làm gì, chạy qua những bước nào, file nào
> liên quan, và cách tự kiểm thử lại.

---

## Mẫu (template) cho mục mới

```
## [STT]. Tên tính năng

- **Ngày hoàn thành:**
- **Mục tiêu / mô tả ngắn:**
- **Branch / commit liên quan:**

### Luồng chạy chi tiết (step-by-step)
1. ...
2. ...
3. ...

### Các file chính liên quan
- `đường/dẫn/file.ts` – vai trò gì

### Cách tự kiểm thử (manual test)
1. ...
2. ...

### Lưu ý / rủi ro / TODO tiếp theo
- ...
```

---

## 1. Hello World – Kết nối Frontend ⇄ Backend

- **Ngày hoàn thành:** 2026-06-08
- **Mục tiêu / mô tả ngắn:** Dựng khung dự án ban đầu (scaffold) cho Backend
  (Node.js + Express + TypeScript) và Frontend (React 18 + Vite + TypeScript),
  đảm bảo hai bên gọi được lẫn nhau qua HTTP — làm nền tảng để phát triển
  3 chế độ chơi (Ôn tập / Thi thử / Thi đấu PvP) sau này.
- **Branch / commit liên quan:** `setup/hello-world` (commit `d78a904`)

### Luồng chạy chi tiết (step-by-step)

**Khi chạy ở môi trường dev (2 terminal song song):**

1. **Backend khởi động** (`backend/src/server.ts`):
   - Đọc biến môi trường `PORT` (mặc định `4000`).
   - Gọi `createApp()` trong `backend/src/app.ts` để khởi tạo Express app.
   - Lắng nghe (`app.listen`) tại `http://localhost:4000` và in log xác nhận.

2. **Express app được cấu hình** (`backend/src/app.ts`):
   - Gắn middleware `cors()` → cho phép Frontend (chạy ở origin khác,
     `http://localhost:5173`) gọi sang mà không bị chặn CORS.
   - Gắn `express.json()` → parse JSON body cho các request POST/PUT sau này.
   - Đăng ký router `/api/hello` (xem bước 3).
   - Đăng ký route `/api/health` → trả `{ status: 'ok' }`, dùng để kiểm tra
     server còn sống (health-check, hữu ích khi deploy/monitor).
   - Middleware bắt **404**: nếu không khớp route nào → trả JSON
     `{ error: 'NOT_FOUND', message: '...' }` thay vì HTML mặc định của Express.
   - Middleware xử lý **lỗi tập trung** (4 tham số `(err, req, res, next)`):
     bắt mọi lỗi được `next(err)` từ các route phía trên, log ra console,
     và trả về `{ error: 'INTERNAL_SERVER_ERROR', message }` với status `500`.

3. **Route `/api/hello` xử lý request** (`backend/src/routes/hello.route.ts`):
   - Nhận `GET /api/hello`.
   - Tạo object `HelloResponse { message, servedAt }` với thời gian hiện tại
     (`new Date().toISOString()`).
   - Trả về JSON cho client.
   - Nếu có lỗi bất ngờ trong khối `try` → bắt bằng `catch` và gọi
     `next(err)` để middleware xử lý lỗi tập trung ở `app.ts` xử lý tiếp
     (không để lộ stack trace cho client).

4. **Frontend khởi động** (`npm run dev` trong thư mục `frontend`):
   - Vite dev server chạy tại `http://localhost:5173`.
   - `vite.config.ts` cấu hình **proxy**: mọi request bắt đầu bằng `/api`
     sẽ được Vite tự động chuyển tiếp (`changeOrigin: true`) sang
     `http://localhost:4000` → giúp Frontend gọi `fetch('/api/hello')` mà
     **không cần** quan tâm tới CORS hay domain thật của backend khi dev.

5. **Component `App.tsx` gọi API khi mount** (`frontend/src/App.tsx`):
   - Dùng `useEffect` + `AbortController` để gọi `fetch('/api/hello')`
     ngay khi component được render lần đầu, và hủy request nếu component
     unmount trước khi có phản hồi (tránh memory leak / setState trên
     component đã unmount).
   - Quản lý 3 trạng thái UI bằng `useState`:
     - `loading`: đang chờ phản hồi → hiển thị "Đang kết nối đến backend...".
     - `error`: nếu `response.ok === false` hoặc `fetch` ném lỗi (vd. backend
       chưa chạy) → hiển thị thông báo lỗi rõ ràng kèm gợi ý khắc phục.
     - `hello`: nếu thành công → hiển thị `message` và thời gian phản hồi
       (định dạng theo locale `vi-VN`).
   - Toàn bộ logic gọi API được bọc trong `try / catch / finally` để đảm bảo
     `loading` luôn được tắt (`setLoading(false)`) dù thành công hay thất bại.

6. **Người dùng thấy kết quả trên trình duyệt** tại `http://localhost:5173`:
   - Card màu xanh nhạt hiển thị: *"Xin chào từ QuizzGame Backend! Kết nối
     thành công."* kèm thời gian phản hồi từ server.

### Các file chính liên quan
- `backend/src/server.ts` – entry point, khởi động HTTP server, đọc `PORT`.
- `backend/src/app.ts` – cấu hình Express: middleware, routes, 404 handler,
  error handler tập trung.
- `backend/src/routes/hello.route.ts` – route mẫu `/api/hello`.
- `backend/tsconfig.json` – cấu hình TypeScript strict mode cho backend.
- `frontend/src/App.tsx` – UI Hello World, gọi API, quản lý state loading/error/data.
- `frontend/src/App.css` – style cho trang Hello World.
- `frontend/vite.config.ts` – cấu hình Vite + proxy `/api` → `http://localhost:4000`.
- `.claude/launch.json` – cấu hình để chạy nhanh frontend qua Claude Preview.

### Cách tự kiểm thử (manual test)
1. Mở terminal 1: `cd backend && npm run dev` → kỳ vọng thấy log
   `[QuizzGame Backend] Server đang chạy tại http://localhost:4000`.
2. Kiểm tra nhanh bằng curl:
   - `curl http://localhost:4000/api/hello` → trả JSON có `message` và `servedAt`.
   - `curl http://localhost:4000/api/health` → trả `{"status":"ok"}`.
   - `curl http://localhost:4000/khong-ton-tai` → trả `404` kèm
     `{"error":"NOT_FOUND", ...}`.
3. Mở terminal 2: `cd frontend && npm run dev` → mở trình duyệt tại
   `http://localhost:5173`.
4. Kỳ vọng: trang hiển thị tiêu đề *"QuizzGame – Ôn thi THPT Quốc gia"*,
   sau khoảng 1 giây hiện card xanh với nội dung *"Xin chào từ QuizzGame
   Backend! Kết nối thành công."*
5. **Test trường hợp lỗi:** tắt backend (Ctrl+C ở terminal 1), reload trang
   frontend → kỳ vọng thấy dòng chữ đỏ báo lỗi kết nối kèm gợi ý kiểm tra
   backend có đang chạy tại `http://localhost:4000` hay không.

### Lưu ý / rủi ro / TODO tiếp theo
- Hiện chưa có database (PostgreSQL/Prisma) hay Redis — sẽ bổ sung ở giai
  đoạn xây dựng hệ thống điểm tích lũy & ngân hàng câu hỏi.
- Chưa có xác thực (Firebase Auth) — cần thêm middleware kiểm tra token ở
  backend trước khi cho phép gọi các API liên quan đến điểm số / thi đấu.
- Khi deploy production, cần thay proxy dev của Vite bằng cấu hình reverse
  proxy thật (Nginx / hosting) hoặc biến môi trường `VITE_API_BASE_URL`.

---

## 2. PointsService – Hệ thống điểm tích lũy với Prisma transactions

- **Ngày hoàn thành:** 2026-06-08
- **Mục tiêu / mô tả ngắn:** Xây dựng lớp service trung tâm quản lý "điểm tích
  lũy" — currency duy nhất trong game. Đảm bảo **không bao giờ âm**, mọi thay
  đổi đều **atomic** (cập nhật số dư + ghi log giao dịch cùng thành công/thất
  bại), và an toàn khi nhiều request cùng sửa điểm 1 user cùng lúc nhờ
  **optimistic locking** (trường `version`).
- **Branch / commit liên quan:** `feature/points-service`

### Luồng chạy chi tiết (step-by-step)

**A. Khởi tạo Prisma & schema** (`backend/prisma/schema.prisma`)
1. Định nghĩa model `UserPoints` (map bảng `user_points`):
   `id, userId (unique), currentPoints (default 0), version (optimistic lock,
   default 0), lastUpdated (@updatedAt)`.
2. Định nghĩa model `PointTransaction` (map bảng `point_transactions`):
   `id, userId, delta, reason, metadata (Json?), createdAt`, có index
   `(userId, createdAt)` để tăng tốc truy vấn lịch sử có phân trang.
3. Chạy `prisma migrate dev --name init_points_system` → tạo migration SQL
   và đồng bộ schema với DB Postgres cục bộ (`quizzgame` @ `localhost:5433`).

**B. `addPoints(userId, amount, reason, metadata?)`** — cộng điểm
1. Validate `amount` phải là **số nguyên dương** (`assertPositiveInteger`)
   → nếu sai, ném `InvalidPointsAmountError` ngay, không chạm DB.
2. Vào `runWithOptimisticRetry`: mở 1 Prisma `$transaction`.
3. `ensureUserPointsRecord`: `upsert` bản ghi `user_points` — nếu user lần
   đầu tham gia, tạo `currentPoints = 0, version = 0`; nếu đã có, lấy về.
4. Tính `newBalance = current + amount`.
5. `applyOptimisticUpdate`: `updateMany({ where: { userId, version: v },
   data: { currentPoints: newBalance, version: { increment: 1 } } })`.
   - Nếu `count === 0` (version đã đổi do request khác cập nhật trước) →
     ném `OptimisticLockRetrySignal` (lỗi nội bộ) → Prisma rollback →
     toàn bộ transaction được **thử lại từ đầu** với dữ liệu mới nhất.
6. `writeTransactionLog`: ghi 1 dòng vào `point_transactions` với
   `delta = +amount` — trong **cùng transaction** với bước 5 → atomic.
7. Trả về `PointsBalance` (số dư mới).

**C. `deductPoints(userId, amount, reason, metadata?)`** — trừ điểm
- Giống luồng `addPoints`, nhưng **trước khi trừ**: kiểm tra
  `current.currentPoints < amount` → nếu thiếu, ném `PointsInsufficientError`
  ngay **bên trong transaction** (transaction tự rollback, DB không đổi gì).
- Ghi log với `delta = -amount` (số âm, phản ánh đúng bản chất "trừ điểm").

**D. `transferPoints(fromId, toId, amount, reason, metadata?)`** — chuyển điểm
1. Validate `amount` và `fromId !== toId`.
2. **Sắp xếp `[fromId, toId]` theo thứ tự alphabet** trước khi khoá/đọc 2 bản
   ghi → đảm bảo MỌI giao dịch chuyển điểm (dù theo chiều nào) luôn truy cập
   2 bản ghi theo **cùng một thứ tự cố định** → tránh **deadlock** ở DB khi có
   nhiều giao dịch chuyển điểm ngược chiều xảy ra đồng thời (ví dụ 2 trận PvP
   kết thúc cùng lúc, A thắng B và C thắng A).
3. Đọc cả 2 bản ghi (`ensureUserPointsRecord` theo thứ tự đã sắp xếp).
4. Kiểm tra người gửi đủ điểm → nếu không, ném `PointsInsufficientError`.
5. Cập nhật cả 2 bản ghi bằng `applyOptimisticUpdate` (theo đúng thứ tự đã khoá).
6. Ghi **2 dòng log độc lập**: `TRANSFER_OUT` (phía người gửi, `delta` âm) và
   `TRANSFER_IN` (phía người nhận, `delta` dương), mỗi dòng có `metadata`
   chứa `counterpartUserId` để truy vết được từ cả hai phía.
7. Toàn bộ bước 3-6 nằm trong 1 `$transaction` + có cơ chế retry riêng
   (dùng `lockKey = "${firstId}:${secondId}"` để log lỗi rõ ràng).

**E. `getBalance(userId)`** — lấy số dư hiện tại
- Đọc trực tiếp (không mở transaction, không tạo bản ghi mới — tránh ghi DB
  trên đường đọc). User chưa từng giao dịch → trả về `currentPoints = 0`.

**F. `getHistory(userId, limit, offset)`** — lịch sử giao dịch có phân trang
- Validate `limit > 0` (giới hạn tối đa 100 để tránh tải quá nặng) và
  `offset >= 0`.
- Chạy song song (`Promise.all`) 2 truy vấn: lấy danh sách (`findMany` với
  `orderBy: createdAt desc, take, skip`) và đếm tổng (`count`) → trả về
  `{ items, total, limit, offset }` để FE dựng UI phân trang.

**G. Cơ chế Optimistic Locking & Retry** (`runWithOptimisticRetry`)
- Bọc toàn bộ luồng nghiệp vụ trong vòng lặp tối đa **10 lần thử**.
- Bắt 2 loại lỗi cần thử lại:
  1. `OptimisticLockRetrySignal` — version không khớp khi update.
  2. Lỗi Prisma `P2002` (Unique constraint) — xảy ra khi 2 transaction cùng
     lúc cố `upsert` tạo bản ghi `user_points` lần đầu cho cùng 1 user
     (cả hai cùng thấy "chưa tồn tại" → cùng INSERT → 1 bên vi phạm UNIQUE).
- Mỗi lần thử lại, chờ một khoảng ngắn ngẫu nhiên (10–50ms, có "jitter") để
  giảm áp lực lên DB và giảm khả năng tiếp tục đụng độ ("thundering herd").
- Hết số lần thử → ném `OptimisticLockError` cho tầng gọi xử lý tiếp
  (ví dụ trả về HTTP 409 Conflict, gợi ý client thử lại).
- Lỗi nghiệp vụ (`PointsInsufficientError`, `InvalidPointsAmountError`) được
  ném ngay lập tức, **không** thử lại (vì thử lại cũng không giải quyết được).

### Các file chính liên quan
- `backend/prisma/schema.prisma` – định nghĩa model `UserPoints`, `PointTransaction`.
- `backend/prisma/migrations/...init_points_system/migration.sql` – migration SQL đã áp dụng.
- `backend/.env.example` – mẫu biến môi trường (`DATABASE_URL`, `PORT`).
- `backend/src/lib/prisma.ts` – Prisma Client singleton, tránh tạo nhiều connection pool.
- `backend/src/services/points/points.types.ts` – DTO (`PointsBalance`,
  `PaginatedHistory`, `TransferResult`) và hằng số `PointReason` (chuẩn hoá lý do giao dịch).
- `backend/src/services/points/points.errors.ts` – các lớp lỗi nghiệp vụ
  (`PointsInsufficientError`, `InvalidPointsAmountError`, `OptimisticLockError`,
  `UserPointsNotFoundError`).
- `backend/src/services/points/points.service.ts` – toàn bộ logic `PointsService`.
- `backend/src/scripts/smoke-test-points.ts` – kiểm thử nhanh các luồng chính
  (cộng/trừ/chuyển điểm, lỗi thiếu điểm, validate amount, lịch sử có phân trang).
- `backend/src/scripts/smoke-test-points-concurrency.ts` – kiểm thử **race
  condition**: bắn 20 request cộng điểm song song cho cùng 1 user, xác nhận
  không có giao dịch nào "biến mất" (lost update).

### Cách tự kiểm thử (manual test)
1. Cài PostgreSQL cục bộ, tạo DB `quizzgame`, cấu hình `DATABASE_URL` trong
   `backend/.env` (copy từ `.env.example`).
2. `cd backend && npx prisma migrate dev` → áp dụng migration (tạo bảng
   `user_points`, `point_transactions`).
3. Chạy kiểm thử chức năng chính:
   `npm run smoke:points`
   → kỳ vọng thấy toàn bộ dòng `✅ ...` và kết thúc bằng
   `🎉 TAT CA KIEM TRA DEU PASS!`
   (kiểm tra: cộng điểm, trừ điểm, trừ vượt quá số dư báo lỗi đúng loại,
   từ chối `amount` không hợp lệ, chuyển điểm atomic, lấy số dư, lấy lịch sử
   có phân trang & sắp xếp đúng, không bao giờ để điểm âm trong DB).
4. Chạy kiểm thử concurrency (race condition):
   `npm run smoke:points:concurrency`
   → kỳ vọng: `Thanh cong: 20/20`, `So du cuoi cung: 20 (ki vong: 20)`,
   kết thúc bằng `🎉 KIEM TRA CONCURRENCY PASS!`
   (xác nhận optimistic locking hoạt động đúng — không "mất" giao dịch nào
   khi nhiều request cùng sửa điểm 1 user đồng thời).
5. (Tuỳ chọn) Mở Prisma Studio để xem dữ liệu trực quan: `npx prisma studio`.

### Lưu ý / rủi ro / TODO tiếp theo
- **Đã hạ phiên bản Prisma từ v7 xuống v6** vì Prisma 7 thay đổi lớn cách cấu
  hình `datasource` (yêu cầu driver adapter qua `prisma.config.ts`), chưa phù
  hợp với schema truyền thống `url = env("DATABASE_URL")`. Khi nâng cấp lên
  Prisma 7 sau này, cần viết lại phần khởi tạo `PrismaClient` theo adapter.
- **Đã đổi cổng PostgreSQL cục bộ từ 5432 → 5433** vì máy đã có một instance
  Postgres khác chiếm cổng 5432 (không phải do project — chỉ ảnh hưởng máy dev
  hiện tại). Khi deploy / dùng máy khác, nhớ cập nhật `DATABASE_URL` cho khớp.
- Service hiện dùng **Firebase UID dạng `String`** làm `userId` — chưa có bảng
  `User` chính thức. Khi tích hợp Firebase Auth, cân nhắc thêm khoá ngoại
  (foreign key) hoặc ít nhất một bảng `users` để đảm bảo toàn vẹn dữ liệu.
- `metadata` hiện là `Json?` tự do — nên thống nhất "shape" cho từng `reason`
  (ví dụ tài liệu hoá rõ `THI_THU_RESULT` cần có `examId`, `score`...) khi các
  module nghiệp vụ khác (Ôn tập, Thi thử, PvP) bắt đầu gọi `PointsService`.
- TODO tiếp theo: viết unit test chính thức (Vitest/Jest) thay cho smoke test
  thủ công; thêm endpoint API (`/api/points/...`) bọc quanh service này; thêm
  middleware xác thực Firebase trước khi cho phép gọi.


## 3. Auth + Onboarding – Đăng nhập Firebase, JWT nội bộ & Quản lý hồ sơ

**Trạng thái:** ✅ Hoàn thành, đang chờ review lần cuối (branch `feature/auth-onboarding`)
**Ngày hoàn thành:** 2026-06-08
**Commit:** `f4c3555`

---

### Tổng quan

Module này là nền tảng xác thực cho toàn bộ ứng dụng — **mọi module nghiệp vụ
tiếp theo (Ôn tập, Thi thử, PvP) đều phụ thuộc vào đây**. Luồng tổng quát:

```
[FE] Đăng nhập Firebase  →  POST /api/auth/login  →  Nhận session token (JWT)
                                                            │
                              ┌─────────────────────────────┘
                              ▼
[FE] Gọi mọi API sau đó  →  Authorization: Bearer <session-token>
                          →  verifyAppToken middleware  →  req.currentUser
```

**Thiết kế then chốt:**
- **Firebase ID Token** (do Firebase cấp): chỉ dùng MỘT LẦN tại `/login` để
  xác minh danh tính.
- **Session Token (JWT nội bộ)**: được phát hành sau khi đăng nhập thành công,
  dùng cho MỌI request tiếp theo (HTTP API + Socket.io PvP sau này). Không cần
  gọi lại Firebase mỗi request — giảm độ trễ và chi phí.

---

### Mô hình dữ liệu — Bảng `users`

```sql
CREATE TABLE users (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  firebaseUid  TEXT UNIQUE NOT NULL,   -- UID từ Firebase Auth (khoá liên kết)
  displayName  TEXT,                   -- Tên hiển thị (từ Firebase lúc tạo, user tự sửa sau)
  email        TEXT UNIQUE,            -- Email (nullable — user đăng nhập bằng SĐT không có)
  phone        TEXT,                   -- SĐT (nullable — user đăng nhập bằng email không có)
  school       TEXT,                   -- Trường THPT (user tự khai báo)
  province     TEXT,                   -- Tỉnh/thành (user tự khai báo)
  subjects     TEXT[] DEFAULT '{}',    -- Mảng mã môn học đã chọn: ["TOAN","VAN",...]
  lastLoginAt  TIMESTAMP,              -- Lần đăng nhập gần nhất (auto-update mỗi /login)
  createdAt    TIMESTAMP DEFAULT now() -- Thời điểm tạo tài khoản (bất biến)
);
```

**Phân loại trường theo "ai quản lý":**

| Trường | Nguồn dữ liệu | Cập nhật khi nào |
|--------|--------------|-----------------|
| `firebaseUid` | Firebase (bất biến) | Chỉ lúc tạo |
| `email` | Firebase (đồng bộ) | Mỗi lần `/login` nếu Firebase trả giá trị khác |
| `lastLoginAt` | Hệ thống | Mỗi lần `/login` thành công |
| `displayName` | Firebase (lúc tạo) → User (sau onboarding) | Chỉ qua `PUT /profile` |
| `phone` | Firebase (lúc tạo) → User (sau onboarding) | Chỉ qua `PUT /profile` |
| `school` | User | Chỉ qua `PUT /profile` |
| `province` | User | Chỉ qua `PUT /profile` |
| `subjects` | User | Chỉ qua `POST /subjects` |
| `createdAt` | Hệ thống | Không bao giờ thay đổi |

---

### Biến môi trường

| Biến | Bắt buộc | Mô tả |
|------|----------|-------|
| `FIREBASE_PROJECT_ID` | ✅ | Project ID trong Firebase Console |
| `FIREBASE_CLIENT_EMAIL` | ✅ | `client_email` trong file Service Account JSON |
| `FIREBASE_PRIVATE_KEY` | ✅ | `private_key` trong file Service Account JSON (dấu xuống dòng dạng `\n`) |
| `JWT_SECRET` | ✅ | Chuỗi bí mật ký JWT (≥ 32 ký tự ngẫu nhiên) |

> Lấy `FIREBASE_*` từ: Firebase Console → Project Settings → Service accounts
> → "Generate new private key" → tải file JSON về.

---

### Kiến trúc middleware xác thực

Module định nghĩa **2 middleware riêng biệt** với mục đích khác nhau:

#### `verifyFirebaseToken` — Chỉ dùng cho `POST /api/auth/login`

```
Request  →  Trích Bearer token từ header Authorization
         →  getFirebaseAuth().verifyIdToken(token)   [Firebase Admin SDK]
         →  Gắn req.firebaseUser {uid, email, displayName, phoneNumber}
         →  Tra cứu req.currentUser từ DB (best-effort — lỗi DB không fail request)
         →  next()
```

- Mục đích: là "cửa ngõ" xác minh danh tính với Firebase, đổi lấy session token.
- Lỗi tra cứu DB tạm thời sẽ được **bỏ qua** (log ra console, `currentUser =
  undefined`), không làm fail request — đây là bước làm giàu dữ liệu tùy chọn.
- Lỗi xác thực Firebase → `InvalidFirebaseTokenError` (401).
- Thiếu token → `MissingAuthTokenError` (401).

#### `verifyAppToken` — Dùng cho **mọi route khác** cần đăng nhập

```
Request  →  Trích Bearer token từ header Authorization
         →  decodeAppToken(token)   [lib/jwt.ts — xác thực chữ ký & hạn dùng]
         →  prisma.user.findUnique({ id: payload.userId })
         →  Gắn req.currentUser = user
         →  next()
```

- Mục đích: xác thực nhanh bằng JWT nội bộ, không cần gọi lại Firebase.
- Token sai/hết hạn/sai định dạng → `InvalidSessionTokenError` (401).
- Token hợp lệ nhưng user đã bị xoá khỏi DB → `SessionUserNotFoundError` (401).
- Đảm bảo `req.currentUser` luôn tồn tại sau khi middleware chạy xong.
- Tương thích với Socket.io (truyền token qua `auth.token` khi kết nối, xử lý
  ở tầng Socket.io middleware sau này).

---

### API Reference

#### `POST /api/auth/login`

**Mục đích:** Đổi Firebase ID Token (ngắn hạn, phụ thuộc Firebase) lấy session
token nội bộ (7 ngày, tự quản lý).

**Request:**
```
Authorization: Bearer <firebase-id-token>
```
*(Không có body)*

**Luồng xử lý chi tiết:**

```
1. verifyFirebaseToken middleware
   ├─ Trích token từ header
   ├─ Firebase Admin SDK xác thực token
   │    ├─ Lỗi → InvalidFirebaseTokenError (401)
   │    └─ OK → giải mã payload (uid, email, displayName, phoneNumber)
   └─ Gắn req.firebaseUser

2. AuthService.login(firebaseUser)
   └─ findCreateOrSyncUser(firebaseUser)
        │
        ├─ Tìm theo firebaseUid trong bảng users
        │
        ├─ [CHƯA CÓ — lần đầu đăng nhập]
        │   └─ prisma.user.create({ firebaseUid, displayName, email, phone, lastLoginAt: now() })
        │        ├─ Thành công → { user, isNewUser: true }
        │        └─ Lỗi P2002 (race condition — 2 thiết bị đăng nhập cùng lúc)
        │             ├─ Đọc lại theo firebaseUid
        │             │   ├─ Tìm thấy → syncExistingUser + { user, isNewUser: false }
        │             │   └─ Không tìm thấy → xung đột email thật → AccountConflictError (409)
        │             └─ (Xem phần "Xử lý Race Condition" bên dưới)
        │
        └─ [ĐÃ CÓ — đăng nhập lại]
            └─ syncExistingUser(existing, firebaseUser)
                 ├─ Luôn cập nhật: lastLoginAt = now()
                 ├─ Chỉ cập nhật email nếu Firebase trả giá trị KHÁC DB
                 │   (tránh ghi DB không cần thiết)
                 ├─ KHÔNG cập nhật: displayName, phone (do user tự quản lý)
                 └─ Lỗi P2002 khi update email → AccountConflictError (409)

3. signAppToken({ userId: user.id, firebaseUid: user.firebaseUid })
   └─ JWT nội bộ, ký bằng JWT_SECRET, hết hạn sau 7 ngày

4. Trả về LoginResult
```

**Response thành công (200):**
```json
{
  "token": "eyJhbGci...",
  "isNewUser": true,
  "user": {
    "id": "uuid",
    "firebaseUid": "firebase-uid",
    "displayName": "Nguyễn Văn A",
    "email": "user@example.com",
    "phone": null,
    "school": null,
    "province": null,
    "subjects": [],
    "createdAt": "2026-06-08T...",
    "lastLoginAt": "2026-06-08T..."
  }
}
```

> `isNewUser = true` → FE điều hướng tới màn hình chọn môn học (onboarding).
> `isNewUser = false` → FE vào thẳng màn hình chính.

**Lỗi có thể xảy ra:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 401 | `MISSING_AUTH_TOKEN` | Không có / sai định dạng header |
| 401 | `INVALID_FIREBASE_TOKEN` | Token Firebase hết hạn, sai chữ ký, bị thu hồi, sai project |
| 409 | `ACCOUNT_CONFLICT` | Email từ Firebase đã thuộc về một tài khoản khác trong hệ thống |

---

#### `POST /api/users/subjects`

**Mục đích:** Lưu danh sách môn học muốn ôn thi — bước hoàn tất onboarding.
Có thể gọi lại nhiều lần để thay đổi danh sách.

**Auth:** `verifyAppToken` (cần session token từ `/login`)

**Request:**
```json
{
  "subjects": [
    { "id": "TOAN" },
    { "id": "VAN", "name": "Ngữ văn" }
  ]
}
```
> Trường `name` là tùy chọn và **hoàn toàn bị bỏ qua** — server luôn tra cứu
> tên từ `SUBJECT_CATALOG` server-side, không tin dữ liệu `name` từ client.

**Danh mục môn hợp lệ (`SUBJECT_CATALOG`):**

| Mã | Tên |
|----|-----|
| `TOAN` | Toán |
| `VAN` | Ngữ văn |
| `ANH` | Tiếng Anh |
| `LY` | Vật lý |
| `HOA` | Hóa học |
| `SINH` | Sinh học |
| `SU` | Lịch sử |
| `DIA` | Địa lý |
| `GDCD` | Giáo dục công dân |

**Luồng xử lý chi tiết:**

```
1. verifyAppToken → req.currentUser

2. Validate sơ bộ tại route layer (assertSubjectInputShape)
   ├─ subjects phải là mảng
   └─ Mỗi phần tử phải có dạng { id: string, name?: string }

3. UsersService.updateSubjects(userId, subjects)
   ├─ Validate số lượng: 1 ≤ length ≤ 7
   ├─ Với mỗi môn:
   │   ├─ id.trim().toUpperCase()  (normalize — "toan" → "TOAN")
   │   ├─ Kiểm tra id có trong SUBJECT_CATALOG
   │   └─ Kiểm tra không trùng lặp (dùng Set<string>)
   ├─ prisma.user.update({ subjects: [mảng mã đã normalize] })
   └─ Map mã → { id, name } từ SUBJECT_CATALOG rồi trả về
```

**Response thành công (200):**
```json
{
  "subjects": [
    { "id": "TOAN", "name": "Toán" },
    { "id": "VAN",  "name": "Ngữ văn" }
  ]
}
```

**Lỗi có thể xảy ra:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 401 | `MISSING_AUTH_TOKEN` | Không có / sai định dạng header |
| 401 | `INVALID_SESSION_TOKEN` | Session token hết hạn hoặc sai |
| 401 | `SESSION_USER_NOT_FOUND` | Tài khoản đã bị xoá sau khi token phát hành |
| 400 | `INVALID_REQUEST_BODY` | `subjects` không phải mảng, hoặc phần tử thiếu `id` |
| 400 | `INVALID_SUBJECTS` | Số lượng < 1 hoặc > 7, mã môn không tồn tại, hoặc trùng lặp |

---

#### `GET /api/users/me`

**Mục đích:** Lấy thông tin hồ sơ đầy đủ + số điểm tích lũy hiện tại.

**Auth:** `verifyAppToken`

**Luồng xử lý:**

```
1. verifyAppToken → req.currentUser (đã có đầy đủ thông tin user)

2. UsersService.getProfile(userId)
   ├─ prisma.user.findUnique({ id: userId })
   │   └─ Không tìm thấy → UserNotFoundError (404) [hi hữu]
   ├─ pointsService.getBalance(user.firebaseUid)  [truy vấn bảng user_points]
   └─ Kết hợp thành UserMeDto:
       profile + subjects (map mã → { id, name }) + points
```

**Response thành công (200):**
```json
{
  "id": "uuid",
  "firebaseUid": "firebase-uid",
  "displayName": "Nguyễn Văn A",
  "email": "user@example.com",
  "phone": "0901234567",
  "school": "THPT Chu Văn An",
  "province": "Hà Nội",
  "subjects": [
    { "id": "TOAN", "name": "Toán" },
    { "id": "VAN",  "name": "Ngữ văn" }
  ],
  "createdAt": "2026-06-08T...",
  "lastLoginAt": "2026-06-08T...",
  "points": 150
}
```

**Lỗi có thể xảy ra:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 401 | `MISSING_AUTH_TOKEN` | Không có / sai định dạng header |
| 401 | `INVALID_SESSION_TOKEN` | Session token hết hạn hoặc sai |
| 401 | `SESSION_USER_NOT_FOUND` | Tài khoản đã bị xoá sau khi token phát hành |
| 404 | `USER_NOT_FOUND` | User tồn tại trong token nhưng không còn trong DB (rất hi hữu) |

---

#### `PUT /api/users/profile`

**Mục đích:** Cho phép người dùng tự cập nhật thông tin hồ sơ cá nhân sau
onboarding.

**Auth:** `verifyAppToken`

**Ngữ nghĩa "PATCH bán phần" (partial patch):**
- Trường **vắng mặt** trong body → **giữ nguyên** giá trị cũ trong DB.
- Trường gửi `null` → **xoá** (set về `null`).
- Trường gửi chuỗi → **trim()** rồi lưu (chuỗi trắng sau trim → coi như `null`).
- Không cần gửi toàn bộ hồ sơ — phù hợp với React Query / SWR cập nhật từng
  trường trong màn hình Settings.

**Các trường được phép cập nhật:**

| Trường | Kiểu | Ràng buộc |
|--------|------|-----------|
| `displayName` | `string \| null` | Tối đa 100 ký tự |
| `phone` | `string \| null` | Tối đa 100 ký tự |
| `school` | `string \| null` | Tối đa 100 ký tự |
| `province` | `string \| null` | Tối đa 100 ký tự |

> **Không thể cập nhật qua đây:** `email` (đồng bộ tự động từ Firebase mỗi lần
> đăng nhập), `subjects` (có endpoint riêng với luật validate khác), `firebaseUid`
> / `createdAt` (bất biến).

**Request (ví dụ — chỉ cần gửi trường muốn sửa):**
```json
{ "displayName": "Nguyễn Thị B", "school": "THPT Lê Hồng Phong" }
```

**Ví dụ xoá trường school:**
```json
{ "school": null }
```

**Luồng xử lý:**

```
1. verifyAppToken → req.currentUser

2. Route layer — assertNullableStringField cho mỗi trường có trong body
   ├─ null / undefined → null (cho phép xoá)
   ├─ Không phải string → InvalidRequestBodyError (400)
   └─ String → trim()

3. UsersService.updateProfile(userId, update)
   ├─ validateProfileField: độ dài > 100 ký tự → InvalidProfileInputError (400)
   ├─ Chuỗi rỗng sau trim → null (tránh lưu chuỗi trắng vô nghĩa)
   ├─ prisma.user.update({ data: chỉ các trường có trong update })
   └─ Gọi lại getProfile() để trả về profile đầy đủ (kem điểm)
```

**Response thành công (200):** Giống `GET /me` — trả về `UserMeDto` đầy đủ
sau khi cập nhật (tiện cho FE cập nhật cache mà không cần gọi thêm `/me`).

**Lỗi có thể xảy ra:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 401 | `MISSING_AUTH_TOKEN` | Không có / sai định dạng header |
| 401 | `INVALID_SESSION_TOKEN` | Session token hết hạn hoặc sai |
| 401 | `SESSION_USER_NOT_FOUND` | Tài khoản đã bị xoá sau khi token phát hành |
| 400 | `INVALID_REQUEST_BODY` | Trường gửi lên không phải string hoặc null |
| 400 | `INVALID_PROFILE_INPUT` | Chuỗi quá 100 ký tự |
| 404 | `USER_NOT_FOUND` | User không còn trong DB (rất hi hữu) |

---

### Catalogue lỗi đầy đủ

Tất cả custom error đều có trường `code` (string) được ánh xạ tập trung tại
`app.ts` (`ERROR_CODE_TO_HTTP_STATUS`). Response body luôn có dạng:
```json
{ "error": "<CODE>", "message": "<mô tả rõ ràng bằng tiếng Việt>" }
```

| Class | Code | HTTP | Thuộc module |
|-------|------|------|-------------|
| `MissingAuthTokenError` | `MISSING_AUTH_TOKEN` | 401 | Auth |
| `InvalidFirebaseTokenError` | `INVALID_FIREBASE_TOKEN` | 401 | Auth |
| `InvalidSessionTokenError` | `INVALID_SESSION_TOKEN` | 401 | Auth |
| `SessionUserNotFoundError` | `SESSION_USER_NOT_FOUND` | 401 | Auth |
| `UserNotRegisteredError` | `USER_NOT_REGISTERED` | 403 | Auth |
| `AccountConflictError` | `ACCOUNT_CONFLICT` | 409 | Auth |
| `InvalidSubjectsError` | `INVALID_SUBJECTS` | 400 | Users |
| `InvalidProfileInputError` | `INVALID_PROFILE_INPUT` | 400 | Users |
| `UserNotFoundError` | `USER_NOT_FOUND` | 404 | Users |
| `UsersError` (generic) | `INVALID_REQUEST_BODY` | 400 | Users |
| `JwtConfigError` | *(không có code)* | 500 | Lib/JWT |

---

### Xử lý Race Condition

**Kịch bản:** User mở app đồng thời trên 2 thiết bị, cả 2 gọi `/login` gần
như cùng một lúc, và đây là LẦN ĐẦU đăng nhập (chưa có bản ghi trong DB).

```
Thiết bị A:  findUnique → null  ──┐
Thiết bị B:  findUnique → null  ──┤  Cả 2 cùng thấy "chưa có"
                                  ▼
Thiết bị A:  CREATE user  ──→  Thành công (giành được lock trước)
Thiết bị B:  CREATE user  ──→  Lỗi P2002 (vi phạm UNIQUE firebaseUid)
                                  │
                                  ▼
             findUnique lại theo firebaseUid
             ├─ Tìm thấy (do A vừa tạo)
             │   └─ syncExistingUser (cập nhật lastLoginAt) → trả về user, isNewUser: false
             └─ Không tìm thấy (P2002 từ cột khác, ví dụ email)
                 └─ AccountConflictError (409) — xung đột dữ liệu thật
```

**Tại sao không dùng `$transaction` với `SELECT FOR UPDATE`?**
Hai request đến từ 2 connection DB khác nhau — ngay cả trong transaction, thao
tác `SELECT FOR UPDATE` cũng không ngăn được việc cả 2 cùng đọc thấy "chưa có
bản ghi". Pattern catch-then-refetch là cách đúng và được dùng rộng rãi trong
PostgreSQL (tương tự `INSERT ... ON CONFLICT DO NOTHING` nhưng tương thích
hơn với Prisma ORM).

---

### Cấu trúc file & trách nhiệm

```
backend/
├── prisma/
│   ├── schema.prisma                          Model User (tất cả trường)
│   └── migrations/
│       ├── 20260608033940_add_users_table/    Migration tạo bảng users
│       └── 20260608064453_add_last_login_at/  Migration thêm cột lastLoginAt
│
├── src/
│   ├── lib/
│   │   ├── firebase-admin.ts    Khởi tạo Firebase Admin SDK (lazy singleton,
│   │   │                        đọc service account từ env vars, cache Auth instance)
│   │   └── jwt.ts               signAppToken / verifyAppToken (JWT nội bộ 7 ngày)
│   │
│   ├── types/
│   │   └── express.d.ts         Mở rộng Express.Request:
│   │                            req.firebaseUser? (FirebaseAuthenticatedUser)
│   │                            req.currentUser?  (User từ Prisma)
│   │
│   ├── middleware/
│   │   └── auth.middleware.ts   verifyFirebaseToken   ← chỉ POST /auth/login
│   │                            verifyAppToken        ← mọi route khác cần auth
│   │
│   ├── services/
│   │   ├── auth/
│   │   │   ├── auth.errors.ts   MissingAuthTokenError, InvalidFirebaseTokenError,
│   │   │   │                    InvalidSessionTokenError, SessionUserNotFoundError,
│   │   │   │                    UserNotRegisteredError, AccountConflictError
│   │   │   ├── auth.types.ts    FirebaseAuthenticatedUser, UserProfileDto,
│   │   │   │                    LoginResult, toUserProfileDto()
│   │   │   └── auth.service.ts  AuthService.login()
│   │   │                        ├─ findCreateOrSyncUser()
│   │   │                        └─ syncExistingUser()
│   │   │
│   │   └── users/
│   │       ├── users.errors.ts  InvalidSubjectsError, InvalidProfileInputError,
│   │       │                    UserNotFoundError
│   │       ├── users.types.ts   SUBJECT_CATALOG (9 môn), SubjectCatalogEntry,
│   │       │                    UserMeDto, MAX_PROFILE_FIELD_LENGTH = 100
│   │       └── users.service.ts UsersService
│   │                            ├─ updateSubjects()   → POST /subjects
│   │                            ├─ updateProfile()    → PUT /profile
│   │                            └─ getProfile()       → GET /me
│   │
│   ├── routes/
│   │   ├── auth.route.ts        POST /api/auth/login
│   │   └── users.route.ts       POST /api/users/subjects
│   │                            GET  /api/users/me
│   │                            PUT  /api/users/profile
│   │
│   └── app.ts                   Đăng ký authRouter (/api/auth)
│                                Đăng ký usersRouter (/api/users)
│                                ERROR_CODE_TO_HTTP_STATUS (ánh xạ lỗi → status)
│
└── .env.example                 FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
                                 FIREBASE_PRIVATE_KEY, JWT_SECRET
```

---

### Luồng onboarding đầy đủ từ góc nhìn FE

```
1. Màn hình đăng nhập
   └─ Firebase Auth SDK (FE) → đăng nhập Google / SĐT / Email
   └─ firebase.currentUser.getIdToken()  → Firebase ID Token (ngắn hạn)

2. POST /api/auth/login
   └─ Header: Authorization: Bearer <firebase-id-token>
   └─ Response: { token, isNewUser, user }
   └─ FE lưu token vào SecureStorage (không lưu vào localStorage — ứng dụng mobile)

3. Nếu isNewUser === true:
   └─ Điều hướng tới màn hình "Chọn môn học"
   └─ POST /api/users/subjects
      Header: Authorization: Bearer <session-token>
      Body: { subjects: [{ id: "TOAN" }, { id: "VAN" }, ...] }
   └─ Điều hướng vào app chính

4. Nếu isNewUser === false:
   └─ Vào thẳng màn hình chính

5. Mọi request sau đó:
   └─ Header: Authorization: Bearer <session-token>
   └─ Token hết hạn (7 ngày) → API trả 401 INVALID_SESSION_TOKEN
      → FE tự động refresh: gọi lại Firebase getIdToken() → POST /login lấy token mới
```

---

### Cách thiết lập & kiểm thử

**1. Cấu hình môi trường:**
```bash
cd backend
cp .env.example .env
# Điền FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
# (lấy từ file Service Account JSON của Firebase Console)
# Điền JWT_SECRET: bất kỳ chuỗi ngẫu nhiên dài ≥ 32 ký tự
```

**2. Chạy migration:**
```bash
npx prisma migrate dev
# Áp dụng 2 migration:
#   20260608033940_add_users_table
#   20260608064453_add_last_login_at
```

**3. Khởi động server:**
```bash
npm run dev   # hoặc: npx tsx src/server.ts
```

**4. Kiểm tra "đường ống" lỗi (không cần Firebase token thật):**
```bash
# Thiếu token → 401 MISSING_AUTH_TOKEN
curl http://localhost:4000/api/users/me

# Sai Firebase token → 401 INVALID_FIREBASE_TOKEN
curl -X POST http://localhost:4000/api/auth/login \
  -H "Authorization: Bearer garbage_firebase_token"

# Sai session token → 401 INVALID_SESSION_TOKEN
curl http://localhost:4000/api/users/me \
  -H "Authorization: Bearer garbage_session_token"

# POST subjects — thiếu body → 400 INVALID_REQUEST_BODY
# (cần session token hợp lệ trước)
```

**5. Test luồng đầy đủ (cần Firebase token thật từ FE):**
Khi FE được phát triển, lấy Firebase ID Token từ console trình duyệt:
```js
firebase.auth().currentUser.getIdToken(true).then(console.log)
```
Rồi dùng token đó gọi `POST /api/auth/login` để lấy session token, sau đó
test các endpoint còn lại.

**6. (Tùy chọn) Test nhanh bằng script Node — không cần FE:**
```js
// Tạo user test trực tiếp trong DB + tự ký session token
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

const user = await prisma.user.create({
  data: { firebaseUid: 'test-uid', email: 'test@example.com', lastLoginAt: new Date() }
});
const token = jwt.sign(
  { userId: user.id, firebaseUid: user.firebaseUid },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);
console.log('Session token:', token);
// Dùng token này để test GET /me, POST /subjects, PUT /profile
// Xoá khi xong: await prisma.user.delete({ where: { id: user.id } })
```

---

### Lưu ý bảo mật

- `FIREBASE_PRIVATE_KEY` và `JWT_SECRET` là **thông tin nhạy cảm cao** — KHÔNG
  bao giờ commit vào Git (đã được `.gitignore` loại trừ). Lưu vào trình quản lý
  secret khi deploy (AWS Secrets Manager, Heroku Config Vars, Render Environment...).
- File `Service Account JSON` gốc nên được lưu ở nơi an toàn (không để trên
  Desktop), hoặc thu hồi (revoke) sau khi đã đưa vào biến môi trường.
- JWT nội bộ có hạn 7 ngày — nếu nghi ngờ bị lộ, thay đổi `JWT_SECRET` sẽ
  vô hiệu hóa tất cả token cũ ngay lập tức (tất cả user phải đăng nhập lại).
- `email` nullable + `@unique`: PostgreSQL cho phép nhiều `NULL` (không vi phạm
  UNIQUE), nhưng chỉ một bản ghi có thể có một email cụ thể.

---

### TODO / Cải thiện trong tương lai

- [ ] Viết unit test chính thức (Vitest) cho `AuthService` / `UsersService` với
  Prisma và Firebase Admin SDK được mock — thay vì chỉ smoke test thủ công.
- [ ] Token refresh tự động — hiện tại FE phải tự phát hiện 401 và gọi lại
  `/login`; có thể chuẩn hoá thêm endpoint `POST /api/auth/refresh` nhận
  refresh token (hoặc dùng lại Firebase refresh token) trả về session token mới.
- [ ] Thêm `DELETE /api/auth/logout` để thu hồi session (cần blacklist token
  trong Redis nếu muốn thực sự vô hiệu hóa trước khi hết hạn 7 ngày).
- [ ] Đồng bộ `phone` từ Firebase khi user đổi số điện thoại (hiện tại phone
  chỉ được đồng bộ lúc TẠO MỚI, không cập nhật lại khi đổi phương thức đăng nhập).
- [ ] Middleware `verifyAppToken` sẽ được tái dùng nguyên vẹn cho Socket.io
  (truyền `token` qua `socket.handshake.auth.token`).
