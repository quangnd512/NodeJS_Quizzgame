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

---

## 4. Practice Module – Chế độ Ôn tập

**Trạng thái:** ✅ Hoàn thành  
**Ngày hoàn thành:** 2026-06-09  
**Branch / commit liên quan:** `feature/practice-module`

---

### Tổng quan

Module Ôn tập là chế độ chơi đầu tiên của QuizzGame. Người dùng chọn môn học,
nhận 15 câu hỏi ngẫu nhiên (5 dễ + 5 trung bình + 5 khó), trả lời trong 17 phút,
và nhận điểm tích lũy bằng số câu đúng. Thiết kế ưu tiên câu "chưa làm trong 24h"
để tránh lặp lại, hỗ trợ resume phiên đang dở, và có cơ chế báo cáo câu hỏi sai.

**Tính năng chính:**
- Rút câu ngẫu nhiên theo độ khó, ưu tiên câu chưa làm trong 24h
- Idempotent answer submission (gọi lại cùng câu → kết quả cũ, không insert thêm)
- Hoàn thành phiên: tính điểm + cộng điểm tích lũy trong 1 transaction atomic
- Rate limit: tối đa 10 phiên/giờ/user qua Redis (Redis down → bỏ qua, không crash — *đã đổi sang fail-closed ở Feature 11*)
- Báo cáo câu sai: chỉ cho phép báo cáo câu **đã từng làm**; ≥5 báo cáo PENDING → tự động ẩn câu
- Admin CRUD câu hỏi, bulk import, quản lý báo cáo
- Cleanup cron: đóng phiên hết hạn lúc 3:00 AM

---

### Phương án kỹ thuật được lựa chọn và lý do

#### 1. Rút câu theo độ khó — không hoàn toàn random

**Vấn đề:** Random thuần túy có thể tạo ra bộ 15 câu quá dễ hoặc quá khó.

**Phương án đã chọn:** Rút 5 EASY + 5 MEDIUM + 5 HARD từ câu chưa làm trong 24h. Nếu không đủ, fallback sang câu đã làm lâu nhất.

**Lý do:** Đảm bảo mỗi phiên có độ cân bằng, phản ánh đúng trình độ tổng thể của học sinh — không may mắn hoặc rủi ro theo bài ra.

#### 2. Idempotent answer submission

**Vấn đề:** Mạng chập chờn → frontend gửi lại cùng đáp án → tạo 2 bản ghi answer → tính điểm sai.

**Phương án đã chọn:** `upsert` thay vì `create` khi ghi đáp án. Nếu `(sessionId, questionId)` đã tồn tại → update, không insert mới.

**Lý do:** Client có thể retry bất kỳ lần nào mà không lo dữ liệu bị nhân đôi. Không cần dedup logic phía client.

#### 3. Rate limit qua Redis, không qua DB

**Vấn đề:** Học sinh có thể "làm phiên" liên tục để tích điểm nhanh (ví dụ script tự động).

**Phương án đã chọn:** Dùng Redis `INCR` + `EXPIRE` để đếm số phiên trong 1 giờ. Giới hạn 10 phiên/giờ/user.

**Lý do:** Redis cho phép atomic increment không cần lock DB. Nhanh hơn query đếm DB. Tự động expire sau 1 giờ. *Lưu ý: ban đầu fail-open (Redis lỗi → bỏ qua giới hạn), sau đổi thành fail-closed ở Feature 11.*

#### 4. Cron job dọn phiên hết hạn — không dùng lazy expiration

**Vấn đề:** Practice Module có timeout 17 phút. Phiên hết giờ không tự đóng nếu user không nộp.

**Phương án đã chọn:** Cron job chạy 3:00 AM mỗi ngày, đóng tất cả phiên `IN_PROGRESS` quá 24 giờ.

**Lý do:** Practice session ít cần real-time accuracy hơn Exam session. Cron 1 lần/ngày đủ. *Contrast với Exam Module (Feature 6) dùng lazy expiration vì cần xác định điểm thưởng khi submit.*

---

### Data Model

#### Bảng `questions` — Ngân hàng câu hỏi

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `id` | UUID | Primary key |
| `subject` | String | Mã môn (`TOAN`, `VAN`, ...) |
| `chapter` | String? | Tên chương (tùy chọn) |
| `difficulty` | Int | Độ khó: 1=dễ, 2=trung bình, 3=khó |
| `question` | String | Nội dung câu hỏi |
| `options` | Json | Mảng 4 đáp án `[string, string, string, string]` |
| `correctAnswer` | Int | Chỉ số đáp án đúng (0–3) |
| `explanation` | String? | Giải thích (hiện sau khi nộp bài) |
| `examYear` | Int? | Năm đề (2023, 2024...) |
| `examCode` | String? | Mã đề thi |
| `isActive` | Boolean | false = ẩn (soft delete hoặc bị báo cáo nhiều) |
| `createdAt` | DateTime | Thời điểm tạo |

Index: `(subject, difficulty, isActive)` — tối ưu query rút câu.

#### Bảng `practice_sessions` — Phiên ôn tập

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `id` | UUID | Primary key |
| `userId` | String | ID user |
| `subjectId` | String | Mã môn học |
| `questions` | Json | Mảng 15 questionId đã rút |
| `score` | Int | Số câu đúng (mặc định 0) |
| `pointsEarned` | Int | Điểm tích lũy được (= score) |
| `startedAt` | DateTime | Thời điểm bắt đầu |
| `completedAt` | DateTime? | null = chưa xong; có giá trị = đã hoàn thành |

Index: `(userId, completedAt)`.

#### Bảng `practice_answers` — Đáp án từng câu

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `id` | UUID | Primary key |
| `sessionId` | String | Liên kết phiên |
| `questionId` | String | Liên kết câu hỏi |
| `selectedOption` | Int? | Lựa chọn của user (0–3) |
| `isCorrect` | Boolean | Đúng hay sai |
| `answeredAt` | DateTime | Thời điểm trả lời |

**UNIQUE(`sessionId`, `questionId`)** — đảm bảo idempotency: gọi lại → trả kết quả cũ.

#### Bảng `user_question_history` — Lịch sử câu hỏi đã làm

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `id` | UUID | Primary key |
| `userId` | String | ID user |
| `questionId` | String | ID câu hỏi |
| `attemptedAt` | DateTime | Lần làm gần nhất (upsert khi làm lại) |

**UNIQUE(`userId`, `questionId`)** — mỗi user 1 bản ghi/câu; upsert khi làm lại.

#### Bảng `question_reports` — Báo cáo câu hỏi

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `id` | UUID | Primary key |
| `questionId` | String | Câu hỏi bị báo cáo |
| `userId` | String | User báo cáo |
| `reason` | String | `WRONG_ANSWER` \| `BAD_CONTENT` \| `TYPO` \| `OTHER` |
| `description` | String? | Mô tả thêm (tối đa 500 ký tự) |
| `status` | String | `PENDING` \| `REVIEWED` \| `FIXED` \| `DISMISSED` |
| `createdAt` | DateTime | Thời điểm báo cáo |

**UNIQUE(`userId`, `questionId`)** — mỗi user chỉ báo cáo 1 lần/câu.

---

### Biến môi trường mới

| Biến | Bắt buộc | Mô tả |
|------|----------|-------|
| `REDIS_URL` | Không | URL Redis cho rate limit (mặc định `redis://localhost:6379`) |
| `ADMIN_SECRET` | ✅ (cho admin API) | Chuỗi bí mật cho header `X-Admin-Secret` |

---

### API Reference

