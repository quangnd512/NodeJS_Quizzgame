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
