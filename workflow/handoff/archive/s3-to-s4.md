# Handoff từ S3-SoatLoi → S4-GhiChep

**Thời gian:** 2026-07-05  
**Branch:** feature/wrong-answer-review

---

[TỪ S3-SOATLOI]

✅ REVIEW + TEST XONG: Ôn Câu Sai (Wrong Answer Review)
🌿 BRANCH: feature/wrong-answer-review

---

## 📋 KẾT QUẢ REVIEW (7 tiêu chí)

- Lỗi tìm thấy: 3
- Đã sửa:
  1. **[CRITICAL]** `exam.service.ts` — `upsertWrongAnswer` bị gọi TRONG transaction callback → khi optimistic lock retry, `wrongCount` cộng thừa nhiều lần. Đã move ra ngoài transaction.
  2. **[INDEX]** Thiếu index `(userId, expiresAt)` trên bảng `wrong_answers` → full table scan. Đã thêm vào `schema.prisma` + migration SQL.
  3. **[FRONTEND LINT]** `setPage(1)` trong `useEffect` vi phạm `react-hooks/set-state-in-effect`. Đã refactor thành `handleSubjectChange` handler.

---

## 🧪 KẾT QUẢ TEST TỰ ĐỘNG

- Unit test: 18 test, 18 pass (framework: vitest, mock Prisma — không cần DB thật)
- Build backend: PASS
- Lint frontend: PASS

---

## 🔍 ĐỐI CHIẾU THIẾT KẾ S1

- ✅ Schema đúng (@@unique, @@index mới bổ sung, onDelete Cascade/SetNull)
- ✅ API GET `/api/wrong-answers` đúng contract (data, total, page, pageSize, subject filter, pagination)
- ✅ API POST `/api/wrong-answers/:id/retry` đúng (isCorrect, correctAnswer, explanation — KHÔNG ghi điểm)
- ✅ upsert cộng dồn wrongCount + reset expiresAt 14 ngày
- ✅ Soft-delete handled, retry đúng không ghi điểm
- ✅ Tất cả 7 TASK hoàn thành

---

## 📁 FILES ĐÃ THAY ĐỔI (tổng hợp S2 + S3)

**Backend:**
- `backend/prisma/schema.prisma` — thêm model WrongAnswer + @@index([userId, expiresAt])
- `backend/prisma/migrations/20260704154329_add_wrong_answer_table/` — migration mới + index
- `backend/src/services/wrongAnswer/wrongAnswer.service.ts` — service mới: upsertWrongAnswer, getWrongAnswers, retryQuestion
- `backend/src/services/wrongAnswer/wrongAnswer.types.ts` — types mới
- `backend/src/services/wrongAnswer/wrongAnswer.errors.ts` — WrongAnswerNotFoundError
- `backend/src/services/wrongAnswer/__tests__/wrongAnswer.service.test.ts` — 18 unit test (S3 viết)
- `backend/src/routes/wrongAnswer.route.ts` — 2 endpoints: GET + POST retry
- `backend/src/app.ts` — đăng ký route + error code mapping
- `backend/src/services/exam/exam.service.ts` — hook upsertWrongAnswer vào submitExam (đã fix race condition)
- `backend/src/services/practice/practice.service.ts` — hook upsertWrongAnswer vào submitAnswer
- `backend/vitest.config.ts` — cấu hình test framework (S3 thêm)
- `backend/package.json` — thêm vitest dependency + test scripts (S3 thêm)

**Frontend:**
- `frontend/src/App.tsx` — thêm Screen 'wrongAnswers', WrongAnswersPage, WrongAnswerCard, WrongAnswerRetry, nút từ ProfilePage; sửa lint error
- `frontend/src/lib/api.ts` — thêm types + hàm getWrongAnswers, retryWrongAnswer

**Docs:**
- `docs/TEST_CASES.md` — append 25 test cases
- `docs/CODE_REVIEW_LOG.md` — append review log

---

## 🌐 API ĐÃ TRIỂN KHAI

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/api/wrong-answers?subjectId=&page=&pageSize=` | Danh sách câu sai chưa hết hạn, filter môn, phân trang |
| POST | `/api/wrong-answers/:id/retry` | Làm lại câu sai — không ghi điểm |

**Response GET:**
```json
{
  "data": [{ "id": 1, "wrongCount": 3, "lastWrongAt": "...", "expiresAt": "...", "source": "practice", "question": {...} }],
  "total": 25,
  "page": 1,
  "pageSize": 20
}
```

**Response POST retry:**
```json
{ "isCorrect": true, "correctAnswer": 2, "explanation": "..." }
```

---

## 🗄️ DATABASE

- Bảng mới: `wrong_answers` (id, userId, questionId?, examQuestionId?, wrongCount, lastWrongAt, expiresAt)
- Ràng buộc: @@unique([userId, questionId]), @@unique([userId, examQuestionId])
- Index: @@index([userId, expiresAt])
- onDelete: CASCADE cho userId, SET NULL cho questionId/examQuestionId (khi câu hỏi bị xóa)

---

## ⚠️ LƯU Ý CHO SESSION 4

1. S2 đã implement đầy đủ tất cả 7 TASK theo thiết kế S1
2. S3 đã sửa 3 lỗi quan trọng (xem mục Review ở trên)
3. Unit test framework là **vitest** (mới, không có từ trước) — cần ghi vào tài liệu
4. Câu sai từ Practice dùng `questionId` (FK → questions), từ Exam dùng `examQuestionId` (FK → exam_questions)
5. 14 ngày tính từ **lần sai gần nhất** (mỗi lần sai thêm sẽ reset 14 ngày)

---

👉 Yêu cầu: Viết/cập nhật tài liệu đầy đủ cho tính năng này.
