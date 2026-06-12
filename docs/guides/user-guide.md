# Hướng dẫn Người dùng — QuizzGame

> Tài liệu này mô tả các tính năng từ góc nhìn người dùng và cách tích hợp
> phía frontend (FE). Dành cho developer FE hoặc tester.

---

## Mục lục

1. [Đăng nhập & Onboarding](#1-đăng-nhập--onboarding)
2. [Chế độ Ôn tập](#2-chế-độ-ôn-tập)
3. [Xem lịch sử & thống kê](#3-xem-lịch-sử--thống-kê)
4. [Quản lý hồ sơ cá nhân](#4-quản-lý-hồ-sơ-cá-nhân)
5. [FAQ — Câu hỏi thường gặp](#5-faq--câu-hỏi-thường-gặp)

---

## 1. Đăng nhập & Onboarding

### Bước 1 — Đăng nhập qua Firebase

Sử dụng Firebase Auth SDK phía FE để đăng nhập (Google, Email, hoặc SĐT).
Sau đó lấy Firebase ID Token:

```javascript
const idToken = await firebase.auth().currentUser.getIdToken(true);
```

### Bước 2 — Đổi lấy Session Token

```
POST /api/auth/login
Authorization: Bearer <firebase-id-token>
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
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
    "createdAt": "2026-06-09T10:00:00.000Z",
    "lastLoginAt": "2026-06-09T10:00:00.000Z"
  }
}
```

> **Quan trọng:** Lưu `token` vào SecureStorage (không dùng localStorage trên
> ứng dụng mobile). Token này hết hạn sau **7 ngày**.

### Bước 3 — Onboarding: Chọn môn học

Nếu `isNewUser === true`, điều hướng tới màn hình chọn môn học:

```
POST /api/users/subjects
Authorization: Bearer <session-token>
Content-Type: application/json

{
  "subjects": [
    { "id": "TOAN" },
    { "id": "VAN" },
    { "id": "ANH" }
  ]
}
```

**Danh sách môn hợp lệ:**

| Mã | Tên môn |
|----|---------|
| `TOAN` | Toán |
| `VAN` | Ngữ văn |
| `ANH` | Tiếng Anh |
| `LY` | Vật lý |
| `HOA` | Hóa học |
| `SINH` | Sinh học |
| `SU` | Lịch sử |
| `DIA` | Địa lý |
| `GDCD` | Giáo dục công dân |

**Ràng buộc:** Tối thiểu 1 môn, tối đa 7 môn. Có thể gọi lại bất kỳ lúc nào
để thay đổi danh sách.

### Tất cả request sau đó

Thêm header vào mọi request cần đăng nhập:
```
Authorization: Bearer <session-token>
```

Khi token hết hạn (API trả `401 INVALID_SESSION_TOKEN`), gọi lại Firebase để
lấy ID Token mới → POST `/api/auth/login` → nhận session token mới.

---

## 2. Chế độ Ôn tập

### Tổng quan luồng

```
Chọn môn học
     ↓
GET /practice/start?subject=TOAN
     ↓ Nhận 15 câu hỏi
Hiển thị từng câu (timer đếm ngược)
     ↓
POST /practice/answer (mỗi câu)
     ↓ Nhận kết quả ngay sau mỗi câu
Khi xong hoặc hết giờ
     ↓
POST /practice/complete
     ↓ Nhận điểm tổng kết
```

---

### 2.1 Bắt đầu phiên ôn tập

```
GET /api/practice/start?subject=TOAN
Authorization: Bearer <session-token>
```

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

**Lưu ý FE:**
- `timeLimitSeconds = 1020` = **17 phút** (15 phút làm bài + 2 phút buffer).
- Lưu `sessionId` và `startedAt` để tính đếm ngược phía FE.
- `questions` trả về **không có** `correctAnswer` và `explanation` — chỉ nhận
  sau khi nộp đáp án.
- 15 câu được phân bổ: 5 câu dễ (difficulty=1) + 5 trung bình (2) + 5 khó (3).
- Hệ thống ưu tiên câu **chưa làm trong 24h** để tránh lặp lại.

**Lỗi có thể gặp:**

| Lỗi | Nguyên nhân | Cách xử lý |
|-----|-------------|------------|
| `403 SUBJECT_NOT_REGISTERED` | Chưa đăng ký môn này | Hướng dẫn user vào Settings → Chọn môn |
| `404 SUBJECT_HAS_NO_QUESTIONS` | Môn chưa có câu hỏi trong hệ thống | Thông báo "Chưa có câu hỏi cho môn này" |
| `429 PRACTICE_RATE_LIMIT_EXCEEDED` | Tạo quá 10 phiên trong 1 giờ | Thông báo thời gian cần chờ |

---

### 2.2 Nộp đáp án từng câu

Gọi ngay sau khi user chọn đáp án. Không cần chờ hết 15 câu.

```
POST /api/practice/answer
Authorization: Bearer <session-token>
Content-Type: application/json

{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "questionId": "q-uuid-1",
  "selectedOption": 0
}
```

> `selectedOption`: số nguyên 0–3 tương ứng với vị trí trong mảng `options`.

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

**Tính năng idempotent:** Gọi lại cùng `sessionId` + `questionId` → nhận lại
kết quả cũ, không insert thêm. Hữu ích khi mạng không ổn định.

**Lỗi có thể gặp:**

| Lỗi | Nguyên nhân | Cách xử lý |
|-----|-------------|------------|
| `410 PRACTICE_SESSION_EXPIRED` | Quá 17 phút | Kết thúc phiên, hiện màn hình hết giờ |
| `409 PRACTICE_SESSION_ALREADY_COMPLETED` | Phiên đã hoàn thành | Redirect tới kết quả |
| `400 QUESTION_NOT_IN_SESSION` | questionId sai | Bug FE — kiểm tra lại |

---

### 2.3 Hoàn thành phiên

Gọi khi user bấm "Nộp bài" hoặc hết giờ:

```
POST /api/practice/complete
Authorization: Bearer <session-token>
Content-Type: application/json

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

**Sau khi hoàn thành:**
- `score` = số câu đúng; `pointsEarned` = điểm tích lũy được (= score, mỗi câu đúng = 1 điểm).
- `answers` chứa kết quả **tất cả câu** đã trả lời kèm đáp án đúng và giải thích.
- Có thể gọi `GET /api/users/me` để xem số điểm tích lũy mới nhất.

---

### 2.4 Resume phiên đang dở

Nếu user thoát giữa chừng và quay lại, lấy lại trạng thái phiên:

```
GET /api/practice/session/:sessionId
Authorization: Bearer <session-token>
```

**Response (200):**
```json
{
  "sessionId": "550e8400-...",
  "subjectId": "TOAN",
  "questions": [ ...15 câu (không có correctAnswer)... ],
  "answers": [
    { "questionId": "q-uuid-1", "selectedOption": 0, "isCorrect": true }
  ],
  "timeRemainingSeconds": 754,
  "startedAt": "2026-06-09T10:00:00.000Z"
}
```

- `answers`: danh sách câu đã trả lời — dùng để highlight câu đã làm trên UI.
- `timeRemainingSeconds`: thời gian còn lại (giây). Có thể âm nếu đã quá giờ.
- Thứ tự `questions` giống hệt lúc bắt đầu.

---

### 2.5 Xem giải thích câu hỏi (sau khi làm xong)

```
GET /api/practice/questions/:questionId/explain
Authorization: Bearer <session-token>
```

> Chỉ có thể xem giải thích của câu **đã từng làm** trong bất kỳ phiên nào.

**Response (200):**
```json
{
  "correctAnswer": 0,
  "explanation": "Điều kiện: x−1 ≥ 0 ⟺ x ≥ 1 → TXĐ: [1;+∞)"
}
```

**Lỗi:**
- `403 QUESTION_NOT_ATTEMPTED`: Chưa làm câu này → không cho xem giải thích.
- `404 QUESTION_NOT_FOUND`: questionId không tồn tại.

---

### 2.6 Báo cáo câu hỏi sai

Nếu phát hiện câu hỏi có nội dung sai, không rõ, hoặc lỗi chính tả:

```
POST /api/practice/questions/:questionId/report
Authorization: Bearer <session-token>
Content-Type: application/json

{
  "reason": "WRONG_ANSWER",
  "description": "Đáp án C mới là đúng vì y' = 3x² − 3 > 0 khi..."
}
```

> ⚠️ Chỉ báo cáo được câu hỏi user **đã từng làm** (đã trả lời trong ít nhất
> 1 phiên — có bản ghi `user_question_history`, giống điều kiện ở mục 2.5).

**Lý do báo cáo:**

| Mã | Ý nghĩa |
|----|---------|
| `WRONG_ANSWER` | Đáp án sai |
| `BAD_CONTENT` | Nội dung không phù hợp |
| `TYPO` | Lỗi chính tả |
| `OTHER` | Lý do khác |

`description` tùy chọn, tối đa 500 ký tự.

**Response (201):**
```json
{ "message": "Da gui bao cao thanh cong." }
```

**Lỗi:**

| Lỗi | Nguyên nhân | Cách xử lý trên UI |
|-----|-------------|---------------------|
| `409 REPORT_ALREADY_SUBMITTED` | Đã báo cáo câu này rồi (1 lần/câu) | Hiện "✓ Bạn đã báo cáo câu này rồi" — coi như thành công, đóng hộp báo lỗi |
| `403 QUESTION_NOT_ATTEMPTED_FOR_REPORT` | Chưa từng làm câu hỏi này | Hiện "Bạn cần làm câu hỏi này trước khi báo cáo." ngay trong hộp báo lỗi, **không** đóng hộp |
| `404 QUESTION_NOT_FOUND` | questionId không tồn tại | Bug FE — kiểm tra lại |

**Lưu ý FE (UI hộp báo lỗi trong `PracticeSessionScreen`):**
- Hộp báo lỗi có 1 ô `<textarea>` nhập mô tả thêm (tuỳ chọn, tối đa 500 ký
  tự) phía trên 4 nút lý do — bấm 1 nút lý do là gửi báo cáo ngay (mô tả đi
  kèm nếu có nhập).
- Vì `PracticeSessionScreen` không unmount giữa các câu (chỉ đổi
  `currentIndex`), toàn bộ state của hộp báo lỗi (hiện/ẩn hộp, đã gửi chưa,
  nội dung mô tả, thông báo, lỗi) được **reset mỗi khi chuyển sang câu khác**
  — tránh hiện nhầm "Đã gửi báo lỗi" của câu trước cho câu hiện tại.

---

## 3. Xem lịch sử & thống kê

### 3.1 Lịch sử phiên ôn tập

```
GET /api/practice/history?limit=20&offset=0
Authorization: Bearer <session-token>
```

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
  "total": 5,
  "limit": 20,
  "offset": 0
}
```

Phân trang: `limit` tối đa 100, `offset` là số phiên bỏ qua.

---

### 3.2 Thống kê theo môn học

```
GET /api/practice/stats
GET /api/practice/stats?subject=TOAN
Authorization: Bearer <session-token>
```

**Response (200):**
```json
[
  {
    "subject": "TOAN",
    "totalSessions": 5,
    "avgScore": 10.6,
    "bestScore": 13,
    "accuracyByDifficulty": {
      "1": 0.96,
      "2": 0.74,
      "3": 0.52
    }
  }
]
```

`accuracyByDifficulty`: tỉ lệ đúng theo độ khó (0.0–1.0 = 0%–100%).

---

### 3.3 Hồ sơ cá nhân + Điểm tích lũy

```
GET /api/users/me
Authorization: Bearer <session-token>
```

**Response (200):**
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
    { "id": "VAN", "name": "Ngữ văn" }
  ],
  "createdAt": "2026-06-09T10:00:00.000Z",
  "lastLoginAt": "2026-06-09T10:00:00.000Z",
  "points": 62
}
```

---

## 4. Quản lý hồ sơ cá nhân

### Cập nhật thông tin

```
PUT /api/users/profile
Authorization: Bearer <session-token>
Content-Type: application/json

{
  "displayName": "Nguyễn Thị B",
  "school": "THPT Lê Hồng Phong",
  "province": "TP. Hồ Chí Minh"
}
```

**Các trường có thể cập nhật:** `displayName`, `phone`, `school`, `province`.

**Nguyên tắc partial update:**
- Trường vắng mặt trong body → giữ nguyên giá trị cũ.
- Trường gửi `null` → xóa (set về null).
- Trường gửi chuỗi → trim và lưu (tối đa 100 ký tự).

**Ví dụ xóa trường school:**
```json
{ "school": null }
```

Response trả về hồ sơ đầy đủ sau cập nhật (giống `GET /api/users/me`).

---

### Thay đổi danh sách môn học

```
POST /api/users/subjects
Authorization: Bearer <session-token>
Content-Type: application/json

{
  "subjects": [
    { "id": "TOAN" },
    { "id": "LY" },
    { "id": "HOA" }
  ]
}
```

Response:
```json
{
  "subjects": [
    { "id": "TOAN", "name": "Toán" },
    { "id": "LY", "name": "Vật lý" },
    { "id": "HOA", "name": "Hóa học" }
  ]
}
```

---

## 5. FAQ — Câu hỏi thường gặp

**Q: Tôi đang làm bài thì app bị tắt, có mất phiên không?**

A: Không mất. Dùng `GET /api/practice/session/:sessionId` để lấy lại trạng thái
phiên (câu đã làm + thời gian còn lại). Phiên hết hạn sau 17 phút kể từ khi
bắt đầu.

---

**Q: Tôi gọi nộp đáp án 2 lần cùng lúc, có bị tính 2 lần không?**

A: Không. API `/practice/answer` idempotent — gọi lại cùng `sessionId` +
`questionId` → nhận kết quả cũ. Chỉ 1 bản ghi được lưu trong DB.

---

**Q: Tại sao tôi không thể xem giải thích câu hỏi?**

A: Giải thích chỉ hiển thị sau khi bạn đã **trả lời câu đó** trong ít nhất 1
phiên. Nếu bạn bắt đầu phiên mới nhưng thoát trước khi nộp câu đó, bạn chưa
"đã làm" câu này.

---

**Q: Tôi báo cáo câu hỏi sai rồi nhưng câu vẫn còn đó?**

A: Câu hỏi chỉ bị ẩn tự động khi có **≥ 5 báo cáo PENDING**. Admin cũng có thể
ẩn câu thủ công sau khi xem xét báo cáo của bạn. Cảm ơn vì đã đóng góp để cải
thiện chất lượng đề thi!

---

**Q: Tại sao tôi bấm "Báo lỗi" mà bị báo "Bạn cần làm câu hỏi này trước khi
báo cáo"?**

A: Bạn chỉ có thể báo cáo câu hỏi mà bạn **đã từng trả lời** trong ít nhất 1
phiên ôn tập (tương tự điều kiện xem giải thích ở câu hỏi phía trên). Đây là
cơ chế chống spam báo cáo câu hỏi bạn chưa từng thấy. Hãy làm câu hỏi đó
trước, rồi báo cáo lại sau.

---

**Q: Tôi vào ôn tập nhưng bị lỗi "Không có câu hỏi nào"?**

A: Môn đó chưa có câu hỏi trong hệ thống. Liên hệ admin để thêm câu hỏi cho
môn này.

---

**Q: Token của tôi hết hạn sau bao lâu?**

A: Session token hết hạn sau **7 ngày** kể từ lần đăng nhập. Khi hết hạn, API
trả về `401 INVALID_SESSION_TOKEN`. FE cần tự động gọi lại Firebase để lấy
ID Token mới → gọi lại `POST /api/auth/login` → nhận session token mới.

---

**Q: Mỗi ngày tôi có thể ôn tập tối đa bao nhiêu phiên?**

A: Hệ thống giới hạn **10 phiên/giờ/tài khoản** để ngăn spam. Nếu vượt quá,
API trả về `429 PRACTICE_RATE_LIMIT_EXCEEDED` — chờ 1 tiếng rồi thử lại.
Không có giới hạn tổng số phiên mỗi ngày.
