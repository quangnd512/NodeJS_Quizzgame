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
7. [Quản lý Đề thi thử (Thi thử / Mock Exam)](#7-quản-lý-đề-thi-thử-thi-thử--mock-exam)
8. [Ngân hàng câu hỏi (Question Bank)](#8-ngân-hàng-câu-hỏi-question-bank)
   - [8.7 Tự động điền câu hỏi (Auto-Fill)](#87-tự-động-điền-câu-hỏi-auto-fill)
9. [Bảng xếp hạng & Ảnh đại diện](#9-bảng-xếp-hạng--ảnh-đại-diện)
10. [Ôn câu sai — Lưu ý cho Admin](#10-ôn-câu-sai--lưu-ý-cho-admin)

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
- `exam_papers`, `exam_questions`, `exam_sessions`, `exam_answers` (Module Thi
  thử — xem mục 7)

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
| Tạo/sửa đề thi thử, thêm câu hỏi, import Excel | Dashboard tab "Đề thi thử" (mục 5.5) hoặc API trực tiếp (mục 7) |

### 5.5 Tab "Đề thi thử" (Quản lý đề thi thử)

Sau khi đăng nhập (mục 5.2), Admin Dashboard có **2 tab** ở đầu trang: **"Báo
cáo câu hỏi"** (mục 5.3) và **"Đề thi thử"** (mới). Tab "Đề thi thử" dùng các
API ở mục 7.

**Danh sách đề thi (`AdminExamPaperListPage`):**
- Bộ lọc theo môn học (dropdown — để trống = xem tất cả môn).
- Mỗi đề hiển thị: tiêu đề, môn, thời gian làm bài (phút), số câu hỏi đang
  hoạt động, trạng thái Hoạt động/Tạm ẩn.
- Form **"Tạo đề mới"**: nhập môn, tiêu đề, thời gian làm bài (phút) → gọi
  `POST /api/admin/exam-papers` (mục 7.2). Đề mới tạo **chưa có câu hỏi nào**
  — cần bấm vào đề để thêm câu hỏi.
- Bấm vào 1 đề để xem chi tiết.

**Chi tiết đề thi (`AdminExamPaperDetailPage`):**
- Nút **"Tạm ẩn" / "Kích hoạt"** — bật/tắt `isActive` của đề
  (`PATCH /api/admin/exam-papers/:id`, mục 7.2). Đề bị tạm ẩn sẽ **không**
  được chọn cho học sinh thi thử nữa (nhưng vẫn xem được lịch sử các phiên cũ).
- **Danh sách câu hỏi**: mỗi câu hiển thị chương, độ khó, dạng câu hỏi
  (`MCQ_4`/`TRUE_FALSE_4`/`FILL_BLANK`), số điểm, và nút **"Xoá"** (ẩn câu —
  soft delete, mục 7.3).
  > ⚠️ Hiện **chưa có nút "Sửa"** cho từng câu hỏi (xem mục 7.5). Muốn sửa nội
  > dung 1 câu, cách duy nhất hiện tại là: **Xoá** câu cũ rồi **thêm câu mới**
  > bằng form dưới đây.
- **Form thêm câu hỏi**: chọn dạng câu hỏi (`MCQ_4`/`TRUE_FALSE_4`/
  `FILL_BLANK`) → form đổi theo dạng tương ứng (xem ví dụ ở mục 7.3) → gọi
  `POST /api/admin/exam-papers/:id/questions`.
- **Khung Import Excel**: chọn file `.xlsx`/`.xls` (tối đa 5MB) → gọi
  `POST /api/admin/exam-papers/:id/questions/import` (mục 7.3) → hiển thị số
  câu đã thêm thành công (`inserted`) và danh sách lỗi theo dòng (`errors`,
  nếu có) — các dòng hợp lệ vẫn được lưu dù có dòng lỗi khác.

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

---

## 7. Quản lý Đề thi thử (Thi thử / Mock Exam)

### 7.1 Tổng quan

- Học sinh bấm **"Thi thử 🎯"** trên trang hồ sơ → trừ **60 điểm** tích lũy
  (`EXAM_ENTRY_FEE`, `PointReason.THI_THU_ENTRY_FEE`) → hệ thống tự chọn 1 đề
  đang hoạt động cho môn đã chọn theo thuật toán "công bằng" (ưu tiên đề học
  sinh thi ít lần nhất).
- Sau khi nộp bài, điểm số (thang 10) quyết định điểm thưởng tích lũy
  (`PointReason.THI_THU_RESULT`):

| Điểm (thang 10) | Điểm thưởng |
|------------------|-------------|
| < 7.0 | 0 |
| 7.0 – 7.9 | 10 |
| 8.0 – 8.9 | 20 |
| 9.0 – 9.9 | 50 |
| 10.0 | 120 |

- 3 dạng câu hỏi: `MCQ_4` (trắc nghiệm 4 đáp án), `TRUE_FALSE_4` (4 phát biểu
  Đúng/Sai, có điểm thành phần theo số ý đúng), `FILL_BLANK` (điền đáp án,
  chấp nhận nhiều cách viết).
- Toàn bộ API ở mục này yêu cầu header `X-Admin-Secret` (mục 2). Xem chi tiết
  request/response đầy đủ tại `docs/api/openapi.yaml` và
  `docs/FEATURE_LOG.md` Section 6.

### 7.2 Quản lý đề thi (Exam Paper)

**Tạo đề thi mới** (chưa có câu hỏi):
```bash
POST /api/admin/exam-papers
X-Admin-Secret: <secret>
Content-Type: application/json

{ "subject": "TOAN", "title": "Đề thi thử THPT QG 2024 - Mã đề 101", "durationMinutes": 50 }
```

**Danh sách đề thi** (trả **mảng trực tiếp**, không phân trang):
```bash
GET /api/admin/exam-papers?subject=TOAN
```

**Chi tiết 1 đề** (kèm toàn bộ câu hỏi, có `correctAnswer`/`explanation`, gồm
cả câu đã ẩn):
```bash
GET /api/admin/exam-papers/:id
```

**Cập nhật đề** (tiêu đề / thời gian / tạm ẩn — partial update):
```bash
PATCH /api/admin/exam-papers/:id
Content-Type: application/json

{ "isActive": false }
```

> Đề bị `isActive=false` sẽ không được `pickFairExamPaper` chọn cho học sinh
> nữa, nhưng các phiên thi cũ vẫn xem được kết quả bình thường.

### 7.3 Quản lý câu hỏi trong đề

**Thêm 1 câu hỏi** — `options`/`correctAnswer` phải khớp `questionType`:

| Dạng | `options` | `correctAnswer` |
|------|-----------|-----------------|
| `MCQ_4` | 4 chuỗi | số 0-3 (vị trí đáp án đúng) |
| `TRUE_FALSE_4` | 4 chuỗi (4 phát biểu a/b/c/d) | 4 boolean (theo đúng thứ tự a/b/c/d) |
| `FILL_BLANK` | không gửi | mảng ≥1 chuỗi (các đáp án được chấp nhận) |

Ví dụ MCQ_4:
```bash
POST /api/admin/exam-papers/:id/questions
Content-Type: application/json

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

Ví dụ TRUE_FALSE_4 (`correctAnswer` = 4 boolean, theo đúng thứ tự
`options` a/b/c/d):
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

Ví dụ FILL_BLANK (`correctAnswer` = mảng đáp án chấp nhận, so khớp sau khi
chuẩn hoá — trim, lowercase, gộp khoảng trắng):
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

**Import câu hỏi từ Excel** (`multipart/form-data`, field `file`, tối đa
5MB):
```bash
curl -X POST -H "X-Admin-Secret: <secret>" \
  -F "file=@de-thi-toan-101.xlsx" \
  http://localhost:4000/api/admin/exam-papers/<id>/questions/import
```

Quy ước cột (xem file mẫu sinh bằng lệnh dưới):

| Cột | Ghi chú |
|-----|---------|
| Chương, Độ khó, Loại câu hỏi, Điểm, Nội dung câu hỏi | bắt buộc |
| Lựa chọn 1-4 | dùng cho `MCQ_4`/`TRUE_FALSE_4`, bỏ trống với `FILL_BLANK` |
| Đáp án đúng | `MCQ_4`: `A`-`D` hoặc `0`-`3`; `TRUE_FALSE_4`: 4 giá trị `D/S` cách nhau bởi dấu phẩy (`"D,S,D,S"`); `FILL_BLANK`: các đáp án cách nhau bởi `\|` (`"Hà Nội\|HN"`) |
| Giải thích, Năm thi, Mã đề | tùy chọn |

Sinh lại file mẫu:
```bash
cd backend
npm run generate:exam-template
# → ghi ra docs/templates/mau-import-cau-hoi-thi-thu.xlsx
```

Import **cho phép thành công một phần** — response trả `inserted` (số câu đã
thêm) và `errors[]` (danh sách `{ row, message }`, `row` tính cả dòng header =
dòng 1). Các dòng hợp lệ vẫn được lưu dù có dòng khác lỗi.

**Ẩn 1 câu hỏi** (soft delete — giữ lại để không phá vỡ lịch sử chấm điểm các
phiên đã làm câu này):
```bash
DELETE /api/admin/exam-papers/:id/questions/:qid
```

**Sửa 1 câu hỏi** (`PATCH /api/admin/exam-papers/:id/questions/:qid`, partial
update) — endpoint đã hoạt động đầy đủ ở backend nhưng **chưa có giao diện**
gọi tới (xem mục 7.5). Có thể gọi trực tiếp bằng curl/Postman nếu cần sửa gấp:
```bash
PATCH /api/admin/exam-papers/:id/questions/:qid
Content-Type: application/json

{ "explanation": "Giải thích đã được cập nhật rõ hơn..." }
```

### 7.4 Kiểm thử nhanh

```bash
cd backend
npm run smoke:exam              # 87 test case: chấm điểm, chọn đề, hết giờ...
npm run smoke:exam:concurrency  # 21 test case: race condition trừ điểm/chốt phiên
```

### 7.5 Vấn đề đã biết / lưu ý

- **Chưa có nút "Sửa câu hỏi"** trên giao diện (`AdminExamPaperDetailPage`
  chỉ có nút "Xoá") dù API `PATCH .../questions/:qid` đã hoạt động đầy đủ.
  Cách sửa hiện tại: xoá (ẩn) câu cũ → thêm câu mới.
- **`GET /api/admin/exam-papers?subject=`** trả về mảng không phân trang —
  nếu số đề thi tăng nhiều, danh sách sẽ tải toàn bộ cùng lúc.
- **Tổng điểm các câu trong 1 đề không bị bắt buộc phải bằng 10** — hệ thống
  tự quy đổi điểm đạt được sang thang 10 (`score = earned/total*100/10`).
  Admin nên tự kiểm tra để tổng điểm hợp lý trước khi kích hoạt đề.
- **Import Excel xử lý tuần tự, không transaction** — nếu request bị ngắt
  giữa chừng, các câu đã insert trước đó không bị rollback; import lại có thể
  tạo câu hỏi trùng.

### 7.6 Sự cố thường gặp khi quản lý Thi thử

**Học sinh báo lỗi "Bạn cần tối thiểu 60 điểm tích lũy để vào thi thử"**
→ `409 EXAM_INSUFFICIENT_POINTS` — đúng như thiết kế (`EXAM_ENTRY_FEE = 60`),
không phải lỗi hệ thống. Học sinh cần làm thêm Ôn tập để tích điểm.

**Học sinh báo lỗi "Môn học này hiện chưa có đề thi thử"**
→ `404 EXAM_PAPER_EMPTY` — môn đó chưa có đề nào `isActive=true` có ≥1 câu hỏi
`isActive=true`. Vào tab "Đề thi thử" (mục 5.5), tạo đề mới hoặc kích hoạt lại
đề đã tạm ẩn, đảm bảo đề có ít nhất 1 câu hỏi đang hoạt động.

**Import Excel báo lỗi `EXAM_IMPORT_FILE_INVALID`**
- File > 5MB, hoặc không phải `.xlsx`/`.xls`, hoặc không đọc được sheet/dữ
  liệu → kiểm tra lại file, dùng file mẫu (`npm run generate:exam-template`)
  làm chuẩn.
- Nếu `errors[]` báo lỗi theo dòng cụ thể (ví dụ "Loai cau hoi '...' khong hop
  le", "Dap an dung '...' khong hop le") → sửa đúng dòng đó trong Excel (`row`
  tính cả dòng header) và import lại — các câu đã import thành công trước đó
  **không cần** import lại.

**Thêm câu hỏi báo lỗi `EXAM_QUESTION_INVALID`**
→ `options`/`correctAnswer` không khớp `questionType` (ví dụ chọn
`questionType: MCQ_4` nhưng `correctAnswer` không phải số 0-3, hoặc
`TRUE_FALSE_4` mà `correctAnswer` không có đúng 4 phần tử boolean). Kiểm tra
lại theo bảng ở mục 7.3.

---

## 8. Ngân hàng câu hỏi (Question Bank)

Ngân hàng câu hỏi là **kho lưu trữ dùng chung** — một câu có thể được tái sử
dụng trong nhiều đề thi khác nhau. Thay vì nhập câu riêng lẻ vào từng đề,
admin có thể tạo câu vào kho trước, rồi chọn thêm vào đề theo batch.

> **Base URL:** `http://localhost:4000/api/admin/question-bank`
> **Auth:** Header `X-Admin-Secret: <giá trị ADMIN_SECRET trong .env>`

---

### 8.1. Tạo câu hỏi mới trong kho

**Endpoint:** `POST /api/admin/question-bank`

**Ví dụ — câu trắc nghiệm 4 đáp án (MCQ_4):**
```bash
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
    "correctAnswer": 1,
    "explanation": "log₂8 = log₂(2³) = 3"
  }'
```

**Ví dụ — câu Đúng/Sai 4 phát biểu (TRUE_FALSE_4):**
```bash
curl -X POST http://localhost:4000/api/admin/question-bank \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: $ADMIN_SECRET" \
  -d '{
    "subject": "LY",
    "difficulty": 1,
    "questionType": "TRUE_FALSE_4",
    "points": 1,
    "questionText": "Xác nhận về lực Newton:",
    "options": ["F=ma", "Lực phản lực cùng chiều", "Vật tĩnh khi hợp lực=0", "Gia tốc tỉ lệ nghịch m"],
    "correctAnswer": [true, false, true, true]
  }'
```

**Ví dụ — câu điền từ (FILL_BLANK):**
```bash
curl -X POST http://localhost:4000/api/admin/question-bank \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: $ADMIN_SECRET" \
  -d '{
    "subject": "VAN",
    "difficulty": 1,
    "questionType": "FILL_BLANK",
    "points": 0.5,
    "questionText": "Thủ đô của Việt Nam là ___.",
    "correctAnswer": ["Hà Nội", "Ha Noi"]
  }'
```

**Quy tắc `options` / `correctAnswer` theo từng loại câu:**

| `questionType` | `options` | `correctAnswer` |
|----------------|-----------|-----------------|
| `MCQ_4` | Bắt buộc — mảng đúng 4 chuỗi | Số nguyên 0–3 (chỉ số đáp án đúng) |
| `TRUE_FALSE_4` | Bắt buộc — mảng đúng 4 chuỗi (nội dung phát biểu) | Mảng đúng 4 boolean `[true/false, ...]` |
| `FILL_BLANK` | Không cần (bỏ qua) | Mảng chuỗi — tất cả đáp án được chấp nhận |

---

### 8.2. Xem danh sách và tìm kiếm câu hỏi

**Endpoint:** `GET /api/admin/question-bank`

```bash
# Tất cả câu môn Toán, độ khó trung bình
curl "http://localhost:4000/api/admin/question-bank?subject=TOAN&difficulty=2" \
  -H "X-Admin-Secret: $ADMIN_SECRET"

# Tìm theo nội dung (case-insensitive)
curl "http://localhost:4000/api/admin/question-bank?search=log" \
  -H "X-Admin-Secret: $ADMIN_SECRET"

# Phân trang trang 2, 50 câu/trang
curl "http://localhost:4000/api/admin/question-bank?page=2&pageSize=50" \
  -H "X-Admin-Secret: $ADMIN_SECRET"

# Chỉ câu đang ẩn
curl "http://localhost:4000/api/admin/question-bank?isActive=false" \
  -H "X-Admin-Secret: $ADMIN_SECRET"
```

**Response:**
```json
{
  "items": [ /* QuestionBankSummaryDto[] */ ],
  "total": 150,
  "page": 1,
  "pageSize": 20
}
```

---

### 8.3. Kiểm tra usage trước khi xóa

**Endpoint:** `GET /api/admin/question-bank/:id/usage`

Gọi endpoint này trước khi xóa câu để biết:
- Câu đang được dùng trong đề thi nào
- Có phiên thi thử `IN_PROGRESS` đang dùng câu này không

```bash
curl http://localhost:4000/api/admin/question-bank/<BANK_ID>/usage \
  -H "X-Admin-Secret: $ADMIN_SECRET"
```

**Response:**
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

> Nếu `hasActiveSession: true` → **đừng xóa ngay**. Chờ phiên thi kết thúc
> (tối đa theo `durationMinutes` của đề thi) rồi xóa lại.

---

### 8.4. Cập nhật câu hỏi

**Endpoint:** `PUT /api/admin/question-bank/:id`

Chỉ cần gửi những trường muốn thay đổi — các trường còn lại giữ nguyên.

```bash
# Ẩn câu hỏi
curl -X PUT http://localhost:4000/api/admin/question-bank/<BANK_ID> \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: $ADMIN_SECRET" \
  -d '{ "isActive": false }'

# Sửa chương và độ khó
curl -X PUT http://localhost:4000/api/admin/question-bank/<BANK_ID> \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: $ADMIN_SECRET" \
  -d '{ "chapter": "Giải tích", "difficulty": 3 }'
```

---

### 8.5. Xóa câu hỏi (Hard Delete)

**Endpoint:** `DELETE /api/admin/question-bank/:id`

> **Lưu ý quan trọng:** Đây là **hard delete** — câu bị xóa vĩnh viễn khỏi kho.
> Các bản sao trong đề thi vẫn còn nguyên (trường `questionBankId` tự thành
> `null`), nhưng không thể khôi phục liên kết sau khi xóa.

**Quy trình xóa an toàn:**
1. Gọi `GET /:id/usage` để kiểm tra usage
2. Nếu `hasActiveSession: false` → có thể xóa an toàn
3. Gọi `DELETE /:id`

```bash
curl -X DELETE http://localhost:4000/api/admin/question-bank/<BANK_ID> \
  -H "X-Admin-Secret: $ADMIN_SECRET"
```

**Khi xóa thất bại:**
- `404 QUESTION_BANK_NOT_FOUND`: ID không tồn tại trong kho
- `409 QUESTION_BANK_DELETE_BLOCKED`: Còn phiên thi `IN_PROGRESS` đang dùng câu → đợi phiên kết thúc

---

### 8.6. Thêm câu từ kho vào đề thi

**Endpoint:** `POST /api/admin/exam-papers/:examPaperId/questions/from-bank`

Thêm hàng loạt câu từ kho vào một đề thi. Câu đã có trong đề sẽ bị bỏ qua tự
động (không báo lỗi).

```bash
curl -X POST http://localhost:4000/api/admin/exam-papers/<PAPER_ID>/questions/from-bank \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: $ADMIN_SECRET" \
  -d '{
    "questionBankIds": [
      "bank-uuid-1",
      "bank-uuid-2",
      "bank-uuid-3"
    ]
  }'
```

**Response:**
```json
{ "added": 2, "skipped": 1 }
```

> `skipped: 1` — 1 câu bị bỏ qua vì đã có trong đề hoặc đang `isActive=false`.
> Tối đa 100 UUID mỗi lần gọi.

---

### 8.7. Tự động điền câu hỏi (Auto-Fill)

**Endpoint:** `POST /api/admin/exam-papers/:examPaperId/questions/auto-fill`

Thay vì chọn từng câu từ kho, admin có thể yêu cầu hệ thống **tự động chọn
ngẫu nhiên N câu** (cùng môn với đề thi) theo tỉ lệ độ khó cố định:
**50% dễ / 30% trung bình / 20% khó**.

```bash
curl -X POST http://localhost:4000/api/admin/exam-papers/<PAPER_ID>/questions/auto-fill \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: $ADMIN_SECRET" \
  -d '{ "count": 40 }'
```

> `count` = tổng số câu muốn thêm (tối đa 200). Câu đã có trong đề sẽ được bỏ
> qua tự động (không tính vào `added`).

**Response:**
```json
{ "added": 38, "skipped": 0, "shortage": 2 }
```

| Field | Ý nghĩa |
|-------|---------|
| `added` | Số câu đã được thêm vào đề thành công |
| `skipped` | Luôn là `0` (auto-fill không đếm duplicate) |
| `shortage` | Số câu thiếu so với `count` (do kho không đủ câu) |

**Khi nào dùng auto-fill vs from-bank?**

| Tình huống | Dùng |
|-----------|------|
| Muốn nhanh chóng tạo đề với cơ cấu độ khó tự động | `auto-fill` |
| Muốn kiểm soát chính xác từng câu được chọn | `from-bank` |
| Kho ít câu (< 50) hoặc cần kiểm tra câu trước khi thêm | `from-bank` |

---

### 8.8. Xử lý sự cố Ngân hàng câu hỏi

**`QUESTION_BANK_NOT_FOUND` khi gọi PUT/DELETE/usage**
→ ID câu hỏi không tồn tại hoặc đã bị xóa trước đó. Dùng `GET /api/admin/question-bank`
để tìm lại câu hỏi cần thao tác.

**`QUESTION_BANK_DELETE_BLOCKED` khi DELETE**
→ Còn phiên thi thử đang diễn ra (`IN_PROGRESS`) dùng đề có chứa câu này.
→ Gọi `GET /:id/usage` để xác định đề nào đang có phiên. Chờ phiên kết thúc
(tối đa `durationMinutes` của đề + 30 giây grace period) rồi thử lại.

**`added: 0, skipped: N` khi from-bank**
→ Tất cả câu trong `questionBankIds` đã có trong đề, hoặc tất cả đều
`isActive=false`. Kiểm tra lại danh sách ID và trạng thái của từng câu.

**`added < count, shortage > 0` khi auto-fill**
→ Kho không đủ câu cho môn học của đề thi (với độ khó tương ứng). Hệ thống
lấy hết số câu còn lại trong kho mà không báo lỗi. Để khắc phục: thêm câu hỏi
vào kho trước (`POST /api/admin/question-bank`) rồi gọi auto-fill lại.

**`EXAM_QUESTION_INVALID` khi tạo/cập nhật câu**
→ Kiểm tra quy tắc `options`/`correctAnswer` theo bảng ở mục 8.1.

---

## 9. Bảng xếp hạng & Ảnh đại diện

### 9.1 Bảng xếp hạng (Leaderboard)

Bảng xếp hạng được tính **tự động từ dữ liệu ExamSession** — không cần thao tác
gì từ phía admin. Mọi học sinh đã hoàn thành ít nhất 1 phiên thi thử sẽ tự động
xuất hiện trong bảng xếp hạng.

**API (dùng để kiểm tra / debug):**
```bash
# Xem bảng xếp hạng (cần session token user, không cần Admin Secret)
curl http://localhost:4000/api/leaderboard \
  -H "Authorization: Bearer <session-token>"

# Lọc theo môn Toán
curl "http://localhost:4000/api/leaderboard?subject=TOAN" \
  -H "Authorization: Bearer <session-token>"
```

**Lưu ý vận hành:**
- Bảng xếp hạng dùng raw SQL với CTE phức tạp (STDDEV_POP, ROW_NUMBER) —
  trên DB nhỏ (< 10.000 user) thời gian phản hồi nhanh. Khi lượng ExamSession
  tăng lớn, cân nhắc thêm index hoặc materialized view.
- Không có API admin riêng để can thiệp thứ hạng — dữ liệu xếp hạng hoàn toàn
  phụ thuộc vào `exam_sessions`.

---

### 9.2 Ảnh đại diện — Quản lý file

Ảnh đại diện của người dùng được lưu tại:
```
backend/uploads/avatars/<userId>.jpg   (hoặc .png)
```

**Lưu ý vận hành:**

| Tình huống | Hành động |
|-----------|-----------|
| Server restart | Ảnh vẫn còn vì lưu trên disk (không mất) |
| Deploy lên production | Cần cấu hình **persistent volume** — nếu dùng container (Docker/Heroku), thư mục `uploads/` bị xóa khi redeploy |
| Disk đầy | Kiểm tra `du -sh backend/uploads/avatars/` — mỗi file ≤ 2MB |
| Muốn xóa ảnh 1 user | Xóa file `backend/uploads/avatars/<userId>.*` VÀ set `avatarUrl = NULL` trong DB |

**Kiểm tra ảnh qua HTTP:**
```bash
# Lấy ảnh trực tiếp (không cần token)
curl http://localhost:4000/uploads/avatars/<userId>.jpg -o /tmp/check.jpg
```

**Xóa ảnh user qua SQL (khi cần xử lý admin thủ công):**
```sql
-- Bước 1: Lấy avatarUrl hiện tại
SELECT id, "avatarUrl" FROM users WHERE id = '<userId>';

-- Bước 2: Xóa URL trong DB
UPDATE users SET "avatarUrl" = NULL WHERE id = '<userId>';

-- Bước 3: Xóa file vật lý (chạy từ thư mục backend)
-- rm uploads/avatars/<userId>.jpg
```

> ⚠️ Không xóa chỉ file mà không cập nhật DB (hoặc ngược lại) — sẽ gây lỗi
> "ảnh bị thiếu" trên UI hoặc tốn dung lượng rác.

---

## Phần 9 — Progress Dashboard (Tiến độ học tập)

### Tổng quan cho Admin

Module Progress **không có giao diện quản lý riêng cho admin** — đây là tính năng
hoàn toàn phía người dùng. Tuy nhiên, admin cần biết:

- **Nguồn dữ liệu:** Progress đọc từ `practice_sessions`, `exam_sessions`,
  `user_points`, và `exam_papers`. Không có bảng riêng.
- **Ảnh hưởng khi xóa ExamPaper:** Nếu admin xóa một đề thi đang có trong lịch sử
  thi của user, mục lịch sử đó vẫn hiển thị nhưng tên đề sẽ là
  `"(Đề không còn tồn tại)"` — không gây lỗi hệ thống.
- **Dữ liệu không cache:** Mỗi lần user mở màn hình Tiến độ, backend chạy 9 query
  đến DB. Nếu cần debug hiệu năng, xem log query tại đây.

### Truy vấn debug thủ công

```sql
-- Kiểm tra streak của 1 user
SELECT "completedAt"::date AS day, COUNT(*) AS sessions_that_day
FROM practice_sessions
WHERE "userId" = '<userId>'
  AND "completedAt" IS NOT NULL
GROUP BY day
ORDER BY day DESC
LIMIT 30;

-- Xem toàn bộ lịch sử thi thử 1 user
SELECT es.id, ep.title, ep.subject, es.score, es."pointsAwarded", es."completedAt"
FROM exam_sessions es
LEFT JOIN exam_papers ep ON ep.id = es."examPaperId"
WHERE es."userId" = '<userId>'
  AND es.status = 'COMPLETED'
ORDER BY es."completedAt" DESC;
```

---

## 10. Ôn câu sai — Lưu ý cho Admin

Tính năng Ôn câu sai **không có endpoint admin riêng** — toàn bộ là tính năng
tự phục vụ phía người dùng. Tuy nhiên, admin cần biết các điều sau:

### Bảng `wrong_answers`

Dữ liệu được lưu trong bảng `wrong_answers` với cấu trúc:

| Cột | Mô tả |
|-----|-------|
| `id` | Tự tăng (SERIAL), không phải UUID |
| `userId` | Liên kết tới `users.id` (CASCADE DELETE) |
| `questionId` | Liên kết tới `questions.id` (SET NULL khi xóa) |
| `examQuestionId` | Liên kết tới `exam_questions.id` (SET NULL khi xóa) |
| `wrongCount` | Số lần sai cộng dồn |
| `expiresAt` | Hết hạn sau 14 ngày kể từ lần sai cuối |

### Ảnh hưởng khi admin xóa/ẩn câu hỏi

- **Soft-delete câu hỏi** (`isActive = false`): bản ghi `wrong_answers` vẫn còn
  trong DB nhưng sẽ **không hiển thị** trong danh sách của người dùng.
- **Hard-delete câu hỏi** (xóa khỏi DB): FK `questionId` / `examQuestionId`
  tự động được set NULL (ON DELETE SET NULL). Bản ghi `wrong_answers` vẫn còn
  nhưng không hiển thị và retry sẽ trả 404.
- **Xóa user**: toàn bộ bản ghi `wrong_answers` của user đó bị xóa ngay lập tức
  (ON DELETE CASCADE).

### Dữ liệu tích lũy theo thời gian

Bản ghi hết hạn (`expiresAt < NOW()`) **không bị tự xóa** — chỉ bị bỏ qua khi
query. Để dọn dẹp định kỳ, chạy lệnh SQL sau (nên lên lịch hàng tuần):

```sql
-- Xóa bản ghi câu sai đã hết hạn
DELETE FROM wrong_answers WHERE "expiresAt" < NOW();

-- Kiểm tra số lượng bản ghi hết hạn trước khi xóa
SELECT COUNT(*) FROM wrong_answers WHERE "expiresAt" < NOW();
```

### Truy vấn debug thủ công

```sql
-- Xem câu sai còn hạn của 1 user
SELECT wa.id, wa."wrongCount", wa."expiresAt", wa."questionId", wa."examQuestionId"
FROM wrong_answers wa
WHERE wa."userId" = '<userId>'
  AND wa."expiresAt" > NOW()
ORDER BY wa."lastWrongAt" DESC;

-- Thống kê câu bị sai nhiều nhất trong hệ thống (top 10)
SELECT
  COALESCE(q.question, eq."questionText") AS content,
  COUNT(wa.id) AS total_wrong_records,
  SUM(wa."wrongCount") AS total_wrong_count
FROM wrong_answers wa
LEFT JOIN questions q ON q.id = wa."questionId"
LEFT JOIN exam_questions eq ON eq.id = wa."examQuestionId"
GROUP BY COALESCE(q.question, eq."questionText")
ORDER BY total_wrong_count DESC
LIMIT 10;
```