#### Người dùng — `/api/practice/*` (cần `Authorization: Bearer <session-token>`)

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/practice/start?subject=TOAN` | Bắt đầu phiên ôn tập mới |
| POST | `/api/practice/answer` | Nộp đáp án 1 câu |
| POST | `/api/practice/complete` | Hoàn thành phiên, nhận điểm |
| GET | `/api/practice/session/:id` | Lấy chi tiết phiên đang dở (resume) |
| GET | `/api/practice/history` | Lịch sử phiên đã hoàn thành |
| GET | `/api/practice/stats?subject=` | Thống kê theo môn học |
| GET | `/api/practice/questions/:id/explain` | Xem giải thích (cần đã làm câu đó) |
| POST | `/api/practice/questions/:id/report` | Báo cáo câu hỏi sai |

#### Admin — `/api/admin/*` (cần `X-Admin-Secret: <ADMIN_SECRET>`)

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/admin/questions` | Tạo 1 câu hỏi |
| POST | `/api/admin/questions/bulk` | Import hàng loạt (tối đa 500 câu, all-or-nothing) |
| PUT | `/api/admin/questions/:id` | Cập nhật câu hỏi |
| DELETE | `/api/admin/questions/:id` | Ẩn câu hỏi (soft delete) |
| GET | `/api/admin/questions` | Danh sách câu hỏi (có phân trang, lọc) |
| GET | `/api/admin/questions/reports` | Danh sách báo cáo |
| GET | `/api/admin/questions/reports/summary` | Thống kê báo cáo |
| PATCH | `/api/admin/questions/reports/:id` | Cập nhật trạng thái báo cáo |

---

#### GET /api/practice/start?subject=TOAN

**Request:** Query param `subject` là mã môn (bắt buộc).

**Response (201):**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "subjectId": "TOAN",
  "questions": [
    {
      "id": "q-uuid-1",
      "subject": "TOAN",
      "chapter": "Hàm số",
      "difficulty": 1,
      "question": "Tập xác định của hàm số y = √(x−1) là?",
      "options": ["[1;+∞)", "(1;+∞)", "[-1;+∞)", "(-∞;1]"]
    }
  ],
  "timeLimitSeconds": 1020,
  "startedAt": "2026-06-09T10:00:00.000Z"
}
```

**Lỗi:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 400 | `INVALID_REQUEST_BODY` | Thiếu query param `subject` |
| 403 | `SUBJECT_NOT_REGISTERED` | Môn không hợp lệ hoặc user chưa đăng ký |
| 404 | `SUBJECT_HAS_NO_QUESTIONS` | Không có câu hỏi nào trong DB |
| 429 | `PRACTICE_RATE_LIMIT_EXCEEDED` | Vượt 10 phiên/giờ |

---

#### POST /api/practice/answer

**Request:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "questionId": "q-uuid-1",
  "selectedOption": 0
}
```

**Response (200):**
```json
{
  "isCorrect": true,
  "correctAnswer": 0,
  "explanation": "Điều kiện: x−1 ≥ 0 ⟺ x ≥ 1 → TXĐ: [1;+∞)",
  "answeredCount": 1,
  "totalQuestions": 15
}
```

**Luồng xử lý:**
```
1. Kiểm tra phiên tồn tại + thuộc user + chưa complete + chưa hết giờ
2. Kiểm tra questionId nằm trong phiên
3. Kiểm tra idempotency (đã trả lời rồi → trả kết quả cũ)
4. Lấy correctAnswer từ DB, tính isCorrect
5. Transaction: INSERT practice_answer + UPSERT user_question_history
6. Catch P2002 (race condition) → xử lý như idempotent
```

**Lỗi:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 400 | `INVALID_REQUEST_BODY` | selectedOption ngoài 0-3, hoặc sessionId/questionId không phải UUID |
| 400 | `QUESTION_NOT_IN_SESSION` | questionId không thuộc phiên này |
| 403 | `PRACTICE_SESSION_NOT_OWNED` | Phiên của user khác |
| 404 | `PRACTICE_SESSION_NOT_FOUND` | sessionId không tồn tại |
| 409 | `PRACTICE_SESSION_ALREADY_COMPLETED` | Phiên đã hoàn thành |
| 410 | `PRACTICE_SESSION_EXPIRED` | Phiên đã quá 17 phút |

---

#### POST /api/practice/complete

**Request:**
```json
{ "sessionId": "550e8400-e29b-41d4-a716-446655440000" }
```

**Response (200):**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "score": 12,
  "pointsEarned": 12,
  "totalQuestions": 15,
  "answers": [
    {
      "questionId": "q-uuid-1",
      "selectedOption": 0,
      "isCorrect": true,
      "correctAnswer": 0,
      "explanation": "Điều kiện: x−1 ≥ 0 ⟺ x ≥ 1 → TXĐ: [1;+∞)"
    }
  ]
}
```

**Luồng xử lý:**
```
1. Transaction:
   a. Tìm phiên, kiểm tra ownership, chưa complete
   b. Đếm câu đúng → score = pointsEarned
   c. UPDATE practice_session: score, pointsEarned, completedAt = now()
   d. Nếu score > 0: addPointsInTx(userId, score, 'ON_TAP_CORRECT')
2. Retry tối đa 10 lần nếu gặp OptimisticLockRetryableError (conflict cộng điểm)
```

---

#### GET /api/practice/session/:id

**Response (200):**
```json
{
  "sessionId": "550e8400-...",
  "subjectId": "TOAN",
  "questions": [ ...15 câu (QuestionPublicDto, không có correctAnswer)... ],
  "answers": [
    { "questionId": "q-uuid-1", "selectedOption": 0, "isCorrect": true }
  ],
  "timeRemainingSeconds": 754,
  "startedAt": "2026-06-09T10:00:00.000Z"
}
```

---

#### GET /api/practice/history?limit=20&offset=0

**Response (200):**
```json
{
  "items": [
    {
      "sessionId": "...",
      "subjectId": "TOAN",
      "score": 12,
      "pointsEarned": 12,
      "totalQuestions": 15,
      "startedAt": "2026-06-09T10:00:00.000Z",
      "completedAt": "2026-06-09T10:14:00.000Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

---

#### GET /api/practice/stats?subject=TOAN

**Response (200):**
```json
[
  {
    "subject": "TOAN",
    "totalSessions": 5,
    "avgScore": 10.6,
    "bestScore": 13,
    "accuracyByDifficulty": { "1": 0.96, "2": 0.74, "3": 0.52 }
  }
]
```

---

#### POST /api/admin/questions/bulk

**Request (`X-Admin-Secret: <ADMIN_SECRET>`):**
```json
{
  "questions": [
    {
      "subject": "TOAN",
      "chapter": "Hàm số",
      "difficulty": 2,
      "question": "Hàm số y = x³ − 3x đồng biến trên khoảng nào?",
      "options": ["(-1;1)", "(-∞;-1)", "(1;+∞)", "(-∞;-1) và (1;+∞)"],
      "correctAnswer": 3,
      "explanation": "y' = 3x² − 3 = 3(x−1)(x+1); y' > 0 khi x < -1 hoặc x > 1",
      "examYear": 2024,
      "examCode": "Mã đề 101"
    }
  ]
}
```

**Response (201):**
```json
{ "inserted": 1, "questions": [ { ...QuestionFullDto... } ] }
```

---

### Luồng chạy (Flow)

#### Luồng ôn tập đầy đủ (happy path)

```
[User]                          [Backend]                        [DB/Redis]
  │                                 │                                 │
  ├─ GET /practice/start?subject=TOAN ─►                              │
  │                                 ├─ Validate môn + user đã đăng ký ─► DB
  │                                 ├─ checkRateLimit ──────────────► Redis
  │                                 ├─ Lấy 24h history ─────────────► DB
  │                                 ├─ Rút 5+5+5 câu (song song) ───► DB
  │                                 ├─ CREATE practice_session ──────► DB
  │                                 ├─ incrementRateLimit ──────────► Redis
  │◄─ 201 { sessionId, questions } ─┘                                 │
  │                                 │                                 │
  ├─ POST /practice/answer ─────────►                                 │
  │  { sessionId, questionId, selectedOption: 0 }                     │
  │                                 ├─ Validate session + ownership   │
  │                                 ├─ Kiểm tra idempotency ─────────► DB
  │                                 ├─ Lấy correctAnswer ────────────► DB
  │                                 ├─ TX: INSERT answer              │
  │                                 │      UPSERT history ───────────► DB
  │◄─ 200 { isCorrect, correctAnswer, explanation } ─┘                │
  │  (lặp lại cho 15 câu)           │                                 │
  │                                 │                                 │
  ├─ POST /practice/complete ───────►                                 │
  │  { sessionId }                  │                                 │
  │                                 ├─ TX:                            │
  │                                 │   ├─ Đếm câu đúng → score      │
  │                                 │   ├─ UPDATE session (completedAt)►DB
  │                                 │   └─ addPointsInTx(score) ─────► DB
  │◄─ 200 { score, pointsEarned, answers } ─┘                        │
```

#### Luồng báo cáo câu hỏi

```
[User]                          [Backend]                        [DB]
  │                                 │                               │
  ├─ POST /practice/questions/:id/report ─►                         │
  │  { reason: "WRONG_ANSWER", description? }                       │
  │                                 ├─ Kiểm tra câu tồn tại ──────► DB
  │                                 ├─ Kiểm tra user đã làm câu này
  │                                 │   chưa (user_question_history) ► DB
  │                                 │   └─ chưa làm → 403
  │                                 │      QUESTION_NOT_ATTEMPTED_FOR_REPORT
  │                                 ├─ Kiểm tra đã báo cáo chưa ──► DB
  │                                 ├─ CREATE question_report ─────► DB
  │                                 ├─ autoHideIfThresholdExceeded():
  │                                 │   đếm PENDING reports ───────► DB
  │                                 │   ├─ < 5 → không làm gì      │
  │                                 │   └─ ≥ 5 → UPDATE isActive=false ► DB
  │◄─ 201 { message: "Đã gửi báo cáo thành công." }                 │
```

---

### Cấu trúc file

```
backend/
├── prisma/
│   ├── schema.prisma                          +4 model mới: Question, PracticeSession,
│   │                                           PracticeAnswer, UserQuestionHistory,
│   │                                           QuestionReport
│   └── migrations/
│       └── 20260609112442_add_practice_module/ Migration thêm 5 bảng mới
│
├── src/
│   ├── lib/
│   │   └── redis.ts                           ioredis client (lazy connect, graceful degradation)
│   │
│   ├── middleware/
│   │   ├── admin.middleware.ts                verifyAdminSecret (header X-Admin-Secret)
│   │   └── validate.middleware.ts             validateBody(zodSchema) — wrapper Zod
│   │
│   ├── services/
│   │   └── practice/
│   │       ├── practice.types.ts              DTOs, hằng số (SESSION_TIMEOUT, QUESTIONS_PER_SESSION...)
│   │       ├── practice.errors.ts             13 custom error class cho module Ôn tập
│   │       └── practice.service.ts            PracticeService — toàn bộ business logic
│   │
│   ├── routes/
│   │   ├── practice.route.ts                  /api/practice/* (7 endpoint cho user)
│   │   └── admin.route.ts                     /api/admin/* (8 endpoint cho admin)
│   │
│   ├── scripts/
│   │   └── smoke-test-question-reports.ts     Smoke test luồng báo cáo (8 case, `npm run smoke:reports`)
│   │
│   └── app.ts                                 +đăng ký practiceRouter, adminRouter
│                                              +ánh xạ error codes mới vào HTTP status
```

---

### Hằng số thiết kế quan trọng

| Hằng số | Giá trị | Ý nghĩa |
|---------|---------|---------|
| `SESSION_TIMEOUT_SECONDS` | 1020 (17 phút) | 15 phút làm bài + 2 phút buffer |
| `QUESTIONS_PER_SESSION` | 15 | Tổng câu mỗi phiên |
| `QUESTIONS_PER_DIFFICULTY` | 5 | Câu mỗi nhóm độ khó |
| `MAX_SESSIONS_PER_HOUR` | 10 | Rate limit phiên/giờ/user |
| `MAX_COMPLETE_RETRY` | 10 | Retry tối đa khi cộng điểm conflict |
| `AUTO_HIDE_REPORT_THRESHOLD` | 5 | Số báo cáo PENDING để auto-ẩn câu |

---

### Ghi chú kỹ thuật

**1. Tại sao tách `practice_answers` thành bảng riêng thay vì JSON trong session?**
Nếu lưu đáp án trong mảng JSON của `practice_sessions`, mỗi POST `/answer` sẽ
phải đọc-sửa-ghi toàn bộ mảng JSON → race condition khi 2 request submit cùng
lúc → mất dữ liệu. Bảng riêng + `@@unique([sessionId, questionId])` giải quyết
sạch vấn đề này.

**2. Idempotency qua `@@unique` + catch P2002:**
- Kiểm tra "đã trả lời chưa" trước khi insert (tránh write thừa).
- Nếu 2 request song song cùng vượt qua check → 1 insert thành công, 1 bị P2002
  → bắt lỗi P2002 và xử lý như idempotent response. Không dùng SELECT FOR UPDATE
  vì cost cao không cần thiết.

**3. Redis graceful degradation:**
Redis client dùng `enableOfflineQueue: false` + `maxRetriesPerRequest: 1`.
Khi Redis down: checkRateLimit bắt lỗi → log warning → **không throw** → user
vẫn tạo được phiên. Rate limit là "nice to have", không phải tính năng critical.

**4. `addPointsInTx` — cộng điểm trong transaction ngoài:**
`completeSession` mở 1 Prisma transaction bao trùm toàn bộ (update session +
cộng điểm). `PointsService.addPointsInTx(tx, ...)` nhận transaction client từ
ngoài vào thay vì mở transaction mới → đảm bảo "cập nhật phiên" và "cộng điểm"
là 1 thao tác atomic duy nhất.

**5. Thứ tự câu hỏi:**
`questions` JSON trong `practice_sessions` lưu mảng questionId theo thứ tự
xác định lúc `startSession`. `getSessionDetail` tái tạo đúng thứ tự này khi
query lại — không phụ thuộc vào thứ tự DB trả về.

---

### Catalogue lỗi

| Class | Code | HTTP |
|-------|------|------|
| `PracticeSessionNotFoundError` | `PRACTICE_SESSION_NOT_FOUND` | 404 |
| `PracticeSessionExpiredError` | `PRACTICE_SESSION_EXPIRED` | 410 |
| `PracticeSessionAlreadyCompletedError` | `PRACTICE_SESSION_ALREADY_COMPLETED` | 409 |
| `PracticeSessionNotOwnedError` | `PRACTICE_SESSION_NOT_OWNED` | 403 |
| `PracticeRateLimitError` | `PRACTICE_RATE_LIMIT_EXCEEDED` | 429 |
| `SubjectNotRegisteredError` | `SUBJECT_NOT_REGISTERED` | 403 |
| `SubjectHasNoQuestionsError` | `SUBJECT_HAS_NO_QUESTIONS` | 404 |
| `QuestionNotFoundError` | `QUESTION_NOT_FOUND` | 404 |
| `QuestionNotAttemptedError` | `QUESTION_NOT_ATTEMPTED` | 403 |
| `QuestionNotAttemptedForReportError` | `QUESTION_NOT_ATTEMPTED_FOR_REPORT` | 403 |
| `QuestionNotInSessionError` | `QUESTION_NOT_IN_SESSION` | 400 |
| `ReportAlreadySubmittedError` | `REPORT_ALREADY_SUBMITTED` | 409 |
| `AdminUnauthorizedError` | `ADMIN_UNAUTHORIZED` | 401 |

---

### Cách thiết lập & kiểm thử

**1. Thêm biến môi trường vào `.env`:**
```bash
REDIS_URL=redis://localhost:6379
ADMIN_SECRET=your-secret-string-min-16-chars
```

**2. Chạy migration:**
```bash
cd backend
npx prisma migrate dev
# Áp dụng migration: 20260609112442_add_practice_module
# Tạo 5 bảng: questions, practice_sessions, practice_answers,
#             user_question_history, question_reports
```

**3. Seed câu hỏi mẫu (nếu có):**
```bash
npx tsx prisma/seed.ts
```

**4. Khởi động Redis (nếu muốn test rate limit):**
```bash
redis-server
```

**5. Khởi động server:**
```bash
npm run dev
```

**6. Test nhanh bằng curl:**

```bash
# Lấy session token (giả định đã có — xem Mục 3)
TOKEN="eyJhbGci..."

# Bắt đầu phiên ôn tập
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/practice/start?subject=TOAN"

# Nộp đáp án (thay sessionId và questionId thực tế)
curl -X POST http://localhost:4000/api/practice/answer \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"<session-id>","questionId":"<question-id>","selectedOption":0}'

# Hoàn thành phiên
curl -X POST http://localhost:4000/api/practice/complete \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"<session-id>"}'

# Admin: import câu hỏi mẫu
curl -X POST http://localhost:4000/api/admin/questions/bulk \
  -H "X-Admin-Secret: $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"questions":[{"subject":"TOAN","difficulty":1,"question":"1+1=?","options":["1","2","3","4"],"correctAnswer":1}]}'
```

---

### Lưu ý / TODO tiếp theo

- **Chưa có cron job thực sự:** `cleanupExpiredSessions()` đã viết nhưng chưa
  tích hợp vào `node-cron` — cần thêm scheduler trong `server.ts`.
- **Thứ tự câu hỏi là random tại thời điểm tạo phiên** — nếu muốn ổn định hơn
  (ví dụ: luôn dễ → khó), có thể sắp xếp lại trước khi lưu vào JSON.
- **Thiếu index** trên `question_reports` cho `questionId` — khi có nhiều báo
  cáo, `COUNT WHERE questionId = ?` có thể chậm. Nên thêm index nếu cần.
- **Điểm thưởng hiện là 1 điểm/câu đúng** — GDD có thể điều chỉnh công thức
  (ví dụ điểm theo độ khó: dễ=1, trung=2, khó=3) trong phiên bản sau.
- TODO: Viết unit test cho `PracticeService` với Prisma mock.

---

## 5. Admin Dashboard – Quản lý báo cáo câu hỏi

**Trạng thái:** ✅ Hoàn thành
**Ngày hoàn thành:** 2026-06-12
**Branch / commit liên quan:** `feature/question-reports`

---

### Tổng quan

Trước đây, admin chỉ có thể xử lý báo cáo câu hỏi bằng cách gọi trực tiếp
`/api/admin/questions/reports*` qua curl/Postman (xem Section 4). Tính năng
này thêm một **trang quản trị web** tại `/#admin` để admin xem thống kê và xử
lý báo cáo trực quan hơn, đồng thời siết lại điều kiện báo cáo ở phía backend.

**Hai phần thay đổi:**

1. **Frontend — trang Admin Dashboard mới (`/#admin`)**
   - Đăng nhập bằng `ADMIN_SECRET` (không qua Firebase).
   - 4 thẻ thống kê: Chờ xử lý / Đã xem / Đã sửa / Đã bỏ qua.
   - Danh sách báo cáo: lọc theo trạng thái, phân trang (20/trang).
   - Đổi trạng thái từng báo cáo (Đã xem / Đã sửa / Bỏ qua) ngay trên UI.
   - Cảnh báo khi một thao tác khiến câu hỏi liên quan bị **tự động ẩn**.

2. **Backend — siết điều kiện báo cáo + chuẩn hoá response thống kê**
   - User chỉ được báo cáo câu hỏi **đã từng làm** (chống spam báo cáo câu
     chưa từng thấy để cố tình đẩy câu nào đó vượt ngưỡng auto-hide).
     Lỗi mới: `403 QUESTION_NOT_ATTEMPTED_FOR_REPORT`.
   - `GET /api/admin/questions/reports/summary` đổi response từ dạng lồng
     `{ byStatus: {...}, topReportedQuestions }` sang dạng **flatten**
     `{ pending, reviewed, fixed, dismissed, topReportedQuestions }` — khớp
     trực tiếp với 4 thẻ thống kê trên dashboard.
   - Hộp báo lỗi câu hỏi (phía người dùng) có thêm ô **mô tả thêm** (tối đa
     500 ký tự, không bắt buộc) và hiển thị đúng thông báo khi báo cáo trùng
     hoặc bị từ chối.

**Tính năng chính:**
- Trang admin độc lập tại `/#admin`, tách biệt hoàn toàn với luồng Firebase Auth
- Đăng nhập bằng `ADMIN_SECRET`, lưu trong `sessionStorage` (mất khi đóng tab)
- 4 thẻ thống kê + danh sách báo cáo có lọc theo trạng thái và phân trang
- Đổi trạng thái báo cáo trực tiếp trên UI, có cảnh báo auto-hide
- Backend: chỉ cho báo cáo câu đã từng làm (`user_question_history`)
- Refactor logic auto-hide thành 1 helper dùng chung (`autoHideIfThresholdExceeded`)

---

### Data Model

Không có bảng/migration mới — tái sử dụng `questions`, `question_reports`,
`user_question_history` đã có từ Practice Module (xem Section 4). Chỉ thêm
kiểu dữ liệu mới ở tầng service/FE cho response của `getReportsSummary()`:

#### `QuestionReportSummary` (backend) / `ReportsSummary` (frontend)

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `pending` | number | Số báo cáo đang ở trạng thái `PENDING` |
| `reviewed` | number | Số báo cáo đang ở trạng thái `REVIEWED` |
| `fixed` | number | Số báo cáo đang ở trạng thái `FIXED` |
| `dismissed` | number | Số báo cáo đang ở trạng thái `DISMISSED` |
| `topReportedQuestions` | `{ questionId: string; count: number }[]` | Top 10 câu bị báo cáo nhiều nhất (mọi trạng thái), sắp giảm dần theo `count` |

> Đây là kết quả refactor của `PracticeService.getReportsSummary()` — trước
> đây trả `{ byStatus: Record<string, number>, topReportedQuestions }`.

---

### API Reference

Dashboard tái sử dụng 3 endpoint admin đã có sẵn từ Section 4 (không thêm
route mới). Bảng dưới chỉ liệt lại các endpoint có liên quan trực tiếp tới
tính năng này:

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| GET | `/api/admin/questions/reports?status=&page=&limit=` | `X-Admin-Secret` | Danh sách báo cáo — dashboard gọi khi mở trang, đổi filter hoặc đổi trang |
| GET | `/api/admin/questions/reports/summary` | `X-Admin-Secret` | 4 chỉ số tổng hợp cho thẻ thống kê (response shape **mới**) |
| PATCH | `/api/admin/questions/reports/:id` | `X-Admin-Secret` | Đổi trạng thái 1 báo cáo, có thể trigger auto-hide |
| POST | `/api/practice/questions/:id/report` | `Authorization: Bearer <session-token>` | Báo cáo câu hỏi — thêm điều kiện "đã từng làm" |

#### GET /api/admin/questions/reports/summary

**Response (200) — shape MỚI:**
```json
{
  "pending": 12,
  "reviewed": 5,
  "fixed": 3,
  "dismissed": 2,
  "topReportedQuestions": [
    { "questionId": "550e8400-e29b-41d4-a716-446655440001", "count": 7 },
    { "questionId": "550e8400-e29b-41d4-a716-446655440002", "count": 4 }
  ]
}
```

> ⚠️ Shape CŨ `{ byStatus: { PENDING, REVIEWED, FIXED, DISMISSED }, topReportedQuestions }`
> **không còn được trả về**. Bất kỳ client nào đọc `result.byStatus.PENDING`
> cần cập nhật sang `result.pending`.

**Lỗi:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 401 | `ADMIN_UNAUTHORIZED` | Thiếu hoặc sai `X-Admin-Secret` |

---

#### PATCH /api/admin/questions/reports/:id

**Request:**
```json
{ "status": "FIXED" }
```

**Response (200):**
```json
{
  "id": "7c1f0e7a-7e3b-4a3a-9b6e-9b6c1a2b3c4d",
  "status": "FIXED",
  "autoHidden": false
}
```

**Luồng xử lý:**
```
1. UPDATE question_report SET status = :status WHERE id = :id
2. autoHideIfThresholdExceeded(report.questionId):
   - COUNT question_report WHERE questionId = :id AND status = 'PENDING'
   - Nếu count >= AUTO_HIDE_REPORT_THRESHOLD (5):
       UPDATE question SET isActive = false
       trả autoHidden = true
   - Ngược lại: autoHidden = false
3. Trả { id, status, autoHidden }
```

**Error codes:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 400 | `INVALID_REQUEST_BODY` | `status` không thuộc `PENDING\|REVIEWED\|FIXED\|DISMISSED` |
| 401 | `ADMIN_UNAUTHORIZED` | Thiếu hoặc sai `X-Admin-Secret` |
| 500 | `INTERNAL_SERVER_ERROR` | `id` không tồn tại (Prisma P2025 — pre-existing, xem Section 4 "Lưu ý / TODO") |

---

#### POST /api/practice/questions/:id/report (điều kiện mới)

Route và request body **không đổi** (`{ reason, description? }`, xem ví dụ ở
`docs/guides/user-guide.md` mục 2.6), nhưng thêm 1 bước kiểm tra trước khi cho
phép tạo báo cáo:

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 403 | `QUESTION_NOT_ATTEMPTED_FOR_REPORT` | User chưa có bản ghi `user_question_history` cho câu hỏi này — chưa từng làm câu này trong bất kỳ phiên nào |

---

### Luồng chạy (Flow)

#### 1. Đăng nhập Admin Dashboard

```
[Admin]                       [Frontend /#admin]              [Backend]
  │                                  │                              │
  ├─ Mở http://.../#admin ──────────►                              │
  │                                  ├─ sessionStorage chưa có       │
  │                                  │   "adminSecret"               │
  │◄─ Hiện AdminLoginPage ───────────┤                              │
  │                                  │                              │
  ├─ Nhập ADMIN_SECRET, Enter ──────►                               │
  │                                  ├─ GET /reports/summary ────────►
  │                                  │   (X-Admin-Secret: <input>)   │
  │                                  │◄─ 200 ────────────────────────┤
  │                                  ├─ lưu secret vào sessionStorage │
  │◄─ Chuyển sang AdminReportsPage ──┤                              │
  │                                  │                              │
  │  (nếu 401/403)                   │                              │
  │◄─ "Mã bí mật không đúng." ───────┤                              │
```

#### 2. Xem & xử lý báo cáo trên dashboard

```
[Admin]                  [AdminReportsPage]              [Backend]                [DB]
  │                              │                              │                    │
  ├─ Mở dashboard ──────────────►                              │                    │
  │                              ├─ GET /reports/summary ───────► getReportsSummary ─► DB (2x groupBy)
  │                              ├─ GET /reports?status=&page= ─► listReports ───────► DB
  │◄─ Hiện 4 thẻ + danh sách ─────┤                              │                    │
  │                              │                              │                    │
  ├─ Đổi filter "Chờ xử lý" ─────► setStatusFilter, page=1       │                    │
  │                              ├─ GET /reports?status=PENDING ►                    │
  │◄─ Cập nhật danh sách ─────────┤                              │                    │
  │                              │                              │                    │
  ├─ Click "Đã sửa" trên 1 dòng ─► setBusyId(reportId)           │                    │
  │                              ├─ PATCH /reports/:id           │                    │
  │                              │   { status: "FIXED" } ───────► updateReport ──────► UPDATE question_report
  │                              │                              ├─ autoHideIfThreshold─► COUNT PENDING
  │                              │                              │   Exceeded()         │ (+ UPDATE isActive
  │                              │◄─ { id, status, autoHidden }─┤                      │  nếu >= 5)
  │                              │                              │                    │
  │  nếu autoHidden=true:         │                              │                    │
  │◄─ Banner "Câu hỏi liên quan ──┤                              │                    │
  │   đã bị tự động ẩn..."        │                              │                    │
  │                              ├─ reload summary + list ───────►                    │
  │◄─ Cập nhật 4 thẻ + danh sách ─┤                              │                    │
```

#### 3. Báo cáo câu hỏi từ phía người dùng (cập nhật)

```
[User]                          [Backend]                         [DB]
  │                                  │                                │
  ├─ POST /practice/questions/:id/report ─►                          │
  │  { reason: "WRONG_ANSWER", description?: "..." }                  │
  │                                  ├─ Câu hỏi tồn tại? ──────────────► 404 QUESTION_NOT_FOUND
  │                                  ├─ Đã làm câu này chưa? ──────────► user_question_history
  │                                  │     chưa làm ───────────────────► 403
  │                                  │                                  QUESTION_NOT_ATTEMPTED_FOR_REPORT
  │                                  ├─ Đã báo cáo câu này chưa? ───────► 409 REPORT_ALREADY_SUBMITTED
  │                                  ├─ CREATE question_report ─────────► DB
  │                                  ├─ autoHideIfThresholdExceeded() ──► COUNT + (UPDATE isActive nếu ≥5)
  │◄─ 201 { message: "Đã gửi báo cáo thành công." } ──┘                 │
```

**Phía FE (PracticeSessionScreen):** khi bấm "Báo lỗi", hiện ô nhập mô tả +
4 nút lý do. Bấm 1 lý do → gọi API ngay (mô tả là tuỳ chọn):
- Thành công → "✓ Đã gửi báo lỗi".
- `REPORT_ALREADY_SUBMITTED` → hiện "✓ Bạn đã báo cáo câu này rồi" (không coi
  là lỗi, vẫn đóng hộp báo lỗi).
- `QUESTION_NOT_ATTEMPTED_FOR_REPORT` → hiện "Bạn cần làm câu hỏi này trước
  khi báo cáo." ngay trong hộp báo lỗi, **không** đóng hộp.
- Toàn bộ trạng thái này (`showReport`, `reportSent`, `reportMessage`,
  `reportError`, `reportDesc`) được reset mỗi khi `question.id` đổi, vì
  `PracticeSessionScreen` không unmount giữa các câu.

---

### File Structure

```
frontend/
└── src/
    ├── App.tsx
    │   ├── Screen 'admin'             window.location.hash === '#admin' lúc init
    │   ├── AdminPage                  điều hướng Login ↔ ReportsPage theo sessionStorage
    │   ├── AdminLoginPage             form nhập ADMIN_SECRET, verify bằng /reports/summary
    │   ├── AdminReportsPage           4 thẻ thống kê + filter + list + pagination + đổi trạng thái
    │   └── PracticeSessionScreen      +textarea mô tả báo lỗi, +reset state theo question.id,
    │                                   +xử lý REPORT_ALREADY_SUBMITTED / QUESTION_NOT_ATTEMPTED_FOR_REPORT
    ├── App.css                        +.screen-admin, .admin-stats, .admin-report-*,
    │                                   .admin-status-badge.status-*, .report-desc, .report-error
    └── lib/
        └── api.ts
            ├── ApiError                sửa parameter properties → field declaration (fix TS1294)
            ├── reportQuestion()        bỏ tham số sessionId, thêm description? tuỳ chọn
            ├── adminListReports()      GET /api/admin/questions/reports
            ├── adminGetReportsSummary() GET /api/admin/questions/reports/summary
            ├── adminUpdateReportStatus() PATCH /api/admin/questions/reports/:id
            └── types: QuestionReportDto, ReportsSummary, ReportStatus

backend/
└── src/
    ├── services/practice/
    │   ├── practice.errors.ts          +QuestionNotAttemptedForReportError (403)
    │   ├── practice.types.ts           +QuestionReportSummary
    │   └── practice.service.ts
    │       ├── reportQuestion()        +kiểm tra user_question_history trước khi cho báo cáo
    │       ├── getReportsSummary()     trả QuestionReportSummary (shape flatten mới)
    │       └── autoHideIfThresholdExceeded()  helper private dùng chung cho
    │                                    reportQuestion() và updateReport()
    ├── app.ts                           +QUESTION_NOT_ATTEMPTED_FOR_REPORT → 403
    ├── package.json                     +script "smoke:reports"
    └── scripts/
        └── smoke-test-question-reports.ts   8 test case (happy path, lỗi, auto-hide, summary, update, filter)
```

---

### Ghi chú kỹ thuật

**1. Vì sao trang Admin không dùng Firebase Auth?**
Admin là vai trò vận hành nội bộ, đã xác thực bằng `ADMIN_SECRET` tĩnh cho mọi
endpoint `/api/admin/*` từ Practice Module. `App` đọc
`window.location.hash === '#admin'` ngay lúc khởi tạo state ban đầu
(`useState(() => ...)`) để bỏ qua hoàn toàn `onAuthStateChanged` của Firebase
— tránh yêu cầu admin phải có tài khoản Firebase.

**2. `ADMIN_SECRET` lưu ở `sessionStorage`, không phải `localStorage`:**
Secret chỉ tồn tại trong tab hiện tại và tự xoá khi đóng tab — giảm rủi ro lộ
secret trên máy dùng chung. `AdminLoginPage` không có endpoint "verify
secret" riêng — xác thực bằng cách gọi thử `GET /reports/summary`; nếu
401/403 thì coi là sai secret. `AdminReportsPage` cũng tự đăng xuất
(`onLogout`) nếu một request bất kỳ trả 401/403 (token/secret bị thu hồi giữa
phiên).

**3. Vì sao thêm `autoHideIfThresholdExceeded()` dùng chung?**
Trước refactor, `reportQuestion()` và `updateReport()` mỗi nơi tự
`questionReport.count({status: 'PENDING'})` rồi `question.update({isActive:
false})` — trùng logic ở 2 nơi, dễ lệch nếu chỉ sửa ngưỡng/log ở 1 nơi. Gộp
thành 1 helper `private` dùng chung, kèm `console.warn` khi auto-hide xảy ra
để dễ trace trong log production.

**4. Vì sao chặn báo cáo câu chưa từng làm?**
Ngăn user spam báo cáo câu hỏi họ chưa từng thấy — ví dụ cố tình gửi nhiều
report cho 1 câu để đẩy số PENDING vượt `AUTO_HIDE_REPORT_THRESHOLD` (5) và
khiến câu đó bị ẩn. Kiểm tra bằng
`prisma.userQuestionHistory.findUnique({ userId_questionId })` — cùng
composite key đã dùng cho idempotency ở `POST /practice/answer`.

**5. Breaking change: response shape của `/reports/summary`**
Shape cũ `{ byStatus: {...}, topReportedQuestions }` không còn được trả về —
mọi consumer (FE, script, tài liệu) phải đọc theo shape flatten mới
`{ pending, reviewed, fixed, dismissed, topReportedQuestions }`. Đã cập nhật
`docs/guides/admin-guide.md` mục 4.2.

---

### Vấn đề đã ghi nhận, chưa xử lý trong tính năng này

(Trích từ `docs/CODE_REVIEW_LOG.md` Review #4 — ngoài phạm vi diff này, để
S1/S3 xem xét ở lần cập nhật sau)

- `GET /api/admin/questions/reports?status=...`: giá trị `status` chưa được
  validate theo `REPORT_STATUSES`. Giá trị tuỳ ý → trả `{ items: [], total: 0 }`
  thay vì `400 INVALID_REQUEST_BODY`.
- `PATCH /api/admin/questions/reports/:id` với `id` không tồn tại → Prisma
  P2025 → middleware lỗi tập trung trả `500 INTERNAL_SERVER_ERROR` thay vì
  `404`. Nên bổ sung `ReportNotFoundError` riêng.
- `question_reports` chưa có index trên `questionId` — `COUNT WHERE
  questionId = ?` trong `autoHideIfThresholdExceeded()` có thể chậm khi data
  lớn (đã ghi từ Section 4).

---

### Cách thiết lập & kiểm thử

```bash
# Backend: chạy smoke test cho luồng báo cáo (8 test case, tự dọn dữ liệu)
cd backend
npm run smoke:reports

# Frontend: mở Admin Dashboard
npm run dev
# → mở http://localhost:5173/#admin
# → nhập giá trị ADMIN_SECRET trong backend/.env
```

---

## 6. Exam Module – Thi thử (Mock Exam)

**Trạng thái:** ✅ Hoàn thành
**Ngày hoàn thành:** 2026-06-15
**Branch / commit liên quan:** `feature/exam-module`

---

### Tổng quan

Tính năng **"Thi thử"** (mock exam) cho phép học sinh làm 1 đề thi đầy đủ
(nhiều dạng câu hỏi, có giới hạn thời gian) để mô phỏng kỳ thi thật — khác với
"Ôn tập" (Practice Module, Section 4) vốn chỉ có 15 câu trắc nghiệm và không
giới hạn thời gian.

**Tính năng chính (học sinh):**
- Trên `ProfilePage`, nút **"Thi thử 🎯"** (cạnh "Bắt đầu ôn tập 📚") mở Hub
  chọn môn học (giống Practice).
- Bấm vào 1 môn → trừ **60 điểm tích lũy** (`EXAM_ENTRY_FEE`); hệ thống chọn
  "công bằng" 1 trong các đề đang active của môn đó (xem mục Ghi chú kỹ
  thuật), tạo `ExamSession` mới và trả về toàn bộ câu hỏi (đã ẩn đáp án đúng,
  thứ tự xáo trộn).
- `ExamSessionScreen`: đồng hồ đếm ngược theo `durationMinutes` của đề; 3
  dạng câu hỏi hiển thị khác nhau (trắc nghiệm 4 đáp án, đúng/sai 4 ý, điền
  đáp án). Hết giờ → tự động nộp bài.
- Nộp bài → chấm điểm theo thang 10, có thể được **thưởng điểm tích lũy**
  theo bậc điểm (0 / 10 / 20 / 50 / 120 cho điểm <7 / 7–7.9 / 8–8.9 / 9–9.9 /
  10).
- `ExamResultScreen`: hiển thị điểm, điểm thưởng, phân tích kết quả theo
  chương, danh sách câu chưa đạt trọn điểm kèm đáp án đúng + giải thích.

**Tính năng chính (admin):**
- `AdminPage` (`/#admin`) có thêm tab **"Đề thi thử"** (cạnh "Báo cáo câu
  hỏi").
- `AdminExamPaperListPage`: danh sách đề thi (lọc theo môn), tạo đề mới (môn,
  tên đề, thời gian làm bài).
- `AdminExamPaperDetailPage`: xem chi tiết 1 đề (kèm đáp án đúng), bật/tắt
  trạng thái active, thêm câu hỏi (form thủ công theo 3 dạng), import câu hỏi
  từ file Excel, xoá (ẩn) câu hỏi.

**Backend:**
- 4 model Prisma mới: `ExamPaper`, `ExamQuestion`, `ExamSession`,
  `ExamAnswer` (migration `20260613232440_add_exam_module`).
- `ExamService` (761 dòng) — toàn bộ logic nghiệp vụ: chọn đề công bằng, trừ
  điểm vào thi (atomic, optimistic lock + retry), chấm điểm 3 dạng câu hỏi,
  thưởng điểm theo bậc, hết giờ + grace period, CRUD đề/câu hỏi cho admin.
- `PointsService.deductPointsInTx()` mới — đối ngẫu của `addPointsInTx()`,
  dùng để trừ điểm atomic trong `startExam`.
- Import câu hỏi từ Excel (`exam-import.service.ts`, dùng `xlsx` + `multer`),
  kèm file mẫu `docs/templates/mau-import-cau-hoi-thi-thu.xlsx` (sinh bằng
  `npm run generate:exam-template`).

---

### Phương án kỹ thuật được lựa chọn và lý do

#### 1. Chọn đề thi "công bằng" — random có ưu tiên đề ít dùng nhất

**Vấn đề:** Một môn có thể có nhiều đề thi đang active. Nếu random đều, đề mới ít câu hỏi sẽ không bao giờ được chọn.

**Phương án đã chọn:** Lấy danh sách đề active của môn đó → tìm đề có `_count.examSessions` nhỏ nhất → trong số các đề có số lần dùng bằng nhau, random 1 đề.

**Lý do:** Đảm bảo tất cả đề được phân phối đồng đều. Học sinh thi cùng môn nhiều lần sẽ gặp nhiều đề khác nhau, giảm rủi ro thuộc lòng câu hỏi.

#### 2. Trừ điểm vào thi là Atomic + Optimistic Lock

**Vấn đề:** Nếu 2 request `startExam` đến đồng thời, cả 2 có thể đọc balance = 200đ, cả 2 cùng trừ 60đ → balance cuối = 140đ thay vì 80đ (mất 60đ).

**Phương án đã chọn:** Dùng `PointsService.deductPointsInTx()` bên trong `$transaction`, kết hợp với optimistic lock (`version` field trên `user_points`). Nếu 2 transaction cùng chạy, 1 cái sẽ fail vì `version` không khớp → Prisma retry tự động.

**Lý do:** Đảm bảo tính toán điểm chính xác kể cả dưới load cao, không cần distributed lock hay Redis.

#### 3. Thưởng điểm theo bậc, không tuyến tính

**Vấn đề:** Làm thế nào để khuyến khích học sinh cố gắng đạt điểm cao?

**Phương án đã chọn:** Hệ thống bậc phi tuyến tính:
```
< 7.0  →  0đ
7.0–7.9 → 10đ
8.0–8.9 → 20đ
9.0–9.9 → 50đ
10.0    → 120đ (nhân đôi đề xuất ban đầu)
```

**Lý do:** Bậc điểm 10.0 thưởng đặc biệt cao (120đ >> 60đ phí vào thi) → tạo động lực mạnh để phấn đấu điểm tuyệt đối. Các bậc dưới chênh nhau ít hơn (10→20→50) nhưng vẫn đủ ý nghĩa.

#### 4. Hết giờ — Auto-submit với Grace Period 30s

**Vấn đề:** Đồng hồ countdown trên frontend không đồng bộ hoàn toàn với server. Khi client thấy hết giờ và gửi submit, server có thể thấy "muộn 1-2 giây".

**Phương án đã chọn:** Server chấp nhận submit trong vòng 30 giây sau khi hết giờ. Ngoài 30 giây → trả EXPIRED, không chấm điểm.

**Lý do:** Grace period 30s đủ để xử lý độ trễ mạng và clock drift. Học sinh không thể "chờ thêm" vì countdown trên FE đã về 0 và tự submit.

#### 5. Import câu hỏi từ Excel (không từ text/JSON)

**Vấn đề:** Admin cần nhập hàng chục đến hàng trăm câu hỏi một lúc.

**Phương án đã chọn:** Excel `.xlsx` với sheet có cấu trúc cố định. Dùng `xlsx` library để parse, validate từng row, insert bulk vào DB.

**Lý do:** Excel thân thiện hơn JSON cho non-technical admin. Có thể dùng Excel formula, copy-paste từ đề thi Word. Cung cấp file mẫu sẵn (generate bằng npm script) để admin không cần tự tạo format.

---

### Quy trình các bước thực hiện

**Bước 1 — Schema & Migration:**
Thiết kế 4 bảng mới (`ExamPaper`, `ExamQuestion`, `ExamSession`, `ExamAnswer`). Chạy migration. Thêm `ExamSession` enum status và `EXAM_ENTRY_FEE` constant.

**Bước 2 — PointsService.deductPointsInTx():**
Tạo method đối ngẫu của `addPointsInTx` — trừ điểm atomic với optimistic lock. Test riêng để đảm bảo không có race condition.

**Bước 3 — ExamService (core logic):**
Implement theo thứ tự: `startExam` → `submitExam` (chấm điểm 3 loại) → `getExamResult` → `getActiveSession` (Phase 2).

**Bước 4 — Admin CRUD API:**
`createExamPaper`, `updateExamPaper`, `addExamQuestion`, `deleteExamQuestion`, `toggleExamPaperActive`.

**Bước 5 — Import Excel:**
Tạo `exam-import.service.ts` với parser, validator (check format theo loại câu hỏi), bulk insert. Tạo script `generate:exam-template`.

**Bước 6 — Route và middleware:**
Đăng ký tất cả route vào `exam.route.ts`. Guard admin endpoint với `verifyAdmin` middleware.

**Bước 7 — Frontend ExamPage:**
Implement hub chọn môn → `ExamSessionScreen` (3 loại câu hỏi, countdown) → `ExamResultScreen`. Quản lý state bằng `sub` state machine (`hub | exam | result`).

**Bước 8 — Frontend AdminExamPaper pages:**
`AdminExamPaperListPage` và `AdminExamPaperDetailPage` với UI tạo/import/xóa câu hỏi.

---

### Data Model

4 bảng mới (xem `backend/prisma/schema.prisma`, migration
`20260613232440_add_exam_module`):

#### `exam_papers` (model `ExamPaper`)

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `id` | UUID (PK) | |
| `subject` | string | Mã môn học, khớp `SUBJECT_CATALOG` (ví dụ `TOAN`) |
| `title` | string | Tên đề thi, ví dụ "Đề thi thử THPT QG 2024 - Mã đề 101" |
| `durationMinutes` | int | Thời gian làm bài (phút) |
| `isActive` | boolean (default `true`) | `false` = admin tạm ẩn đề — không được rút khi học sinh chọn đề ngẫu nhiên |
| `createdAt` | datetime | |

Index: `[subject, isActive]`

#### `exam_questions` (model `ExamQuestion`)

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `id` | UUID (PK) | |
| `examPaperId` | UUID (FK) | Đề thi chứa câu hỏi này |
| `chapter` | string? | Tên chương/chủ đề — dùng để phân tích kết quả theo chương |
| `difficulty` | int | 1 = dễ, 2 = trung bình, 3 = khó |
| `questionType` | string | `MCQ_4` \| `TRUE_FALSE_4` \| `FILL_BLANK` |
| `points` | float | Điểm của câu hỏi trong đề (tổng các câu **không cần** bằng 10 — hệ thống tự quy đổi về thang 10 khi chấm) |
| `questionText` | string | |
| `options` | JSON? | `MCQ_4`/`TRUE_FALSE_4`: mảng 4 string; `FILL_BLANK`: `null` |
| `correctAnswer` | JSON | `MCQ_4`: số 0-3; `TRUE_FALSE_4`: mảng 4 boolean; `FILL_BLANK`: mảng ≥1 string (các đáp án được chấp nhận) |
| `explanation` | string? | Hiện ở trang kết quả |
| `examYear` | int? | |
| `examCode` | string? | Mã đề gốc (khác với `ExamPaper.id` nội bộ) |
| `isActive` | boolean (default `true`) | Soft delete |
| `createdAt` | datetime | |

Index: `[examPaperId, isActive]`

#### `exam_sessions` (model `ExamSession`)

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `id` | UUID (PK) | |
| `userId` | UUID | |
| `examPaperId` | UUID | Đề đã được rút cho phiên này |
| `subjectId` | string | Snapshot môn học (phục vụ thống kê) |
| `durationMinutes` | int | **Snapshot** từ `ExamPaper.durationMinutes` lúc bắt đầu — admin sửa đề sau đó không ảnh hưởng phiên đang chạy |
| `startedAt` | datetime (default `now()`) | |
| `status` | string (default `IN_PROGRESS`) | `IN_PROGRESS` \| `COMPLETED` \| `EXPIRED` |
| `score` | float? | Thang 10, 1 chữ số thập phân — `null` nếu chưa nộp |
| `pointsAwarded` | int (default `0`) | Điểm tích lũy được thưởng (0 nếu `score < 7.0`) |
| `completedAt` | datetime? | |

Index: `[userId, examPaperId]` (phục vụ thuật toán chọn đề công bằng),
`[userId, completedAt]` (phục vụ lịch sử)

#### `exam_answers` (model `ExamAnswer`)

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `id` | UUID (PK) | |
| `sessionId` | UUID | |
| `examQuestionId` | UUID | |
| `selectedAnswer` | JSON | Theo từng dạng, giống `correctAnswer`; `{}` = chưa trả lời |
| `pointsEarned` | float (default `0`) | Có thể là số lẻ (`TRUE_FALSE_4` đúng 2/4 ý → `points * 0.25`) |
| `answeredAt` | datetime (default `now()`) | |

Unique: `[sessionId, examQuestionId]` — mỗi câu hỏi trong 1 phiên chỉ có 1
bản ghi trả lời.

---

### API Reference

#### Tổng hợp endpoint

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| POST | `/api/exam/start` | `Bearer <session-token>` | Bắt đầu phiên thi thử mới (trừ 60 điểm, chọn đề công bằng) |
| POST | `/api/exam/submit` | `Bearer <session-token>` | Nộp bài, chấm điểm + thưởng điểm |
| GET | `/api/exam/:id/result` | `Bearer <session-token>` | Xem kết quả chi tiết 1 phiên đã hoàn thành |
| POST | `/api/admin/exam-papers` | `X-Admin-Secret` | Tạo đề thi mới |
| GET | `/api/admin/exam-papers?subject=` | `X-Admin-Secret` | Danh sách đề thi |
| GET | `/api/admin/exam-papers/:id` | `X-Admin-Secret` | Chi tiết 1 đề (kèm đáp án đúng) |
| PATCH | `/api/admin/exam-papers/:id` | `X-Admin-Secret` | Cập nhật tiêu đề/thời gian/trạng thái active |
| POST | `/api/admin/exam-papers/:id/questions` | `X-Admin-Secret` | Thêm 1 câu hỏi |
| POST | `/api/admin/exam-papers/:id/questions/import` | `X-Admin-Secret` | Import câu hỏi từ file Excel (`multipart/form-data`) |
| PATCH | `/api/admin/exam-papers/:id/questions/:qid` | `X-Admin-Secret` | Cập nhật 1 câu hỏi (⚠️ chưa có FE gọi — xem Ghi chú kỹ thuật) |
| DELETE | `/api/admin/exam-papers/:id/questions/:qid` | `X-Admin-Secret` | Ẩn (soft delete) 1 câu hỏi |

---

#### POST /api/exam/start

**Request:**
```json
{ "subject": "TOAN" }
```

**Response (201):**
```json
{
  "sessionId": "a1b2c3d4-0001-4a3a-9b6e-9b6c1a2b3c4d",
  "examPaperId": "b2c3d4e5-0001-4a3a-9b6e-9b6c1a2b3c4d",
  "subject": "TOAN",
  "title": "Đề thi thử THPT QG 2024 - Mã đề 101",
  "durationMinutes": 50,
  "startedAt": "2026-06-15T08:00:00.000Z",
  "questions": [
    {
      "id": "a1b2c3d4-0003-4a3a-9b6e-9b6c1a2b3c4d",
      "chapter": "Hàm số",
      "difficulty": 2,
      "questionType": "MCQ_4",
      "points": 0.25,
      "questionText": "Hàm số y = x^3 - 3x đồng biến trên khoảng nào?",
      "options": ["(-1;1)", "(-∞;-1)", "(1;+∞)", "(-∞;-1) và (1;+∞)"]
    },
    {
      "id": "a1b2c3d4-0004-4a3a-9b6e-9b6c1a2b3c4d",
      "chapter": "Hình học",
      "difficulty": 2,
      "questionType": "TRUE_FALSE_4",
      "points": 1,
      "questionText": "Cho hình chóp S.ABCD có đáy là hình vuông cạnh a, SA vuông góc với đáy, SA = a. Xét tính đúng/sai của các phát biểu sau:",
      "options": [
        "a) SA vuông góc với BC",
        "b) Góc giữa SC và mặt đáy bằng 45°",
        "c) Thể tích khối chóp S.ABCD bằng a^3/3",
        "d) SC = a√3"
      ]
    },
    {
      "id": "a1b2c3d4-0005-4a3a-9b6e-9b6c1a2b3c4d",
      "chapter": "Đại số",
      "difficulty": 1,
      "questionType": "FILL_BLANK",
      "points": 0.5,
      "questionText": "Giải phương trình 2x + 4 = 10. Đáp án: x = ___",
      "options": null
    }
  ]
}
```

> Câu hỏi trả về **không có** `correctAnswer`/`explanation` (dùng
> `ExamQuestionPublicDto`), và thứ tự đã được xáo trộn (`shuffle()`).

**Lỗi:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 400 | `INVALID_REQUEST_BODY` | Thiếu `subject` (Zod) |
| 400 | `EXAM_INVALID_SUBJECT` | `subject` không nằm trong `SUBJECT_CATALOG` |
| 404 | `EXAM_PAPER_EMPTY` | Môn học chưa có đề thi `isActive=true` nào có ≥1 câu hỏi `isActive=true` |
| 409 | `EXAM_INSUFFICIENT_POINTS` | User có ít hơn `EXAM_ENTRY_FEE` (60) điểm tích lũy |

---

#### POST /api/exam/submit

**Request:**
```json
{
  "sessionId": "a1b2c3d4-0001-4a3a-9b6e-9b6c1a2b3c4d",
  "answers": [
    { "examQuestionId": "a1b2c3d4-0003-4a3a-9b6e-9b6c1a2b3c4d", "selectedAnswer": 3 },
    { "examQuestionId": "a1b2c3d4-0004-4a3a-9b6e-9b6c1a2b3c4d", "selectedAnswer": [true, false, false, false] },
    { "examQuestionId": "a1b2c3d4-0005-4a3a-9b6e-9b6c1a2b3c4d", "selectedAnswer": "x = 3" }
  ]
}
```

**Response (200):**
```json
{
  "sessionId": "a1b2c3d4-0001-4a3a-9b6e-9b6c1a2b3c4d",
  "score": 7.1,
  "pointsAwarded": 10
}
```

> Cách tính ở ví dụ trên (xem `gradeQuestion()`):
> - Câu MCQ_4 (0.25đ): chọn đúng đáp án `3` → +0.25.
> - Câu TRUE_FALSE_4 (1đ), đáp án đúng `[true,true,false,false]`, chọn
>   `[true,false,false,false]` → đúng 3/4 ý → `TRUE_FALSE_SCORE_RATIOS[3] = 0.5`
>   → +0.5 (chưa đạt trọn điểm → xuất hiện trong `wrongAnswers` khi xem kết
>   quả).
> - Câu FILL_BLANK (0.5đ), đáp án đúng chấp nhận `["x = 3","x=3"]`, nhập
>   `"x = 3"` → khớp sau `normalizeAnswer()` → +0.5.
> - `score = round((0.25+0.5+0.5) / (0.25+1+0.5) * 100) / 10 = 7.1` →
>   `getExamBonusPoints(7.1) = 10`.

**Response khi hết giờ (410):** nếu quá `durationMinutes*60 + 30s` tính từ
`startedAt`, phiên bị đánh dấu `EXPIRED`, **không** chấm điểm, **không** hoàn
60 điểm đã trừ:
```json
{ "error": "EXAM_EXPIRED", "message": "Phien thi thu '...' da het thoi gian lam bai - bai khong duoc cham diem." }
```
Frontend xử lý case này bằng cách tự coi như `{ score: 0, pointsAwarded: 0 }`
và chuyển sang `ExamResultScreen` (xem `ExamPage.handleSubmit`).

**Lỗi:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 400 | `INVALID_REQUEST_BODY` | `sessionId` không phải UUID, hoặc `answers[].selectedAnswer` không phải `number \| string \| boolean[]` (Zod) |
| 404 | `EXAM_SESSION_NOT_FOUND` | `sessionId` không tồn tại |
| 403 | `EXAM_SESSION_NOT_OWNED` | Phiên không thuộc về user hiện tại |
| 409 | `EXAM_SESSION_ALREADY_COMPLETED` | Phiên đã được nộp trước đó — hoặc bị 1 request đồng thời khác "chốt" trước (race condition, xem Ghi chú kỹ thuật) |
| 410 | `EXAM_EXPIRED` | Đã quá thời gian làm bài + 30s grace period |

---

#### GET /api/exam/:id/result

**Response (200):**
```json
{
  "sessionId": "a1b2c3d4-0001-4a3a-9b6e-9b6c1a2b3c4d",
  "status": "COMPLETED",
  "score": 7.1,
  "pointsAwarded": 10,
  "totalQuestions": 3,
  "chapterAnalysis": [
    { "chapter": "Hàm số", "correctCount": 1, "totalCount": 1, "pointsEarned": 0.25, "pointsTotal": 0.25 },
    { "chapter": "Hình học", "correctCount": 0, "totalCount": 1, "pointsEarned": 0.5, "pointsTotal": 1 },
    { "chapter": "Đại số", "correctCount": 1, "totalCount": 1, "pointsEarned": 0.5, "pointsTotal": 0.5 }
  ],
  "wrongAnswers": [
    {
      "examQuestionId": "a1b2c3d4-0004-4a3a-9b6e-9b6c1a2b3c4d",
      "questionText": "Cho hình chóp S.ABCD có đáy là hình vuông cạnh a, SA vuông góc với đáy, SA = a. Xét tính đúng/sai của các phát biểu sau:",
      "questionType": "TRUE_FALSE_4",
      "chapter": "Hình học",
      "options": [
        "a) SA vuông góc với BC",
        "b) Góc giữa SC và mặt đáy bằng 45°",
        "c) Thể tích khối chóp S.ABCD bằng a^3/3",
        "d) SC = a√3"
      ],
      "correctAnswer": [true, true, false, false],
      "selectedAnswer": [true, false, false, false],
      "explanation": "a, b đúng theo tính chất hình chóp đều có cạnh bên vuông góc đáy; c, d sai do tính toán thể tích/độ dài cạnh.",
      "points": 1,
      "pointsEarned": 0.5
    }
  ]
}
```

> - `wrongAnswers` chỉ gồm câu **chưa đạt trọn điểm** (`pointsEarned <
>   points`) — kể cả khi đã được điểm thành phần (như ví dụ trên, đúng 3/4 ý
>   vẫn tính là "chưa đúng").
> - `chapter` = `"Khác"` nếu câu hỏi không gán chương.
> - `status` có thể là `EXPIRED` (xem mục `submitExam`) — khi đó `score = 0`,
>   `pointsAwarded = 0`, nhưng `wrongAnswers`/`chapterAnalysis` vẫn được trả
>   về dựa trên `ExamAnswer` đã ghi (rỗng, vì hết giờ không tạo `ExamAnswer`).

**Lỗi:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 404 | `EXAM_SESSION_NOT_FOUND` | `sessionId` không tồn tại |
| 403 | `EXAM_SESSION_NOT_OWNED` | Phiên không thuộc về user hiện tại |
| 409 | `EXAM_SESSION_NOT_COMPLETED` | Phiên đang `IN_PROGRESS` — chưa có kết quả |

---

#### POST /api/admin/exam-papers — Tạo đề thi mới

**Request:**
```json
{ "subject": "TOAN", "title": "Đề thi thử THPT QG 2024 - Mã đề 101", "durationMinutes": 50 }
```

**Response (201):**
```json
{
  "id": "b2c3d4e5-0001-4a3a-9b6e-9b6c1a2b3c4d",
  "subject": "TOAN",
  "title": "Đề thi thử THPT QG 2024 - Mã đề 101",
  "durationMinutes": 50,
  "isActive": true,
  "questionCount": 0,
  "createdAt": "2026-06-15T08:00:00.000Z"
}
```

**Lỗi:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 400 | `INVALID_REQUEST_BODY` | `subject` không thuộc `SUBJECT_CATALOG`, `title` rỗng/>300 ký tự, hoặc `durationMinutes` không phải số nguyên dương ≤600 (Zod) |
| 401 | `ADMIN_UNAUTHORIZED` | Thiếu/sai `X-Admin-Secret` |

---

#### GET /api/admin/exam-papers?subject=TOAN — Danh sách đề thi

**Response (200):** trả **mảng trực tiếp** (không phân trang, không bọc `items`):
```json
[
  {
    "id": "b2c3d4e5-0001-4a3a-9b6e-9b6c1a2b3c4d",
    "subject": "TOAN",
    "title": "Đề thi thử THPT QG 2024 - Mã đề 101",
    "durationMinutes": 50,
    "isActive": true,
    "questionCount": 3,
    "createdAt": "2026-06-15T08:00:00.000Z"
  }
]
```

> `questionCount` chỉ đếm câu hỏi `isActive=true`. Nếu `subject` không truyền,
> trả tất cả đề (mọi môn).

**Lỗi:** | 401 | `ADMIN_UNAUTHORIZED` |

---

#### GET /api/admin/exam-papers/:id — Chi tiết 1 đề thi

**Response (200):** giống `ExamPaperSummaryDto` + `questions[]` (đầy đủ, **có**
`correctAnswer`/`explanation`, **gồm cả câu đã bị ẩn** `isActive=false`):
```json
{
  "id": "b2c3d4e5-0001-4a3a-9b6e-9b6c1a2b3c4d",
  "subject": "TOAN",
  "title": "Đề thi thử THPT QG 2024 - Mã đề 101",
  "durationMinutes": 50,
  "isActive": true,
  "questionCount": 1,
  "createdAt": "2026-06-15T08:00:00.000Z",
  "questions": [
    {
      "id": "a1b2c3d4-0003-4a3a-9b6e-9b6c1a2b3c4d",
      "examPaperId": "b2c3d4e5-0001-4a3a-9b6e-9b6c1a2b3c4d",
      "chapter": "Hàm số",
      "difficulty": 2,
      "questionType": "MCQ_4",
      "points": 0.25,
      "questionText": "Hàm số y = x^3 - 3x đồng biến trên khoảng nào?",
      "options": ["(-1;1)", "(-∞;-1)", "(1;+∞)", "(-∞;-1) và (1;+∞)"],
      "correctAnswer": 3,
      "explanation": "y' = 3x^2 - 3 = 3(x-1)(x+1); y' > 0 khi x < -1 hoặc x > 1",
      "examYear": 2024,
      "examCode": "Mã đề 101",
      "isActive": true,
      "createdAt": "2026-06-15T08:00:00.000Z"
    }
  ]
}
```

**Lỗi:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 404 | `EXAM_PAPER_NOT_FOUND` | `id` không tồn tại |
| 401 | `ADMIN_UNAUTHORIZED` | |

---

#### PATCH /api/admin/exam-papers/:id — Cập nhật đề thi

**Request (ví dụ tạm ẩn đề):**
```json
{ "isActive": false }
```

**Response (200):** `ExamPaperSummaryDto` (không kèm `questions`):
```json
{
  "id": "b2c3d4e5-0001-4a3a-9b6e-9b6c1a2b3c4d",
  "subject": "TOAN",
  "title": "Đề thi thử THPT QG 2024 - Mã đề 101",
  "durationMinutes": 50,
  "isActive": false,
  "questionCount": 1,
  "createdAt": "2026-06-15T08:00:00.000Z"
}
```

> Tất cả field (`title`, `durationMinutes`, `isActive`) đều tùy chọn — chỉ
> field nào có trong body mới được cập nhật. Dùng cho cả nút "Tạm ẩn / Kích
> hoạt" trên `AdminExamPaperDetailPage`.

**Lỗi:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 400 | `INVALID_REQUEST_BODY` | `title` rỗng/>300, `durationMinutes` không hợp lệ, hoặc `isActive` không phải boolean (Zod) |
| 404 | `EXAM_PAPER_NOT_FOUND` | `id` không tồn tại |
| 401 | `ADMIN_UNAUTHORIZED` | |

---

#### POST /api/admin/exam-papers/:id/questions — Thêm 1 câu hỏi

Body theo `CreateExamQuestionPayload`, `options`/`correctAnswer` **phải khớp**
`questionType` (kiểm tra bởi `validateQuestionShape()`). 3 ví dụ theo từng dạng:

**MCQ_4:**
```json
{
  "chapter": "Hàm số",
  "difficulty": 2,
  "questionType": "MCQ_4",
  "points": 0.25,
  "questionText": "Hàm số y = x^3 - 3x đồng biến trên khoảng nào?",
  "options": ["(-1;1)", "(-∞;-1)", "(1;+∞)", "(-∞;-1) và (1;+∞)"],
  "correctAnswer": 3,
  "explanation": "y' = 3x^2 - 3 = 3(x-1)(x+1); y' > 0 khi x < -1 hoặc x > 1",
  "examYear": 2024,
  "examCode": "Mã đề 101"
}
```

**TRUE_FALSE_4** (`correctAnswer` = 4 boolean, theo đúng thứ tự `options` a/b/c/d):
```json
{
  "chapter": "Hình học",
  "difficulty": 2,
  "questionType": "TRUE_FALSE_4",
  "points": 1,
  "questionText": "Cho hình chóp S.ABCD có đáy là hình vuông cạnh a, SA vuông góc với đáy, SA = a. Xét tính đúng/sai của các phát biểu sau:",
  "options": [
    "a) SA vuông góc với BC",
    "b) Góc giữa SC và mặt đáy bằng 45°",
    "c) Thể tích khối chóp S.ABCD bằng a^3/3",
    "d) SC = a√3"
  ],
  "correctAnswer": [true, true, false, false],
  "explanation": "a, b đúng theo tính chất hình chóp đều có cạnh bên vuông góc đáy; c, d sai do tính toán thể tích/độ dài cạnh."
}
```

**FILL_BLANK** (`options` không có; `correctAnswer` = mảng các đáp án được
chấp nhận, so khớp sau khi `normalizeAnswer()` — trim, lowercase, gộp khoảng
trắng):
```json
{
  "chapter": "Đại số",
  "difficulty": 1,
  "questionType": "FILL_BLANK",
  "points": 0.5,
  "questionText": "Giải phương trình 2x + 4 = 10. Đáp án: x = ___",
  "correctAnswer": ["x = 3", "x=3", "3"]
}
```

**Response (201):** `ExamQuestionFullDto` (giống item trong `questions[]` ở
endpoint GET chi tiết đề).

**Lỗi:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 400 | `INVALID_REQUEST_BODY` | Sai schema Zod (`questionType` không thuộc 3 giá trị, `points <= 0`, `difficulty` không thuộc 1-3, `questionText`/`options[]` rỗng hoặc quá dài...) |
| 400 | `EXAM_QUESTION_INVALID` | `options`/`correctAnswer` không khớp `questionType` (ví dụ `MCQ_4` mà `correctAnswer` không phải số 0-3) |
| 404 | `EXAM_PAPER_NOT_FOUND` | `id` (đề thi) không tồn tại |
| 401 | `ADMIN_UNAUTHORIZED` | |

---

#### POST /api/admin/exam-papers/:id/questions/import — Import câu hỏi từ Excel

`Content-Type: multipart/form-data`, field `file` (`.xlsx`/`.xls`, tối đa
5MB). Quy ước cột — xem file mẫu
`docs/templates/mau-import-cau-hoi-thi-thu.xlsx` (sinh bằng `npm run
generate:exam-template`):

| Cột | Ghi chú |
|-----|---------|
| Chương, Độ khó, Loại câu hỏi, Điểm, Nội dung câu hỏi | bắt buộc |
| Lựa chọn 1-4 | dùng cho `MCQ_4`/`TRUE_FALSE_4`, bỏ trống với `FILL_BLANK` |
| Đáp án đúng | `MCQ_4`: `A`-`D` hoặc `0`-`3`; `TRUE_FALSE_4`: 4 giá trị `D/S` cách nhau bởi dấu phẩy (ví dụ `"D,S,D,S"`); `FILL_BLANK`: các đáp án cách nhau bởi `\|` (ví dụ `"Hà Nội\|HN"`) |
| Giải thích, Năm thi, Mã đề | tùy chọn |

**Response (200) — cho phép THÀNH CÔNG MỘT PHẦN:**
```json
{
  "inserted": 18,
  "errors": [
    { "row": 5, "message": "Loai cau hoi 'TRAC_NGHIEM' khong hop le (phai la MCQ_4, TRUE_FALSE_4 hoac FILL_BLANK)." },
    { "row": 12, "message": "Dap an dung 'E' khong hop le (phai la A/B/C/D hoac 0-3)." }
  ]
}
```

> `row` tính cả dòng header (dòng 1) — `row: 5` = dòng dữ liệu thứ 4. Các
> dòng hợp lệ vẫn được lưu dù có dòng khác lỗi (xử lý tuần tự từng dòng qua
> `createExamQuestion`, không bọc transaction chung).

**Lỗi:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 400 | `EXAM_IMPORT_FILE_INVALID` | Thiếu file, sai định dạng (không đọc được bằng `xlsx`), không có sheet/dữ liệu, hoặc **vượt 5MB** (`MulterError` → 400, xem fix Review #5) |
| 404 | `EXAM_PAPER_NOT_FOUND` | `id` (đề thi) không tồn tại |
| 401 | `ADMIN_UNAUTHORIZED` | |

---

#### PATCH /api/admin/exam-papers/:id/questions/:qid — Cập nhật 1 câu hỏi

> ⚠️ **Endpoint đã implement đầy đủ ở backend nhưng hiện CHƯA có nơi nào ở
> frontend gọi tới** (không có `adminUpdateExamQuestion` trong
> `frontend/src/lib/api.ts`, `AdminExamPaperDetailPage` chỉ có nút "Xoá", không
> có "Sửa"). Xem mục Ghi chú kỹ thuật.

**Request (partial — chỉ field cần đổi):**
```json
{ "explanation": "Giải thích đã được cập nhật rõ hơn..." }
```

**Response (200):** `ExamQuestionFullDto` sau khi cập nhật.

> Nếu request có `questionType`/`options`/`correctAnswer`, server validate
> lại **toàn bộ shape theo dạng câu hỏi MỚI** (lấy giá trị cũ cho field không
> đổi) bằng `validateQuestionShape()`.

**Lỗi:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 400 | `INVALID_REQUEST_BODY` | Sai schema Zod (partial của schema tạo câu hỏi) |
| 400 | `EXAM_QUESTION_INVALID` | Sau khi áp input mới, `options`/`correctAnswer` không khớp `questionType` |
| 404 | `EXAM_QUESTION_NOT_FOUND` | `qid` không tồn tại hoặc không thuộc đề `id` |
| 401 | `ADMIN_UNAUTHORIZED` | |

---

#### DELETE /api/admin/exam-papers/:id/questions/:qid — Ẩn 1 câu hỏi

Soft delete — set `isActive = false`, giữ lại để không phá vỡ lịch sử chấm
điểm các phiên đã làm câu này.

**Response (200):**
```json
{ "message": "Da an cau hoi thanh cong." }
```

**Lỗi:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 404 | `EXAM_QUESTION_NOT_FOUND` | `qid` không tồn tại hoặc không thuộc đề `id` |
| 401 | `ADMIN_UNAUTHORIZED` | |

---

### Luồng chạy (Flow)

#### 1. Bắt đầu phiên thi thử

```
[Học sinh]                    [ExamPage]                         [Backend]                    [DB]
  │                              │                                    │                          │
  ├─ Bấm "Thi thử 🎯" ───────────► sub = 'hub'                         │                          │
  │◄─ Hiện danh sách môn học ─────┤                                    │                          │
  │                              │                                    │                          │
  ├─ Chọn môn (vd TOAN) ──────────► setLoadingSubj('TOAN')             │                          │
  │                              ├─ POST /api/exam/start               │                          │
  │                              │   { subject: "TOAN" } ──────────────► startExam()              │
  │                              │                                    ├─ pickFairExamPaper(): ─────► SELECT ExamPaper
  │                              │                                    │   - đề isActive + có câu      WHERE subject &
  │                              │                                    │     hỏi isActive              isActive
  │                              │                                    │   - groupBy ExamSession ──────► COUNT theo
  │                              │                                    │     theo examPaperId            examPaperId
  │                              │                                    │   - chọn random trong nhóm
  │                              │                                    │     "đã thi ít nhất"
  │                              │                                    ├─ $transaction:
  │                              │                                    │   deductPointsInTx(60) ────────► UPDATE user_points
  │                              │                                    │     (optimistic lock + retry)     (version check)
  │                              │                                    │   CREATE ExamSession ──────────► INSERT exam_sessions
  │                              │                                    │   SELECT ExamQuestion ──────────► WHERE examPaperId
  │                              │                                    │     (toàn bộ câu isActive)        & isActive
  │                              │◄─ 201 { sessionId, examPaperId,     │   shuffle() + toPublicDto()
  │                              │         title, durationMinutes,     │   (ẩn correctAnswer/explanation)
  │                              │         startedAt, questions[] } ───┤                          │
  │                              ├─ setSession(...); sub = 'session'   │                          │
  │                              ├─ getMyProfile() ──────────────────────► (cập nhật điểm hiển thị) │
  │◄─ ExamSessionScreen ───────────┤                                    │                          │
  │                              │                                    │                          │
  │  nếu 409 EXAM_INSUFFICIENT_POINTS:                                  │                          │
  │◄─ "Bạn cần tối thiểu 60 điểm tích lũy để vào thi thử." ──────────────┤                          │
  │  nếu 404 EXAM_PAPER_EMPTY:                                          │                          │
  │◄─ "Môn học này hiện chưa có đề thi thử. Vui lòng thử lại sau." ──────┤                          │
```

#### 2. Làm bài & nộp bài

```
[Học sinh]              [ExamSessionScreen]                      [Backend]                    [DB]
  │                              │                                    │                          │
  ├─ Trả lời từng câu ────────────► onAnswerChange(qId, value)         │                          │
  │                              │   (lưu vào Map answers — chỉ ở      │                          │
  │                              │    client, KHÔNG gọi API mỗi câu)   │                          │
  │                              │                                    │                          │
  │  setInterval 1s ───────────────► timeLeft--, hiện ps-timer          │                          │
  │  timeLeft === 0 ───────────────► autoSubmitted=true → onSubmit()    │                          │
  │                              │                                    │                          │
  ├─ Bấm "Nộp bài" (hoặc auto) ────► handleSubmit()                    │                          │
  │                              ├─ POST /api/exam/submit               │                          │
  │                              │   { sessionId, answers[] } ──────────► submitExam()            │
  │                              │                                    ├─ now > startedAt +          │
  │                              │                                    │   duration*60 + 30s ?       │
  │                              │                                    │   CÓ → UPDATE status=        │
  │                              │                                    │   EXPIRED ────────────────────► exam_sessions
  │                              │◄─ 410 EXAM_EXPIRED ───────────────────┤   (không chấm, không hoàn   │
  │                              │   (FE coi như score=0, pointsAwarded=0,  điểm)                    │
  │                              │    chuyển sang ExamResultScreen)        │                          │
  │                              │                                    │  KHÔNG → tiếp tục:          │
  │                              │                                    ├─ $transaction:               │
  │                              │                                    │   freshSession.status ===    │
  │                              │                                    │   IN_PROGRESS? (else 409)    │
  │                              │                                    │   gradeQuestion() x N câu    │
  │                              │                                    │   (MCQ_4/TRUE_FALSE_4/       │
  │                              │                                    │    FILL_BLANK)               │
  │                              │                                    │   createMany ExamAnswer ──────► INSERT exam_answers
  │                              │                                    │   score = round(earned/total │   (skipDuplicates)
  │                              │                                    │     *100)/10                 │
  │                              │                                    │   pointsAwarded =             │
  │                              │                                    │     getExamBonusPoints(score)│
  │                              │                                    │   nếu pointsAwarded>0:       │
  │                              │                                    │     addPointsInTx() ──────────► UPDATE user_points
  │                              │                                    │   updateMany ExamSession      │
  │                              │                                    │   WHERE status=IN_PROGRESS ───► UPDATE exam_sessions
  │                              │                                    │   (count=0 → đã bị chốt       │   SET status=COMPLETED,
  │                              │                                    │    trước → 409) ──► rollback   │   score, pointsAwarded
  │                              │◄─ 200 { sessionId, score,             │                          │
  │                              │         pointsAwarded } ──────────────┤                          │
  │                              ├─ getMyProfile() ────────────────────────► (cập nhật điểm hiển thị) │
  │◄─ ExamResultScreen ─────────────┤                                    │                          │
```

#### 3. Xem kết quả chi tiết

```
[Học sinh]              [ExamResultScreen]                       [Backend]                    [DB]
  │                              │                                    │                          │
  ├─ Vào màn kết quả ──────────────► useEffect: GET /api/exam/:id/      │                          │
  │                              │   result ─────────────────────────────► getExamResult()        │
  │                              │                                    ├─ Promise.all:                │
  │                              │                                    │   SELECT ExamQuestion ────────► exam_questions
  │                              │                                    │     WHERE examPaperId          (toàn bộ đề, kể cả
  │                              │                                    │   SELECT ExamAnswer ──────────► exam_answers
  │                              │                                    │     WHERE sessionId             câu đã bị ẩn)
  │                              │                                    ├─ Gộp theo chapter →
  │                              │                                    │   chapterAnalysis[]
  │                              │                                    ├─ pointsEarned < points →
  │                              │                                    │   wrongAnswers[] (kèm
  │                              │                                    │   correctAnswer + explanation)
  │                              │◄─ 200 { score, pointsAwarded,         │                          │
  │                              │         chapterAnalysis[],            │                          │
  │                              │         wrongAnswers[] } ──────────────┤                          │
  │◄─ Điểm + icon (🎉/💪/📖) ───────┤                                    │                          │
  │◄─ Bảng "Phân tích theo chương" ─┤                                    │                          │
  │◄─ "Câu chưa đúng" (đáp án        │                                    │                          │
  │    đúng + giải thích nếu có) ───┤                                    │                          │
  │                              │                                    │                          │
  ├─ "Thi tiếp 🎯" ──────────────────► reset state → sub = 'hub'         │                          │
  ├─ "Về trang chủ" ──────────────────► onHome() → ProfilePage           │                          │
```

#### 4. Admin quản lý đề thi thử

```
[Admin]                  [AdminExamPage]                         [Backend]                    [DB]
  │                              │                                    │                          │
  ├─ Tab "Đề thi thử" ─────────────► AdminExamPaperListPage             │                          │
  │                              ├─ GET /api/admin/exam-papers           │                          │
  │                              │   ?subject= ──────────────────────────► listExamPapers() ────────► SELECT ExamPaper
  │◄─ Danh sách đề (lọc môn) ───────┤                                    │   + groupBy questionCount   + groupBy ExamQuestion
  │                              │                                    │                          │
  ├─ "+ Tạo đề thi mới" → điền       │                                    │                          │
  │   môn / tên đề / thời gian ──────► POST /api/admin/exam-papers ───────► createExamPaper() ───────► INSERT exam_papers
  │◄─ reload list ──────────────────┤                                    │                          │
  │                              │                                    │                          │
  ├─ Click 1 đề ─────────────────────► AdminExamPaperDetailPage          │                          │
  │                              ├─ GET /api/admin/exam-papers/:id ───────► getExamPaperDetail() ────► SELECT ExamPaper +
  │◄─ Chi tiết đề (kèm correctAnswer) ┤                                    │   (toàn bộ ExamQuestion,    ExamQuestion[]
  │   + danh sách câu hỏi ───────────┤                                    │    kể cả isActive=false)    (tất cả, mọi trạng thái)
  │                              │                                    │                          │
  ├─ "Tạm ẩn / Kích hoạt" ─────────────► PATCH /api/admin/exam-papers/:id │                          │
  │                              │     { isActive: !paper.isActive } ─────► updateExamPaper() ───────► UPDATE exam_papers
  │◄─ reload detail ──────────────────┤                                    │                          │
  │                              │                                    │                          │
  ├─ "+ Thêm câu hỏi" → chọn dạng       │                                    │                          │
  │   (MCQ_4/TRUE_FALSE_4/FILL_BLANK),  │                                    │                          │
  │   điền nội dung + đáp án ───────────► AdminExamQuestionForm            │                          │
  ├─ "Thêm câu hỏi" ──────────────────────► POST .../:id/questions ────────► createExamQuestion() ────► validateQuestionShape()
  │                              │       (payload theo dạng)               │                            INSERT exam_questions
  │◄─ reload detail ──────────────────────┤                                │                          │
  │                              │                                    │                          │
  ├─ Chọn file Excel (.xlsx) ──────────────► AdminExamImportBox            │                          │
  │                              ├─ POST .../:id/questions/import ─────────► uploadExcelFile()        │
  │                              │   (multipart/form-data, field "file")   │   → importQuestionsFromExcel()
  │                              │                                    ├─ parseExcelRow() x N dòng     │
  │                              │                                    ├─ createExamQuestion() từng    │
  │                              │                                    │   dòng hợp lệ ──────────────────► INSERT exam_questions
  │◄─ "Đã thêm N câu hỏi" +                  │◄─ 200 { inserted, errors[] } ─┤   (dòng lỗi bị skip,        (mỗi dòng hợp lệ)
  │   danh sách dòng lỗi (nếu có) ───────────┤                                │    không rollback toàn bộ)
  │                              │                                    │                          │
  ├─ "Xoá" 1 câu hỏi ────────────────────────► DELETE .../questions/:qid ────► deleteExamQuestion() ────► UPDATE isActive=false
  │◄─ reload detail (câu mất khỏi             │                                │                          │
  │   danh sách, nhưng vẫn còn trong          │                                │                          │
  │   exam_questions để giữ lịch sử) ─────────┤                                │                          │
```

---

### File Structure

```
backend/
├── prisma/
│   ├── schema.prisma                    +4 model: ExamPaper, ExamQuestion, ExamSession, ExamAnswer
│   └── migrations/
│       └── 20260613232440_add_exam_module/
└── src/
    ├── app.ts                            +examRouter, +examAdminRouter, +12 error code → HTTP status
    ├── routes/
    │   ├── exam.route.ts                  POST /start, POST /submit, GET /:id/result (verifyAppToken)
    │   └── exam-admin.route.ts            CRUD đề/câu hỏi + import Excel (verifyAdminSecret)
    ├── services/
    │   ├── exam/
    │   │   ├── exam.types.ts              hằng số (EXAM_ENTRY_FEE, EXAM_GRACE_SECONDS,
    │   │   │                                TRUE_FALSE_SCORE_RATIOS, getExamBonusPoints) + DTOs
    │   │   ├── exam.errors.ts             12 lớp lỗi (ExamPaperNotFoundError, ExamExpiredError, ...)
    │   │   ├── exam.service.ts            ExamService: pickFairExamPaper, gradeQuestion,
    │   │   │                                validateQuestionShape, normalizeAnswer, startExam,
    │   │   │                                submitExam, getExamResult, + CRUD đề/câu hỏi (admin)
    │   │   └── exam-import.service.ts     parseExcelRow, importQuestionsFromExcel
    │   └── points/
    │       ├── points.service.ts          +deductPointsInTx() — đối ngẫu addPointsInTx()
    │       └── points.types.ts            +PointReason.THI_THU_ENTRY_FEE, THI_THU_RESULT
    ├── scripts/
    │   ├── generate-exam-import-template.ts  sinh docs/templates/mau-import-cau-hoi-thi-thu.xlsx
    │   ├── smoke-test-exam.ts                 87 test case (hàm thuần + luồng chính)
    │   └── smoke-test-exam-concurrency.ts     21 test case (race condition start/submit)
    └── package.json                       +scripts smoke:exam, smoke:exam:concurrency,
                                             generate:exam-template; +deps multer, xlsx, @types/multer

frontend/
└── src/
    ├── App.tsx
    │   ├── ProfilePage                    +nút "Thi thử 🎯" (onExam) cạnh "Bắt đầu ôn tập 📚"
    │   ├── Screen 'exam'                  ExamPage (sub: 'hub' | 'session' | 'result')
    │   ├── ExamPage                       hub chọn môn → startExam → session/result
    │   ├── ExamSessionScreen              đồng hồ đếm ngược, auto-submit khi timeLeft=0
    │   ├── ExamQuestionCard               render theo questionType (MCQ_4/TRUE_FALSE_4/FILL_BLANK)
    │   ├── ExamResultScreen               điểm, icon, chapterAnalysis, wrongAnswers
    │   ├── defaultAnswerFor()             giá trị mặc định theo questionType (-1 / [] / '')
    │   ├── describeExamAnswer()           hiển thị 1 đáp án (đã chọn/đúng) ở màn kết quả
    │   ├── AdminPage                      +tab 'exams' (AdminTab = 'reports' | 'exams')
    │   ├── AdminExamPage                  điều hướng list ↔ detail (AdminExamSub)
    │   ├── AdminExamPaperListPage         danh sách đề (lọc môn) + tạo đề mới
    │   ├── AdminExamPaperDetailPage       chi tiết đề, toggle active, danh sách câu hỏi + xoá
    │   ├── AdminExamQuestionForm          form thêm câu hỏi theo 3 dạng
    │   └── AdminExamImportBox             upload Excel, hiện inserted/errors theo dòng
    ├── App.css                            +.exam-*, .admin-exam-*, .admin-import-*,
    │                                       .admin-tab(s), .btn-lg, .ps-option.selected*
    └── lib/
        └── api.ts
            ├── types: ExamQuestionType, ExamSessionStatus, ExamAnswerValue, ExamQuestionPublic,
            │   StartExamResult, SubmitExamResult, ExamChapterAnalysis, ExamWrongAnswer, ExamResult,
            │   ExamPaperSummary, ExamQuestionFull, ExamPaperDetail, CreateExamQuestionPayload,
            │   ExamImportResultDto
            ├── startExam(), submitExam(), getExamResult()                       (học sinh)
            └── adminCreateExamPaper(), adminListExamPapers(),
                adminGetExamPaperDetail(), adminUpdateExamPaper(),
                adminCreateExamQuestion(), adminDeleteExamQuestion(),
                adminImportExamQuestions()       (admin — ⚠️ thiếu adminUpdateExamQuestion)
```

---

### Ghi chú kỹ thuật

**1. Thuật toán chọn đề "công bằng" (`pickFairExamPaper`)**
Mỗi lần học sinh bấm "Thi thử" cho 1 môn, hệ thống KHÔNG random hoàn toàn
trong mọi đề — mà: (1) lấy các đề `isActive=true` có ≥1 câu hỏi `isActive=true`,
(2) đếm số lần user đã thi từng đề (`groupBy ExamSession`), (3) tìm số lần
thi **tối thiểu** (`minAttempts`) trong nhóm, (4) random đều trong các đề có
`attemptCount === minAttempts`. Kết quả: học sinh sẽ "xoay vòng" qua hết các
đề trước khi gặp lại đề đã làm — tránh tình trạng 1 đề bị rút liên tục do
random thuần.

**2. Optimistic locking + retry cho `startExam`/`submitExam`**
Cả 2 thao tác đều bọc `$transaction` và catch
`OptimisticLockRetryableError` để retry tối đa `MAX_EXAM_RETRY = 10` lần, có
`delayJitter()` (10-50ms ngẫu nhiên) giữa các lần retry để giảm "thundering
herd" khi nhiều request cùng đụng `version` của `user_points`. Nếu hết
`MAX_EXAM_RETRY` lần vẫn conflict → `OptimisticLockError` (500).

**3. `deductPointsInTx` — đối ngẫu của `addPointsInTx`**
`startExam` cần trừ `EXAM_ENTRY_FEE` (60 điểm) **atomic cùng** việc tạo
`ExamSession` — nếu tạo session thất bại, điểm KHÔNG được trừ (và ngược lại).
`PointsService.deductPointsInTx()` mới được thêm theo đúng pattern
`addPointsInTx()` (cùng 1 outer `tx`, `updateMany` + check `version` +
`writeTransactionLog` với `amount` âm), khác biệt duy nhất: kiểm tra
`currentPoints >= amount` trước, nếu không đủ → `PointsInsufficientError` →
`ExamService` bắt và chuyển thành `ExamInsufficientPointsError` (409).

**4. Chấm điểm 3 dạng câu hỏi (`gradeQuestion`)**
- `MCQ_4`: đúng hoàn toàn → `+points`, sai → `0` (không có điểm thành phần).
- `TRUE_FALSE_4`: đếm số ý đúng trong 4 ý (`correctCount` 0-4), điểm =
  `points * TRUE_FALSE_SCORE_RATIOS[correctCount]` với
  `TRUE_FALSE_SCORE_RATIOS = [0, 0.1, 0.25, 0.5, 1]` — đúng 2/4 ý chỉ được
  25% điểm câu, đúng 3/4 ý được 50%. Ý không trả lời (không phải `boolean`)
  tính là sai.
- `FILL_BLANK`: chuẩn hoá cả 2 phía bằng `normalizeAnswer()` (trim, lowercase,
  gộp khoảng trắng liên tiếp) rồi so khớp với **bất kỳ** đáp án nào trong
  `correctAnswer[]` — khớp 1 là đủ `+points`.

Câu chưa trả lời được gửi lên dưới dạng sentinel `{}` (hợp lệ với mọi dạng
JSON và luôn được `gradeQuestion` tính là sai).

**5. Giới hạn thời gian + grace period (`EXAM_GRACE_SECONDS = 30`)**
`submitExam` so sánh `Date.now()` với
`startedAt + durationMinutes*60_000 + 30_000` **trước khi** vào transaction
chấm điểm. Quá hạn → đánh dấu `EXPIRED`, không tạo `ExamAnswer`, không
chấm/thưởng điểm, **không hoàn lại** 60 điểm đã trừ lúc `startExam`. 30 giây
grace là khoảng đệm cho độ trễ mạng khi học sinh bấm nộp đúng lúc hết giờ.

**6. Điểm thưởng theo bậc (`getExamBonusPoints`)**

| Điểm (thang 10) | Điểm thưởng |
|------------------|-------------|
| < 7.0 | 0 |
| 7.0 – 7.9 | 10 |
| 8.0 – 8.9 | 20 |
| 9.0 – 9.9 | 50 |
| 10.0 | 120 |

Khi `pointsAwarded = 0`, `submitExam` **không gọi** `addPointsInTx` (hàm này
yêu cầu `amount > 0`, sẽ ném `InvalidPointsAmountError` nếu gọi với `0`) —
chỉ ghi `score`/`pointsAwarded = 0` vào `ExamSession`.

**7. Fix race condition khi `pointsAwarded = 0` (Review #5, bug #3)**
Khi điểm < 7.0, `submitExam` không đi qua `addPointsInTx` (không có
optimistic lock nào ở bước này) — nếu chỉ dùng `tx.examSession.update()` vô
điều kiện, 2 request nộp bài đồng thời cho cùng 1 phiên đều có thể vượt qua
check `status === 'IN_PROGRESS'` (đọc trước khi bên kia commit, Read
Committed) và cả hai trả `200`. Fix: đổi thành
`tx.examSession.updateMany({ where: { id, status: 'IN_PROGRESS' }, data:
{...} })` — nếu `count === 0` (đã bị request khác chốt trước) → ném
`ExamSessionAlreadyCompletedError`. Xác nhận bằng
`smoke-test-exam-concurrency.ts` (21/21 PASS).

**8. Fix upload Excel > 5MB trả sai mã lỗi (Review #5, bug #2)**
`multer` ném `MulterError` (`LIMIT_FILE_SIZE`) khi file vượt 5MB — middleware
lỗi tập trung trong `app.ts` không biết mã lỗi này nên rơi vào nhánh `>= 500`.
Fix: wrapper `uploadExcelFile()` trong `exam-admin.route.ts` bắt
`MulterError` và chuyển thành `ExamImportFileInvalidError` →
`400 EXAM_IMPORT_FILE_INVALID`.

**9. Fix thiếu import type ở FE (Review #5, bug #1)**
`App.tsx` thiếu import `ExamQuestionPublic`/`ExamImportResultDto` (và import
dư `ExamQuestionFull` không dùng) khiến `tsc -b` fail với 8 lỗi (`TS6196`,
`TS2552`/`TS2304`, kéo theo 4 lỗi `TS7006` implicit `any`). Đã fix trong block
import của `App.tsx`.

**10. Soft delete `ExamQuestion` (`isActive=false`)**
Giống pattern của Practice Module — xoá câu hỏi không xoá dữ liệu, chỉ ẩn
khỏi: (a) `pickFairExamPaper`/`startExam` (câu mới sẽ không được rút), (b)
danh sách hiển thị cho admin trong `AdminExamPaperDetailPage`. Các
`ExamAnswer`/`ExamResult` của các phiên đã làm câu đó **trước khi** bị ẩn vẫn
giữ nguyên (join trực tiếp `ExamQuestion` theo `examQuestionId`, không lọc
`isActive`).

**11. `PATCH /api/admin/exam-papers/:id/questions/:qid` chưa có FE sử dụng**
Route, Zod schema (`updateQuestionSchema = createQuestionSchema.partial()`)
và `ExamService.updateExamQuestion()` đã implement đầy đủ và đúng (validate
lại shape theo dạng mới nếu đổi `questionType`/`options`/`correctAnswer`),
nhưng `frontend/src/lib/api.ts` **không có** `adminUpdateExamQuestion()`, và
`AdminExamPaperDetailPage` chỉ có nút "Xoá" cho mỗi câu hỏi, không có "Sửa".
Hiện tại cách duy nhất để sửa nội dung 1 câu hỏi đã tạo là: xoá (ẩn) câu cũ
rồi thêm câu mới qua `AdminExamQuestionForm`.

---

### Vấn đề đã ghi nhận, chưa xử lý trong tính năng này

- **Thiếu UI "Sửa câu hỏi"** ở `AdminExamPaperDetailPage` dù backend
  `PATCH .../questions/:qid` đã sẵn sàng (xem Ghi chú kỹ thuật #11).
- **`GET /api/admin/exam-papers?subject=`** trả mảng **không phân trang** —
  khi số đề thi tăng lên (nhiều môn × nhiều mã đề), danh sách admin sẽ tải
  toàn bộ cùng lúc.
- **Không có trang "Lịch sử thi thử"** cho học sinh — khác với Practice
  Module (Section 4) có `PaginatedHistory`/`PracticeStats`, học sinh thi thử
  xong chỉ xem được kết quả ngay lúc đó (`ExamResultScreen`), không có nơi
  xem lại các phiên `ExamSession` cũ.
- **Tổng điểm các câu trong 1 đề không bị validate phải bằng 10** — đây là
  chủ ý thiết kế (hệ thống tự quy đổi qua `score = earned/total*100/10`),
  nhưng admin cần tự đảm bảo tổng điểm hợp lý (ví dụ không tạo đề chỉ có 1
  câu 0.25đ) để điểm số có ý nghĩa.
- **Import Excel xử lý tuần tự, không transaction** — nếu 1 trong nhiều dòng
  hợp lệ ghi DB thành công nhưng request bị ngắt giữa chừng (timeout, crash),
  các câu đã insert trước đó **không bị rollback**; lần import lại sẽ tạo
  câu hỏi trùng (không có check trùng nội dung).

---

### Cách thiết lập & kiểm thử

```bash
# Backend: smoke test luồng chính (87 test case — chấm điểm 3 dạng, chọn đề
# công bằng, hết giờ + grace period, điểm thưởng, lỗi đầu vào...)
cd backend
npm run smoke:exam

# Backend: smoke test race condition (21 test case — tranh chấp trừ điểm khi
# vào thi, tranh chấp "chốt phiên" khi nộp bài cả 2 trường hợp pointsAwarded=0/>0)
npm run smoke:exam:concurrency

# (Tuỳ chọn) sinh lại file mẫu import Excel
npm run generate:exam-template
# → ghi ra docs/templates/mau-import-cau-hoi-thi-thu.xlsx

# Frontend
npm run dev
# → Đăng nhập học sinh → ProfilePage → "Thi thử 🎯"
# → Admin: http://localhost:5173/#admin → tab "Đề thi thử"
#   (dùng giá trị ADMIN_SECRET trong backend/.env)
```

---

## 7. Ngân hàng câu hỏi (Question Bank)

**Trạng thái:** ✅ Hoàn thành
**Ngày hoàn thành:** 2026-07-03
**Branch / commit liên quan:** `feature/question-bank`

---

### Tổng quan

Module Ngân hàng câu hỏi là **kho lưu trữ câu hỏi dùng chung** cho toàn hệ
thống. Admin có thể tạo, sửa, xóa câu hỏi trong kho — sau đó thêm hàng loạt
vào bất kỳ đề thi nào mà không phải nhập lại. Điểm khác biệt so với câu hỏi
đề thi (`exam_questions`): câu trong kho có thể được **tái sử dụng** trong
nhiều đề, và khi xóa khỏi kho, các bản sao trong đề thi vẫn còn nguyên
(`FK ON DELETE SET NULL`).

**Tính năng chính:**
- CRUD đầy đủ: Tạo / Đọc (danh sách có filter + phân trang) / Sửa / Xóa câu hỏi
- Hỗ trợ 3 dạng câu: `MCQ_4` (trắc nghiệm 4 đáp án), `TRUE_FALSE_4` (4 phát biểu Đúng/Sai), `FILL_BLANK` (điền từ)
- Tìm kiếm theo nội dung (full-text contains, case-insensitive)
- Lọc theo môn học, chương, độ khó, trạng thái active
- **Hard delete có cảnh báo**: kiểm tra phiên `IN_PROGRESS` trước khi xóa; nếu đang có phiên thi dùng câu này → trả lỗi `409 QUESTION_BANK_DELETE_BLOCKED`
- Kiểm tra usage: xem câu đang dùng trong đề nào, có phiên đang diễn ra không
- **Thêm từ kho vào đề thi** theo batch (tối đa 100 câu): tự động bỏ qua câu đã tồn tại trong đề (skip duplicate, không báo lỗi)

---

### Phương án kỹ thuật được lựa chọn và lý do

#### 1. Bảng `question_bank` riêng, không dùng lại `questions` (Practice)

**Vấn đề:** `questions` (Practice) và câu hỏi thi thử (`exam_questions`) có cấu trúc khác nhau (3 dạng vs 1 dạng trắc nghiệm). Nếu dùng chung, cần nhiều nullable field.

**Phương án đã chọn:** Bảng `question_bank` độc lập với đầy đủ 3 dạng câu hỏi. Khi thêm từ kho vào đề, tạo bản sao sang `exam_questions` — không tham chiếu trực tiếp.

**Lý do:** Bản sao riêng giữ toàn bộ ngữ nghĩa câu hỏi trong đề thi. Khi câu trong kho bị xóa hoặc sửa, đề thi không bị ảnh hưởng. Admin có thể chỉnh câu trong đề mà không ảnh hưởng kho.

#### 2. Hard delete có cảnh báo, không soft delete

**Vấn đề:** Soft delete (thêm `deletedAt`) giữ data nhưng làm phức tạp mọi query phải thêm `WHERE deletedAt IS NULL`.

**Phương án đã chọn:** Hard delete thật sự (`DELETE FROM question_bank`), nhưng trước đó check: nếu câu đang được dùng trong phiên thi đang diễn ra (`IN_PROGRESS`) → từ chối với 409.

**Lý do:** Hard delete đơn giản hơn, không cần filter trong mọi query. Check trước khi xóa đảm bảo tính toàn vẹn. Câu trong `exam_questions` có `sourceQuestionBankId` null-safe (`ON DELETE SET NULL`) nên không bị ảnh hưởng.

#### 3. Batch import (kho → đề): skip duplicate, không lỗi

**Vấn đề:** Admin chọn 50 câu từ kho để thêm vào đề. Một số câu có thể đã tồn tại trong đề.

**Phương án đã chọn:** Với mỗi câu trong batch, kiểm tra `(examPaperId, sourceQuestionBankId)` → nếu đã tồn tại thì bỏ qua, không insert. Trả về số lượng "đã thêm" và "bỏ qua".

**Lý do:** Không làm gián đoạn workflow của admin. Có thể chọn cả block câu hỏi và import lại mà không sợ nhân đôi.

---

### Data Model

#### Bảng `question_bank` (mới)

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `id` | TEXT (UUID) | Primary key |
| `subject` | TEXT | Mã môn (`TOAN`, `VAN`, ...) |
| `chapter` | TEXT? | Tên chương (tùy chọn) |
| `difficulty` | INTEGER | Độ khó: 1=dễ, 2=trung bình, 3=khó |
| `questionType` | TEXT | Dạng câu: `MCQ_4` / `TRUE_FALSE_4` / `FILL_BLANK` |
| `points` | FLOAT | Điểm của câu hỏi |
| `questionText` | TEXT | Nội dung câu hỏi (tối đa 4000 ký tự) |
| `options` | JSONB? | `null` với FILL_BLANK; mảng 4 chuỗi với MCQ_4/TRUE_FALSE_4 |
| `correctAnswer` | JSONB | Đáp án đúng: `int` (MCQ_4), `bool[]` (TRUE_FALSE_4), `string[]` (FILL_BLANK) |
| `explanation` | TEXT? | Giải thích đáp án |
| `examYear` | INTEGER? | Năm đề tham khảo |
| `examCode` | TEXT? | Mã đề tham khảo |
| `isActive` | BOOLEAN | `false` = ẩn khỏi danh sách active |
| `createdAt` | TIMESTAMP | Thời điểm tạo |
| `sourceQuestionId` | TEXT? (UNIQUE) | ID câu hỏi gốc từ bảng `questions` (module Ôn tập). `null` = câu được tạo thủ công hoặc import. Ràng buộc `@unique` đảm bảo seed script idempotent — chạy nhiều lần không tạo bản sao. |

**Index:** `(subject, difficulty, isActive)` — tối ưu truy vấn lọc câu theo môn/độ khó.

#### Bảng `exam_questions` (thay đổi)

| Field mới | Kiểu | Mô tả |
|-----------|------|-------|
| `questionBankId` | TEXT? (FK, nullable) | Liên kết với `question_bank.id`. `ON DELETE SET NULL`: khi câu trong kho bị xóa, field này tự thành `null` — bản sao trong đề thi vẫn tồn tại. |

**Index mới:** `exam_questions_questionBankId_idx`.

---

### API Reference

#### Admin — `/api/admin/question-bank/*` (cần `X-Admin-Secret: <ADMIN_SECRET>`)

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/admin/question-bank` | Danh sách câu hỏi (filter + phân trang) |
| POST | `/api/admin/question-bank` | Tạo câu hỏi mới trong kho |
| GET | `/api/admin/question-bank/:id/usage` | Kiểm tra câu đang được dùng trong đề nào |
| PUT | `/api/admin/question-bank/:id` | Cập nhật câu hỏi (partial update) |
| DELETE | `/api/admin/question-bank/:id` | Hard delete câu hỏi (có guard phiên IN_PROGRESS) |

#### Endpoint thêm vào `exam-admin` (đã có)

| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/admin/exam-papers/:id/questions/from-bank` | Thêm nhiều câu từ kho vào đề thi (batch, theo danh sách ID) |
| POST | `/api/admin/exam-papers/:id/questions/auto-fill` | Tự động lấy N câu ngẫu nhiên từ kho (tỉ lệ 50% dễ / 30% TB / 20% khó) |

---

#### GET /api/admin/question-bank

**Query params (tất cả tùy chọn):**

| Param | Kiểu | Mô tả |
|-------|------|-------|
| `subject` | string | Lọc theo mã môn (`TOAN`, `VAN`, ...) |
| `chapter` | string | Lọc theo tên chương (contains, case-insensitive) |
| `difficulty` | 1\|2\|3 | Lọc theo độ khó |
| `search` | string | Tìm kiếm theo nội dung câu hỏi (contains) |
| `isActive` | `"true"` \| `"false"` | Lọc theo trạng thái |
| `page` | int > 0 | Trang hiện tại (mặc định: 1) |
| `pageSize` | 1–100 | Số câu mỗi trang (mặc định: 20) |

**Response (200):**
```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "subject": "TOAN",
      "chapter": "Đại số",
      "difficulty": 2,
      "questionType": "MCQ_4",
      "points": 1,
      "questionText": "Giá trị của biểu thức log₂8 bằng?",
      "options": ["2", "3", "4", "6"],
      "correctAnswer": 1,
      "explanation": "log₂8 = log₂(2³) = 3",
      "examYear": 2024,
      "examCode": "001",
      "isActive": true,
      "createdAt": "2026-07-03T02:00:00.000Z"
    }
  ],
  "total": 150,
  "page": 1,
  "pageSize": 20
}
```

---

#### POST /api/admin/question-bank

**Request body (MCQ_4):**
```json
{
  "subject": "TOAN",
  "chapter": "Đại số",
  "difficulty": 2,
  "questionType": "MCQ_4",
  "points": 1,
  "questionText": "Giá trị của biểu thức log₂8 bằng?",
  "options": ["2", "3", "4", "6"],
  "correctAnswer": 1,
  "explanation": "log₂8 = log₂(2³) = 3",
  "examYear": 2024,
  "examCode": "001"
}
```

**Request body (TRUE_FALSE_4):**
```json
{
  "subject": "LY",
  "difficulty": 1,
  "questionType": "TRUE_FALSE_4",
  "points": 1,
  "questionText": "Xác nhận đúng/sai về định luật Newton:",
  "options": ["F=ma", "Lực và phản lực cùng chiều", "Vật tĩnh khi hợp lực = 0", "Gia tốc tỉ lệ nghịch với khối lượng"],
  "correctAnswer": [true, false, true, true]
}
```

**Request body (FILL_BLANK):**
```json
{
  "subject": "VAN",
  "difficulty": 1,
  "questionType": "FILL_BLANK",
  "points": 0.5,
  "questionText": "Thủ đô của Việt Nam là ___.",
  "correctAnswer": ["Hà Nội", "Ha Noi"]
}
```

**Response (201):** Trả về `QuestionBankSummaryDto` đầy đủ (giống schema trong GET).

**Lỗi:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 401 | `ADMIN_UNAUTHORIZED` | Thiếu hoặc sai `X-Admin-Secret` |
| 400 | `INVALID_REQUEST_BODY` | Thiếu trường bắt buộc, `subject` không hợp lệ |
| 400 | `EXAM_QUESTION_INVALID` | `correctAnswer` không khớp với `questionType` (ví dụ MCQ_4 nhưng gửi mảng boolean) |

---

#### GET /api/admin/question-bank/:id/usage

**Response (200):**
```json
{
  "examPapers": [
    {
      "paperId": "paper-uuid",
      "paperTitle": "Đề Toán 2024 - Số 1",
      "subject": "TOAN",
      "isActive": true,
      "hasActiveSession": false
    }
  ],
  "totalExamPapers": 1,
  "hasActiveSession": false
}
```

> `hasActiveSession: true` → cảnh báo cho admin: không nên xóa câu này ngay,
> vì đang có phiên thi thử đang diễn ra dùng đề có chứa câu hỏi này.

**Lỗi:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 401 | `ADMIN_UNAUTHORIZED` | Thiếu hoặc sai `X-Admin-Secret` |
| 404 | `QUESTION_BANK_NOT_FOUND` | `id` không tồn tại trong kho |

---

#### PUT /api/admin/question-bank/:id

**Ngữ nghĩa partial update:** Chỉ trường nào có trong body mới bị cập nhật.
Có thể gửi chỉ `{ "isActive": false }` để ẩn câu mà không cần gửi lại toàn bộ dữ liệu.

**Request body (ví dụ — chỉ cần gửi trường muốn sửa):**
```json
{
  "chapter": "Giải tích",
  "difficulty": 3,
  "isActive": false
}
```

**Response (200):** `QuestionBankSummaryDto` sau khi cập nhật.

**Lỗi:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 401 | `ADMIN_UNAUTHORIZED` | Thiếu hoặc sai `X-Admin-Secret` |
| 400 | `INVALID_REQUEST_BODY` | Kiểu dữ liệu không đúng |
| 400 | `EXAM_QUESTION_INVALID` | Sự kết hợp `questionType/options/correctAnswer` không hợp lệ |
| 404 | `QUESTION_BANK_NOT_FOUND` | `id` không tồn tại trong kho |

---

#### DELETE /api/admin/question-bank/:id

**Luồng xử lý chi tiết:**

```
1. Kiểm tra id tồn tại trong question_bank → không → 404 QUESTION_BANK_NOT_FOUND

2. Mở Prisma $transaction:
   a. Tìm tất cả ExamQuestion có questionBankId = id
   b. Nếu có → lấy danh sách examPaperId
   c. Kiểm tra có ExamSession IN_PROGRESS nào dùng các đề đó không
      → Có → throw QuestionBankDeleteBlockedError (409) → transaction rollback
   d. Không có → prisma.questionBank.delete({ where: { id } })
   e. FK ON DELETE SET NULL tự động đặt exam_questions.questionBankId = null
      cho tất cả ExamQuestion từng tham chiếu đến câu này

3. Trả về 200 + { message: "Da xoa cau hoi khoi ngan hang thanh cong." }
```

**Response (200):**
```json
{ "message": "Da xoa cau hoi khoi ngan hang thanh cong." }
```

**Lỗi:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 401 | `ADMIN_UNAUTHORIZED` | Thiếu hoặc sai `X-Admin-Secret` |
| 404 | `QUESTION_BANK_NOT_FOUND` | `id` không tồn tại trong kho |
| 409 | `QUESTION_BANK_DELETE_BLOCKED` | Còn phiên thi thử `IN_PROGRESS` đang dùng đề có câu này |

---

#### POST /api/admin/exam-papers/:id/questions/from-bank

**Mục đích:** Thêm hàng loạt câu hỏi từ kho vào một đề thi. Câu đã tồn tại
trong đề (theo `questionBankId`) sẽ bị bỏ qua (`skipped`) mà không báo lỗi.
Chỉ câu có `isActive: true` trong kho mới được thêm.

**Request body:**
```json
{
  "questionBankIds": [
    "bank-uuid-1",
    "bank-uuid-2",
    "bank-uuid-3"
  ]
}
```

> Tối đa 100 UUID mỗi lần gọi. Phải là UUID hợp lệ.

**Luồng xử lý:**

```
1. Kiểm tra examPaperId tồn tại → không → 404 EXAM_PAPER_NOT_FOUND

2. Mở Prisma $transaction:
   a. Lấy câu hỏi trong kho theo IDs (chỉ lấy câu isActive=true)
   b. Tìm questionBankId đã tồn tại trong đề này (để skip)
   c. Lọc: toInsert = bankQuestions không có trong existingLinks
   d. createMany ExamQuestion từ toInsert (copy toàn bộ fields từ QuestionBank)
   e. skipped = questionBankIds.length - toInsert.length

3. Trả về { added, skipped }
```

**Response (200):**
```json
{ "added": 2, "skipped": 1 }
```

> `skipped` bao gồm cả câu đã có trong đề lẫn câu `isActive=false` trong kho.

**Lỗi:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 401 | `ADMIN_UNAUTHORIZED` | Thiếu hoặc sai `X-Admin-Secret` |
| 400 | `INVALID_REQUEST_BODY` | `questionBankIds` rỗng, vượt 100, hoặc không phải UUID |
| 404 | `EXAM_PAPER_NOT_FOUND` | `examPaperId` không tồn tại |

---

---

#### POST /api/admin/exam-papers/:id/questions/auto-fill

**Mục đích:** Tự động lấy ngẫu nhiên N câu từ kho (cùng môn với đề thi) theo
tỉ lệ độ khó cố định: **50% dễ / 30% trung bình / 20% khó**. Câu đã tồn tại
trong đề thi được bỏ qua tự động. Hữu ích khi muốn nhanh chóng tạo đề mà
không cần chọn thủ công từng câu.

**Request body:**
```json
{ "count": 40 }
```

> `count` là số câu cần thêm (nguyên dương, tối đa 200). Ví dụ với `count=40`:
> `easyCount = 20` (50%), `mediumCount = 12` (30%), `hardCount = 8` (20%).
> Phần còn lại được gán cho nhóm khó để tránh lệch do làm tròn.

**Luồng xử lý:**

```
1. Kiểm tra examPaperId tồn tại → không → 404 EXAM_PAPER_NOT_FOUND

2. Tính số câu theo độ khó:
   easyCount   = round(count * 0.5)
   mediumCount = round(count * 0.3)
   hardCount   = count - easyCount - mediumCount  ← phần còn lại, tránh lệch do làm tròn

3. Mở Prisma $transaction:
   a. Đọc existingBankIds (các questionBankId đã có trong đề) — bên trong TX để atomic
   b. Với mỗi độ khó, query QuestionBank:
      WHERE subject = paper.subject AND difficulty = diff
        AND isActive = true
        AND id NOT IN existingBankIds
   c. Fisher-Yates shuffle kết quả → lấy đúng số câu cần
      (nếu kho không đủ câu cho 1 độ khó → lấy tất cả số còn lại)
   d. createMany ExamQuestion từ tất cả câu đã chọn (copy toàn bộ fields)
   e. shortage = count - added  (số câu thiếu so với yêu cầu)

4. Trả về { added, skipped, shortage }
```

**Response (200):**
```json
{ "added": 38, "skipped": 0, "shortage": 2 }
```

> `shortage > 0` → kho không đủ câu cho môn/độ khó tương ứng. Ví dụ:
> yêu cầu 40 câu nhưng kho môn Toán chỉ còn 38 câu chưa có trong đề →
> `added: 38, shortage: 2`.

**Lỗi:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 401 | `ADMIN_UNAUTHORIZED` | Thiếu hoặc sai `X-Admin-Secret` |
| 400 | `INVALID_REQUEST_BODY` | `count` không phải số nguyên dương hoặc vượt 200 |
| 404 | `EXAM_PAPER_NOT_FOUND` | `examPaperId` không tồn tại |

---

### Luồng chạy (Flow)

#### A. Admin tạo câu hỏi và thêm vào đề thi

```
Admin
  │
  ├─ POST /api/admin/question-bank
  │    └─ validateQuestionShape (options/correctAnswer khớp questionType?)
  │    └─ prisma.questionBank.create(...)
  │    └─ 201 + QuestionBankSummaryDto
  │
  ├─ GET /api/admin/question-bank?subject=TOAN&difficulty=2
  │    └─ listQuestions (filter + phân trang)
  │    └─ 200 + { items, total, page, pageSize }
  │
  ├─ GET /api/admin/question-bank/:id/usage
  │    └─ Kiểm tra câu đang trong đề nào, có phiên IN_PROGRESS không
  │    └─ 200 + QuestionBankUsageDto
  │
  ├─ POST /api/admin/exam-papers/:paperId/questions/from-bank
  │    └─ { questionBankIds: ["id1", "id2", ...] }
  │    └─ TX: lấy câu active → skip duplicate → createMany ExamQuestion
  │    └─ 200 + { added: N, skipped: M }
  │
  └─ POST /api/admin/exam-papers/:paperId/questions/auto-fill
       └─ { count: 40 }
       └─ Tính easyCount/mediumCount/hardCount theo tỉ lệ 50/30/20
       └─ TX: đọc existingBankIds → pickRandom(diff, need) × 3 song song
              (Fisher-Yates shuffle → slice)
       └─ createMany ExamQuestion + shortage = count - added
       └─ 200 + { added: N, skipped: 0, shortage: M }
```

#### B. Admin xóa câu hỏi (hard delete có guard)

```
Admin → DELETE /api/admin/question-bank/:id
          │
          ├─ findUnique → không tìm thấy → 404
          │
          └─ $transaction:
               ├─ findMany ExamQuestion (questionBankId = id)
               │    └─ Có → tìm ExamSession IN_PROGRESS dùng các đề đó
               │         ├─ Có phiên IN_PROGRESS → 409 QUESTION_BANK_DELETE_BLOCKED
               │         └─ Không có → tiếp tục xóa
               └─ questionBank.delete(id)
                    └─ FK ON DELETE SET NULL → exam_questions.questionBankId = null
                    └─ 200 + { message }
```

---

### Cấu trúc file liên quan

```
backend/
├── prisma/
│   ├── schema.prisma                            Model QuestionBank mới; thêm field
│   │                                            questionBankId vào ExamQuestion
│   └── migrations/
│       └── 20260703021638_add_question_bank/    Migration SQL tạo bảng question_bank,
│                                                thêm FK question_bank_id vào exam_questions
│
├── src/
│   ├── services/exam/
│   │   ├── question-bank.types.ts               QuestionBankSummaryDto, QuestionBankListResult,
│   │   │                                        QuestionBankUsageDto, AddFromBankResult,
│   │   │                                        AutoFillFromBankResult (extends AddFromBankResult + shortage),
│   │   │                                        CreateQuestionBankInput, UpdateQuestionBankInput,
│   │   │                                        QuestionBankFilter, AddFromBankInput, AutoFillFromBankInput
│   │   ├── question-bank.errors.ts              QuestionBankNotFoundError (404),
│   │   │                                        QuestionBankDeleteBlockedError (409),
│   │   │                                        QuestionBankDuplicateError (không dùng — skip silent)
│   │   └── question-bank.service.ts             QuestionBankService:
│   │                                            ├─ listQuestions(filter)
│   │                                            ├─ createQuestion(input)
│   │                                            ├─ updateQuestion(id, input)
│   │                                            ├─ getUsage(id)
│   │                                            ├─ deleteQuestion(id)      ← hard delete + guard
│   │                                            ├─ addFromBank(examPaperId, input)
│   │                                            └─ autoFillFromBank(examPaperId, input)  ← random 50/30/20
│   │
│   ├── routes/
│   │   ├── question-bank.route.ts               Router /api/admin/question-bank
│   │   │                                        (GET /, POST /, GET /:id/usage,
│   │   │                                        PUT /:id, DELETE /:id)
│   │   └── exam-admin.route.ts                  Bổ sung thêm:
│   │                                            POST /:id/questions/from-bank
│   │                                            POST /:id/questions/auto-fill
│   │
│   ├── app.ts                                   Đăng ký questionBankRouter tại
│   │                                            /api/admin/question-bank
│   │
│   └── scripts/
│       └── smoke-test-question-bank.ts          Smoke test tất cả luồng chính
│                                                (23 test case CRUD + usage + from-bank)
```

---

### Ghi chú kỹ thuật

1. **Hard delete vs soft delete:** Module Ngân hàng câu hỏi dùng **hard delete**
   (xóa hẳn khỏi DB) thay vì soft delete (`isActive=false`) như module Ôn tập.
   Lý do: câu trong kho là bản "gốc" để tái sử dụng; khi không còn cần thiết,
   nên xóa thật. Các bản sao trong `exam_questions` vẫn còn nhờ `ON DELETE SET NULL`.

2. **FK ON DELETE SET NULL:** Khi xóa câu khỏi kho, `exam_questions.questionBankId`
   tự động về `null`. Điều này có nghĩa: câu trong đề thi trở thành "độc lập" —
   không còn liên kết với kho nữa. Admin vẫn phải sửa/xóa riêng bản sao trong đề.

3. **Guard phiên IN_PROGRESS bên trong transaction:** Toàn bộ việc kiểm tra
   và xóa nằm trong cùng 1 transaction để tránh race condition: nếu 1 phiên
   được tạo ngay sau khi kiểm tra nhưng trước khi xóa, transaction vẫn sẽ
   phát hiện và từ chối.

4. **addFromBank bỏ qua câu isActive=false:** Khi thêm từ kho vào đề thi,
   câu bị ẩn (`isActive=false`) được coi là "không tồn tại" và không được thêm
   — tính vào `skipped`. Hành vi này là có chủ đích: không muốn đề thi chứa
   câu đang bị ẩn.

5. **Validate shape được tái sử dụng từ exam.service:** `validateQuestionShape`
   từ `exam.service.ts` được dùng lại để đảm bảo `options/correctAnswer` khớp
   với `questionType` — không có logic validate trùng lặp.

6. **autoFillFromBank: Fisher-Yates shuffle thay vì `ORDER BY RANDOM()`:** Lấy
   toàn bộ câu hợp lệ cho mỗi độ khó rồi shuffle phía application, thay vì
   dùng `ORDER BY RANDOM()` của PostgreSQL. Lý do: `ORDER BY RANDOM()` không thể
   kết hợp với `LIMIT` hiệu quả trên bảng lớn (phải sort toàn bộ bảng). Fisher-Yates
   đảm bảo random thực sự và không phụ thuộc vào thứ tự DB trả về.

7. **`sourceQuestionId` — idempotent seed script:** Trường `@unique` này chỉ
   được dùng bởi `seed-question-bank-from-questions.ts` để "copy" câu từ bảng
   `questions` (module Ôn tập) sang kho. Ràng buộc `@unique` đảm bảo chạy
   script nhiều lần không tạo bản sao — bất kỳ câu nào đã có `sourceQuestionId`
   tương ứng sẽ bị skip.

---

### Cách kiểm thử

```bash
cd backend

# Chạy smoke test Ngân hàng câu hỏi (23 test case)
npm run smoke:question-bank
# Kỳ vọng: toàn bộ PASS, kết thúc bằng "TAT CA KIEM TRA PASS!"

# Test thủ công — tạo câu hỏi MCQ_4
curl -X POST http://localhost:4000/api/admin/question-bank \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: $ADMIN_SECRET" \
  -d '{
    "subject": "TOAN",
    "chapter": "Đại số",
    "difficulty": 2,
    "questionType": "MCQ_4",
    "points": 1,
    "questionText": "log₂8 bằng?",
    "options": ["2", "3", "4", "6"],
    "correctAnswer": 1
  }'

# Test thêm câu từ kho vào đề (thay <PAPER_ID> và <BANK_ID> bằng UUID thật)
curl -X POST http://localhost:4000/api/admin/exam-papers/<PAPER_ID>/questions/from-bank \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: $ADMIN_SECRET" \
  -d '{ "questionBankIds": ["<BANK_ID>"] }'

# Test kiểm tra usage trước khi xóa
curl http://localhost:4000/api/admin/question-bank/<BANK_ID>/usage \
  -H "X-Admin-Secret: $ADMIN_SECRET"

# Test xóa câu (guard sẽ từ chối nếu còn phiên IN_PROGRESS)
curl -X DELETE http://localhost:4000/api/admin/question-bank/<BANK_ID> \
  -H "X-Admin-Secret: $ADMIN_SECRET"
```

### Lưu ý / rủi ro / TODO tiếp theo

- **UI Admin chưa có:** Hiện tại chưa có giao diện cho Ngân hàng câu hỏi trong
  admin dashboard frontend. Admin phải dùng curl/Postman hoặc viết UI ở giai đoạn tiếp.
- **Không có giới hạn tổng số câu:** Không có cap cho số câu trong kho — cần
  monitor dung lượng DB khi số lượng câu tăng lớn.
- **`skipped` có thể khó debug:** Khi `from-bank` trả `skipped > 0`, admin không
  biết câu nào bị skip (bị ẩn hay đã có trong đề). Có thể bổ sung field
  `skippedIds` trong response về sau nếu cần.
- **Chưa có audit log:** Các thao tác xóa câu chưa được ghi lịch sử (ai xóa, lúc nào).
  Cân nhắc thêm bảng `admin_audit_log` nếu cần truy vết.
- TODO tiếp theo: Xây dựng UI tab "Ngân hàng câu hỏi" trong admin dashboard frontend.

---

## 8. Leaderboard & Avatar – Bảng xếp hạng & Ảnh đại diện

**Trạng thái:** ✅ Hoàn thành
**Ngày hoàn thành:** 2026-07-04
**Branch:** `feature/leaderboard`

---

### Tổng quan

Module này gồm 2 tính năng đi kèm nhau:

1. **Ảnh đại diện (Avatar):** Người dùng có thể upload ảnh đại diện JPG/PNG (≤ 2MB)
   từ màn hình Profile. Ảnh được lưu trên server (`backend/uploads/avatars/`) và
   hiển thị trên Bảng xếp hạng. Click vào avatar để chọn ảnh mới; có nút xem trước
   (preview) trước khi lưu và nút xóa ảnh.

2. **Bảng xếp hạng (Leaderboard):** Xếp hạng học sinh theo **Điểm Uy Tín** — công
   thức tổng hợp điểm trung bình, độ ổn định, và số lần thi. Hiển thị podium Top 3,
   bảng hạng từ vị trí 4 trở đi (phân trang), có thể lọc theo môn học, và thanh
   ghim hiển thị hạng của bản thân.

---

### Phương án kỹ thuật được lựa chọn và lý do

#### 1. Lưu ảnh trên disk (local), không dùng cloud storage

**Vấn đề:** Cần lưu file ảnh với chi phí thấp, triển khai đơn giản.

**Phương án đã chọn:** `multer` lưu file vào `backend/uploads/avatars/` trên server. Serve static qua Express `serveStatic`.

**Lý do:** Không cần chi phí S3/Cloud Storage. Đủ cho số lượng user nhỏ ban đầu. **Trade-off**: không scale ngang — nếu sau này có nhiều server thì phải dùng shared storage hoặc CDN.

#### 2. Điểm Uy Tín (Prestige Score) — công thức tổng hợp, không chỉ điểm trung bình

**Vấn đề:** Nếu chỉ xếp theo điểm trung bình, học sinh thi 1 lần đạt 10 điểm sẽ hạng 1 mãi mãi.

**Phương án đã chọn:** `prestigeScore = avgScore × (1 - stdDevPenalty) × log(examCount + 1)`

**Lý do:** Kết hợp 3 yếu tố: điểm trung bình (quality) × độ ổn định (1 - độ lệch chuẩn) × số lần tham gia (log-scale để không thiên vị quá nhiều). Khuyến khích học sinh thi nhiều lần, ổn định.

#### 3. Xếp hạng tính on-the-fly, không cache

**Vấn đề:** Dữ liệu xếp hạng có thể cũ nếu cache.

**Phương án đã chọn:** Query DB mỗi lần gọi `GET /api/leaderboard`, tính prestige score bằng SQL window function.

**Lý do:** Đủ nhanh với số lượng user hiện tại. Luôn fresh. **Trade-off**: khi user nhiều (>1000) cần thêm materialized view hoặc cache Redis.

---

### Data Model

#### Bảng `users` — Thêm cột mới

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `avatarUrl` | `TEXT?` | URL tương đối đến file ảnh, ví dụ `/uploads/avatars/<userId>.jpg`. `NULL` = chưa có ảnh. |

**Migration:** `20260703175302_add_user_avatar_url`

#### File ảnh — lưu trên disk

| Đường dẫn | Mô tả |
|-----------|-------|
| `backend/uploads/avatars/<userId>.jpg` | Ảnh định dạng JPG |
| `backend/uploads/avatars/<userId>.png` | Ảnh định dạng PNG |

Mỗi user chỉ có tối đa 1 file ảnh. Khi upload lại, file cũ bị ghi đè (overwrite)
hoặc xóa trước khi lưu file mới (nếu đổi định dạng).

---

### API Reference

#### Tổng hợp endpoints

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| `POST` | `/api/users/me/avatar` | Bearer token | Upload ảnh đại diện |
| `DELETE` | `/api/users/me/avatar` | Bearer token | Xóa ảnh đại diện |
| `GET` | `/api/leaderboard` | Bearer token | Danh sách xếp hạng (phân trang) |
| `GET` | `/api/leaderboard/me` | Bearer token | Hạng và chỉ số của user đang đăng nhập |

---

#### POST /api/users/me/avatar

**Mục đích:** Upload ảnh đại diện mới, thay thế ảnh cũ nếu đã có.

**Content-Type:** `multipart/form-data` — field tên là `avatar`.

**Ràng buộc:**
- Chỉ chấp nhận `image/jpeg` hoặc `image/png`
- Dung lượng tối đa 2MB
- Tên file lưu: `<userId>.<ext>` — Multer tự đặt, không phụ thuộc tên file gốc

**Request (curl mẫu):**
```bash
curl -X POST http://localhost:4000/api/users/me/avatar \
  -H "Authorization: Bearer <session-token>" \
  -F "avatar=@/path/to/photo.jpg"
```

**Luồng xử lý:**
```
1. verifyAppToken → req.currentUser
2. Multer middleware:
   ├─ Kiểm tra mimetype (JPG/PNG) → từ chối nếu sai: AVATAR_INVALID_TYPE (400)
   ├─ Kiểm tra kích thước → từ chối nếu > 2MB: AVATAR_FILE_TOO_LARGE (400)
   └─ Lưu file vào backend/uploads/avatars/<userId>.<ext>
3. UsersService.uploadAvatar(userId, filePath, relativeUrl)
   ├─ Tìm user trong DB (UserNotFoundError nếu không tìm thấy)
   ├─ Nếu user đã có avatarUrl cũ → xóa file vật lý cũ (bỏ qua nếu file không tồn tại)
   ├─ UPDATE users SET avatarUrl = '/uploads/avatars/<userId>.<ext>'
   └─ Trả về UserMeDto đầy đủ (kem điểm)
```

**Response thành công (200):** `UserMeDto` đầy đủ (xem `GET /api/users/me`), có thêm trường `avatarUrl`.

**Lỗi có thể xảy ra:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 400 | `AVATAR_NO_FILE` | Không có field `avatar` trong form data |
| 400 | `AVATAR_INVALID_TYPE` | File không phải JPG hoặc PNG |
| 400 | `AVATAR_FILE_TOO_LARGE` | File vượt quá 2MB |
| 400 | `AVATAR_UPLOAD_ERROR` | Lỗi Multer khác (ít gặp) |
| 401 | `MISSING_AUTH_TOKEN` | Thiếu header Authorization |
| 401 | `INVALID_SESSION_TOKEN` | Token hết hạn hoặc sai |
| 404 | `USER_NOT_FOUND` | User không còn trong DB (rất hi hữu) |

---

#### DELETE /api/users/me/avatar

**Mục đích:** Xóa ảnh đại diện — đặt `avatarUrl = null` trong DB và xóa file vật lý.

**Request:** Không có body.

**Luồng xử lý:**
```
1. verifyAppToken → req.currentUser
2. UsersService.removeAvatar(userId)
   ├─ Tìm user, lấy avatarUrl hiện tại
   ├─ Nếu avatarUrl = null → AVATAR_NOT_FOUND (400)
   ├─ Xóa file vật lý (bỏ qua nếu file đã không còn)
   ├─ UPDATE users SET avatarUrl = NULL
   └─ Trả về UserMeDto (avatarUrl = null)
```

**Response thành công (200):** `UserMeDto` với `avatarUrl: null`.

**Lỗi có thể xảy ra:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 400 | `AVATAR_NOT_FOUND` | User chưa có ảnh đại diện để xóa |
| 401 | `MISSING_AUTH_TOKEN` | Thiếu header Authorization |
| 401 | `INVALID_SESSION_TOKEN` | Token hết hạn hoặc sai |

---

#### GET /api/leaderboard?subject=&page=

**Mục đích:** Lấy danh sách xếp hạng, phân trang 10 người/trang, có thể lọc theo môn học.

**Query params:**

| Param | Kiểu | Mặc định | Mô tả |
|-------|------|---------|-------|
| `page` | `number` | `1` | Trang cần lấy (bắt đầu từ 1) |
| `subject` | `string` | *(tất cả môn)* | Mã môn học để lọc (ví dụ `TOAN`, `VAN`) |

**Request (curl mẫu):**
```bash
# Tất cả môn, trang 1
curl http://localhost:4000/api/leaderboard \
  -H "Authorization: Bearer <session-token>"

# Chỉ môn Toán, trang 2
curl "http://localhost:4000/api/leaderboard?subject=TOAN&page=2" \
  -H "Authorization: Bearer <session-token>"
```

**Luồng xử lý:**
```
1. verifyAppToken → req.currentUser
2. Parse query: page (min 1), subject (uppercase, bỏ qua nếu rỗng)
3. LeaderboardService.getLeaderboard(page, subject?)
   ├─ Đếm tổng user tham gia xếp hạng (COUNT DISTINCT userId)
   ├─ Nếu total = 0 → trả { data: [], total: 0, page, pageSize: 10 }
   └─ CTE query (PostgreSQL):
       ├─ current_scores: AVG, STDDEV_POP, COUNT, ReputationScore, lastCompletedAt
       ├─ current_ranks:  ROW_NUMBER() OVER (ORDER BY reputationScore DESC, lastCompletedAt DESC)
       ├─ old_scores:     Tương tự nhưng chỉ data TRƯỚC 30 ngày
       ├─ old_ranks:      ROW_NUMBER() cho data cũ (để tính xu hướng)
       └─ JOIN users: lấy displayName, avatarUrl
          LIMIT 20 OFFSET (page-1)*20
4. Map rows → LeaderboardEntry[] (round reputationScore/avgScore 2 chữ số)
```

**Công thức Điểm Uy Tín:**
```
Điểm Uy Tín = (AVG(score) − 0.5 × STDDEV_POP(score)) × (1 − 1/(n+1))
```
- `AVG(score)`: điểm trung bình các lần thi (chỉ tính ExamSession COMPLETED có score)
- `STDDEV_POP(score)`: độ lệch chuẩn (= 0 khi chỉ có 1 lần thi)
- `n`: số lần thi thành công

> **Ý nghĩa:** Học sinh thi đều đặn, điểm cao và ổn định sẽ có Điểm Uy Tín cao.
> Người thi 1 lần điểm tuyệt đối vẫn bị hạn chế vì `n` nhỏ. Người điểm cao nhưng
> không ổn định (STDDEV lớn) sẽ bị trừ điểm.

**Xu hướng (trend):**

| Giá trị | Ý nghĩa |
|---------|---------|
| `"up"` | Hạng tăng so với 30 ngày trước (số hạng nhỏ hơn = tốt hơn) |
| `"down"` | Hạng giảm so với 30 ngày trước |
| `"same"` | Hạng không đổi |
| `"new"` | Chưa có dữ liệu 30 ngày trước (mới thi lần đầu trong 30 ngày qua) |

**Response thành công (200):**
```json
{
  "data": [
    {
      "rank": 1,
      "userId": "uuid-user-1",
      "displayName": "Nguyễn Văn A",
      "avatarUrl": "/uploads/avatars/uuid-user-1.jpg",
      "reputationScore": 8.45,
      "avgScore": 9.2,
      "examCount": 15,
      "trend": "up"
    },
    {
      "rank": 2,
      "userId": "uuid-user-2",
      "displayName": "Trần Thị B",
      "avatarUrl": null,
      "reputationScore": 7.83,
      "avgScore": 8.5,
      "examCount": 8,
      "trend": "same"
    }
  ],
  "total": 87,
  "page": 1,
  "pageSize": 20
}
```

**Lỗi có thể xảy ra:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 401 | `MISSING_AUTH_TOKEN` | Thiếu header Authorization |
| 401 | `INVALID_SESSION_TOKEN` | Token hết hạn hoặc sai |

---

#### GET /api/leaderboard/me?subject=

**Mục đích:** Lấy hạng và chỉ số Điểm Uy Tín của user đang đăng nhập.
Nếu chưa thi lần nào → trả về `rank: null`.

**Query params:** `subject` (tùy chọn, giống endpoint trên).

**Request (curl mẫu):**
```bash
curl http://localhost:4000/api/leaderboard/me \
  -H "Authorization: Bearer <session-token>"
```

**Luồng xử lý:**
```
1. verifyAppToken → req.currentUser
2. LeaderboardService.getMyRank(userId, subject?)
   ├─ Truy vấn thống kê của user: AVG, COUNT, ReputationScore
   ├─ Nếu examCount = 0 → trả { rank: null, reputationScore: null, avgScore: null, examCount: 0, trend: null }
   ├─ Tính hạng hiện tại: đếm số user có ReputationScore cao hơn (hoặc bằng nhưng thi sớm hơn)
   ├─ Tính hạng 30 ngày trước (dùng data trước NOW - 30 days)
   └─ Tính trend: so sánh current_rank vs old_rank
```

**Response thành công (200) — đã thi:**
```json
{
  "rank": 5,
  "reputationScore": 6.72,
  "avgScore": 7.8,
  "examCount": 4,
  "trend": "up"
}
```

**Response (200) — chưa thi lần nào:**
```json
{
  "rank": null,
  "reputationScore": null,
  "avgScore": null,
  "examCount": 0,
  "trend": null
}
```

**Lỗi có thể xảy ra:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 401 | `MISSING_AUTH_TOKEN` | Thiếu header Authorization |
| 401 | `INVALID_SESSION_TOKEN` | Token hết hạn hoặc sai |

---

### Luồng chạy (Flow)

#### A. Upload ảnh đại diện từ Profile

```
[FE] ProfilePage
  └─ User click vào avatar → <input type="file" accept="image/*">
  └─ Chọn file JPG/PNG
        │
        ▼
  Validate phía FE (loại file, kích thước ≤ 2MB)
  Hiển thị preview (URL.createObjectURL)
        │
        ▼
  User bấm "Lưu ảnh"
        │
        ▼
  uploadAvatar(sessionToken, file) → POST /api/users/me/avatar
  [multipart/form-data, field "avatar"]
        │
  [BE] Multer lưu → backend/uploads/avatars/<userId>.jpg
  [BE] UsersService.uploadAvatar → xóa ảnh cũ, UPDATE DB
        │
        ▼
  Response: UserMeDto (avatarUrl = "/uploads/avatars/<userId>.jpg")
  [FE] Cập nhật state profile, revoke preview URL
```

#### B. Xem Bảng xếp hạng

```
[FE] User bấm "Bảng xếp hạng" trên ProfilePage
  └─ setScreen('leaderboard')
        │
        ▼
  LeaderboardPage mount
  Gọi song song:
    ├─ getLeaderboard(token, page=1, subject?)      → GET /api/leaderboard
    └─ getMyLeaderboardRank(token, subject?)        → GET /api/leaderboard/me
        │
        ▼
  Render:
    ├─ Podium (top3[1] = Hạng 2 trái, top3[0] = Hạng 1 giữa, top3[2] = Hạng 3 phải)
    ├─ Bảng hạng 4+ (scrollable)
    ├─ "Xem thêm" → fetchLeaderboard(page+1, subject, append=true)
    └─ Thanh ghim hạng bản thân (cuối trang)
        │
        ▼
  User đổi filter môn → fetchLeaderboard(page=1, newSubject, append=false)
```

#### C. Vite proxy `/uploads` (chỉ dev)

```
[FE] <img src="/uploads/avatars/<id>.jpg">
  └─ Vite proxy → http://localhost:4000/uploads/avatars/<id>.jpg
  └─ Express static middleware → backend/uploads/avatars/<id>.jpg
```

---

### Cấu trúc file

```
backend/
├── prisma/
│   ├── schema.prisma                              Thêm avatarUrl String? vào model User
│   └── migrations/
│       └── 20260703175302_add_user_avatar_url/    Migration tạo cột avatarUrl
│
├── uploads/
│   └── avatars/
│       └── .gitkeep                               Đảm bảo thư mục tồn tại trong Git
│
└── src/
    ├── services/
    │   ├── users/
    │   │   ├── users.types.ts     Thêm avatarUrl vào UserMeDto
    │   │   ├── users.errors.ts    Thêm AvatarError (AVATAR_NOT_FOUND, AVATAR_INVALID_TYPE,
    │   │   │                      AVATAR_FILE_TOO_LARGE, AVATAR_NO_FILE, AVATAR_UPLOAD_ERROR)
    │   │   └── users.service.ts   Thêm uploadAvatar(), removeAvatar()
    │   │
    │   └── leaderboard/
    │       ├── leaderboard.types.ts    LeaderboardEntry, LeaderboardResponse,
    │       │                          MyRankResponse, RawLeaderboardRow, Trend
    │       └── leaderboard.service.ts  LeaderboardService:
    │                                   ├─ getLeaderboard(page, subject?)
    │                                   └─ getMyRank(userId, subject?)
    │
    ├── routes/
    │   ├── users.route.ts         Thêm POST /me/avatar, DELETE /me/avatar (Multer)
    │   └── leaderboard.route.ts   GET /, GET /me — cả 2 cần verifyAppToken
    │
    └── app.ts                     Thêm express.static('/uploads'), leaderboardRouter,
                                   AVATAR_* error codes vào ERROR_CODE_TO_HTTP_STATUS

frontend/
├── vite.config.ts       Thêm proxy /uploads → http://localhost:4000
└── src/
    ├── lib/api.ts        Thêm avatarUrl vào UserProfile; uploadAvatar(), deleteAvatar(),
    │                     getLeaderboard(), getMyLeaderboardRank(); type LeaderboardEntry,
    │                     LeaderboardResponse, MyRankResponse, Trend
    ├── App.tsx           Screen type thêm 'leaderboard'; ProfilePage: avatar upload/delete/preview;
    │                     LeaderboardPage (mới): podium, bảng hạng, filter môn, xem thêm,
    │                     thanh ghim hạng bản thân; AvatarCell component
    └── App.css           CSS: .avatar-wrapper, .avatar-btn, .avatar-overlay, .avatar-preview-bar
```

---

### Ghi chú kỹ thuật

1. **Công thức Điểm Uy Tín — không thay đổi:** Công thức `(AVG − 0.5×STDDEV_POP) × (1 − 1/(n+1))`
   đã được xác nhận và không được thay đổi. Khi `STDDEV_POP = 0` (chỉ 1 lần thi),
   PostgreSQL trả `NULL` → `COALESCE(..., 0)` xử lý về 0.

2. **CTE thay vì subquery lồng nhau:** LeaderboardService dùng CTE (WITH ... AS)
   để tính cả hạng hiện tại và hạng 30 ngày trước trong 1 query duy nhất,
   giảm số round-trip đến DB so với cách tính riêng từng bước.

3. **Multer v2 đã có sẵn:** Multer đã được cài trước đó cho admin bulk import.
   Module avatar tái dùng, không cài thêm dependency.

4. **File avatar lưu theo userId:** Tên file dạng `<userId>.<ext>` nên tự động
   overwrite khi upload lại cùng định dạng. Nếu đổi từ JPG sang PNG (hoặc ngược lại),
   `UsersService.uploadAvatar` sẽ xóa file cũ trước khi lưu file mới.

5. **Xu hướng 30 ngày — phụ thuộc dữ liệu lịch sử:** Nếu user chưa có dữ liệu
   trước 30 ngày (mới tham gia hoặc mới thi trong vòng 30 ngày), trend = `"new"`.
   Điều này không phải lỗi — là hành vi thiết kế.

6. **Sắp xếp tiebreak:** Khi 2 user có cùng ReputationScore, người nào có
   `lastCompletedAt` muộn hơn (thi gần đây hơn) sẽ đứng hạng cao hơn.
   Đây là tiebreak nhất quán giữa cả current_rank và old_rank.

7. **`getMyRank` — 3 query riêng biệt:** Để đơn giản hóa code, `getMyRank` thực
   hiện 3 query tuần tự (stats → current_rank → old_rank) thay vì 1 CTE phức tạp.
   Chấp nhận được vì đây là endpoint cá nhân, không load nhiều data.

---

### Cách tự kiểm thử (manual test)

**Chuẩn bị:** Server backend đang chạy, có session token hợp lệ.

```bash
# 1. Upload avatar
curl -X POST http://localhost:4000/api/users/me/avatar \
  -H "Authorization: Bearer <session-token>" \
  -F "avatar=@/path/to/photo.jpg"
# Kỳ vọng: 200 + UserMeDto có avatarUrl = "/uploads/avatars/<id>.jpg"

# 2. Xem ảnh trực tiếp
curl http://localhost:4000/uploads/avatars/<userId>.jpg -o /tmp/check.jpg
# Kỳ vọng: file ảnh tải thành công

# 3. Xóa avatar
curl -X DELETE http://localhost:4000/api/users/me/avatar \
  -H "Authorization: Bearer <session-token>"
# Kỳ vọng: 200 + UserMeDto có avatarUrl = null

# 4. Xóa khi chưa có avatar
curl -X DELETE http://localhost:4000/api/users/me/avatar \
  -H "Authorization: Bearer <session-token>"
# Kỳ vọng: 400 + { error: "AVATAR_NOT_FOUND" }

# 5. Upload file quá lớn (> 2MB)
curl -X POST http://localhost:4000/api/users/me/avatar \
  -H "Authorization: Bearer <session-token>" \
  -F "avatar=@/path/to/large-file.jpg"
# Kỳ vọng: 400 + { error: "AVATAR_FILE_TOO_LARGE" }

# 6. Upload file sai định dạng (.gif)
curl -X POST http://localhost:4000/api/users/me/avatar \
  -H "Authorization: Bearer <session-token>" \
  -F "avatar=@/path/to/animated.gif"
# Kỳ vọng: 400 + { error: "AVATAR_INVALID_TYPE" }

# 7. Xem bảng xếp hạng (tất cả môn, trang 1)
curl http://localhost:4000/api/leaderboard \
  -H "Authorization: Bearer <session-token>"
# Kỳ vọng: 200 + { data: [...], total: N, page: 1, pageSize: 10 }

# 8. Xem bảng xếp hạng — lọc theo môn Toán
curl "http://localhost:4000/api/leaderboard?subject=TOAN&page=1" \
  -H "Authorization: Bearer <session-token>"
# Kỳ vọng: chỉ có user đã thi ExamSession môn TOAN

# 9. Xem hạng bản thân
curl http://localhost:4000/api/leaderboard/me \
  -H "Authorization: Bearer <session-token>"
# Kỳ vọng (chưa thi): { rank: null, examCount: 0, trend: null, ... }
# Kỳ vọng (đã thi): { rank: N, reputationScore: X.XX, examCount: N, trend: "up"/"down"/... }
```

**Test script tự động:**
```bash
cd backend
npx tsx src/scripts/smoke-test-leaderboard.ts
# Kỳ vọng: toàn bộ PASS
```

---

### Lưu ý / rủi ro / TODO tiếp theo

- **File ảnh không được backup:** `backend/uploads/avatars/` không nên lưu vào
  Git (đã có `.gitkeep` để tạo thư mục). Khi deploy production, cần cấu hình
  persistent storage (volume mount hoặc object storage như S3/GCS).
- **Không có CDN:** Ảnh được serve trực tiếp qua Express static — đủ dùng cho
  môi trường dev/staging, nhưng production nên đưa lên CDN để giảm tải server.
- **getMyRank dùng 3 query riêng biệt:** Có thể tối ưu thành 1 CTE nếu cần
  tăng performance khi số user lớn.
- **Chưa có phân quyền admin cho leaderboard:** Hiện tại mọi user đăng nhập đều
  xem được BXH. Nếu cần ẩn BXH (ví dụ trong thời gian thi), cần thêm flag riêng.
- TODO tiếp theo: Lưu avatar lên S3/object storage thay vì disk để hỗ trợ scale.

---

## 9. Progress Dashboard – Tiến độ học tập

**Trạng thái:** ✅ Hoàn thành
**Ngày hoàn thành:** 2026-07-04
**Branch / commit liên quan:** `feature/progress-dashboard`

---

### Tổng quan

Module Progress Dashboard cung cấp cho học sinh cái nhìn toàn diện về quá trình học tập:
tổng số phiên ôn tập, số lần thi thử, điểm tích lũy, chuỗi ngày học liên tiếp (streak),
so sánh hoạt động tháng này vs tháng trước, thống kê độ chính xác theo môn,
biểu đồ xu hướng điểm số (30 phiên gần nhất), và lịch sử thi thử có phân trang.

**Triết lý thiết kế:**
- **Không bao giờ throw lỗi vì thiếu dữ liệu** — user mới chưa có bất kỳ phiên nào sẽ thấy toàn bộ số `0` / mảng rỗng.
- **Tất cả query chạy song song** (`Promise.all`) trong `getSummary` — tối thiểu round-trip DB.
- **Reuse logic** — thống kê theo môn gọi thẳng `practiceService.getStats()` thay vì viết lại.

---

### Phương án kỹ thuật được lựa chọn và lý do

#### 1. Không tạo bảng mới — đọc từ bảng hiện có

**Vấn đề:** Cần hiển thị nhiều loại thống kê từ nhiều bảng khác nhau.

**Phương án đã chọn:** `progressService.getSummary()` chạy song song nhiều query trên `practice_sessions`, `exam_sessions`, `practice_answers`, `user_points` — không denormalize vào bảng riêng.

**Lý do:** Tránh đồng bộ dữ liệu (sync consistency problem). Mỗi lần gọi luôn lấy số liệu mới nhất. Phù hợp cho lượng user nhỏ-vừa.

#### 2. Streak tính từ calendar days, không từ session count

**Vấn đề:** Học sinh học 5 lần/ngày và không học hôm sau — streak có tính không?

**Phương án đã chọn:** Streak đếm số ngày liên tiếp có ít nhất 1 phiên học (practice hoặc exam). Dùng SQL `DATE_TRUNC('day', startedAt)` → distinct ngày → đếm chuỗi liên tiếp từ hôm nay ngược về quá khứ.

**Lý do:** Phản ánh thói quen học đều đặn hơn là chơi nhiều trong 1 ngày. Nhất quán với các app học ngoại ngữ (Duolingo, Anki).

#### 3. Promise.all cho 5+ query song song

**Vấn đề:** Dashboard cần nhiều loại thống kê, nếu chạy tuần tự → tổng latency tăng tuyến tính.

**Phương án đã chọn:** `const [summary, streak, bySubject, trend, history] = await Promise.all([...])` — tất cả chạy đồng thời.

**Lý do:** Giảm latency từ ~O(n × queryTime) xuống ~O(max queryTime). Các query độc lập (không phụ thuộc kết quả nhau) nên hoàn toàn an toàn.

---

### Data Model

Module Progress không tạo bảng DB mới. Nó đọc dữ liệu từ các bảng đã có:

| Bảng | Dữ liệu đọc |
|------|-------------|
| `practice_sessions` | Số phiên hoàn thành, ngày hoàn thành (tính streak), điểm (biểu đồ xu hướng) |
| `exam_sessions` | Số phiên `COMPLETED`, điểm thi trung bình theo tháng |
| `user_points` | Số điểm tích lũy hiện tại |
| `exam_papers` | Tên đề và môn học (join vào lịch sử thi) |

---

### API Reference

#### GET /api/progress/summary

**Auth:** `verifyAppToken` (cần session token)

**Mô tả:** Trả về toàn bộ tóm tắt tiến độ học tập của user đang đăng nhập.

**Request:** Không có body, không có query param.

**Luồng xử lý:**
```
verifyAppToken → req.currentUser.id
    │
    └─ progressService.getSummary(userId)
         │
         ├─ Promise.all([9 query song song]):
         │   ├─ practiceSession: tất cả completedAt (tính streak + tổng)
         │   ├─ examSession.count (COMPLETED)
         │   ├─ userPoints.findUnique (điểm hiện tại)
         │   ├─ practiceSession.count (tháng này)
         │   ├─ practiceSession.count (tháng trước)
         │   ├─ examSession.findMany scores (tháng này)
         │   ├─ examSession.findMany scores (tháng trước)
         │   ├─ practiceSession.findMany (30 phiên gần nhất — biểu đồ)
         │   └─ practiceService.getStats(userId) (thống kê theo môn)
         │
         ├─ computeStreaks(completedDates) → { currentStreak, bestStreak }
         ├─ calcExamAvg(scores) → number | null
         └─ Ghép thành ProgressSummary
```

**Response thành công (200):**
```json
{
  "overview": {
    "totalPracticeSessions": 15,
    "totalExamSessions": 3,
    "currentPoints": 500,
    "currentStreak": 3
  },
  "bestStreak": 7,
  "monthComparison": {
    "thisMonth": {
      "practiceSessions": 8,
      "examAvgScore": 7.5
    },
    "lastMonth": {
      "practiceSessions": 7,
      "examAvgScore": null
    }
  },
  "practiceStatsBySubject": [
    {
      "subject": "TOAN",
      "totalSessions": 10,
      "avgScore": 10.2,
      "bestScore": 13,
      "accuracyByDifficulty": { "1": 0.96, "2": 0.74, "3": 0.52 }
    }
  ],
  "scoreTrend": [
    { "date": "2026-07-01T10:00:00.000Z", "score": 10, "subject": "TOAN" },
    { "date": "2026-07-02T11:00:00.000Z", "score": 12, "subject": "TOAN" },
    { "date": "2026-07-04T10:00:00.000Z", "score": 8, "subject": "TOAN" }
  ]
}
```

> `examAvgScore = null` nếu tháng đó chưa có lần thi nào hoàn thành.
> `scoreTrend` được sắp xếp từ cũ đến mới (phù hợp để vẽ biểu đồ trái → phải).

**Lỗi có thể xảy ra:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 401 | `MISSING_AUTH_TOKEN` | Không có Authorization header |
| 401 | `INVALID_SESSION_TOKEN` | Token hết hạn hoặc sai |
| 401 | `SESSION_USER_NOT_FOUND` | Tài khoản đã bị xoá |

---

#### GET /api/progress/exam-history?limit=10&offset=0

**Auth:** `verifyAppToken`

**Mô tả:** Lịch sử các lần thi thử đã hoàn thành, có phân trang.

**Query params:**

| Param | Kiểu | Mặc định | Mô tả |
|-------|------|---------|-------|
| `limit` | number | 10 | Số bản ghi mỗi trang (clamp: 1–50) |
| `offset` | number | 0 | Vị trí bắt đầu |

**Luồng xử lý:**
```
verifyAppToken → req.currentUser.id
    │
    └─ progressService.getExamHistory(userId, limit, offset)
         │
         ├─ safeLimit  = clamp(limit, 1, 50)
         ├─ safeOffset = max(0, offset)
         ├─ Promise.all([
         │     examSession.findMany (COMPLETED, limit/offset),
         │     examSession.count    (COMPLETED)
         │   ])
         ├─ Lấy ExamPaper info theo examPaperId (batch query)
         └─ Map ExamSession + ExamPaper → ExamHistoryItem[]
              (nếu ExamPaper đã bị xóa: title = '(Đề không còn tồn tại)', subject = '')
```

**Response thành công (200):**
```json
{
  "items": [
    {
      "id": "session-uuid",
      "examPaperId": "paper-uuid",
      "title": "Đề thi thử THPT QG 2024 - Mã đề 101",
      "subject": "TOAN",
      "score": 8.5,
      "pointsAwarded": 80,
      "completedAt": "2026-07-04T14:30:00.000Z"
    }
  ],
  "total": 3,
  "limit": 10,
  "offset": 0
}
```

**Lỗi có thể xảy ra:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 401 | `MISSING_AUTH_TOKEN` | Không có Authorization header |
| 401 | `INVALID_SESSION_TOKEN` | Token hết hạn hoặc sai |
| 401 | `SESSION_USER_NOT_FOUND` | Tài khoản đã bị xoá |

---

### Luồng chạy (Flow)

```
[FE] Người dùng nhấn "📊 Tiến độ của tôi" trên ProfilePage
        │
        ▼
[FE] ProgressPage mount
        │
        ├─ useEffect 1: GET /api/progress/summary
        │       → Hiện spinner → nhận data → render 4 ô tổng quan, so sánh tháng,
        │         bảng thống kê theo môn, sparkline xu hướng điểm
        │
        └─ useEffect 2: GET /api/progress/exam-history?limit=10&offset=0
                → Hiện spinner trong phần lịch sử → nhận data
                → render bảng lịch sử thi thử + phân trang (nếu total > 10)

[FE] User nhấn "Sau →" / "← Trước" trong phân trang lịch sử thi
        → setExamPage(p ± 1) → useEffect 2 trigger lại với offset mới

[FE] Biểu đồ xu hướng điểm (ScoreSparkline):
        - < 2 điểm dữ liệu → hiện "Chưa đủ dữ liệu"
        - ≥ 2 điểm → render SVG sparkline (polyline + fill gradient + dots)
```

---

### Thuật toán Streak

Hàm `computeStreaks(completedAtDates)` trong `progress.service.ts`:

```
1. Lấy danh sách ngày ĐỘC NHẤT (UTC date "yyyy-mm-dd") từ tất cả completedAt
2. Sắp xếp GIẢM DẦN: ['2026-07-04', '2026-07-03', '2026-07-01', ...]
3. Tính currentStreak:
   - Chỉ đếm nếu ngày đầu tiên là HÔM NAY hoặc HÔM QUA
     (cho phép user nghỉ 1 ngày mà không mất streak)
   - Đếm liên tiếp ngược về quá khứ (diff = 1 ngày → tiếp tục)
4. Tính bestStreak:
   - Quét toàn bộ lịch sử ngày
   - Chuỗi dài nhất liên tiếp
```

Ví dụ: ngày ôn `[04, 03, 02]` → `currentStreak = 3`, `bestStreak = 3`
Ví dụ: ngày ôn `[04, 02, 01]` → `currentStreak = 1`, `bestStreak = 2`

---

### Cấu trúc file

```
backend/
└── src/
    ├── services/
    │   └── progress/
    │       ├── progress.types.ts    ProgressOverview, MonthStats, MonthComparison,
    │       │                        ScoreTrendPoint, ProgressSummary,
    │       │                        ExamHistoryItem, PaginatedExamHistory
    │       └── progress.service.ts  progressService:
    │                                ├─ getSummary(userId)   → ProgressSummary
    │                                └─ getExamHistory(userId, limit, offset)
    │                                                        → PaginatedExamHistory
    │
    ├── routes/
    │   └── progress.route.ts        GET /api/progress/summary
    │                                GET /api/progress/exam-history
    │
    ├── scripts/
    │   └── smoke-test-progress.ts   4 bài test: getSummary có data, getSummary rỗng,
    │                                getExamHistory phân trang, streak liên tiếp
    │
    └── app.ts                       Thêm progressRouter → /api/progress

frontend/
└── src/
    ├── lib/api.ts    Thêm interfaces ProgressSummary, ExamHistoryItem, PaginatedExamHistory;
    │                 hàm getProgressSummary(), getExamHistory()
    └── App.tsx       Screen type thêm 'progress'; ProfilePage: nút "📊 Tiến độ của tôi";
                      ProgressPage (mới): 4 ô tổng quan, so sánh tháng, bảng theo môn,
                      sparkline xu hướng, lịch sử thi phân trang; ScoreSparkline component
```

---

### Cách tự kiểm thử (manual test)

**1. Smoke test tự động (không cần server chạy):**
```bash
cd backend
npx tsx src/scripts/smoke-test-progress.ts
# Kỳ vọng: 4 test PASS — getSummary có data, getSummary rỗng,
#           getExamHistory phân trang, streak liên tiếp
```

**2. Kiểm tra qua curl (cần session token hợp lệ):**
```bash
# Lấy summary tiến độ
curl http://localhost:4000/api/progress/summary \
  -H "Authorization: Bearer <session-token>"
# Kỳ vọng: 200 + { overview, bestStreak, monthComparison, practiceStatsBySubject, scoreTrend }

# Lấy lịch sử thi thử
curl "http://localhost:4000/api/progress/exam-history?limit=10&offset=0" \
  -H "Authorization: Bearer <session-token>"
# Kỳ vọng: 200 + { items, total, limit, offset }

# Không có token → 401
curl http://localhost:4000/api/progress/summary
# Kỳ vọng: { error: "MISSING_AUTH_TOKEN" }
```

**3. Kiểm tra giao diện:**
- Đăng nhập, từ màn hình Profile → nhấn "📊 Tiến độ của tôi"
- Kiểm tra: 4 ô số tổng quan hiển thị đúng, streak có 🔥
- Kiểm tra: user chưa ôn lần nào → mọi số đều là 0, biểu đồ hiện "Chưa đủ dữ liệu"
- Kiểm tra: bảng lịch sử thi phân trang đúng khi có > 10 lần thi

---

### Lưu ý / rủi ro / TODO tiếp theo

- **Streak tính theo UTC** — user ở múi giờ UTC+7 làm bài lúc 11:00 PM local
  (tức 16:00 UTC ngày hôm trước) có thể bị coi là "hôm qua". Ảnh hưởng nhỏ,
  chấp nhận được ở giai đoạn hiện tại.
- **Không có cache** — `getSummary` chạy 9 query mỗi lần load. Với quy mô hiện tại
  (học sinh THPT, vài trăm user) hoàn toàn ổn. Khi mở rộng, cân nhắc cache Redis
  với TTL 5 phút.
- **scoreTrend chỉ từ Practice** — xu hướng điểm hiện chỉ lấy từ `practice_sessions`,
  không bao gồm điểm thi thử. Có thể bổ sung sau.
- TODO: Thêm filter theo môn cho `scoreTrend` và `practiceStatsBySubject`.
- TODO: Export báo cáo tiến độ ra PDF/CSV.

---

## 10. Wrong Answer Review – Ôn câu sai

**Trạng thái:** ✅ Hoàn thành
**Ngày hoàn thành:** 2026-07-05
**Branch / commit liên quan:** `feature/wrong-answer-review`

---

### Tổng quan

Module Ôn câu sai tự động thu thập mọi câu trả lời **sai** từ cả hai chế độ
(Ôn tập và Thi thử), lưu vào bảng riêng với TTL 14 ngày, và cho phép người dùng
ôn lại từng câu trực tiếp trên giao diện. Mục tiêu: giúp học sinh tập trung
vào điểm yếu, không bỏ lọt câu đã sai.

**Tính năng chính:**
- **Ghi nhận tự động**: Practice service và Exam service đều gọi `upsertWrongAnswer`
  ngay sau khi nhận biết câu sai (fire-and-forget, không block response).
- **Upsert thông minh**: nếu cùng câu bị sai lần nữa → `wrongCount` tăng, `expiresAt`
  reset thêm 14 ngày (không tạo bản ghi trùng lặp).
- **Danh sách có thể lọc**: lọc theo môn học, phân trang (mặc định 20/trang, tối đa 50).
- **Làm lại (retry)**: hỗ trợ cả 3 dạng câu hỏi (MCQ_4, TRUE_FALSE_4, FILL_BLANK) —
  kiểm tra đáp án và trả kết quả ngay, **không ghi điểm, không xóa khỏi danh sách**.
- **Tự động hết hạn**: bản ghi `expiresAt < NOW()` bị bỏ qua khi query, không cần
  cronjob xóa.
- **Câu bị ẩn/xóa**: câu `isActive = false` hoặc bị hard-delete (FK = NULL) tự động
  không hiển thị — không cần xử lý đặc biệt phía FE.

---

### Phương án kỹ thuật được lựa chọn và lý do

#### 1. Bảng `wrong_answers` riêng, không query từ answer history

**Vấn đề:** Tìm câu sai từ bảng `practice_answers` + `exam_answers` mỗi lần query sẽ rất tốn kém (join nhiều bảng, filter sai).

**Phương án đã chọn:** Bảng `wrong_answers` riêng. Service ghi vào đây ngay khi phát hiện câu sai (fire-and-forget).

**Lý do:** Query danh sách câu sai O(1) lookup thay vì O(n) scan qua toàn bộ lịch sử. Dễ thêm metadata như `wrongCount`, `expiresAt` mà không ảnh hưởng bảng gốc.

#### 2. TTL 14 ngày và lazy expiration (không cron job xóa)

**Vấn đề:** Câu sai cũ không còn giá trị ôn tập sau một thời gian.

**Phương án đã chọn:** Mỗi bản ghi có `expiresAt = now + 14 ngày`. Query luôn thêm `WHERE expiresAt > NOW()`. Không có cron job xóa.

**Lý do:** Đơn giản, không cần background job. Bản ghi hết hạn vẫn còn trong DB (không chiếm nhiều dung lượng) nhưng vô hình với người dùng. Nếu cùng câu bị sai lần nữa: `expiresAt` reset → câu "sống lại" tự nhiên.

#### 3. Upsert, không insert — tránh duplicate

**Vấn đề:** Học sinh sai cùng 1 câu nhiều lần → không muốn nhiều bản ghi cho cùng 1 câu.

**Phương án đã chọn:** `upsert` với `(userId, questionId)` hoặc `(userId, examQuestionId)` làm unique key. Nếu đã có → tăng `wrongCount` và reset `expiresAt`.

**Lý do:** 1 bản ghi / câu / user — dễ quản lý, dễ query. `wrongCount` là metadata hữu ích (biết câu nào sai nhiều nhất để ưu tiên ôn).

#### 4. Fire-and-forget khi ghi wrong answers

**Vấn đề:** Ghi vào `wrong_answers` không nên làm chậm response chính (nộp bài, hoàn thành phiên).

**Phương án đã chọn:** `void wrongAnswerService.upsertWrongAnswer(...)` — không `await`. Lỗi ghi wrong_answers không ảnh hưởng response chính.

**Lý do:** UX ưu tiên: học sinh thấy kết quả nhanh nhất có thể. Mất 1 bản ghi wrong_answer (nếu ghi lỗi) ít ảnh hưởng hơn là response chậm 100ms.

---

### Data Model

#### Bảng `wrong_answers`

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `id` | SERIAL (Int) | Primary key — tự tăng (dùng `id` số để gọi retry) |
| `userId` | String | ID user (FK → `users.id`, ON DELETE CASCADE) |
| `questionId` | String? | FK → `questions.id` (câu từ Ôn tập); NULL nếu từ Thi thử |
| `examQuestionId` | String? | FK → `exam_questions.id` (câu từ Thi thử); NULL nếu từ Ôn tập |
| `wrongCount` | Int | Số lần sai cộng dồn (bắt đầu từ 1) |
| `lastWrongAt` | DateTime | Thời điểm sai gần nhất |
| `expiresAt` | DateTime | Thời điểm hết hạn = `lastWrongAt + 14 ngày` |

**Ràng buộc:**
- `UNIQUE(userId, questionId)` — mỗi user một bản ghi mỗi câu Ôn tập
- `UNIQUE(userId, examQuestionId)` — mỗi user một bản ghi mỗi câu Thi thử
- `INDEX(userId, expiresAt)` — tăng tốc query chính: lấy câu sai chưa hết hạn

**Quy tắc FK:**
- `questionId` ON DELETE **SET NULL** → câu bị hard-delete: FK → null, bản ghi còn nhưng không hiện trong list
- `examQuestionId` ON DELETE **SET NULL** → tương tự
- `userId` ON DELETE **CASCADE** → xóa user thì xóa toàn bộ câu sai của user đó

---

### API Reference

#### GET /api/wrong-answers

**Auth:** `verifyAppToken` (cần session token)

**Mô tả:** Lấy danh sách câu sai còn hạn (chưa quá 14 ngày kể từ lần sai gần nhất).
Câu đã bị soft-delete (`isActive = false`) hoặc câu hỏi không còn tồn tại sẽ bị bỏ qua.

**Query params:**

| Param | Kiểu | Mặc định | Mô tả |
|-------|------|---------|-------|
| `subjectId` | string | — | Lọc theo mã môn (TOAN, VAN, ...) |
| `page` | number | 1 | Trang hiện tại (≥ 1) |
| `pageSize` | number | 20 | Số bản ghi mỗi trang (clamp: 1–50) |

**Luồng xử lý:**
```
verifyAppToken → req.currentUser.id
    │
    └─ wrongAnswerService.getWrongAnswers(userId, subjectId?, page, pageSize)
         │
         ├─ prisma.wrongAnswer.findMany({ WHERE userId=? AND expiresAt>NOW(),
         │   INCLUDE question, examQuestion, ORDER BY lastWrongAt DESC })
         │
         ├─ Lấy subject của exam questions qua batch query ExamPaper
         │
         ├─ Chuẩn hóa từng bản ghi thành WrongAnswerListItem:
         │   ├─ question != null → source='practice', type='MCQ_4'
         │   ├─ examQuestion != null → source='exam', type=questionType
         │   └─ Bỏ qua nếu isActive=false hoặc cả hai FK đều null
         │
         ├─ Filter theo subjectId (nếu có)
         └─ Paginate trong bộ nhớ: slice(skip, skip+pageSize)
```

**Response thành công (200):**
```json
{
  "data": [
    {
      "id": 42,
      "wrongCount": 3,
      "lastWrongAt": "2026-07-04T10:00:00.000Z",
      "expiresAt": "2026-07-18T10:00:00.000Z",
      "source": "practice",
      "question": {
        "id": "q-uuid-1",
        "content": "Tập xác định của hàm số y = √(x−1) là?",
        "type": "MCQ_4",
        "subjectId": "TOAN",
        "options": ["[1;+∞)", "(1;+∞)", "[-1;+∞)", "(-∞;1]"],
        "correctAnswer": 0,
        "explanation": "Điều kiện: x−1 ≥ 0 ⟺ x ≥ 1 → TXĐ: [1;+∞)"
      }
    },
    {
      "id": 55,
      "wrongCount": 1,
      "lastWrongAt": "2026-07-03T14:30:00.000Z",
      "expiresAt": "2026-07-17T14:30:00.000Z",
      "source": "exam",
      "question": {
        "id": "eq-uuid-1",
        "content": "Cho các phát biểu sau về kim loại kiềm...",
        "type": "TRUE_FALSE_4",
        "subjectId": "HOA",
        "options": ["Phát biểu A", "Phát biểu B", "Phát biểu C", "Phát biểu D"],
        "correctAnswer": [true, false, true, false],
        "explanation": null
      }
    }
  ],
  "total": 8,
  "page": 1,
  "pageSize": 20
}
```

**Lỗi có thể xảy ra:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 401 | `MISSING_AUTH_TOKEN` | Không có Authorization header |
| 401 | `INVALID_SESSION_TOKEN` | Token hết hạn hoặc sai |
| 401 | `SESSION_USER_NOT_FOUND` | Tài khoản đã bị xóa |

---

#### POST /api/wrong-answers/:id/retry

**Auth:** `verifyAppToken`

**Mô tả:** Làm lại một câu sai. `id` là ID của bản ghi `WrongAnswer` (số nguyên,
trả về trong `GET /api/wrong-answers`). **Không ghi điểm, không xóa khỏi danh sách.**

**Path param:** `:id` — số nguyên (ID bản ghi WrongAnswer)

**Request body:**
```json
{ "answer": <đáp án tùy theo loại câu> }
```

| Loại câu | Kiểu `answer` | Ví dụ |
|----------|--------------|-------|
| MCQ_4 | `number` (0–3) | `{ "answer": 2 }` |
| TRUE_FALSE_4 | `boolean[]` (4 phần tử) | `{ "answer": [true, false, true, false] }` |
| FILL_BLANK | `string` | `{ "answer": "Hà Nội" }` |

**Luồng xử lý:**
```
verifyAppToken → req.currentUser.id
    │
    ├─ Validate: id phải là số nguyên, body.answer phải tồn tại
    │
    └─ wrongAnswerService.retryQuestion(userId, id, answer)
         │
         ├─ prisma.wrongAnswer.findUnique({ id, INCLUDE question, examQuestion })
         │
         ├─ Kiểm tra: bản ghi tồn tại + userId khớp + expiresAt > NOW()
         │   └─ Sai bất kỳ điều kiện → WrongAnswerNotFoundError (404)
         │
         ├─ question != null (Practice MCQ_4):
         │   └─ isCorrect = (typeof answer === 'number' && answer === correctAnswer)
         │
         ├─ examQuestion != null (Exam):
         │   └─ checkExamAnswer(questionType, correctAnswer, answer)
         │       ├─ MCQ_4: so sánh số nguyên
         │       ├─ TRUE_FALSE_4: so sánh từng phần tử mảng 4 boolean
         │       └─ FILL_BLANK: normalizeAnswer → kiểm tra trong danh sách đáp án
         │
         └─ cả hai FK null → WrongAnswerNotFoundError (404)
```

**Response thành công (200):**
```json
{
  "isCorrect": true,
  "correctAnswer": 0,
  "explanation": "Điều kiện: x−1 ≥ 0 ⟺ x ≥ 1 → TXĐ: [1;+∞)"
}
```

Ví dụ khi sai:
```json
{
  "isCorrect": false,
  "correctAnswer": [true, false, true, false],
  "explanation": null
}
```

**Lỗi có thể xảy ra:**

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 401 | `MISSING_AUTH_TOKEN` | Không có Authorization header |
| 401 | `INVALID_SESSION_TOKEN` | Token hết hạn hoặc sai |
| 400 | `INVALID_REQUEST_BODY` | `id` không phải số nguyên hoặc thiếu `body.answer` |
| 404 | `WRONG_ANSWER_NOT_FOUND` | id không tồn tại, thuộc user khác, hoặc đã hết hạn |

---

### Luồng chạy (Flow)

#### Luồng ghi nhận câu sai — từ Practice

```
[PracticeService.submitAnswer()]
    │
    ├─ Chấm đáp án → isCorrect = false
    │
    └─ fire-and-forget (không block response):
         wrongAnswerService.upsertWrongAnswer(userId, questionId, 'practice')
              │
              ├─ [Đã có bản ghi (userId, questionId)]:
              │   UPDATE: wrongCount += 1, lastWrongAt = now(), expiresAt = now()+14d
              │
              └─ [Chưa có]:
                  INSERT: wrongCount=1, lastWrongAt=now(), expiresAt=now()+14d
```

#### Luồng ghi nhận câu sai — từ Exam

```
[ExamService.submitExam()]
    │
    ├─ Transaction: chấm điểm, cập nhật ExamSession, cộng điểm
    │
    └─ Sau khi transaction commit thành công:
         fire-and-forget (Promise.all cho tất cả câu sai):
              wrongAnswerService.upsertWrongAnswer(userId, examQuestionId, 'exam')
              (cùng logic upsert như trên)
```

#### Luồng người dùng ôn câu sai — FE

```
[FE] Từ ProfilePage → nhấn nút "Ôn câu sai"
        │
        ▼
[FE] WrongAnswersPage mount
        │
        ├─ GET /api/wrong-answers?page=1&pageSize=20
        │   → Hiện spinner → nhận data → render danh sách WrongAnswerCard
        │
        ├─ [User lọc theo môn]: set subjectFilter → GET lại với ?subjectId=TOAN
        │
        └─ [User nhấn "Làm lại" trên WrongAnswerCard]:
               WrongAnswerRetry component mount
                    │
                    ├─ User chọn đáp án (MCQ_4: radio button | TRUE_FALSE_4: toggles | FILL_BLANK: input)
                    │
                    ├─ POST /api/wrong-answers/:id/retry { answer: ... }
                    │
                    └─ Hiện kết quả: ✅ Đúng / ❌ Sai + correctAnswer + explanation
```

---

### Cấu trúc file

```
backend/
├── prisma/
│   ├── schema.prisma                                     Model WrongAnswer (mới)
│   └── migrations/
│       └── 20260704154329_add_wrong_answer_table/        Migration tạo bảng wrong_answers
│
└── src/
    ├── services/
    │   └── wrongAnswer/
    │       ├── wrongAnswer.types.ts    WrongAnswerSource, WrongAnswerQuestionDetail,
    │       │                          WrongAnswerListItem, WrongAnswerListResponse,
    │       │                          RetryResult, ExamQuestionType
    │       ├── wrongAnswer.errors.ts  WrongAnswerNotFoundError (code: WRONG_ANSWER_NOT_FOUND)
    │       ├── wrongAnswer.service.ts WrongAnswerService:
    │       │                          ├─ upsertWrongAnswer(userId, questionId, source)
    │       │                          ├─ getWrongAnswers(userId, subjectId?, page, pageSize)
    │       │                          └─ retryQuestion(userId, id, answer)
    │       └── __tests__/
    │           └── wrongAnswer.service.test.ts  Unit tests (Vitest, mock Prisma)
    │
    ├── routes/
    │   └── wrongAnswer.route.ts       GET /api/wrong-answers
    │                                  POST /api/wrong-answers/:id/retry
    │
    └── app.ts                         Thêm wrongAnswerRouter → /api/wrong-answers
                                       Thêm WRONG_ANSWER_NOT_FOUND vào ERROR_CODE_TO_HTTP_STATUS

frontend/
└── src/
    ├── lib/api.ts    Thêm WrongAnswerQuestionType, WrongAnswerQuestion, WrongAnswerItem,
    │                 WrongAnswerListResponse, RetryResult;
    │                 hàm getWrongAnswers(), retryWrongAnswer()
    └── App.tsx       Screen type thêm 'wrongAnswers'; ProfilePage: nút "Ôn câu sai";
                      WrongAnswersPage (mới): filter môn, phân trang, WrongAnswerCard,
                      WrongAnswerRetry component (hỗ trợ MCQ_4/TRUE_FALSE_4/FILL_BLANK)
```

---

### Ghi chú kỹ thuật

1. **[Bug fix — CRITICAL] upsertWrongAnswer phải gọi NGOÀI transaction**:
   Phiên bản đầu của `exam.service.ts` gọi `upsertWrongAnswer` bên trong callback
   `$transaction` bằng `void`. Vấn đề: khi Prisma retry transaction do optimistic lock,
   callback chạy lại nhiều lần → `wrongCount` bị cộng thêm mỗi lần retry thay vì
   chỉ 1 lần sau commit thực sự. Fix: collect danh sách `wrongIds` bên trong
   transaction, return ra ngoài, gọi `upsertWrongAnswer` sau khi `await $transaction`
   thành công — đảm bảo chỉ chạy đúng 1 lần dù transaction có retry bao nhiêu lần.

2. **[Bug fix — INDEX] Thêm @@index([userId, expiresAt])**:
   Query chính của `getWrongAnswers` là `WHERE userId=? AND expiresAt>NOW()`.
   Không có index trên cặp này → full table scan mỗi lần user mở màn hình ôn câu sai.
   Fix: thêm `@@index([userId, expiresAt])` vào schema Prisma và `CREATE INDEX` tương
   ứng vào migration SQL. Query hiện chạy với index scan thay vì seq scan.

3. **[Bug fix — LINT] Tách handler `handleSubjectChange` ở FE**:
   Phiên bản đầu gọi `setPage(1)` bên trong `useEffect` body (trong vòng lặp effect)
   vi phạm ESLint rule `react-hooks/set-state-in-effect`. Fix: tách thành handler
   `handleSubjectChange` — khi user đổi môn, event handler gọi `setPage(1)` và
   `fetchData()` trực tiếp; `useEffect` chỉ chịu trách nhiệm load lần đầu.

4. **Unit test với Vitest (framework mới)**:
   Module này là module đầu tiên trong dự án có unit test chính thức bằng
   **Vitest** (cài mới, không có từ trước). Vitest mock hoàn toàn Prisma client —
   không cần DB thật để chạy test. Script: `npm run test` hoặc
   `npx vitest run`. 18 test cases / 18 PASS bao gồm 3 nhóm: `upsertWrongAnswer`,
   `retryQuestion`, `getWrongAnswers`.

5. **Fire-and-forget cho upsert**: `upsertWrongAnswer` được gọi bằng `void ...catch(...)`
   ngoài transaction chính — lỗi ghi câu sai (VD: DB tạm thời quá tải) sẽ chỉ được
   log ra console, không làm fail response của submitAnswer/submitExam. Thiết kế này
   ưu tiên UX (người dùng vẫn nhận kết quả thi) hơn tính toàn vẹn tuyệt đối của
   danh sách câu sai.

6. **Pagination trong bộ nhớ (in-memory)**: `getWrongAnswers` load toàn bộ bản ghi
   chưa hết hạn rồi filter và paginate trong code. Chấp nhận được vì mỗi user có
   tối đa vài trăm câu sai (TTL 14 ngày tự làm sạch). Subject của `ExamQuestion`
   phải JOIN qua `ExamPaper` — khó paginate hiệu quả ở tầng DB với subject filter.

7. **ID kiểu Int (SERIAL) thay vì UUID**: bảng `wrong_answers` dùng `id SERIAL`
   vì đây là endpoint nội bộ (người dùng gọi retry bằng `id` nhận từ GET list),
   không cần UUID ngẫu nhiên để tránh đoán.

8. **`expiresAt` reset mỗi lần sai**: nếu học sinh vẫn sai câu trong vòng 14 ngày,
   TTL tự động gia hạn thêm 14 ngày — câu vẫn còn trong danh sách ôn.

9. **normalizeAnswer tái dụng**: `retryQuestion` gọi hàm `normalizeAnswer` từ
   `exam.service.ts` để so khớp FILL_BLANK (trim + lowercase + collapse spaces) —
   nhất quán với logic chấm điểm gốc của module Thi thử.

10. **ERROR_CODE_TO_HTTP_STATUS**: `WRONG_ANSWER_NOT_FOUND` → 404 được đăng ký
    tập trung tại `app.ts`, nhất quán với cách xử lý lỗi toàn app.

---

### Cách tự kiểm thử (manual test)

**1. Unit test tự động — Vitest (không cần DB, mock Prisma):**
```bash
cd backend
npm run test
# hoặc chạy file cụ thể:
npx vitest run src/services/wrongAnswer/__tests__/wrongAnswer.service.test.ts
# Kỳ vọng: 18/18 PASS
# Nhóm test:
#   upsertWrongAnswer — practice/exam key đúng, expiresAt = +14d
#   retryQuestion     — MCQ_4, TRUE_FALSE_4, FILL_BLANK (normalize),
#                       lỗi: not-found, userId mismatch, expired, hard-delete (FK null)
#   getWrongAnswers   — rỗng, soft-delete bị bỏ qua, filter môn, pagination trang 2
```

**2. Kiểm tra qua curl (cần session token hợp lệ):**
```bash
# Lấy danh sách câu sai
curl http://localhost:4000/api/wrong-answers \
  -H "Authorization: Bearer <session-token>"
# Kỳ vọng: 200 + { data: [...], total: N, page: 1, pageSize: 20 }

# Lọc theo môn Toán
curl "http://localhost:4000/api/wrong-answers?subjectId=TOAN&page=1&pageSize=10" \
  -H "Authorization: Bearer <session-token>"
# Kỳ vọng: chỉ câu sai của môn TOAN

# Làm lại câu sai MCQ_4 (id=42, chọn đáp án 0)
curl -X POST http://localhost:4000/api/wrong-answers/42/retry \
  -H "Authorization: Bearer <session-token>" \
  -H "Content-Type: application/json" \
  -d '{"answer": 0}'
# Kỳ vọng: 200 + { isCorrect: true/false, correctAnswer: N, explanation: "..." }

# id không phải số → 400
curl -X POST http://localhost:4000/api/wrong-answers/abc/retry \
  -H "Authorization: Bearer <session-token>" \
  -d '{"answer": 0}'
# Kỳ vọng: 400 + { error: "INVALID_REQUEST_BODY" }

# id không tồn tại → 404
curl -X POST http://localhost:4000/api/wrong-answers/99999/retry \
  -H "Authorization: Bearer <session-token>" \
  -d '{"answer": 0}'
# Kỳ vọng: 404 + { error: "WRONG_ANSWER_NOT_FOUND" }

# Không có token → 401
curl http://localhost:4000/api/wrong-answers
# Kỳ vọng: { error: "MISSING_AUTH_TOKEN" }
```

**3. Kiểm tra tích hợp end-to-end:**
1. Làm phiên ôn tập, cố tình chọn sai một câu → vào WrongAnswersPage kiểm tra
   câu đó xuất hiện với `source: 'practice'`
2. Thi thử, cố tình sai vài câu → submit → vào WrongAnswersPage kiểm tra
   câu đó với `source: 'exam'`
3. Nhấn "Làm lại" → chọn đáp án đúng → kỳ vọng hiện `✅ Đúng rồi!`
4. Câu vẫn còn trong danh sách sau khi làm đúng (không tự xóa)
5. Lọc theo môn → kỳ vọng chỉ hiện câu đúng môn đó

---

### Lưu ý / rủi ro / TODO tiếp theo

- **Không có cronjob dọn dẹp**: bản ghi hết hạn không bị xóa vật lý — chỉ bị
  bỏ qua khi query. Theo thời gian bảng sẽ tích lũy dữ liệu cũ. Cân nhắc thêm
  cronjob hàng tuần `DELETE FROM wrong_answers WHERE expiresAt < NOW()`.
- **Pagination trong bộ nhớ**: nếu user có >1000 câu sai chưa hết hạn (trường hợp
  cực đoan), query có thể nặng. Cải thiện: thêm `WHERE subject = ?` trực tiếp vào
  DB query sau khi JOIN `ExamPaper` hoặc lưu `subjectId` thẳng vào `wrong_answers`.
- **Chưa có chức năng "xóa câu sai"**: học sinh không thể chủ động xóa bản ghi
  trước hạn — cần thêm `DELETE /api/wrong-answers/:id` nếu có nhu cầu.
- **Chưa tracking "đã ôn lại"**: sau khi retry đúng, câu vẫn còn trong danh sách.
  Có thể thêm trường `retriedAt` hoặc `masteredAt` để thống kê mức độ tiến bộ.
- TODO: Thêm smoke test tích hợp (cần DB thật) kiểm tra luồng end-to-end.
- TODO: Lưu `subjectId` thẳng vào bảng `wrong_answers` để tối ưu query filter theo môn.

---

## 8. Admin User Management + Dashboard — Quản lý người dùng & Bảng tổng quan

**Trạng thái:** ✅ Hoàn thành
**Ngày hoàn thành:** 2026-07-05
**Branch / commit liên quan:** `feature/admin-user-management`

---

### Tổng quan

Module này bổ sung 2 tab mới cho trang Admin Dashboard (`/#admin`), cho phép quản
trị viên theo dõi hoạt động hệ thống và quản lý toàn bộ tài khoản người dùng mà
không cần truy cập trực tiếp vào DB hay dùng Prisma Studio.

**Tab Dashboard (📊):** Hiển thị 6 chỉ số thời gian thực — tổng user, user mới
tuần/tháng, tổng phiên thi, tỷ lệ đậu, và số user đang online ngay lúc đó.

**Tab Người dùng (👥):** Danh sách đầy đủ người dùng với tìm kiếm (theo tên/email),
lọc (theo role, trạng thái khoá), phân trang. Click vào từng user để xem chi tiết
(thông tin cá nhân, thống kê học tập, 5 kỳ thi gần nhất) và thực hiện các hành động
quản trị: khoá/mở khoá tài khoản, đặt lại mật khẩu, thay đổi quyền (STUDENT/ADMIN),
xóa tài khoản.

**Tác động bảo mật:** Khi tài khoản bị khoá (`isBlocked=true`), mọi API call có
xác thực của user đó trả về lỗi `403 USER_BLOCKED` ngay lập tức (middleware
`verifyAppToken` kiểm tra trước khi xử lý nghiệp vụ).

---

### Phương án kỹ thuật được lựa chọn và lý do

#### 1. isBlocked check trong middleware, không trong từng route

**Vấn đề:** Khoá tài khoản phải có tác dụng tức thì trên mọi endpoint.

**Phương án đã chọn:** Thêm `isBlocked` check vào `verifyAppToken` middleware — chạy trước mọi request có xác thực.

**Lý do:** Middleware là điểm kiểm soát trung tâm. Không cần nhớ thêm check vào từng route/service mới. Đảm bảo không route nào "lọt" qua dù dev mới thêm.

#### 2. Xóa account: Hard delete + CASCADE

**Vấn đề:** Xóa user phải xóa tất cả dữ liệu liên quan (phiên, đáp án, điểm, avatar) nhưng không muốn viết nhiều query riêng.

**Phương án đã chọn:** FK constraint `ON DELETE CASCADE` trên tất cả bảng có `userId`. Xóa 1 lệnh `DELETE FROM users WHERE id = ?` → PostgreSQL tự dọn sạch.

**Lý do:** DB đảm bảo toàn vẹn, không cần transaction phức tạp. Không thể bỏ sót bảng nào.

#### 3. "Đang online" dùng Redis SET, không query DB

**Vấn đề:** Đếm user đang online không thể query từ DB vì không có bảng session server-side.

**Phương án đã chọn:** Mỗi lần user gọi API có xác thực → middleware ghi `SADD online_users <userId>` vào Redis SET (TTL 5 phút, fire-and-forget). `GET /api/admin/dashboard` đọc `SCARD online_users`.

**Lý do:** Redis SET tự động deduplicate (cùng userId gọi nhiều lần chỉ tính 1). TTL 5 phút phản ánh "đang hoạt động". Fire-and-forget không làm chậm request chính.

---

### Data Model

**Thay đổi bảng `users`** (migration: `20260705120000_add_user_isblocked_role`):

| Field | Kiểu | Mô tả |
|-------|------|-------|
| `isBlocked` | `Boolean DEFAULT false` | Trạng thái khoá tài khoản |
| `role` | `String DEFAULT 'STUDENT'` | Quyền hạn: `'STUDENT'` hoặc `'ADMIN'` |

Index mới:
- `users_isBlocked_idx` trên cột `isBlocked` (tối ưu filter danh sách user bị khoá)
- `users_role_idx` trên cột `role` (tối ưu filter danh sách admin)

**Tracking online user (Redis):** Không tạo bảng mới. Mỗi khi `verifyAppToken`
thành công, hệ thống ghi:
```
SET online:{userId} 1 EX 300
```
TTL = 300 giây (5 phút). Đếm online bằng SCAN `online:*`.

---

### API Reference

**Auth:** Tất cả endpoint yêu cầu header `X-Admin-Secret: <ADMIN_SECRET>`.

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/admin/dashboard` | 6 chỉ số tổng quan hệ thống |
| GET | `/api/admin/users` | Danh sách user (search/filter/phân trang) |
| GET | `/api/admin/users/:id` | Chi tiết user + stats + 5 kỳ thi gần nhất |
| PATCH | `/api/admin/users/:id/block` | Khoá hoặc mở khoá tài khoản |
| POST | `/api/admin/users/:id/reset-password` | Tạo link đặt lại mật khẩu qua Firebase |
| PATCH | `/api/admin/users/:id/role` | Đổi quyền STUDENT ↔ ADMIN |
| DELETE | `/api/admin/users/:id` | Xóa tài khoản (Firebase + DB) |

---

#### GET /api/admin/dashboard

**Mô tả:** Chạy 6 query song song (Promise.all) để trả về thống kê hệ thống.
Số "online" được đếm bằng Redis SCAN cursor-based (tránh dùng KEYS).

**Response (200):**
```json
{
  "totalUsers": 1250,
  "newUsersThisWeek": 38,
  "newUsersThisMonth": 142,
  "totalExamSessions": 4870,
  "examPassRate": 61.4,
  "onlineNow": 23
}
```

**Luồng xử lý:**
```
GET /api/admin/dashboard
  └─ verifyAdminSecret
  └─ getDashboardStats()
       ├─ Promise.all:
       │   ├─ prisma.user.count()
       │   ├─ prisma.user.count({ createdAt >= 7 ngày trước })
       │   ├─ prisma.user.count({ createdAt >= 30 ngày trước })
       │   ├─ prisma.examSession.count({ status: 'COMPLETED' })
       │   ├─ prisma.examSession.count({ status: 'COMPLETED', score >= 7.0 })
       │   └─ countOnlineUsers()  ← Redis SCAN cursor loop
       └─ Tính examPassRate = round(passed/total * 100, 1)
       └─ Trả DashboardStats
```

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 401 | `ADMIN_UNAUTHORIZED` | Thiếu/sai X-Admin-Secret |

---

#### GET /api/admin/users

**Query parameters:**

| Param | Kiểu | Mô tả |
|-------|------|-------|
| `search` | string? | Tìm theo `displayName` hoặc `email` (ILIKE, không phân biệt hoa thường) |
| `role` | `'STUDENT' \| 'ADMIN'`? | Lọc theo quyền |
| `isBlocked` | `'true' \| 'false'`? | Lọc theo trạng thái khoá |
| `page` | number (mặc định 1) | Số trang |
| `limit` | number (mặc định 20) | Số user/trang |

**Response (200):**
```json
{
  "users": [
    {
      "id": "uuid",
      "displayName": "Nguyễn Văn A",
      "email": "a@example.com",
      "role": "STUDENT",
      "isBlocked": false,
      "createdAt": "2026-06-10T08:00:00.000Z",
      "lastLoginAt": "2026-07-04T15:30:00.000Z",
      "avatarUrl": null
    }
  ],
  "total": 1250,
  "page": 1,
  "totalPages": 63
}
```

> **Lưu ý:** `totalPages` tối thiểu là 1 dù không có kết quả — tránh frontend
> bị nhầm lẫn với `totalPages = 0`.

**Luồng xử lý:**
```
GET /api/admin/users?search=nguyen&role=STUDENT&page=2
  └─ verifyAdminSecret
  └─ Parse + validate query params
  └─ listUsers({ search, role, isBlocked, page, limit })
       ├─ Xây where động:
       │   search → OR [displayName ILIKE, email ILIKE]
       │   role   → { role }
       │   isBlocked → { isBlocked: boolean }
       ├─ Promise.all: findMany(skip, take, orderBy createdAt desc) + count(where)
       └─ Trả AdminUserListResult
```

---

#### GET /api/admin/users/:id

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "displayName": "Trần Thị B",
    "email": "b@example.com",
    "phone": "0912345678",
    "school": "THPT Chu Văn An",
    "province": "Hà Nội",
    "role": "STUDENT",
    "isBlocked": false,
    "createdAt": "2026-06-15T10:00:00.000Z",
    "lastLoginAt": "2026-07-05T09:00:00.000Z",
    "avatarUrl": "http://localhost:4000/uploads/avatars/uuid.jpg",
    "subjects": ["TOAN", "LY", "HOA"]
  },
  "stats": {
    "totalPracticeSessions": 47,
    "totalExamSessions": 12,
    "avgExamScore": 7.8
  },
  "recentExams": [
    {
      "id": "session-uuid",
      "examPaperTitle": "Đề thi thử THPT QG 2024 - Toán Mã đề 101",
      "score": 8.25,
      "status": "COMPLETED",
      "completedAt": "2026-07-04T14:00:00.000Z"
    }
  ]
}
```

**Lưu ý kỹ thuật:** Để tránh N+1 query khi lấy tên đề thi cho 5 phiên thi gần
nhất, service dùng batch query tách biệt:
```
1. Lấy recentExams (chỉ select examPaperId)
2. Lấy Set<examPaperId> unique
3. examPaper.findMany({ where: { id: { in: examPaperIds } } })
4. Tạo Map<id, title> → O(1) lookup
```

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 404 | `ADMIN_USER_NOT_FOUND` | Không tìm thấy user với ID đã cho |

---

#### PATCH /api/admin/users/:id/block

**Request:**
```json
{ "isBlocked": true }
```

**Response (200):**
```json
{ "id": "uuid", "isBlocked": true }
```

**Luồng xử lý:**
```
isBlocked = true  → UPDATE users SET isBlocked=true WHERE id=:id
isBlocked = false → UPDATE users SET isBlocked=false WHERE id=:id
                    + redis.del("online:{userId}")  ← xóa key để tránh hiển thị nhầm
```

**Hiệu lực ngay lập tức:** Sau khi bị khoá, lần gọi API tiếp theo của user đó sẽ
nhận `403 USER_BLOCKED` (do `verifyAppToken` kiểm tra `isBlocked` trong DB mỗi request).

---

#### POST /api/admin/users/:id/reset-password

**Mô tả:** Gọi Firebase Admin SDK `generatePasswordResetLink(email)` để tạo link
đặt lại mật khẩu. Admin nhận link và tự gửi cho người dùng (qua email, chat...).

**Điều kiện:** User phải có `email` (user đăng nhập bằng SĐT sẽ bị lỗi `400`).

**Response (200):**
```json
{
  "resetLink": "https://accounts.google.com/signin/v2/...?oobCode=...&apiKey=..."
}
```

| HTTP | Code | Nguyên nhân |
|------|------|-------------|
| 400 | `ADMIN_USER_NO_EMAIL` | User không có email (đăng nhập bằng SĐT) |
| 404 | `ADMIN_USER_NOT_FOUND` | User không tồn tại |

---

#### PATCH /api/admin/users/:id/role

**Request:**
```json
{ "role": "ADMIN" }
```

**Response (200):**
```json
{ "id": "uuid", "role": "ADMIN" }
```

Giá trị hợp lệ: `"STUDENT"` hoặc `"ADMIN"`. Giá trị khác → `400 ADMIN_INVALID_ROLE`.

---

#### DELETE /api/admin/users/:id

**Mô tả:** Xóa hoàn toàn tài khoản — không thể hoàn tác.

**Chiến lược xóa (Firebase-first):**
```
1. Tìm user trong DB → 404 nếu không có
2. getFirebaseAuth().deleteUser(user.firebaseUid)
   └─ Lỗi Firebase → ném lỗi, dừng (DB không bị thay đổi)
3. prisma.user.delete({ where: { id: userId } })
   └─ Lỗi DB → log lỗi + tiếp tục trả success
   (Firebase user đã mất → user không thể đăng nhập lại dù DB vẫn còn bản ghi)
4. redis.del("online:{userId}")  ← dọn dẹp
```

**Response (200):**
```json
{ "message": "Da xoa tai khoan nguoi dung 'Nguyễn Văn A' thanh cong." }
```

**Cascade delete trong DB:** Bảng `wrong_answers` có `ON DELETE CASCADE` →
toàn bộ câu sai của user bị xóa tự động cùng bản ghi `users`.

---

### Luồng chạy (Flow)

#### Luồng khoá tài khoản người dùng

```
[Admin bấm "Khoá"]
       │
       ▼
PATCH /api/admin/users/:id/block { isBlocked: true }
       │
       ├─ verifyAdminSecret
       ├─ setUserBlocked(id, true)
       │   ├─ prisma.user.update({ isBlocked: true })
       │   └─ (không xóa Redis key khi khoá — key sẽ tự expire sau 5 phút)
       └─ Response 200 { isBlocked: true }
               │
               ▼
[User gọi bất kỳ API nào tiếp theo]
       │
       ▼
verifyAppToken middleware
       ├─ Decode JWT → lấy userId
       ├─ prisma.user.findUnique(userId) → user.isBlocked = true
       ├─ throw UserBlockedError()
       └─ Response 403 { error: "USER_BLOCKED", message: "..." }
```

#### Luồng online tracking

```
[Bất kỳ API nào dùng verifyAppToken]
       │
       ▼
verifyAppToken
       ├─ Validate JWT + load user từ DB
       ├─ Check isBlocked → throw 403 nếu bị khoá
       ├─ redis.set("online:{userId}", "1", "EX", 300)  ← fire-and-forget (catch() {})
       └─ next() → route handler tiếp tục bình thường
```

```
[GET /api/admin/dashboard]
       │
       ▼
countOnlineUsers()
       ├─ cursor = "0"
       ├─ loop: redis.scan(cursor, "MATCH", "online:*", "COUNT", 100)
       │   └─ cộng dồn số key tìm thấy mỗi lần scan
       └─ Khi cursor trở về "0" → trả count
```

---

### File Structure

```
backend/
├── prisma/
│   ├── schema.prisma                   Thêm isBlocked, role + 2 index vào model User
│   └── migrations/
│       └── 20260705120000_add_user_isblocked_role/
│           └── migration.sql           ALTER TABLE users ADD COLUMN isBlocked, role; CREATE INDEX
│
├── src/
│   ├── middleware/
│   │   └── auth.middleware.ts          + check isBlocked → UserBlockedError
│   │                                   + redis.set online:{userId} EX 300 (fire-and-forget)
│   │
│   ├── services/
│   │   ├── auth/
│   │   │   └── auth.errors.ts          + UserBlockedError (code: USER_BLOCKED)
│   │   │
│   │   └── admin-users/               (module mới)
│   │       ├── admin-users.errors.ts   AdminUsersError base + 3 lớp con:
│   │       │                           AdminUserNotFoundError  (ADMIN_USER_NOT_FOUND → 404)
│   │       │                           AdminUserNoEmailError   (ADMIN_USER_NO_EMAIL  → 400)
│   │       │                           AdminInvalidRoleError   (ADMIN_INVALID_ROLE   → 400)
│   │       ├── admin-users.types.ts    VALID_ROLES + 6 interface DTO
│   │       ├── admin-users.service.ts  7 hàm nghiệp vụ (xem bên dưới)
│   │       └── __tests__/
│   │           └── admin-users.service.test.ts  26 unit test (Vitest + mock Prisma/Redis/Firebase)
│   │
│   ├── routes/
│   │   └── admin-users.route.ts        7 endpoint, Zod validation body
│   │
│   └── app.ts                          + 4 error code mới trong ERROR_CODE_TO_HTTP_STATUS
│                                        + register adminUsersRouter tại /api/admin
│
frontend/
├── src/
│   ├── lib/api.ts                      + 4 interface + 7 hàm gọi API admin
│   ├── App.tsx                         + AdminDashboardPage, AdminUsersPage components
│   │                                   + 2 tab button mới (📊 Dashboard, 👥 Người dùng)
│   └── App.css                         + CSS cho dashboard cards, users table, modal, badges
│
docs/
├── api/drafts/admin-user-management.yaml   API contract đầy đủ (do S1 tạo, S3 verify)
├── TEST_CASES.md                           + 30 test case mới (TC-008-*)
└── CODE_REVIEW_LOG.md                      + Entry #008 (2 vấn đề tìm thấy + đã fix)
```

---

### Catalogue lỗi đầy đủ (module admin-users)

| Class | Code | HTTP | Nguyên nhân |
|-------|------|------|-------------|
| `UserBlockedError` | `USER_BLOCKED` | 403 | Tài khoản bị khoá — mọi request của user |
| `AdminUserNotFoundError` | `ADMIN_USER_NOT_FOUND` | 404 | Không tìm thấy user theo ID |
| `AdminUserNoEmailError` | `ADMIN_USER_NO_EMAIL` | 400 | Reset password nhưng user không có email |
| `AdminInvalidRoleError` | `ADMIN_INVALID_ROLE` | 400 | Giá trị role không hợp lệ |

---

### Ghi chú kỹ thuật

1. **Online tracking fire-and-forget:** `redis.set(...)` được gọi không `await`,
   lỗi Redis được `.catch(() => {})` im lặng — tránh gián đoạn luồng xác thực
   khi Redis tạm thời không khả dụng.

2. **SCAN thay vì KEYS:** `KEYS online:*` sẽ block Redis trong O(N) — không dùng
   trong production. Service dùng `SCAN cursor MATCH online:* COUNT 100` để scan
   dần dần, không block. Với vài nghìn user online, vòng lặp SCAN thực thi trong
   vài millisecond.

3. **Xóa Firebase trước khi xóa DB:** Nếu xóa DB trước, Firebase account còn
   lại nhưng không có bản ghi tương ứng → user có thể đăng nhập lại và tạo tài
   khoản mới (gây dữ liệu mồ côi). Chiến lược Firebase-first đảm bảo user không
   thể đăng nhập lại bất kể DB ra sao.

4. **Tác động `isBlocked` lên middleware:** `verifyAppToken` hiện query DB mỗi
   request để load user (đã có từ trước). Thêm kiểm tra `user.isBlocked` không
   tốn thêm query — zero performance overhead.

5. **Tại sao xóa Redis key khi mở khoá:** Khi user bị khoá mà Redis key `online:{id}`
   vẫn còn TTL, Dashboard sẽ đếm nhầm user bị khoá là đang online. Xóa key khi
   mở khoá đảm bảo count chính xác trong vòng 5 phút tiếp theo.

6. **`totalPages = Math.max(1, ...):`** Khi không có kết quả (total=0), `ceil(0/20) = 0`.
   Frontend thường render "Trang 1/0" gây confuse — ép minimum = 1.

---

### Cách tự kiểm thử (manual test)

**1. Unit test tự động:**
```bash
cd backend
npm run test
# Kỳ vọng: 44/44 PASS (18 test cũ + 26 test mới cho adminUsersService)
# Hoặc chạy riêng:
npx vitest run src/services/admin-users/__tests__/admin-users.service.test.ts
# Kỳ vọng: 26/26 PASS
# Nhóm test:
#   getDashboardStats (3)  — all zeros, Redis error, pass rate tính đúng
#   listUsers (4)          — search, filter role, filter isBlocked, pagination
#   getUserDetail (4)      — happy path, not found, no exams, no practice
#   setUserBlocked (4)     — block, unblock (xóa Redis), not found, idempotent
#   resetUserPassword (3)  — happy path, no email, not found
#   setUserRole (4)        — to ADMIN, to STUDENT, invalid role, not found
#   deleteUser (4)         — happy path, DB error (log+continue), not found, Firebase error
```

**2. Kiểm tra API qua curl:**
```bash
# Xem dashboard
curl http://localhost:4000/api/admin/dashboard \
  -H "X-Admin-Secret: your-admin-secret"
# Kỳ vọng: { totalUsers, newUsersThisWeek, ..., onlineNow }

# Danh sách user (có search)
curl "http://localhost:4000/api/admin/users?search=nguyen&page=1" \
  -H "X-Admin-Secret: your-admin-secret"

# Chi tiết user
curl http://localhost:4000/api/admin/users/<userId> \
  -H "X-Admin-Secret: your-admin-secret"

# Khoá tài khoản
curl -X PATCH http://localhost:4000/api/admin/users/<userId>/block \
  -H "X-Admin-Secret: your-admin-secret" \
  -H "Content-Type: application/json" \
  -d '{"isBlocked": true}'
# Kỳ vọng: { id, isBlocked: true }

# Xác nhận khoá có hiệu lực: dùng session token của user đó gọi API bất kỳ
curl http://localhost:4000/api/users/me \
  -H "Authorization: Bearer <user-session-token>"
# Kỳ vọng: 403 { error: "USER_BLOCKED" }

# Đặt lại mật khẩu
curl -X POST http://localhost:4000/api/admin/users/<userId>/reset-password \
  -H "X-Admin-Secret: your-admin-secret"
# Kỳ vọng: { resetLink: "https://accounts.google.com/..." }

# Thay đổi role
curl -X PATCH http://localhost:4000/api/admin/users/<userId>/role \
  -H "X-Admin-Secret: your-admin-secret" \
  -H "Content-Type: application/json" \
  -d '{"role": "ADMIN"}'

# Xóa tài khoản
curl -X DELETE http://localhost:4000/api/admin/users/<userId> \
  -H "X-Admin-Secret: your-admin-secret"
# Kỳ vọng: { message: "Da xoa tai khoan..." }
```

**3. Kiểm tra qua giao diện web:**
1. Mở `http://localhost:5173/#admin`, đăng nhập bằng `ADMIN_SECRET`.
2. Tab 📊 Dashboard → kiểm tra 6 thẻ thống kê hiển thị đúng số.
3. Tab 👥 Người dùng → tìm kiếm theo tên, lọc theo trạng thái khoá.
4. Bấm vào 1 user → modal chi tiết hiển thị stats và 5 kỳ thi gần nhất.
5. Bấm "Khoá" → xác nhận icon và trạng thái thay đổi trên danh sách.
6. Bấm "Reset mật khẩu" → link xuất hiện qua `window.prompt`.
7. Bấm "Xóa tài khoản" → dialog xác nhận trước khi xóa.

---

### Lưu ý / rủi ro / TODO tiếp theo

- **`window.prompt` cho reset link:** Vì Firebase không gửi email tự động qua
  Admin SDK, admin phải copy link từ popup và tự gửi cho user. TODO: Tích hợp
  dịch vụ email (SendGrid / Resend) để tự động gửi nếu cần.
- **Role ADMIN không phân cấp:** Hiện tại chỉ có 2 role `STUDENT` và `ADMIN`.
  Khi cần phân quyền senh hơn (super-admin, moderator...), cần mở rộng hệ thống role.
- **Online count có thể lệch ~5 phút:** Key Redis TTL = 300s — user đóng app nhưng
  vẫn được tính online cho đến khi key expire. Chấp nhận được với dashboard tổng quan.
- **Xóa tài khoản không rollback được:** Sau khi Firebase user bị xóa, không
  thể khôi phục. Cân nhắc thêm soft-delete (isDeleted) hoặc archive trước khi
  xóa vĩnh viễn trong tương lai.
- TODO: Thêm phân quyền senh hơn trong module admin (ví dụ chỉ super-admin mới
  có thể xóa tài khoản hoặc đổi role thành ADMIN).
- TODO: Thêm audit log cho các hành động admin (khoá/mở khoá, xóa, đổi role).

---

## 11. Anti-Cheat Security Fixes — Bảo mật chống gian lận

> **Branch**: `feature/anti-cheat-fixes` | **Merge**: v1.9.0 | **Ngày**: 2026-07-07

---

### Tổng quan

Vá 4 lỗ hổng bảo mật cho phép học sinh gian lận trong module Thi thử và Luyện tập:

| Bug | Mô tả | Module |
|-----|-------|--------|
| **Bug 1a** | Nộp bài tức thì (không cần làm) | Exam |
| **Bug 1b** | Xem đáp án đúng của câu bỏ trắng | Exam |
| **Bug 2** | Redis down → vượt giới hạn phiên luyện tập | Practice |
| **Bug 3** | Nộp phiên luyện tập đã hết giờ → vẫn nhận điểm | Practice |
| **Bug 4** | Mở 2 tab thi cùng môn cùng lúc → 2 phiên song song | Exam |

Không thêm endpoint mới, không migration DB.

---

### Phương án kỹ thuật được lựa chọn và lý do

#### 1. Sentinel `{}` cho câu bỏ trắng (Bug 1b)

**Phương án đã chọn:** Frontend gửi `selectedAnswer: {}` (object rỗng) cho câu học sinh không trả lời. Backend detect bằng `isSentinelUnanswered(answer)`.

**Phương án bị loại:** Dùng `null` hoặc bỏ field hoàn toàn.

**Lý do:**
- `null` đã có nghĩa riêng trong Prisma: không có bản ghi. Dùng `null = bỏ trắng` sẽ nhập nhằng với "chưa có đáp án trong DB"
- Bỏ field hoàn toàn: Zod schema sẽ reject (field required) → cần exception logic
- `{}` là giá trị hợp lệ về mặt JSON, không xung đột với đáp án hợp lệ của cả 3 loại câu hỏi (trắc nghiệm → string, đúng/sai → array, điền số → số)
- Dễ detect: `typeof answer === 'object' && !Array.isArray(answer) && Object.keys(answer).length === 0`

#### 2. Fail-closed cho Redis (Bug 2)

**Phương án đã chọn:** Khi Redis lỗi trong `checkRateLimit()`, throw exception → user không bắt đầu được phiên luyện tập.

**Phương án bị loại:** Fail-open — khi Redis lỗi, log warning và cho qua như không có rate limit.

**Lý do:**
- Fail-open tạo "cửa sau" vô hình: Redis down → ai cũng có thể bắt đầu vô hạn phiên
- Rủi ro bảo mật > rủi ro UX: Redis down rất hiếm (~0.1%), nhưng nếu xảy ra mà fail-open, gian lận có thể khai thác
- Triết lý: "mặc định an toàn" — tạm bất tiện 1 user tốt hơn là vĩnh viễn để lọt gian lận
- Nếu cần SLA cao hơn: có thể thêm Redis health check endpoint và circuit breaker riêng

#### 3. Ngưỡng 30% thời gian tối thiểu là constant, không hardcode (Bug 1a)

**Phương án đã chọn:** `EXAM_MIN_SUBMIT_RATIO = 0.3` trong `exam.types.ts`, dùng ở `exam.service.ts`.

**Phương án bị loại:** Hardcode `elapsed < duration * 60 * 0.3` trực tiếp trong service.

**Lý do:**
- Ngưỡng 30% là quyết định nghiệp vụ, có thể thay đổi (VD: đề ngắn → 20%, đề dài → 40%)
- Đặt thành constant → thay đổi 1 chỗ, áp dụng mọi nơi, không phải tìm và sửa nhiều file
- Đặt trong `exam.types.ts` (cùng file với constants khác như `EXAM_ENTRY_FEE`) → dễ tìm và review

#### 4. Check phiên trùng ở service layer, không phải DB constraint (Bug 4)

**Phương án đã chọn:** `exam.service.ts` dùng `findFirst({ where: { userId, status: 'IN_PROGRESS' } })` trước khi tạo phiên mới.

**Phương án bị loại:** Unique constraint DB `(userId, subjectId, status = 'IN_PROGRESS')`.

**Lý do chọn service-level:**
- Unique constraint partial index (có điều kiện `WHERE status = 'IN_PROGRESS'`) là tính năng nâng cao của PostgreSQL — cần thêm migration
- Giữ scope nhỏ: tính năng này là "fix", không phải "refactor schema"
- Đủ an toàn cho lưu lượng hiện tại

**Lý do đây là kỹ thuật nợ (tech debt):**
- Check nằm ngoài transaction → 2 request đồng thời cực kỳ nhanh (race condition) có thể vượt qua check
- TODO: Thêm unique constraint DB để an toàn tuyệt đối

---

### Quy trình các bước thực hiện

**Bước 1 — Phân tích lỗ hổng hiện tại:**
Viết test case cho từng bug, xác nhận lỗ hổng tồn tại bằng cách gọi API trực tiếp vượt qua UI.

**Bước 2 — Backend fix Bug 4 (Chặn phiên trùng):**
Thêm check `findFirst` + throw `ExamSessionAlreadyActiveError` (409) vào `startExam()` *trước khi* trừ điểm. Thứ tự quan trọng: check phiên trùng → trừ điểm → tạo phiên mới.

**Bước 3 — Backend fix Bug 1a (30% thời gian tối thiểu):**
Thêm `EXAM_MIN_SUBMIT_RATIO`, tính `elapsed` và `minRequired` trong `submitExam()`, throw 400 nếu quá sớm.

**Bước 4 — Backend fix Bug 1b (Sentinel câu bỏ trắng):**
Thêm `isSentinelUnanswered()` helper, dùng trong `buildExamResult()` để set `correctAnswer = null` khi câu bỏ trắng.

**Bước 5 — Backend fix Bug 2 (Fail-closed Redis):**
Thay `checkRateLimit` từ `catch (e) { return }` thành `catch (e) { throw new InternalServerError() }`.

**Bước 6 — Backend fix Bug 3 (Grace period practice):**
Thêm check `completedAt > startedAt + SESSION_TIMEOUT_SECONDS + 60` trong `completeSession()`, throw 400 nếu quá giờ.

**Bước 7 — Frontend fix (Zod schema + auto-submit):**
Cập nhật Zod schema để accept `z.object({}).strict()` cho sentinel. Thêm auto-submit với Latest Ref Pattern khi hết giờ (tránh race condition với `useEffect`).

**Bước 8 — Viết test và verify:**
Bổ sung 12 unit test cho tất cả happy path + error path của các bug đã fix. Build pass 78/78 test.

---

### Data Model

Không thay đổi schema DB. Các field đã có được dùng để detect gian lận:

| Field | Bảng | Cách dùng |
|-------|------|-----------|
| `startedAt` | `exam_sessions` | Tính elapsed để chặn nộp sớm |
| `durationMinutes` | `exam_sessions` | Ngưỡng 30% = durationMinutes × 60 × 0.3 |
| `status` | `exam_sessions` | Lọc `IN_PROGRESS` để phát hiện phiên trùng |
| `selectedAnswer` | `exam_answers` | Detect sentinel `{}` = câu bỏ trắng |
| `startedAt` | `practice_sessions` | Tính elapsed để chặn complete quá hạn |

---

### Hằng số mới

| Hằng số | Giá trị | File | Ý nghĩa |
|---------|---------|------|---------|
| `EXAM_MIN_SUBMIT_RATIO` | `0.3` | `exam.types.ts` | Tỉ lệ thời gian tối thiểu trước khi được nộp bài |

---

### Error classes mới

| Class | HTTP | Code | Khi nào throw |
|-------|------|------|---------------|
| `ExamSubmitTooEarlyError` | 400 | `EXAM_SUBMIT_TOO_EARLY` | Nộp bài khi chưa đủ 30% thời gian |
| `ExamSessionAlreadyActiveError` | 409 | `EXAM_SESSION_ALREADY_ACTIVE` | Bắt đầu phiên khi đang có phiên IN_PROGRESS cùng môn |

---

### API Reference (behavior thay đổi — không có endpoint mới)

#### POST /api/exam/start

**Thay đổi**: Trả 409 nếu user đang có phiên IN_PROGRESS cùng môn.

```
Trước: Tạo phiên mới, user có thể có nhiều phiên cùng lúc
Sau:   Kiểm tra IN_PROGRESS → nếu có → 409 EXAM_SESSION_ALREADY_ACTIVE
```

**Error mới**:
```json
HTTP 409
{ "error": "EXAM_SESSION_ALREADY_ACTIVE", "message": "Ban dang co phien thi thu chua hoan thanh ('abc123'). Hay hoan thanh hoac cho het gio." }
```

---

#### POST /api/exam/submit

**Thay đổi**: Trả 400 nếu elapsed < 30% durationMinutes.

```
Trước: Nộp bài bất kỳ lúc nào sau khi bắt đầu
Sau:   elapsed < durationMinutes × 60 × 0.3 → 400 EXAM_SUBMIT_TOO_EARLY
```

**Error mới**:
```json
HTTP 400
{ "error": "EXAM_SUBMIT_TOO_EARLY", "message": "Ban can lam bai them it nhat 5 phut nua moi duoc nop." }
```

---

#### GET /api/exam/:id/result

**Thay đổi**: `correctAnswer` trong `wrongAnswers` có thể là `null` cho câu bỏ trắng.

```
Trước: correctAnswer luôn có giá trị (lộ đáp án dù câu bỏ trắng)
Sau:   correctAnswer = null nếu selectedAnswer = {} (sentinel)
```

**Response mẫu (câu bỏ trắng)**:
```json
{
  "examQuestionId": "q-xxx",
  "questionText": "Tìm x biết ...",
  "correctAnswer": null,
  "selectedAnswer": {},
  "pointsEarned": 0
}
```

---

### Luồng xử lý chống gian lận

#### Bug 1a — Nộp bài tối thiểu 30%

```
POST /api/exam/submit
      │
      ▼
┌─────────────────────────────────────┐
│ elapsed = now - session.startedAt   │
│ minRequired = duration × 60 × 0.3  │
├─────────────────────────────────────┤
│  elapsed < minRequired?             │
│  ├─ YES → 400 EXAM_SUBMIT_TOO_EARLY │
│  └─ NO  → Tiếp tục chấm điểm       │
└─────────────────────────────────────┘
```

#### Bug 1b — Sentinel câu bỏ trắng

```
getExamResult()
      │
      ▼
Với mỗi câu sai (pointsEarned < q.points):
      │
      ▼
┌─────────────────────────────────────────────────────┐
│ selectedAnswer = answer?.selectedAnswer ?? null     │
│ isSentinelUnanswered(selectedAnswer)?               │
│   ├─ YES (là {}) → correctAnswer = null             │
│   │                → frontend: "Bạn chưa trả lời"  │
│   └─ NO           → correctAnswer = q.correctAnswer │
└─────────────────────────────────────────────────────┘
```

#### Bug 2 — Fail-closed Redis

```
POST /api/practice/start
      │
      ▼
checkRateLimit()
      │
      ├─ Redis OK, count < MAX → cho phép
      ├─ Redis OK, count >= MAX → 429 PRACTICE_RATE_LIMIT_EXCEEDED
      └─ Redis ERROR → 429 PRACTICE_RATE_LIMIT_EXCEEDED  ← thay đổi!
           (trước đây: bỏ qua lỗi → fail-open → gian lận được)
```

#### Bug 3 — Timeout check trong transaction

```
completeSession($transaction)
      │
      ▼
┌──────────────────────────────────────────────────────┐
│ elapsedSeconds = now - session.startedAt             │
│ if elapsed > SESSION_TIMEOUT_SECONDS + 60:           │
│   ├─ UPDATE completedAt = now (đánh dấu, tránh retry)│
│   └─ throw PracticeSessionExpiredError → 410          │
│ else: tiếp tục chấm điểm bình thường                 │
└──────────────────────────────────────────────────────┘
```

#### Bug 4 — Chặn phiên trùng lặp

```
POST /api/exam/start
      │
      ▼
findFirst({ where: { userId, subjectId, status: 'IN_PROGRESS' } })
      │
      ├─ Có kết quả → 409 EXAM_SESSION_ALREADY_ACTIVE
      └─ Không có  → Tiếp tục tạo phiên mới
```

---

### File Structure

| File | Thay đổi |
|------|----------|
| `backend/src/services/exam/exam.types.ts` | +`EXAM_MIN_SUBMIT_RATIO`, `ExamWrongAnswerItem.correctAnswer: null` |
| `backend/src/services/exam/exam.errors.ts` | +`ExamSubmitTooEarlyError`, +`ExamSessionAlreadyActiveError` |
| `backend/src/services/exam/exam.service.ts` | Bug 4 (startExam), Bug 1a (submitExam), Bug 1b (getExamResult) |
| `backend/src/services/practice/practice.service.ts` | Bug 2 (checkRateLimit), Bug 3 (completeSession) |
| `backend/src/app.ts` | Đăng ký 2 HTTP status code mới |
| `frontend/src/App.tsx` | Xử lý 3 error case mới, cảnh báo nộp sớm |
| `backend/src/services/exam/__tests__/anti-cheat.test.ts` | 22 unit test mới |

---

### Ghi chú kỹ thuật

**Sentinel value `{}`**:
Khi học sinh không trả lời 1 câu, frontend gửi `selectedAnswer: {}` (object rỗng) thay vì bỏ qua field. Backend detect bằng `isSentinelUnanswered()` — xem ADR-009 để biết lý do chọn pattern này.

**Fail-closed vs Fail-open**:
`checkRateLimit()` đổi từ fail-open (bỏ qua lỗi Redis) sang fail-closed (throw khi Redis lỗi). Đánh đổi: Redis down thì user không bắt đầu luyện tập được (~rất hiếm) nhưng không gian lận được. Xem ADR-009.

**Ngưỡng 30% (EXAM_MIN_SUBMIT_RATIO = 0.3)**:
Đề 60 phút → phải làm ít nhất 18 phút. Có thể điều chỉnh hằng số này mà không cần sửa logic.

**Grace 60s ở Bug 3**:
`SESSION_TIMEOUT_SECONDS + 60` cho phép học sinh nộp muộn tối đa 1 phút do trễ mạng. Kết hợp với grace 30s của Exam module, tổng grace tối đa là 60s.

---

### Lưu ý / rủi ro / TODO tiếp theo

- **Race condition nhỏ ở Bug 4**: check `findFirst` nằm ngoài transaction → 2 request cực kỳ đồng thời có thể vượt qua. Để fix hoàn toàn cần unique constraint DB `(userId, subjectId, WHERE status = 'IN_PROGRESS')` — là migration schema, để sau.
- **Fail-closed ảnh hưởng UX khi Redis down**: Rất hiếm xảy ra (~99.9% uptime Redis). Nếu cần SLA cao hơn, có thể đổi về fail-open cho các môi trường có nhiều người dùng VIP.
- TODO: Thêm monitoring alert khi Redis down để phát hiện sớm.
- TODO: Xem xét thêm unique constraint DB cho phiên thi `(userId, subjectId, status)` khi có thời gian làm migration.

---

## 12. Exam UX Improvements — Cải tiến trải nghiệm thi thử

**Trạng thái:** ✅ Hoàn thành
**Ngày hoàn thành:** 2026-07-08
**Branch / commit liên quan:** `feature/exam-ux-improvements`

---

### Tổng quan

#### Vấn đề cần giải quyết

Sau khi triển khai Exam Module (Feature 6 & 11), người dùng phản ánh 3 vấn đề UX nghiêm trọng:

| # | Vấn đề | Hậu quả |
|---|--------|---------|
| 1 | Lỡ thoát app giữa bài thi (đóng tab, mất mạng, bấm nhầm Back) | Mất toàn bộ đáp án đã làm, bị chặn 409 khi thi lại |
| 2 | Không có cách thoát bài thi có kiểm soát | Phải đợi hết giờ hoặc nộp bài để thoát — không thể "đổi ý" |
| 3 | Sau khi phiên IN_PROGRESS còn tồn tại (kể cả đã hết giờ) | Bấm thi môn khác → lỗi 409 EXAM_SESSION_ALREADY_ACTIVE |

#### Giải pháp được chọn

Ba tính năng mới bổ sung đồng thời:

1. **Exam Resume** — Khi mở lại app sau khi lỡ thoát, hiện ngay modal hỏi "Tiếp tục hay Huỷ?" với đáp án cũ được khôi phục từ localStorage
2. **Exit Button** — Nút ✕ trong màn hình làm bài → modal xác nhận 2 bước → huỷ có kiểm soát
3. **Post-abandon Unblock** — Sau khi huỷ (dù theo cách nào), user được thi môn khác ngay lập tức

---

### Phương án kỹ thuật được lựa chọn và lý do

#### 1. Lưu đáp án nháp ở localStorage, không phải server

**Phương án đã chọn:** Mỗi lần user chọn đáp án → ghi ngay vào `localStorage[exam_draft_{sessionId}]`

**Phương án bị loại:** Gửi từng đáp án lên server ngay khi chọn (Auto-save to DB)

**Lý do chọn localStorage:**
- Không cần thêm bảng DB, endpoint, hay migration mới → giữ scope nhỏ
- Tốc độ ghi tức thì (0ms, không cần internet) → không làm chậm UX làm bài
- Draft chỉ có ý nghĩa khi resume trên cùng thiết bị/trình duyệt — phù hợp use case
- Rủi ro chấp nhận được: xóa localStorage / đổi thiết bị → không resume được, hệ thống tự abandon phiên cũ

**Kỹ thuật triển khai:**
```
User chọn đáp án B câu số 3
         ↓
handleAnswerChange("question-uuid", 1)
         ↓
Map { "question-uuid": 1, ... }
         ↓
saveDraftAnswers(sessionId, map)
         ↓
localStorage["exam_draft_abc123"] = '{"question-uuid":1,...}'  ← 0ms
```

Ngoài đáp án, còn lưu `exam_session_data_{sessionId}` = toàn bộ `StartExamResult` (câu hỏi, đề thi) khi bắt đầu thi. Đây là cách duy nhất để rebuild màn hình câu hỏi mà không cần thêm endpoint `GET /api/exam/:id/questions`.

#### 2. Thêm trạng thái ABANDONED thay vì tái sử dụng EXPIRED

**Phương án đã chọn:** Thêm giá trị `ABANDONED` vào enum `ExamSession.status`

**Phương án bị loại:** Dùng EXPIRED cho cả 2 trường hợp (hết giờ + chủ động thoát)

**Lý do chọn ABANDONED riêng:**
- Phân biệt rõ ngữ nghĩa: EXPIRED = hệ thống đánh dấu; ABANDONED = người dùng chủ động
- Không cần thay đổi logic chấm điểm và điểm thưởng của EXPIRED
- Có thể thêm analytics sau (đếm tỷ lệ abandon, phân tích lý do)
- Không hoàn lại 60 điểm vào thi trong cả 2 trường hợp → tránh lạm dụng "vào xem đề rồi thoát"

**Vòng đời đầy đủ của ExamSession:**
```
                    BẮT ĐẦU THI
                   POST /api/exam/start
                   → trừ 60 điểm
                   → tạo IN_PROGRESS
                         │
              ┌──────────┼──────────┐
              │          │          │
         Bấm NỘP   Bấm ✕ xác nhận  Hết giờ,
         (thủ công) hoặc auto-submit không xử lý
              │     khi hết giờ     │
              │          │          │
         COMPLETED  ABANDONED    EXPIRED
         +điểm thưởng  mất 60đ    mất 60đ
         (nếu đủ điều kiện)
```

#### 3. Kiểm tra bài đang dở ở App-level (sau đăng nhập), không phải Page-level

**Phương án ban đầu (S2):** Gọi `getActiveExamSession` trong `useEffect` của ExamPage

**Phương án cải tiến (phát hiện trong S5):** Gọi ngay sau đăng nhập, trong App component

**Lý do thay đổi:**
- User mong đợi thông báo xuất hiện ngay khi vào app, không phải sau khi vào trang thi
- Tránh việc user nhìn thấy hub thi thử "bình thường" rồi thử bấm → bị chặn → bối rối
- App-level state (`resumeAlert`) được chia sẻ với ProfilePage, ExamPage → không gọi API 2 lần

**Luồng sau cải tiến:**
```
Mở app → Firebase auth → lấy token
                                ↓
                       getMyProfile()
                                ↓
                    getActiveExamSession()   ← chạy ngay ở đây
                                ↓
                   Có session dở? → lưu vào resumeAlert state (App)
                                ↓
                       setScreen('profile')
                                ↓
              ProfilePage nhận resumeAlert → hiện modal ngay
```

#### 4. Lazy Expiration — không dùng cron job

**Phương án đã chọn:** Server không chủ động đánh dấu EXPIRED; chỉ check khi có API call liên quan

**Phương án bị loại:** Cron job chạy mỗi phút, scan tất cả IN_PROGRESS sessions

**Lý do chọn Lazy Expiration:**
- Tiết kiệm tài nguyên: không cần background worker
- Session "tự nhiên" expire khi user tương tác trở lại
- Logic đơn giản hơn: `startedAt + durationMinutes * 60 < now → EXPIRED`
- Đủ cho use case hiện tại (số lượng user còn nhỏ)

---

### Quy trình các bước thực hiện

#### Bước 1: Backend — Thêm ABANDONED vào schema

Cập nhật `EXAM_SESSION_STATUSES` trong `exam.types.ts`:
```typescript
['IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'ABANDONED'] as const
```
Thêm `ExamSessionAbandonedError` (HTTP 409) và mapping trong `app.ts`.

#### Bước 2: Backend — Triển khai 2 service methods mới

`getActiveSession(userId)`:
- Tìm session `IN_PROGRESS` của user
- Tính `remainingSeconds = (startedAt + durationMinutes*60s) - now`
- Trả về session kèm remainingSeconds (có thể âm nếu hết giờ)
- Dùng 2 query riêng (ExamSession + ExamPaper) vì schema không có @relation trực tiếp

`abandonSession(userId, sessionId)`:
- Validate: tồn tại → thuộc user → đang IN_PROGRESS
- Update `status = ABANDONED`, `completedAt = now()`

#### Bước 3: Backend — Thêm 2 route mới

Thêm vào `exam.route.ts` *trước* `POST /start` để tránh conflict routing:
- `GET /api/exam/active`
- `POST /api/exam/:id/abandon`

Cập nhật `submitExam()` để từ chối nếu session là ABANDONED.

#### Bước 4: Frontend — localStorage helpers + auto-save

Thêm 3 helper functions ở module scope:
- `saveDraftAnswers(sessionId, answers)` — ghi Map → JSON vào localStorage
- `loadDraftAnswers(sessionId)` → đọc JSON → Map (trả Map rỗng nếu lỗi)
- `clearDraftAnswers(sessionId)` — xóa sau khi nộp/huỷ thành công

Gọi `saveDraftAnswers` trong `handleAnswerChange` sau mỗi lần chọn đáp án.

#### Bước 5: Frontend — Resume flow trong ExamPage

Ban đầu (S2): `useEffect` gọi `getActiveExamSession` khi ExamPage mount.
Sau cải tiến (S5): ExamPage nhận `initialResume` prop từ App-level, skip API call nếu đã có.

Xử lý resume:
```
handleResume(active):
  msLeft = (startedAt + durationMinutes*60s) - now
  if msLeft <= 0:
    → auto-submit với draft answers
    → if submit fail: abandon im lặng, về hub sạch
  else:
    → đọc exam_session_data từ localStorage
    → if không có: abandon, thông báo "không thể khôi phục"
    → nếu có: setSession(data + draft answers), vào ExamSessionScreen
```

#### Bước 6: Frontend — Nút ✕ + Exit Confirm Dialog

Thêm vào `ExamSessionScreen`:
- State `showExitConfirm`
- Nút `btn-icon-exit` (class mới, dùng trên nền sáng — khác `btn-icon-back` dùng nền tối)
- Modal overlay khi `showExitConfirm = true`
- Xác nhận → `onAbandon()` → `abandonExam()` + clear localStorage + về hub

#### Bước 7: Frontend — App-level resumeAlert (cải tiến S5)

Chuyển kiểm tra lên App component, gọi sau `getMyProfile`:
```typescript
const { session: active } = await getActiveExamSession(result.token).catch(() => ({ session: null }));
if (active) setResumeAlert(active);
```

ProfilePage nhận `resumeAlert` → hiện modal popup (thiết kế dạng card căn giữa, nền tối mờ).

#### Bước 8: Xử lý React StrictMode double-invoke

Thêm `resumeAttempted = useRef(false)` trong ExamPage:
```typescript
if (resumeAttempted.current) return;
resumeAttempted.current = true;
void handleResume(initialResume);
```
Guard này đảm bảo `handleResume` chỉ chạy 1 lần dù React StrictMode invoke effect 2 lần trong dev mode.

### Data Model

**Không thêm bảng mới.** Chỉ thêm giá trị `ABANDONED` vào trạng thái `ExamSession.status`:

| Status | Ý nghĩa |
|--------|---------|
| `IN_PROGRESS` | Đang làm bài |
| `COMPLETED` | Đã nộp bài, đã chấm điểm |
| `EXPIRED` | Quá giờ nộp bài, không được chấm điểm |
| `ABANDONED` | Người dùng chủ động huỷ (nút Thoát). Không hoàn điểm đã tru |

**Frontend localStorage** (không lưu DB):
- `exam_draft_{sessionId}` — Map đáp án đã chọn (cập nhật realtime)
- `exam_session_data_{sessionId}` — Toàn bộ `StartExamResult` (câu hỏi, thông tin đề)

### API Reference

| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| GET | `/api/exam/active` | ✅ | Lấy phiên thi đang IN_PROGRESS (nếu có) |
| POST | `/api/exam/:id/abandon` | ✅ | Huỷ phiên thi đang IN_PROGRESS |

#### GET /api/exam/active

Kiểm tra xem user có phiên thi nào đang `IN_PROGRESS` không. Dùng để hiển thị banner "Tiếp tục?" khi mở lại trang thi.

**Response 200 (có phiên dở):**
```json
{
  "session": {
    "id": "3f2a1b4c-...",
    "subject": "toan",
    "title": "Đề Toán 2024 — Số 1",
    "durationMinutes": 60,
    "startedAt": "2026-07-07T10:30:00.000Z",
    "remainingSeconds": 2134
  }
}
```

**Response 200 (không có phiên nào):**
```json
{ "session": null }
```

> ⚠️ `remainingSeconds` có thể âm nếu phiên đã hết giờ — frontend sẽ tự nộp bài thay vì hỏi "tiếp tục?".

**Error codes:**
| HTTP | Code | Khi nào |
|------|------|---------|
| 401 | `MISSING_AUTH_TOKEN` | Chưa đăng nhập |

#### POST /api/exam/:id/abandon

Huỷ phiên thi đang `IN_PROGRESS`. Đổi status thành `ABANDONED`. Điểm vào thi (60đ) **không được hoàn lại**.

**Request:** Không cần body.

**Response 200:**
```json
{ "success": true }
```

**Error codes:**
| HTTP | Code | Khi nào |
|------|------|---------|
| 401 | `MISSING_AUTH_TOKEN` | Chưa đăng nhập |
| 403 | `EXAM_SESSION_NOT_OWNED` | Session không thuộc user này |
| 404 | `EXAM_SESSION_NOT_FOUND` | Không tìm thấy session |
| 409 | `EXAM_SESSION_ABANDONED` | Session đã bị huỷ trước đó |
| 409 | `EXAM_SESSION_ALREADY_COMPLETED` | Session đã COMPLETED hoặc EXPIRED |

### Luồng chạy (Flow)

#### Luồng 1: Khôi phục bài thi đang dở (Resume)

```
User mở ExamPage (hub)
        │
        ▼
GET /api/exam/active
        │
   ┌────┴────┐
   │         │
null     session tồn tại
   │         │
   │    remainingSeconds > 0?
   │         │
   │    ┌────┴────┐
   │   Có        Không
   │    │         │
   │  Banner   Tự submit
   │  "Tiếp    với draft
   │   tục?"   answers
   │    │         │
   │  ┌─┴─┐    Kết quả
   │  Có Không
   │  │   │
   │ Vào Abandon
   │ bài  └──────┐
   │              │
   └──────────────┘
   Chọn môn → thi mới
```

#### Luồng 2: Thoát bài thi có xác nhận

```
User đang làm bài
        │
        ▼
Bấm nút ✕ (góc trên trái)
        │
        ▼
Dialog xác nhận:
"Bạn có chắc muốn thoát?
 Bài thi sẽ bị huỷ."
        │
   ┌────┴────┐
 Huỷ bài   Ở lại
   │
   ▼
POST /api/exam/:id/abandon
   │
   ▼
Về hub chọn môn
(có thể thi môn mới ngay)
```

---

### Bugs phát hiện trong quá trình kiểm thử (S5)

5 bug được phát hiện và sửa trong vòng S5 (tất cả sửa xong trước khi kết thúc vòng):

| # | Bug | Nguyên nhân gốc | Giải pháp |
|---|-----|-----------------|-----------|
| 1 | Modal resume không hiện khi quay lại app | `getActiveExamSession` chỉ gọi trong `useEffect` của ExamPage — user phải vào trang thi mới thấy | Chuyển check lên `App.onAuthStateChanged`; lưu vào `resumeAlert` state App-level; ProfilePage nhận prop và hiện modal ngay |
| 2 | Banner ngang xấu, không nổi bật | Thiết kế dạng `.exam-resume-banner` inline div không đủ chú ý | Thay bằng full-screen `.modal-overlay` + `.modal-box.modal-resume` với icon 📋, căn giữa, nút full-width |
| 3 | React StrictMode gọi `handleResume` 2 lần | Trong dev mode, React StrictMode invoke `useEffect` 2 lần → lần 2 gọi `handleResume` khi session đã COMPLETED → lỗi | Thêm `resumeAttempted = useRef(false)` làm guard; lần 2 return sớm |
| 4 | Thông báo lỗi xấu hiện ở hub sau "Thi tiếp" | Catch block của `handleResume` set `hubError` → trạng thái lỗi còn khi `onRetry` đưa về hub; `onRetry` cũ không clear `hubError` | Catch block không set `hubError` (silent fail); `onRetry` callback thêm `setHubError('')` |
| 5 | Nút ✕ trong màn hình thi vô hình | `btn-icon-back` có `color: #fff` — thiết kế cho nền tối (ProfilePage topbar). Exam session topbar dùng `background: var(--surface)` (nền sáng) → chữ trắng biến mất | Tạo class `.btn-icon-exit` mới với `color: var(--muted)`, hover đỏ; thay `className` trong `ExamSessionScreen` |

---

### File Structure (sau khi hoàn thành tất cả fixes)

| File | Thay đổi |
|------|---------|
| `backend/prisma/schema.prisma` | Cập nhật comment field `status` — thêm `ABANDONED` |
| `backend/src/services/exam/exam.types.ts` | Thêm `'ABANDONED'` vào `EXAM_SESSION_STATUSES`; thêm `ActiveExamSessionResponse` type |
| `backend/src/services/exam/exam.errors.ts` | Thêm `ExamSessionAbandonedError` (code: `EXAM_SESSION_ABANDONED`, HTTP 409) |
| `backend/src/services/exam/exam.service.ts` | Thêm `getActiveSession()`, `abandonSession()`; cập nhật `submitExam()` từ chối ABANDONED; `getExamResult()` handle ABANDONED |
| `backend/src/routes/exam.route.ts` | Thêm `GET /api/exam/active` và `POST /api/exam/:id/abandon` |
| `backend/src/app.ts` | Thêm `EXAM_SESSION_ABANDONED → 409` vào error mapping |
| `backend/src/services/exam/__tests__/exam-ux.test.ts` | 12 unit test mới (78/78 total PASS) |
| `frontend/src/lib/api.ts` | Thêm `getActiveExamSession()`, `abandonExam()`, `ActiveExamSessionInfo` interface |
| `frontend/src/App.tsx` | **Nhiều thay đổi nhất:** App-level `resumeAlert` state, check sau login, `onResumeExam`/`onAbandonResume` callbacks; ProfilePage nhận modal props; ExamPage nhận `initialResume`+`onResumeClear`; localStorage auto-save; `resumeAttempted` ref; `btn-icon-exit` trên ExamSessionScreen; `onRetry` clear `hubError` |
| `frontend/src/App.css` | Thêm `.btn-icon-exit` (nút thoát nền sáng); `.modal-title`, `.modal-body`, `.modal-actions` (định nghĩa typography modal còn thiếu); `.modal-resume`, `.modal-resume-icon` (style riêng cho modal resume) |

### Ghi chú kỹ thuật

**localStorage làm nơi lưu draft:**
Đáp án được lưu vào `localStorage` thay vì backend vì:
- Không cần thêm bảng DB hay endpoint mới (giữ scope nhỏ)
- Ghi tức thì 0ms, không cần internet, không lag UX
- Phù hợp với use case: resume trên cùng thiết bị / trình duyệt
- Rủi ro chấp nhận được: clear localStorage hoặc đổi thiết bị → mất draft

**Hai lớp localStorage:**
- `exam_draft_{sessionId}` — Map đáp án đã chọn (key: questionId, value: optionIndex)
- `exam_session_data_{sessionId}` — Toàn bộ `StartExamResult` (câu hỏi, mã đề, thông tin môn)

**Giới hạn của Resume:**
- Nếu user clear localStorage hoặc đổi thiết bị → không resume được câu hỏi, hệ thống tự abandon phiên cũ.

**Điểm vào thi không hoàn lại khi ABANDON:**
Quyết định chủ ý — tránh lạm dụng "vào xem câu hỏi rồi thoát". Giống hành vi khi EXPIRED.

**ABANDONED ≠ EXPIRED:**
- `EXPIRED`: hệ thống tự đánh dấu theo logic lazy (check khi có API call)
- `ABANDONED`: người dùng chủ động xác nhận thoát qua nút ✕

**CSS context — tại sao phải tạo class mới:**
- `btn-icon-back`: `color: #fff`, `border: 1px solid rgba(255,255,255,.4)` — thiết kế cho topbar nền tối (ProfilePage)
- `btn-icon-exit`: `color: var(--muted)`, `border: 1px solid var(--border)` — cho exam session topbar nền sáng
- Không sửa `btn-icon-back` vì sẽ phá các màn hình khác đang dùng class đó
