# Hướng dẫn Admin — QuizzGame

> Tài liệu này dành cho quản trị viên hệ thống. Bao gồm: quản lý câu hỏi,
> xử lý báo cáo từ người dùng, và cấu hình ban đầu.

---

## Mục lục

1. [Cấu hình ban đầu](#1-cấu-hình-ban-đầu)
2. [Xác thực Admin](#2-xác-thực-admin)
3. [Quản lý câu hỏi](#3-quản-lý-câu-hỏi)
4. [Xử lý báo cáo câu hỏi](#4-xử-lý-báo-cáo-câu-hỏi)
5. [Admin Dashboard (Giao diện Web)](#5-admin-dashboard-giao-diện-web)
6. [Xử lý sự cố thường gặp](#6-xử-lý-sự-cố-thường-gặp)

---

## 1. Cấu hình ban đầu

### Biến môi trường cần thiết

Mở file `backend/.env` và đảm bảo có đủ các biến sau:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5433/quizzgame

# Firebase (lấy từ Firebase Console → Project Settings → Service accounts)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# JWT nội bộ (≥ 32 ký tự ngẫu nhiên)
JWT_SECRET=your-super-secret-jwt-key-at-least-32-chars

# Admin API
ADMIN_SECRET=your-admin-secret-key-min-16-chars

# Redis (tùy chọn — cho rate limiting)
REDIS_URL=redis://localhost:6379
```

> **Lưu ý bảo mật:** KHÔNG commit file `.env` vào Git. Dùng trình quản lý
> secret khi deploy (AWS Secrets Manager, Heroku Config Vars, Render Environment...).

### Chạy migration database

```bash
cd backend
npx prisma migrate dev
```

Lệnh này tạo tất cả các bảng cần thiết, bao gồm:
- `users`, `user_points`, `point_transactions` (Auth + Points)
- `questions`, `practice_sessions`, `practice_answers` (Practice Module)
- `user_question_history`, `question_reports` (Practice Module)

### Xem dữ liệu trực quan (Prisma Studio)

```bash
cd backend
npx prisma studio
# Mở trình duyệt tại http://localhost:5555
```

---

## 2. Xác thực Admin

Tất cả API admin đều yêu cầu header:

```
X-Admin-Secret: <giá trị ADMIN_SECRET trong .env>
```

**Ví dụ với curl:**
```bash
curl -H "X-Admin-Secret: your-admin-secret-key" \
  http://localhost:4000/api/admin/questions
```

**Lỗi xác thực:**
- Thiếu header hoặc sai giá trị → `401 ADMIN_UNAUTHORIZED`
- `ADMIN_SECRET` chưa cấu hình trong `.env` → cũng trả về `401`

---

## 3. Quản lý câu hỏi

### 3.1 Xem danh sách câu hỏi

```bash
# Tất cả câu hỏi (phân trang 20 câu/trang)
GET /api/admin/questions

# Lọc theo môn + độ khó
GET /api/admin/questions?subject=TOAN&difficulty=2

# Chỉ xem câu đang ẩn
GET /api/admin/questions?isActive=false

# Trang 2, 50 câu/trang
GET /api/admin/questions?page=2&limit=50
```

**Query parameters:**

| Param | Kiểu | Mô tả |
|-------|------|-------|
| `subject` | string | Lọc theo mã môn (`TOAN`, `VAN`, ...) |
| `difficulty` | number | Lọc theo độ khó (1, 2, hoặc 3) |
| `isActive` | boolean | `true`=đang hoạt động, `false`=đã ẩn |
| `page` | number | Số trang (mặc định 1) |
| `limit` | number | Số câu/trang (mặc định 20, tối đa 100) |

**Response mẫu:**
```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "subject": "TOAN",
      "chapter": "Hàm số",
      "difficulty": 2,
      "question": "Hàm số y = x³ − 3x đồng biến trên khoảng nào?",
      "options": ["(-1;1)", "(-∞;-1)", "(1;+∞)", "(-∞;-1) và (1;+∞)"],
      "correctAnswer": 3,
      "explanation": "y' = 3x² − 3 > 0 khi x < -1 hoặc x > 1",
      "examYear": 2024,
      "examCode": "Mã đề 101",
      "isActive": true,
      "createdAt": "2026-06-09T10:00:00.000Z"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 20
}
```

---

### 3.2 Thêm 1 câu hỏi

```bash
POST /api/admin/questions
X-Admin-Secret: <secret>
Content-Type: application/json

{
  "subject": "TOAN",
  "chapter": "Hàm số",
  "difficulty": 2,
  "question": "Hàm số y = x³ − 3x đồng biến trên khoảng nào?",
  "options": ["(-1;1)", "(-∞;-1)", "(1;+∞)", "(-∞;-1) và (1;+∞)"],
  "correctAnswer": 3,
  "explanation": "y' = 3x² − 3 > 0 khi x < -1 hoặc x > 1",
  "examYear": 2024,
  "examCode": "Mã đề 101"
}
```

**Các trường bắt buộc:** `subject`, `difficulty`, `question`, `options` (đúng 4 phần tử), `correctAnswer`

**Danh mục môn hợp lệ:** `TOAN` | `VAN` | `ANH` | `LY` | `HOA` | `SINH` | `SU` | `DIA` | `GDCD`

**Độ khó:** `1` = dễ, `2` = trung bình, `3` = khó

---

### 3.3 Import hàng loạt (khuyến nghị dùng khi seed data)

Import theo lô, **all-or-nothing**: nếu 1 câu lỗi → toàn bộ batch không được insert.

```bash
POST /api/admin/questions/bulk
X-Admin-Secret: <secret>
Content-Type: application/json

{
  "questions": [
    {
      "subject": "TOAN",
      "difficulty": 1,
      "question": "Tập xác định của hàm số y = √(x−1) là?",
      "options": ["[1;+∞)", "(1;+∞)", "[-1;+∞)", "(-∞;1]"],
      "correctAnswer": 0,
      "explanation": "Điều kiện: x−1 ≥ 0 ⟺ x ≥ 1"
    },
    {
      "subject": "TOAN",
      "difficulty": 2,
      "question": "Hàm số y = x³ − 3x đồng biến trên khoảng nào?",
      "options": ["(-1;1)", "(-∞;-1)", "(1;+∞)", "(-∞;-1) và (1;+∞)"],
      "correctAnswer": 3
    }
  ]
}
```

**Giới hạn:** tối đa 500 câu/batch. Nếu cần import nhiều hơn, chia thành nhiều batch.

**Response thành công:**
```json
{ "inserted": 2, "questions": [ ...QuestionFullDto... ] }
```

---

### 3.4 Cập nhật câu hỏi

Chỉ cần gửi các trường muốn thay đổi (partial update):

```bash
PUT /api/admin/questions/:id
X-Admin-Secret: <secret>
Content-Type: application/json

{ "explanation": "Giải thích đã được cập nhật rõ hơn..." }
```

---

### 3.5 Ẩn câu hỏi (soft delete)

```bash
DELETE /api/admin/questions/:id
X-Admin-Secret: <secret>
```

Thao tác này **không xóa dữ liệu** — chỉ set `isActive = false`. Câu hỏi sẽ
không xuất hiện trong các phiên ôn tập mới nhưng vẫn được giữ lại trong DB để
đối chiếu với các phiên cũ.

Để khôi phục câu ẩn, dùng `PUT` để set lại `isActive = true`:
```bash
PUT /api/admin/questions/:id
Content-Type: application/json

{ "isActive": true }
```

> **Lưu ý:** `isActive` không có trong `updateQuestionSchema` — cần thêm vào
> schema nếu muốn hỗ trợ khôi phục qua API. Hiện tại có thể dùng Prisma Studio
> hoặc SQL trực tiếp để khôi phục.

---

## 4. Xử lý báo cáo câu hỏi

Người dùng có thể báo cáo câu hỏi sai/có vấn đề — nhưng **chỉ với câu hỏi họ
đã từng làm** (hệ thống kiểm tra `user_question_history`; nếu chưa từng làm,
API trả `403 QUESTION_NOT_ATTEMPTED_FOR_REPORT`). Hệ thống tự động ẩn câu khi
nhận **≥ 5 báo cáo PENDING**.

### 4.1 Xem danh sách báo cáo

```bash
# Tất cả báo cáo đang chờ xử lý
GET /api/admin/questions/reports?status=PENDING

# Tất cả báo cáo, trang 1
GET /api/admin/questions/reports
```

**Response mẫu:**
```json
{
  "items": [
    {
      "id": "report-uuid",
      "questionId": "q-uuid",
      "userId": "user-uuid",
      "reason": "WRONG_ANSWER",
      "description": "Đáp án C mới là đúng vì...",
      "status": "PENDING",
      "createdAt": "2026-06-09T10:00:00.000Z"
    }
  ],
  "total": 12
}
```

---

### 4.2 Xem thống kê báo cáo tổng hợp

```bash
GET /api/admin/questions/reports/summary
```

**Response mẫu:**
```json
{
  "pending": 12,
  "reviewed": 5,
  "fixed": 3,
  "dismissed": 2,
  "topReportedQuestions": [
    { "questionId": "q-uuid-1", "count": 7 },
    { "questionId": "q-uuid-2", "count": 4 }
  ]
}
```

> ⚠️ **Đã đổi response shape (2026-06-12):** trước đây là dạng lồng
> `{ byStatus: { PENDING, REVIEWED, FIXED, DISMISSED }, topReportedQuestions }`.
> Shape cũ **không còn được trả về** — đọc trực tiếp `pending`, `reviewed`,
> `fixed`, `dismissed` ở root object.

**Quy trình xử lý báo cáo được khuyến nghị:**
1. Xem `topReportedQuestions` để ưu tiên câu bị báo cáo nhiều nhất.
2. Lấy `questionId` → gọi `GET /api/admin/questions?subject=&difficulty=` để
   tra thông tin đầy đủ, hoặc dùng Prisma Studio.
3. Đánh giá nội dung báo cáo, quyết định hành động.

---

### 4.3 Cập nhật trạng thái báo cáo

Sau khi kiểm tra báo cáo, cập nhật trạng thái:

```bash
PATCH /api/admin/questions/reports/:reportId
X-Admin-Secret: <secret>
Content-Type: application/json

{ "status": "REVIEWED" }
```

**Trạng thái hợp lệ:**

| Trạng thái | Ý nghĩa |
|-----------|---------|
| `PENDING` | Chờ xử lý (mặc định khi tạo) |
| `REVIEWED` | Đã xem xét, chưa hành động |
| `FIXED` | Đã sửa câu hỏi |
| `DISMISSED` | Bác bỏ báo cáo (báo cáo không hợp lệ) |

> **Lưu ý:** Cập nhật sang `REVIEWED`, `FIXED`, hoặc `DISMISSED` làm giảm số
> lượng báo cáo PENDING. Nếu đang có 5 PENDING → auto-ẩn câu → sau khi xử lý
> đổi status xuống còn < 5 PENDING, câu hỏi **vẫn ẩn** (không tự động hiện lại).
> Cần thủ công khôi phục `isActive = true` nếu muốn dùng lại câu đó.

---

## 5. Admin Dashboard (Giao diện Web)

Thay vì gọi `curl`/Postman như mục 4, admin có thể dùng giao diện web để xem
thống kê và xử lý báo cáo trực quan hơn.

### 5.1 Truy cập

Mở frontend và thêm `#admin` vào cuối URL:

```
http://localhost:5173/#admin
```

Trang Admin Dashboard **tách biệt hoàn toàn** với app chính — không cần đăng
nhập Firebase/tài khoản người dùng.

### 5.2 Đăng nhập

Lần đầu truy cập, màn hình yêu cầu nhập **Mã bí mật (Admin Secret)** — chính
là giá trị `ADMIN_SECRET` trong `backend/.env`:

1. Nhập `ADMIN_SECRET` vào ô "Mã bí mật (Admin Secret)".
2. Nhấn **Đăng nhập** (hoặc Enter).
3. Nếu đúng → vào thẳng trang quản lý báo cáo.
4. Nếu sai → hiện thông báo "Mã bí mật không đúng."

> Mã bí mật được lưu trong `sessionStorage` của trình duyệt — chỉ tồn tại
> trong tab hiện tại, **mất khi đóng tab**. Nhấn **Đăng xuất** ở góc trên để
> xoá ngay.

### 5.3 Trang quản lý báo cáo

Sau khi đăng nhập, màn hình hiển thị:

- **4 thẻ thống kê** ở đầu trang: *Chờ xử lý* / *Đã xem* / *Đã sửa* / *Đã bỏ
  qua* — lấy từ `GET /api/admin/questions/reports/summary` (xem mục 4.2).
- **Bộ lọc trạng thái** (dropdown "Tất cả trạng thái" / `PENDING` / `REVIEWED`
  / `FIXED` / `DISMISSED`) — đổi filter sẽ load lại danh sách từ trang 1.
- **Danh sách báo cáo**, mỗi dòng gồm: nhãn trạng thái, lý do báo cáo, mã câu
  hỏi (`questionId`), mô tả (nếu có), thời gian gửi, và 3 nút hành động **Đã
  xem** / **Đã sửa** / **Bỏ qua**.
- **Phân trang** 20 báo cáo/trang ở cuối danh sách.

**Đổi trạng thái 1 báo cáo:**
1. Nhấn nút trạng thái mong muốn (ví dụ **Đã sửa**) trên dòng báo cáo.
2. Hệ thống gọi `PATCH /api/admin/questions/reports/:id` (xem mục 4.3) và tải
   lại cả 4 thẻ thống kê + danh sách.
3. Nếu thao tác này khiến câu hỏi liên quan đạt ≥ 5 báo cáo `PENDING`, một
   banner màu xanh sẽ hiện: **"Câu hỏi liên quan đã bị tự động ẩn do vượt
   ngưỡng báo cáo."** — xem mục 4.3 để khôi phục thủ công nếu cần.

### 5.4 Khi nào dùng Dashboard, khi nào dùng API trực tiếp?

| Tình huống | Dùng |
|------------|------|
| Xử lý báo cáo hàng ngày, xem nhanh thống kê | Dashboard (`/#admin`) |
| Import/sửa hàng loạt câu hỏi, debug, script tự động | API trực tiếp (mục 3, 4) |

---

## 6. Xử lý sự cố thường gặp

### Lỗi "ADMIN_UNAUTHORIZED" dù đã gửi header

**Nguyên nhân 1:** Biến `ADMIN_SECRET` chưa được set trong `.env`.
```bash
# Kiểm tra:
grep ADMIN_SECRET backend/.env
```

**Nguyên nhân 2:** Header sai tên — phải là `X-Admin-Secret` (phân biệt hoa/thường).

---

### Admin Dashboard (`/#admin`) báo "Mã bí mật không đúng"

Trang đăng nhập xác thực bằng cách gọi thử `GET /api/admin/questions/reports/summary`
với giá trị vừa nhập — nếu API trả `401`/`403` thì hiện thông báo này. Nguyên
nhân giống lỗi `ADMIN_UNAUTHORIZED` ở trên: kiểm tra `ADMIN_SECRET` trong
`backend/.env` có khớp với giá trị đang nhập, và backend đã được khởi động
lại sau khi đổi `.env` chưa.

---

### Người dùng báo lỗi "Bạn cần làm câu hỏi này trước khi báo cáo"

Đây là lỗi `403 QUESTION_NOT_ATTEMPTED_FOR_REPORT` — hệ thống chỉ cho phép báo
cáo câu hỏi người dùng **đã từng trả lời** (có bản ghi `user_question_history`).
Đây là hành vi **mong muốn** (chống spam báo cáo câu chưa từng thấy), không
phải lỗi hệ thống. Hướng dẫn người dùng làm câu hỏi đó trong 1 phiên ôn tập
trước, sau đó báo cáo lại.

---

### Câu hỏi bị ẩn do auto-hide nhưng không muốn ẩn

Xảy ra khi ≥ 5 báo cáo PENDING. Để khôi phục:
1. Xử lý các báo cáo PENDING liên quan (đổi sang `DISMISSED` hoặc `FIXED`).
2. Khôi phục câu hỏi qua Prisma Studio hoặc SQL:
   ```sql
   UPDATE questions SET "isActive" = true WHERE id = '<question-id>';
   ```

---

### Import bulk thất bại (400 INVALID_REQUEST_BODY)

Toàn bộ batch bị từ chối nếu 1 câu lỗi. Lỗi response có trường `details` chứa
danh sách lỗi theo field:

```json
{
  "error": "INVALID_REQUEST_BODY",
  "message": "Dữ liệu không hợp lệ",
  "details": [
    {
      "path": ["questions", 2, "options"],
      "message": "Array must contain exactly 4 element(s)"
    }
  ]
}
```

**→ Sửa câu tại index `2` (câu thứ 3) và gửi lại.**

---

### Redis không kết nối được

Hệ thống vẫn hoạt động bình thường — chỉ mất tính năng rate limit. Log sẽ hiện:
```
[Redis] Lỗi kết nối Redis (rate limit sẽ bị bỏ qua): connect ECONNREFUSED 127.0.0.1:6379
```

Để bật rate limit, khởi động Redis:
```bash
redis-server
# hoặc: brew services start redis (macOS)
```

---

### Database migration chưa chạy

Nếu server khởi động nhưng API trả lỗi 500 với "relation does not exist":
```bash
cd backend
npx prisma migrate dev
```
