# Handoff từ S1-KienTrucSu → S2-ThoCode

**Thời gian:** 2026-07-04  
**Branch:** feature/wrong-answer-review

---

[TỪ S1-KIENTRUCSU]

🎯 TÍNH NĂNG CẦN LÀM: Ôn câu sai — Wrong Answer Review
🌿 BRANCH: feature/wrong-answer-review

---

## 📝 TÓM TẮT YÊU CẦU NGƯỜI DÙNG

Thêm 1 trang riêng tên **"Ôn câu sai"**, nơi học sinh xem lại toàn bộ những câu đã trả lời sai — từ cả bài luyện tập (Practice) lẫn thi thử (Exam). Nếu cùng 1 câu sai nhiều lần thì chỉ hiện 1 lần nhưng có hiển thị **số lần đã sai**. Học sinh có thể lọc theo môn, xem đáp án đúng, và làm lại câu đó — nhưng việc làm lại **không tính điểm, không ảnh hưởng xếp hạng**. Câu sai tự xóa sau **14 ngày kể từ lần sai gần nhất**.

---

## 🔧 CHI TIẾT KỸ THUẬT

### DB schema mới — bảng `WrongAnswer`

Thêm model vào `backend/prisma/schema.prisma`:

```prisma
model WrongAnswer {
  id           Int      @id @default(autoincrement())
  userId       String
  questionId   Int
  wrongCount   Int      @default(1)
  lastWrongAt  DateTime @default(now())
  expiresAt    DateTime

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  question     Question @relation(fields: [questionId], references: [id], onDelete: Cascade)

  @@unique([userId, questionId])
}
```

- `expiresAt = lastWrongAt + 14 ngày`
- Ràng buộc `@@unique([userId, questionId])` đảm bảo không trùng lặp
- Khi cùng câu sai lần nữa → **upsert**: tăng `wrongCount`, cập nhật `lastWrongAt` và `expiresAt`

### Ghi nhận câu sai

Tại 2 nơi trong backend hiện có:
- **Practice flow**: khi học sinh trả lời sai 1 câu trong bài luyện tập → upsert WrongAnswer
- **Exam flow**: khi chấm điểm bài thi → với mỗi câu sai → upsert WrongAnswer

Logic upsert:
```
IF (userId, questionId) đã tồn tại:
  wrongCount += 1
  lastWrongAt = now()
  expiresAt = now() + 14 days
ELSE:
  INSERT mới với wrongCount = 1, lastWrongAt = now(), expiresAt = now() + 14 days
```

