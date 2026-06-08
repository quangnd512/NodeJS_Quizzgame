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
