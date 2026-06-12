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
- Rate limit: tối đa 10 phiên/giờ/user qua Redis (Redis down → bỏ qua, không crash)
- Báo cáo câu sai: chỉ cho phép báo cáo câu **đã từng làm**; ≥5 báo cáo PENDING → tự động ẩn câu
- Admin CRUD câu hỏi, bulk import, quản lý báo cáo
- Cleanup cron: đóng phiên hết hạn lúc 3:00 AM

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