### API Endpoints mới

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/wrong-answers?subjectId=<optional>&page=<n>&pageSize=20` | Danh sách câu sai (chưa hết hạn) của user đang đăng nhập |
| POST | `/api/wrong-answers/:questionId/retry` | Nộp đáp án làm lại — không ghi điểm |

**Response GET /api/wrong-answers:**
```json
{
  "data": [
    {
      "questionId": 42,
      "wrongCount": 3,
      "lastWrongAt": "2026-07-01T10:00:00Z",
      "expiresAt": "2026-07-15T10:00:00Z",
      "question": {
        "id": 42,
        "content": "Nội dung câu hỏi...",
        "type": "MCQ_4" | "TRUE_FALSE_4" | "FILL_BLANK",
        "subjectId": 1,
        "subjectName": "Toán",
        "options": [...],
        "correctAnswer": "..."
      }
    }
  ],
  "total": 25,
  "page": 1,
  "pageSize": 20
}
```

**Request POST /api/wrong-answers/:questionId/retry:**
```json
{ "answer": "A" }
```

**Response POST /api/wrong-answers/:questionId/retry:**
```json
{
  "isCorrect": true | false,
  "correctAnswer": "B",
  "explanation": "..." (nếu có)
}
```

### Files cần tạo/chỉnh sửa

**Backend:**
- `backend/prisma/schema.prisma` — thêm model `WrongAnswer`
- `backend/prisma/migrations/` — migration mới
- `backend/src/services/wrongAnswer.service.ts` — **file mới**: upsertWrongAnswer(), getWrongAnswers(), retryQuestion()
- `backend/src/routes/wrongAnswer.route.ts` — **file mới**: 2 endpoint
- `backend/src/app.ts` — đăng ký route `/api/wrong-answers`
- `backend/src/services/practice.service.ts` (hoặc controller tương đương) — thêm gọi upsertWrongAnswer khi trả lời sai
- Exam grading logic — thêm gọi upsertWrongAnswer cho từng câu sai sau khi chấm

**Frontend:**
- `frontend/src/App.tsx` — thêm screen `'wrongAnswers'` vào type Screen
- `frontend/src/pages/WrongAnswersPage.tsx` — **file mới**, UI đầy đủ
- `frontend/src/pages/ProfilePage.tsx` — thêm nút điều hướng đến WrongAnswersPage

### Edge cases

1. Câu hỏi bị soft-delete khỏi hệ thống → bỏ qua khi query (join với Question, kiểm tra deleted flag)
2. Làm lại đúng → KHÔNG xóa khỏi danh sách, vẫn giữ đến hết 14 ngày
3. Retry hỗ trợ cả 3 loại câu: `MCQ_4`, `TRUE_FALSE_4`, `FILL_BLANK`
4. Query phải có điều kiện `WHERE expiresAt > NOW()` để chỉ hiện câu chưa hết hạn

---

## 📋 DANH SÁCH TASK

**TASK 1:** Tạo model `WrongAnswer` trong schema.prisma + chạy migration
- Output: bảng mới với unique constraint (userId, questionId), Prisma Client tái sinh
- Phụ thuộc: không

**TASK 2:** Backend — Service `upsertWrongAnswer()` + hook vào Practice flow
- Viết hàm upsert trong `wrongAnswer.service.ts`
- Tìm chỗ xử lý đáp án sai trong Practice và gọi hàm này
- Output: mỗi câu sai trong bài luyện tập được tự động lưu/cộng dồn vào DB
- Phụ thuộc: TASK 1

**TASK 3:** Backend — Hook `upsertWrongAnswer()` vào Exam grading flow
- Tìm chỗ chấm điểm bài thi và gọi hàm upsert cho từng câu sai
- Output: mỗi câu sai trong bài thi được tự động lưu/cộng dồn vào DB
- Phụ thuộc: TASK 1 (TASK 2 và TASK 3 có thể làm song song)

**TASK 4:** Backend — API GET `/api/wrong-answers`
- Query WrongAnswer JOIN Question JOIN Subject, filter theo subjectId (optional), chỉ lấy `expiresAt > NOW()`, phân trang 20 câu/trang, trả đủ thông tin câu hỏi kèm `wrongCount`
- Output: endpoint hoạt động đúng
- Phụ thuộc: TASK 1

**TASK 5:** Backend — API POST `/api/wrong-answers/:questionId/retry`
- Nhận đáp án từ client, so sánh với đáp án đúng của câu hỏi, trả `isCorrect` + `correctAnswer`
- Không gọi bất kỳ logic tính điểm hay cập nhật leaderboard nào
- Hỗ trợ cả 3 loại câu MCQ_4 / TRUE_FALSE_4 / FILL_BLANK
- Output: endpoint hoạt động cho cả 3 loại câu
- Phụ thuộc: TASK 4

**TASK 6:** Frontend — Trang WrongAnswersPage
- Dropdown filter môn học (giống pattern đang dùng ở các trang khác)
- Danh sách câu sai: hiện nội dung câu, badge "Sai X lần", ngày hết hạn
- Với mỗi câu: nút "Xem đáp án" (toggle hiện đáp án đúng tại chỗ) + nút "Làm lại" (mở mini quiz inline hoặc modal)
- Khi làm lại: hiện đúng/sai nhưng không cộng/trừ điểm, không thay đổi gì trong DB
- Phân trang 20 câu/trang
- Output: trang đầy đủ, UI rõ ràng, dễ dùng
- Phụ thuộc: TASK 4, TASK 5

**TASK 7:** Frontend — Thêm nút vào trang hồ sơ cá nhân (ProfilePage)
- Thêm nút/card "Ôn câu sai" dẫn đến WrongAnswersPage (tương tự nút "Bảng xếp hạng" đang có)
- Thêm `'wrongAnswers'` vào type Screen trong App.tsx
- Output: học sinh điều hướng được đến trang từ ProfilePage
- Phụ thuộc: TASK 6

---

## ⚠️ LƯU Ý ĐẶC BIỆT

1. **KHÔNG ghi điểm khi retry** — đây là yêu cầu cứng từ người dùng, tuyệt đối không tích hợp với scoring system
2. **14 ngày tính từ lần sai gần nhất** (không phải lần đầu tiên sai) — mỗi lần sai thêm sẽ reset lại 14 ngày
3. **Upsert, không insert** — nếu (userId, questionId) đã tồn tại thì tăng `wrongCount` và cập nhật thời gian, không tạo bản ghi mới
4. Câu hỏi bị xóa mềm → bỏ qua trong query, không crash
5. Làm lại đúng → không xóa khỏi danh sách WrongAnswer (để ôn thêm cho đến hết 14 ngày)
