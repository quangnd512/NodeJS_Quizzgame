# Test Cases — QuizzGame

---

## Test Cases: Practice Module (Ôn tập)

### 1. POST /api/practice/start (Bắt đầu phiên)

#### Happy Path
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 1 | Bắt đầu phiên bình thường | userId hợp lệ, subjectId đã đăng ký, DB có đủ 15+ câu | 201 + `{ sessionId, questions: [15 câu], timeLimitSeconds: 1020 }` |
| 2 | Subject có câu chưa làm trong 24h | Có câu mới | Questions ưu tiên câu chưa làm gần đây |
| 3 | Subject chỉ có 8 câu (ít hơn 15) | DB chỉ có 8 câu | 201 + `{ questions: [8 câu] }` — không throw |

#### Edge Cases
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 4 | Không có câu nào cho môn học | subjectId hợp lệ nhưng 0 câu trong DB | 404 + `{ error: 'SUBJECT_HAS_NO_QUESTIONS' }` |
| 5 | Rate limit — tạo 10 phiên trong 1 giờ | 11 lần gọi cùng userId | Lần 11: 429 + `{ error: 'PRACTICE_RATE_LIMIT_EXCEEDED' }` |
| 6 | Redis down | Redis không kết nối được | Vẫn tạo được phiên (rate limit bị bỏ qua, không crash) |

#### Error Cases
| # | Mô tả | Input | Expected HTTP | Expected Error Code |
|---|-------|-------|---------------|---------------------|
| 7 | Thiếu query param `subject` | GET /start (không có ?subject=) | 400 | `INVALID_REQUEST_BODY` |
| 8 | Subject không hợp lệ | `subject=INVALID_MON` | 403 | `SUBJECT_NOT_REGISTERED` |
| 9 | User chưa đăng ký môn học | userId chưa có TOAN trong subjects | 403 | `SUBJECT_NOT_REGISTERED` |
| 10 | Không có token | Header thiếu Authorization | 401 | `MISSING_AUTH_TOKEN` |

---

### 2. POST /api/practice/answer (Nộp đáp án)

#### Happy Path
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 1 | Trả lời đúng | selectedOption = correctAnswer | 200 + `{ isCorrect: true, correctAnswer, answeredCount: N }` |
| 2 | Trả lời sai | selectedOption ≠ correctAnswer | 200 + `{ isCorrect: false, correctAnswer, explanation }` |
| 3 | Gọi lại với cùng sessionId + questionId (idempotent) | Body giống hệt lần trước | 200 + kết quả cũ (không insert thêm) |

#### Edge Cases
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 4 | 2 request cùng lúc cho cùng câu (race condition) | 2 POST đồng thời, cùng sessionId + questionId | Cả 2 đều trả 200, không có 500 (P2002 được xử lý) |
| 5 | Phiên đã hết giờ (> 17 phút) | Gọi sau 17 phút kể từ startedAt | 410 + `{ error: 'PRACTICE_SESSION_EXPIRED' }` |

#### Error Cases
| # | Mô tả | Input | Expected HTTP | Expected Error Code |
|---|-------|-------|---------------|---------------------|
| 6 | sessionId không tồn tại | sessionId = UUID ngẫu nhiên | 404 | `PRACTICE_SESSION_NOT_FOUND` |
| 7 | Phiên của user khác | sessionId của userB, gọi bởi userA | 403 | `PRACTICE_SESSION_NOT_OWNED` |
| 8 | Phiên đã hoàn thành | sessionId đã complete | 409 | `PRACTICE_SESSION_ALREADY_COMPLETED` |
| 9 | questionId không trong phiên | questionId hợp lệ nhưng không thuộc session | 400 | `QUESTION_NOT_IN_SESSION` |
| 10 | selectedOption ngoài khoảng 0-3 | `selectedOption: 4` | 400 | `INVALID_REQUEST_BODY` |
| 11 | sessionId không phải UUID | `sessionId: "abc"` | 400 | `INVALID_REQUEST_BODY` |

---

### 3. POST /api/practice/complete (Hoàn thành phiên)

#### Happy Path
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 1 | Hoàn thành phiên đã trả lời 15/15 câu | sessionId hợp lệ | 200 + `{ score, pointsEarned, totalQuestions: N, answers: [...] }` |
| 2 | Hoàn thành phiên trả lời 0 câu (score=0) | sessionId chưa có answer | 200 + `{ score: 0, pointsEarned: 0 }` — không cộng điểm |
| 3 | Phiên có race condition cộng điểm | Gọi song song cùng sessionId từ 2 tab | Cả 2 đều nhận kết quả đúng (1 cái 409, cái kia 200) |

#### Error Cases
| # | Mô tả | Input | Expected HTTP | Expected Error Code |
|---|-------|-------|---------------|---------------------|
| 4 | Gọi lại sau khi đã complete | Gọi lần 2 | 409 | `PRACTICE_SESSION_ALREADY_COMPLETED` |
| 5 | sessionId không tồn tại | UUID ngẫu nhiên | 404 | `PRACTICE_SESSION_NOT_FOUND` |
| 6 | Phiên của user khác | sessionId của userB | 403 | `PRACTICE_SESSION_NOT_OWNED` |

---

### 4. GET /api/practice/session/:id (Chi tiết phiên đang dở)

#### Happy Path
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 1 | Lấy phiên đang dở | sessionId chưa complete | 200 + `{ questions, answers (đã trả lời), timeRemainingSeconds }` |
| 2 | Thứ tự câu hỏi đúng với khi tạo | Phiên có 15 câu | Thứ tự câu trong response khớp với lúc startSession |

#### Error Cases
| # | Mô tả | Input | Expected HTTP | Expected Error Code |
|---|-------|-------|---------------|---------------------|
| 3 | Phiên đã complete | sessionId đã complete | 409 | `PRACTICE_SESSION_ALREADY_COMPLETED` |

---

### 5. GET /api/practice/questions/:id/explain (Xem giải thích)

#### Happy Path
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 1 | User đã làm câu hỏi đó | questionId trong lịch sử của user | 200 + `{ correctAnswer, explanation }` |

#### Error Cases
| # | Mô tả | Input | Expected HTTP | Expected Error Code |
|---|-------|-------|---------------|---------------------|
| 2 | User chưa làm câu đó bao giờ | questionId hợp lệ nhưng chưa có trong history | **403** | `QUESTION_NOT_ATTEMPTED` |
| 3 | questionId không tồn tại | UUID ngẫu nhiên | 404 | `QUESTION_NOT_FOUND` |

---

### 6. POST /api/practice/questions/:id/report (Báo cáo câu hỏi)

#### Happy Path
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 1 | Báo cáo lần đầu | reason + questionId hợp lệ | 201 + `{ message: 'Da gui bao cao thanh cong.' }` |
| 2 | Câu bị ≥5 báo cáo PENDING | questionId đã có 4 PENDING, user thứ 5 báo | question.isActive → false |

#### Edge Cases
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 3 | 2 user báo cáo cùng lúc (race condition) | 2 POST đồng thời cùng userId + questionId | Cả 2 đều trả lời đúng — không có 500 (P2002 → 409) |

#### Error Cases
| # | Mô tả | Input | Expected HTTP | Expected Error Code |
|---|-------|-------|---------------|---------------------|
| 4 | Báo cáo lần 2 | Cùng userId + questionId | 409 | `REPORT_ALREADY_SUBMITTED` |
| 5 | questionId không tồn tại | UUID ngẫu nhiên | 404 | `QUESTION_NOT_FOUND` |
| 6 | Reason không hợp lệ | `reason: "FAKE_REASON"` | 400 | `INVALID_REQUEST_BODY` |
| 7 | User chưa từng làm câu hỏi này | questionId hợp lệ nhưng user chưa có `UserQuestionHistory` cho câu đó | 403 | `QUESTION_NOT_ATTEMPTED_FOR_REPORT` |

---

### 7. Admin — POST /api/admin/questions/bulk

#### Happy Path
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 1 | Nhập batch 100 câu hợp lệ | Array 100 questions | 201 + `{ inserted: 100, questions: [...] }` |

#### Error Cases
| # | Mô tả | Input | Expected HTTP | Expected Error Code |
|---|-------|-------|---------------|---------------------|
| 2 | 1 câu trong batch không hợp lệ | options chỉ có 3 phần tử | 400 | `INVALID_REQUEST_BODY` |
| 3 | Vượt quá 500 câu | Array 501 câu | 400 | `INVALID_REQUEST_BODY` |
| 4 | Thiếu X-Admin-Secret header | Header không có | 401 | `ADMIN_UNAUTHORIZED` |
| 5 | X-Admin-Secret sai | Header có nhưng sai | 401 | `ADMIN_UNAUTHORIZED` |

---

### 8. Admin — GET /api/admin/questions/reports (Danh sách báo cáo)

#### Happy Path
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 1 | Lấy danh sách báo cáo (mặc định) | không truyền query | 200 + `{ items: QuestionReportDto[], total }`, mới nhất trước |
| 2 | Lọc theo trạng thái | `?status=PENDING` | 200 + chỉ chứa report có `status: "PENDING"` |
| 3 | Phân trang | `?page=2&limit=10` | 200 + `items` là trang 2, tối đa 10 phần tử |

#### Edge Cases
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 4 | `status` không khớp giá trị hợp lệ nào | `?status=FOO_BAR` | 200 + `{ items: [], total: 0 }` (không có report nào có status này, KHÔNG trả lỗi 400) |
| 5 | Không có báo cáo nào trong DB | DB trống | 200 + `{ items: [], total: 0 }` |
| 6 | `limit` vượt quá giới hạn | `?limit=1000` | 200 + `limit` bị giới hạn về tối đa 100 (theo `Math.min(100, ...)`) |

#### Error Cases
| # | Mô tả | Input | Expected HTTP | Expected Error Code |
|---|-------|-------|---------------|---------------------|
| 7 | Thiếu X-Admin-Secret header | Header không có | 401 | `ADMIN_UNAUTHORIZED` |
| 8 | X-Admin-Secret sai | Header có nhưng sai | 401 | `ADMIN_UNAUTHORIZED` |

> ⚠️ **Lưu ý (pre-existing, ngoài phạm vi review này):** query param `status` chưa được validate theo `REPORT_STATUSES` (`PENDING|REVIEWED|FIXED|DISMISSED`). Giá trị tuỳ ý sẽ không match record nào và trả về danh sách trống thay vì lỗi `400 INVALID_REQUEST_BODY`. Đề xuất S4/S1 xem xét bổ sung validate ở lần cập nhật sau.

---

### 9. Admin — GET /api/admin/questions/reports/summary (Tổng hợp báo cáo)

#### Happy Path
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 1 | Tổng hợp số lượng theo từng trạng thái | có report ở nhiều trạng thái khác nhau | 200 + `{ pending, reviewed, fixed, dismissed, topReportedQuestions }` (đếm đúng từng trạng thái) |
| 2 | Top câu hỏi bị báo cáo nhiều nhất | nhiều report cho cùng 1 câu hỏi | `topReportedQuestions` chứa `{ questionId, count }`, sắp giảm dần theo `count`, tối đa 10 phần tử |

#### Edge Cases
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 3 | Không có báo cáo nào trong DB | DB trống | 200 + `{ pending: 0, reviewed: 0, fixed: 0, dismissed: 0, topReportedQuestions: [] }` |

#### Error Cases
| # | Mô tả | Input | Expected HTTP | Expected Error Code |
|---|-------|-------|---------------|---------------------|
| 4 | Thiếu X-Admin-Secret header | Header không có | 401 | `ADMIN_UNAUTHORIZED` |

> ℹ️ **Lưu ý cho S4 (docs):** response shape mới là `{ pending, reviewed, fixed, dismissed, topReportedQuestions }` (flattened), thay cho shape cũ `{ byStatus: {...}, topReportedQuestions: [...] }` mô tả trong `docs/guides/admin-guide.md` (dòng ~287-302). Cần cập nhật docs cho khớp shape mới.

---

### 10. Admin — PATCH /api/admin/questions/reports/:id (Cập nhật trạng thái báo cáo)

#### Happy Path
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 1 | Đổi trạng thái từ PENDING sang REVIEWED | `{ status: "REVIEWED" }`, câu hỏi chưa đạt ngưỡng | 200 + `{ id, status: "REVIEWED", autoHidden: false }` |
| 2 | Đổi trạng thái sang FIXED/DISMISSED | `{ status: "FIXED" }` hoặc `{ status: "DISMISSED" }` | 200 + `{ id, status, autoHidden: false }` |

#### Edge Cases
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 3 | Đổi 1 báo cáo về PENDING khiến tổng số PENDING của câu hỏi đó đạt `AUTO_HIDE_REPORT_THRESHOLD` (5) | `{ status: "PENDING" }` | 200 + `{ ..., autoHidden: true }`, đồng thời `question.isActive` → `false` |
| 4 | `status` không hợp lệ | `{ status: "FAKE" }` | 400 + `INVALID_REQUEST_BODY` (Zod `z.enum(REPORT_STATUSES)`) |

#### Error Cases
| # | Mô tả | Input | Expected HTTP | Expected Error Code |
|---|-------|-------|---------------|---------------------|
| 5 | Thiếu X-Admin-Secret header | Header không có | 401 | `ADMIN_UNAUTHORIZED` |
| 6 | `id` báo cáo không tồn tại | UUID ngẫu nhiên | 500 | `INTERNAL_SERVER_ERROR` |

> ⚠️ **Lưu ý (pre-existing, ngoài phạm vi review này):** `updateReport()` gọi `prisma.questionReport.update({ where: { id } })` trực tiếp — nếu `id` không tồn tại, Prisma nem `PrismaClientKnownRequestError` (P2025) và bị middleware lỗi tập trung trả về `500 INTERNAL_SERVER_ERROR` thay vì `404 REPORT_NOT_FOUND`. Đề xuất bổ sung error class riêng (ví dụ `ReportNotFoundError`) ở lần cập nhật sau.

---

## Test Cases: Exam Module (Thi thử)

### 11. POST /api/exam/start (Bắt đầu phiên thi thử)

#### Happy Path
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 1 | Bắt đầu thi môn hợp lệ, đủ điểm, có đề active | `{ subject: "TOAN" }`, user đủ ≥ 60 điểm | 200 + `StartExamResponse` (`sessionId`, `examPaperId`, `title`, `durationMinutes`, `startedAt`, `questions[]`) |
| 2 | Câu hỏi trả về KHÔNG lộ đáp án đúng | — | Mỗi câu trong `questions[]` không có field `correctAnswer` |
| 3 | Trừ đúng `EXAM_ENTRY_FEE` (60 điểm) | trước: 1000 điểm | sau: 940 điểm; `PointTransaction` mới có `reason: THI_THU_ENTRY_FEE`, `delta: -60` |
| 4 | Chọn đề "công bằng" giữa nhiều đề active của 1 môn | môn có 2 đề active, user chưa thi đề nào | Đề được chọn có số lần user đã thi ÍT NHẤT (round-robin theo `examSession.groupBy`) |

#### Edge Cases
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 5 | User vừa đủ điểm (đúng 60) | `currentPoints = 60` | 200, sau khi trừ còn 0 — không lỗi |
| 6 | Đề active nhưng 0 câu hỏi active | đề chỉ có câu `isActive=false` | 404 `EXAM_PAPER_EMPTY` (đề bị loại khỏi danh sách "đề hợp lệ") |
| 7 | Nhiều request `startExam` đồng thời, user chỉ đủ điểm cho 1 lần | 5 request song song, `currentPoints = 60` | CHỈ 1 request thành công (trừ đúng 1 lần 60 điểm, tạo đúng 1 `ExamSession`); 4 request còn lại nhận `EXAM_INSUFFICIENT_POINTS` — không có request nào lỗi `500`/`OPTIMISTIC_LOCK_CONFLICT` |

#### Error Cases
| # | Mô tả | Input | Expected HTTP | Expected Error Code |
|---|-------|-------|---------------|---------------------|
| 8 | `subject` không hợp lệ | `{ subject: "KHONG_TON_TAI" }` | 400 | `EXAM_INVALID_SUBJECT` |
| 9 | Môn học chưa có đề thi active nào | `{ subject: "GDCD" }` (chưa có đề) | 404 | `EXAM_PAPER_EMPTY` |
| 10 | User không đủ điểm (< 60) | `currentPoints = 0` | 409 | `EXAM_INSUFFICIENT_POINTS` (không tạo `ExamSession`, không trừ điểm — transaction rollback) |
| 11 | Thiếu `subject` trong body | `{}` | 400 | `INVALID_REQUEST_BODY` |
| 12 | Không có token | Header thiếu Authorization | 401 | `MISSING_AUTH_TOKEN` |

---

### 12. POST /api/exam/submit (Nộp bài thi thử)

#### Happy Path
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 1 | Làm đúng hoàn toàn (3 câu: MCQ_4, TRUE_FALSE_4, FILL_BLANK) | `answers` đúng hết | `score: 10`, `pointsAwarded: 120`; số dư được cộng 120, ghi `PointTransaction` `reason: THI_THU_RESULT` |
| 2 | Làm đúng một phần (score = 7.0) | TRUE_FALSE_4 chỉ đúng 2/4 ý (ratio 0.5) | `score: 7.0`, `pointsAwarded: 10`; cộng đúng 10 điểm |
| 3 | FILL_BLANK chấp nhận đáp án viết hoa/thường, khoảng trắng dư | `selectedAnswer: "  hà   nội  "`, đáp án đúng `"Hà Nội"` | Được tính đúng (so khớp sau `normalizeAnswer`) |
| 4 | TRUE_FALSE_4 chấm theo tỉ lệ ý đúng (0/1/2/3/4 → ratio `TRUE_FALSE_SCORE_RATIOS`) | đúng 3/4 ý | `pointsEarned = points * 0.5` |

#### Edge Cases
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 5 | `answers: []` (không trả lời câu nào) | — | `score: 0`, `pointsAwarded: 0`; KHÔNG cộng điểm; mỗi `ExamAnswer.selectedAnswer = {}` (sentinel), `pointsEarned: 0` |
| 6 | `score < 7.0` → `pointsAwarded = 0` | — | KHÔNG gọi cộng điểm (vì `addPoints` yêu cầu `amount > 0`); số dư không đổi |
| 7 | Nộp bài sau khi hết giờ + grace period (`durationMinutes*60 + 30s`) | `Date.now() > deadlineMs` | 410 `EXAM_EXPIRED`; session chuyển `EXPIRED`, KHÔNG chấm điểm, KHÔNG tạo `ExamAnswer`, KHÔNG hoàn/trừ điểm đã trừ lúc `startExam` |
| 8 | Nộp lại phiên đã `EXPIRED` | gọi `submit` lần 2 sau khi đã expired | vẫn 410 `EXAM_EXPIRED` (không đổi trạng thái thêm) |
| 9 | `selectedAnswer` sai kiểu/định dạng cho loại câu hỏi (vd MCQ_4 nhưng gửi mảng) | — | `gradeQuestion` không crash, trả `pointsEarned: 0` (coi như sai) |
| 10 | 5 request `submitExam` đồng thời cho CÙNG 1 phiên, `score < 7` (`pointsAwarded = 0`) | 5 request song song, `answers` giống nhau | CHỈ 1 request trả 200 (`score: 0, pointsAwarded: 0`); 4 request còn lại nhận `EXAM_SESSION_ALREADY_COMPLETED`; CHỈ có 1 `ExamAnswer` cho mỗi câu hỏi |
| 11 | 5 request `submitExam` đồng thời cho CÙNG 1 phiên, `score = 10` (`pointsAwarded = 120`) | 5 request song song, `answers` đúng hết | CHỈ 1 request trả 200 (`score: 10, pointsAwarded: 120`); 4 request còn lại nhận `EXAM_SESSION_ALREADY_COMPLETED`; số dư CHỈ được cộng 120 MỘT LẦN (không phải 600) |

#### Error Cases
| # | Mô tả | Input | Expected HTTP | Expected Error Code |
|---|-------|-------|---------------|---------------------|
| 12 | `sessionId` không tồn tại | UUID ngẫu nhiên | 404 | `EXAM_SESSION_NOT_FOUND` |
| 13 | `sessionId` thuộc về user khác | user B nộp bài session của user A | 403 | `EXAM_SESSION_NOT_OWNED` |
| 14 | Nộp lại phiên đã `COMPLETED` | gọi `submit` lần 2 | 409 | `EXAM_SESSION_ALREADY_COMPLETED` |
| 15 | `sessionId` không phải UUID hợp lệ | `{ sessionId: "abc" }` | 400 | `INVALID_REQUEST_BODY` |
| 16 | `examQuestionId` trong `answers` không thuộc đề thi của phiên | UUID câu hỏi ngẫu nhiên | Câu đó không được chấm (không có trong `questions` của đề) — không lỗi, không ảnh hưởng các câu khác |

---

### 13. GET /api/exam/:id/result (Xem kết quả phiên thi)

#### Happy Path
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 1 | Xem kết quả phiên đã hoàn thành | `sessionId` đã `submitExam` | 200 + `ExamResultResponse` (`score`, `pointsAwarded`, `chapterAnalysis[]`, `wrongAnswers[]`) |
| 2 | Phân tích theo chương | đề có nhiều câu thuộc nhiều `chapter` | `chapterAnalysis[]` gộp đúng số câu đúng/tổng điểm theo từng `chapter` |
| 3 | Danh sách câu sai | có câu `pointsEarned < points` | `wrongAnswers[]` chứa đúng các câu đó kèm `selectedAnswer`, `correctAnswer`, `explanation` |

#### Edge Cases
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 4 | Phiên `EXPIRED` (hết giờ, không chấm điểm) | `sessionId` của phiên expired | 200 + `score: 0`, tất cả câu nằm trong `wrongAnswers` với `selectedAnswer: null` |
| 5 | Phiên làm đúng hết | — | `wrongAnswers: []` |

#### Error Cases
| # | Mô tả | Input | Expected HTTP | Expected Error Code |
|---|-------|-------|---------------|---------------------|
| 6 | Phiên còn `IN_PROGRESS` (chưa nộp bài) | `sessionId` chưa `submit` | 409 | `EXAM_SESSION_NOT_COMPLETED` |
| 7 | `sessionId` không tồn tại | UUID ngẫu nhiên | 404 | `EXAM_SESSION_NOT_FOUND` |
| 8 | `sessionId` thuộc về user khác | user B xem kết quả của user A | 403 | `EXAM_SESSION_NOT_OWNED` |

---

### 14. Admin — Quản lý đề thi & câu hỏi (`/api/admin/exam-papers`)

#### Happy Path
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 1 | Tạo đề thi mới | `POST /` `{ subject, title, durationMinutes }` | 201 + `ExamPaperSummaryDto` (`isActive: true` mặc định) |
| 2 | Danh sách đề thi, lọc theo môn | `GET /?subject=TOAN` | 200 + chỉ các đề môn TOAN |
| 3 | Chi tiết đề thi kèm toàn bộ câu hỏi (cả câu đã ẩn) | `GET /:id` | 200 + `ExamPaperDetailDto` (`questions[]` đầy đủ `correctAnswer`) |
| 4 | Cập nhật đề thi (đổi tiêu đề / thời gian / `isActive`) | `PATCH /:id` `{ title?, durationMinutes?, isActive? }` | 200 + đề đã cập nhật |
| 5 | Thêm 1 câu hỏi (mỗi loại MCQ_4 / TRUE_FALSE_4 / FILL_BLANK) | `POST /:id/questions` đúng shape từng loại | 201 + `ExamQuestionFullDto` |
| 6 | Sửa câu hỏi (partial update) | `PATCH /:id/questions/:qid` `{ points: 5 }` | 200 + câu hỏi đã cập nhật |
| 7 | Ẩn (soft delete) câu hỏi | `DELETE /:id/questions/:qid` | 200 + `{ message }`; câu chuyển `isActive: false`, không bị xoá khỏi DB |

#### Edge Cases
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 8 | Tắt `isActive` đề thi đang là đề DUY NHẤT active của môn | `PATCH /:id { isActive: false }` | 200 OK; lần `startExam` kế tiếp cho môn đó → `EXAM_PAPER_EMPTY` |
| 9 | `correctAnswer` không khớp `questionType` (vd MCQ_4 nhưng `correctAnswer` là mảng 4 boolean) | `POST /:id/questions` | 400 `EXAM_QUESTION_INVALID` (qua `validateQuestionShape`, KHÔNG tạo record) |
| 10 | `options` thiếu (MCQ_4/TRUE_FALSE_4 yêu cầu đúng 4 phần tử) | `options: ["A", "B"]` | 400 `INVALID_REQUEST_BODY` (Zod `.length(4)`) |

#### Error Cases
| # | Mô tả | Input | Expected HTTP | Expected Error Code |
|---|-------|-------|---------------|---------------------|
| 11 | Thiếu `X-Admin-Secret` header | bất kỳ route admin nào | 401 | `ADMIN_UNAUTHORIZED` |
| 12 | `subject` không thuộc `SUBJECT_CATALOG` | `POST / { subject: "FAKE" }` | 400 | `INVALID_REQUEST_BODY` |
| 13 | `examPaperId` không tồn tại | `GET /:id` với UUID ngẫu nhiên | 404 | `EXAM_PAPER_NOT_FOUND` |
| 14 | `examQuestionId` không tồn tại / không thuộc đề | `PATCH /:id/questions/:qid` sai `qid` | 404 | `EXAM_QUESTION_NOT_FOUND` |

---

### 15. Admin — POST /api/admin/exam-papers/:id/questions/import (Import câu hỏi từ Excel)

#### Happy Path
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 1 | Import file đúng format (1 dòng mỗi loại câu hỏi) | file `.xlsx` theo template `docs/templates/mau-import-cau-hoi-thi-thu.xlsx` | 200 + `{ inserted: N, errors: [] }`; N câu hỏi mới được tạo |
| 2 | File có một số dòng lỗi, một số dòng hợp lệ | trộn dòng đúng/sai | 200 + `{ inserted: M, errors: [{ row, message }, ...] }` — THÀNH CÔNG MỘT PHẦN, các dòng hợp lệ vẫn được tạo |

#### Edge Cases
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 3 | Đáp án Đúng/Sai dạng chữ tiếng Việt (`Đ`, `S`, `Đúng`, `Sai`, `1`, `0`, `X`) | cột "Đáp án đúng" = `"Đ"` / `"S"` / ... | Parse đúng thành `true`/`false` |
| 4 | Đáp án MCQ dạng chữ cái (`A`/`B`/`C`/`D`) hoặc số (`0`-`3`) | cột "Đáp án đúng" = `"C"` | Parse thành `correctAnswer: 2` |
| 5 | File rỗng (0 dòng dữ liệu, chỉ có header) | sheet chỉ có header | 200 + `{ inserted: 0, errors: [] }` (hoặc lỗi rõ ràng — không crash) |
| 6 | Lỗi được báo đúng số dòng Excel (tính cả header) | dòng dữ liệu thứ 1 (Excel row 2) sai | `errors[0].row === 2` |

#### Error Cases
| # | Mô tả | Input | Expected HTTP | Expected Error Code |
|---|-------|-------|---------------|---------------------|
| 7 | Không gửi file (`field "file"` rỗng) | `POST` không kèm file | 400 | `EXAM_IMPORT_FILE_INVALID` |
| 8 | File không phải Excel hợp lệ (vd `.txt` đổi đuôi) | `XLSX.read` parse lỗi | 400 | `EXAM_IMPORT_FILE_INVALID` |
| 9 | File vượt quá 5MB | file > 5MB | 400 | `EXAM_IMPORT_FILE_INVALID` (qua `MulterError` `LIMIT_FILE_SIZE` → `uploadExcelFile` chuyển đổi, KHÔNG còn rơi vào `500`) |
| 10 | `examPaperId` không tồn tại | `POST /:fakeId/questions/import` | 404 | `EXAM_PAPER_NOT_FOUND` |

---

### 16. Race conditions — Module Thi thử (smoke test riêng `smoke:exam:concurrency`)

> Các test case này được hiện thực trong `backend/src/scripts/smoke-test-exam-concurrency.ts` (chạy bằng `npm run smoke:exam:concurrency`), bổ sung cho `smoke-test-exam.ts` (vốn chỉ test tuần tự).

| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 1 | 5× `startExam` đồng thời, user chỉ đủ điểm cho 1 lần | `currentPoints = EXAM_ENTRY_FEE` | 1 thành công + 4× `ExamInsufficientPointsError`; số dư cuối = 0; đúng 1 `ExamSession`, đúng 1 `PointTransaction (THI_THU_ENTRY_FEE)` |
| 2 | 5× `submitExam` đồng thời, cùng phiên, `pointsAwarded = 0` | `answers` sai (score = 0) | 1 thành công (`score: 0`) + 4× `ExamSessionAlreadyCompletedError`; đúng 1 `ExamAnswer`/câu; session → `COMPLETED` |
| 3 | 5× `submitExam` đồng thời, cùng phiên, `pointsAwarded = 120` | `answers` đúng hết (score = 10) | 1 thành công (`score: 10, pointsAwarded: 120`) + 4× `ExamSessionAlreadyCompletedError`; đúng 1 `ExamAnswer`/câu; số dư CHỈ được cộng 120 một lần, đúng 1 `PointTransaction (THI_THU_RESULT)` |

---

## Test Cases: Ngân hàng câu hỏi (Question Bank)
> Smoke test: `npm run smoke:question-bank` (`backend/src/scripts/smoke-test-question-bank.ts`)

### Happy Path
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 1 | Tạo câu hỏi MCQ_4 với đầy đủ trường | `POST /api/admin/question-bank` (MCQ_4, 4 options, correctAnswer=0) | `201`, trả về DTO với `questionType: "MCQ_4"`, `isActive: true` |
| 2 | Tạo câu hỏi TRUE_FALSE_4 | `POST` (TRUE_FALSE_4, 4 phát biểu, correctAnswer=[true,false,true,false]) | `201`, `questionType: "TRUE_FALSE_4"` |
| 3 | Tạo câu hỏi FILL_BLANK (không options) | `POST` (FILL_BLANK, không có options, correctAnswer=["đáp án 1"]) | `201`, `options: null` |
| 4 | Lấy danh sách với filter môn/chương/độ khó | `GET ?subject=TOAN&chapter=Đại số` | `200`, chỉ trả về câu thuộc chương đó |
| 5 | Tìm kiếm theo nội dung (contains, case-insensitive) | `GET ?search=trac nghiem` | `200`, trả về câu có text khớp |
| 6 | Cập nhật câu hỏi (partial) | `PUT /:id` `{ chapter, difficulty, isActive }` | `200`, chỉ trường được gửi bị thay đổi |
| 7 | Thêm câu từ kho vào đề thi (2 câu) | `POST /api/admin/exam-papers/:id/questions/from-bank` | `200`, `{ added: 2, skipped: 0 }` |
| 8 | Thêm lại câu đã có + 1 câu mới (skip duplicate) | `POST from-bank` với 2 câu cũ + 1 câu mới | `200`, `{ added: 1, skipped: 2 }` |
| 9 | Kiểm tra usage câu hỏi đang dùng trong đề | `GET /:id/usage` | `200`, `totalExamPapers: 1, hasActiveSession: false` |
| 10 | Xóa câu hỏi không thuộc đề nào | `DELETE /:id` | `200`, câu biến mất khỏi DB |

### Edge Cases
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 11 | pageSize=0 bị clamp lên 1 | `GET ?pageSize=0` | `200`, `pageSize: 1` |
| 12 | pageSize=200 bị clamp xuống 100 | `GET ?pageSize=200` | `200`, `pageSize: 100` |
| 13 | Thêm câu từ kho khi câu `isActive=false` | `POST from-bank` với câu inactive | `200`, `{ added: 0, skipped: 1 }` |
| 14 | Xóa câu trong kho → ExamQuestion.questionBankId tự set NULL (FK ON DELETE SET NULL) | `DELETE /:id` khi câu đang được dùng trong đề (nhưng không có phiên IN_PROGRESS) | `200`, `exam_questions.questionBankId = null` |
| 15 | usage trả về `examPapers: []` khi câu chưa được dùng đề nào | `GET /:id/usage` (câu chưa trong đề nào) | `200`, `{ totalExamPapers: 0, hasActiveSession: false }` |

### Error Cases
| # | Mô tả | Input | Expected HTTP | Expected Error Code |
|---|-------|-------|---------------|---------------------|
| 16 | Tạo câu với subject không hợp lệ | `subject: "KHONG_TON_TAI"` | 400 | `INVALID_REQUEST_BODY` |
| 17 | Tạo MCQ_4 thiếu options | `questionType: "MCQ_4"`, không có `options` | 400 | Validation shape error |
| 18 | Cập nhật ID không tồn tại | `PUT /non-existent-id` | 404 | `QUESTION_BANK_NOT_FOUND` |
| 19 | Xóa ID không tồn tại | `DELETE /non-existent-id` | 404 | `QUESTION_BANK_NOT_FOUND` |
| 20 | Xóa câu khi còn ExamSession IN_PROGRESS đang dùng câu đó | `DELETE /:id` | 409 | `QUESTION_BANK_DELETE_BLOCKED` |
| 21 | Usage check ID không tồn tại | `GET /non-existent-id/usage` | 404 | `QUESTION_BANK_NOT_FOUND` |
| 22 | addFromBank với `questionBankIds` rỗng | `{ questionBankIds: [] }` | 400 | `INVALID_REQUEST_BODY` |
| 23 | addFromBank với examPaperId không tồn tại | `POST /fake-id/questions/from-bank` | 404 | `EXAM_PAPER_NOT_FOUND` |
| 24 | autoFill với examPaperId không tồn tại | `POST /fake-id/questions/auto-fill` | 404 | `EXAM_PAPER_NOT_FOUND` |

### Auto-fill Tests (Mới — S3 bổ sung)
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 25 | autoFill happy path, kho đủ câu | `count: 2`, kho có câu medium + hard cùng môn | `{ added >= 0, shortage >= 0, added + shortage == 2 }` |
| 26 | autoFill shortage: yêu cầu nhiều hơn tổng kho | `count = bankCount + 1` | `shortage > 0`, `added + shortage == count` |
| 27 | autoFill gọi lần 2: không thêm câu trùng | Gọi lại autoFill cùng đề sau lần 1 | `skipped == 0`, không có duplicate questionBankId trong đề |

---

## Test Cases: Leaderboard — Bảng xếp hạng học sinh

### Happy Path
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 1 | Lấy bảng xếp hạng tất cả môn | `GET /api/leaderboard?page=1` | `200`, `{ data: [...], total: N, page: 1, pageSize: 10 }` |
| 2 | Rank giảm dần theo Điểm Uy Tín | `GET /api/leaderboard` | `data[0].reputationScore >= data[1].reputationScore` |
| 3 | User thi nhiều môn: 5 lần, avg=9 → rank 1 | Smoke: USER_A 5 ExamSession | `rank=1`, `examCount=5`, `reputationScore≈7.26` |
| 4 | Lấy bảng xếp hạng lọc theo môn | `GET /api/leaderboard?subject=TOAN` | Chỉ trả về user thi môn Toán |
| 5 | getMyRank có dữ liệu | `GET /api/leaderboard/me` | `rank≠null`, `examCount>0`, `reputationScore>0`, `avgScore>0` |
| 6 | getMyRank lọc theo môn | `GET /api/leaderboard/me?subject=TOAN` | rank theo môn Toán riêng |
| 7 | Upload avatar: JPG hợp lệ | `POST /api/users/me/avatar` file JPG <2MB | `200`, `avatarUrl` ≠ null trong response |
| 8 | Xóa avatar | `DELETE /api/users/me/avatar` | `200`, `avatarUrl = null` |

### Edge Cases
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 9 | User chưa thi lần nào | `GET /api/leaderboard/me` với user không có ExamSession | `{ rank: null, examCount: 0, reputationScore: null, trend: null }` |
| 10 | Trend = "new" khi không có dữ liệu 30 ngày trước | User chỉ thi trong 30 ngày gần đây | `trend: "new"` |
| 11 | Trend ≠ "new" khi có dữ liệu 30 ngày trước | User có session cả cũ lẫn mới | `trend: "same" | "up" | "down"` |
| 12 | Lọc môn không có ai thi | `GET /api/leaderboard?subject=HOA` (không có dữ liệu) | `{ data: [], total: 0 }` |
| 13 | Phân trang trang 2 rỗng khi tổng ≤ 20 | `GET /api/leaderboard?page=2` | `data: []` |
| 14 | User thi môn VAN không xuất hiện khi filter TOAN | filter môn Toán | user chỉ thi VAN không có trong kết quả |
| 15 | page=0 bị clamp lên page=1 | `GET /api/leaderboard?page=0` | `page: 1` |

### Error Cases
| # | Mô tả | Input | Expected HTTP | Expected Error Code |
|---|-------|-------|---------------|---------------------|
| 16 | Upload avatar khi chưa đăng nhập | `POST /api/users/me/avatar` không có token | 401 | `MISSING_AUTH_TOKEN` |
| 17 | Upload file không phải ảnh | `POST /api/users/me/avatar` file .pdf | 400 | `AVATAR_INVALID_TYPE` |
| 18 | Upload ảnh quá 2MB | `POST /api/users/me/avatar` file >2MB | 413 | `AVATAR_FILE_TOO_LARGE` |
| 19 | Upload thiếu field "avatar" | `POST /api/users/me/avatar` không có file | 400 | `AVATAR_NO_FILE` |
| 20 | Xóa avatar khi chưa có ảnh | `DELETE /api/users/me/avatar` (avatarUrl=null) | 404 | `AVATAR_NOT_FOUND` |
| 21 | GET /api/leaderboard không có token | Không có Authorization header | 401 | `MISSING_AUTH_TOKEN` |
| 22 | GET /api/leaderboard/me không có token | Không có Authorization header | 401 | `MISSING_AUTH_TOKEN` |

---

## Test Cases: Progress — Tiến độ học tập

### Happy Path
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 1 | getSummary user có dữ liệu | `GET /api/progress/summary` | `200`, đủ 5 trường: `overview`, `bestStreak`, `monthComparison`, `practiceStatsBySubject`, `scoreTrend` |
| 2 | totalPracticeSessions đúng | User có 3 phiên hoàn thành | `overview.totalPracticeSessions = 3` |
| 3 | totalExamSessions đúng | User có 2 lần thi COMPLETED | `overview.totalExamSessions = 2` |
| 4 | currentPoints đúng | UserPoints.currentPoints = 500 | `overview.currentPoints = 500` |
| 5 | currentStreak 3 ngày liên tiếp | 3 phiên ôn hôm nay + hôm qua + 2 ngày trước | `currentStreak >= 3` |
| 6 | bestStreak >= currentStreak | Bất kỳ dữ liệu nào | `bestStreak >= currentStreak` |
| 7 | scoreTrend có dữ liệu | User có phiên ôn hoàn thành | `scoreTrend.length >= 1`, mỗi phần tử có `score` (số) và `date` (ISO string) |
| 8 | getExamHistory phân trang | `GET /api/progress/exam-history?limit=10&offset=0` | `200`, `{ items, total, limit, offset }` |
| 9 | examHistory trả đúng số phiên | 2 phiên COMPLETED | `total = 2`, `items.length = 2` |
| 10 | examHistory có tên đề thi | ExamPaper tồn tại | `item.title` không phải `'(Đề không còn tồn tại)'` |

### Edge Cases
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 11 | getSummary user chưa có dữ liệu | User mới, chưa ôn | `overview = {0,0,0,0}`, `bestStreak = 0`, `scoreTrend = []`, `practiceStatsBySubject = []` |
| 12 | examAvgScore null khi chưa thi | User chưa có ExamSession | `monthComparison.thisMonth.examAvgScore = null` |
| 13 | getExamHistory offset vượt quá tổng | `offset=999` | `items = []`, `total` vẫn trả đúng |
| 14 | limit bị clamp xuống 50 | `limit=200` | `limit = 50` trong response |
| 15 | limit bị clamp lên 1 | `limit=0` | `limit = 1` trong response |
| 16 | examHistory đề thi đã bị xóa | ExamPaper không tồn tại | `title = '(Đề không còn tồn tại)'`, `subject = ''` |
| 17 | streak không đứt ngày | 3 ngày liên tiếp (hôm nay, hôm qua, 2 ngày trước) | `currentStreak = 3` |
| 18 | streak = 0 khi chỉ có phiên cũ | Phiên cuối cách hơn 1 ngày | `currentStreak = 0` |

### Error Cases
| # | Mô tả | Input | Expected HTTP | Expected Error Code |
|---|-------|-------|---------------|---------------------|
| 19 | GET /api/progress/summary không có token | Không có Authorization header | 401 | `MISSING_AUTH_TOKEN` |
| 20 | GET /api/progress/exam-history không có token | Không có Authorization header | 401 | `MISSING_AUTH_TOKEN` |
| 21 | Token không hợp lệ | `Authorization: Bearer invalid` | 401 | `INVALID_SESSION_TOKEN` |

---

## Test Cases: Ôn Câu Sai (Wrong Answer Review)

### Happy Path
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 1 | Lấy danh sách câu sai còn hạn | userId có 5 câu sai, chưa hết 14 ngày | 200 + `{ data: [5 items], total: 5, page: 1, pageSize: 20 }` |
| 2 | Filter theo môn học | `?subjectId=TOAN`, user có 3 TOAN + 2 VAN | `data: [3 items]`, tất cả `subjectId = 'TOAN'` |
| 3 | Phân trang đúng | `?page=2&pageSize=1`, có 2 câu sai | `data: [1 item]` (item thứ 2), `page: 2`, `total: 2` |
| 4 | Làm lại MCQ_4 đúng | `POST /:id/retry` với `answer: 2`, đáp án đúng là 2 | `{ isCorrect: true, correctAnswer: 2 }` |
| 5 | Làm lại TRUE_FALSE_4 đúng | answer: `[true, false, true, false]` khớp đáp án | `{ isCorrect: true }` |
| 6 | Làm lại FILL_BLANK đúng | answer: `"ha noi"` (sau normalize khớp "ha noi") | `{ isCorrect: true }` |
| 7 | Câu sai từ Practice ghi đúng DB | submitAnswer trong practice với đáp án sai | Bản ghi `wrong_answers` mới với `source='practice'` |
| 8 | Câu sai từ Exam ghi đúng DB | submitExam với 3 câu sai | 3 bản ghi `wrong_answers` với `source='exam'` |
| 9 | upsert cộng dồn wrongCount | Sai câu đã tồn tại lần nữa | `wrongCount` tăng thêm 1, `expiresAt` reset +14 ngày |
| 10 | Điều hướng đến WrongAnswersPage từ ProfilePage | Click nút "Ôn câu sai" | Màn hình chuyển sang WrongAnswersPage |

### Edge Cases
| # | Mô tả | Input | Expected Output |
|---|-------|-------|-----------------|
| 11 | Câu sai đã hết hạn (> 14 ngày) | `expiresAt < NOW()` | Không hiện trong GET list |
| 12 | Câu hỏi bị soft-delete (`isActive=false`) | Câu tồn tại trong wrong_answers nhưng bị ẩn | Không hiện trong GET list |
| 13 | Cả question và examQuestion đều null (hard-delete) | FK bị SetNull cả hai | Không hiện trong list, retry → 404 |
| 14 | Làm lại đúng → biến mất khỏi danh sách sau reload | retry → isCorrect: true | `isCorrect: true`; `expiresAt` bị set về NOW(); GET ngay sau đó không còn trả về bản ghi này |
| 15 | Làm lại MCQ_4 sai | answer: 0, đáp án đúng là 2 | `{ isCorrect: false, correctAnswer: 2 }` |
| 16 | TRUE_FALSE_4 — thiếu 1 ý (null trong mảng) | `[true, false, true, null]` | `isCorrect: false` |
| 17 | FILL_BLANK — chuỗi rỗng | `answer: ""` | `isCorrect: false` |
| 18 | Danh sách trống (không có câu sai) | User mới chưa làm bài | 200 + `{ data: [], total: 0 }` |
| 19 | Exam retry nhiều lần (optimistic lock) | Transaction retry 3 lần | `wrongCount` chỉ tăng 1 (không tăng 3) |

### Error Cases
| # | Mô tả | Input | Expected HTTP | Expected Error Code |
|---|-------|-------|---------------|---------------------|
| 20 | GET /api/wrong-answers không có token | Không có Authorization header | 401 | `MISSING_AUTH_TOKEN` |
| 21 | POST retry với id không phải số | `POST /api/wrong-answers/abc/retry` | 400 | `INVALID_REQUEST_BODY` |
| 22 | POST retry thiếu body answer | `POST` với `{}` | 400 | `INVALID_REQUEST_BODY` |
| 23 | POST retry id không tồn tại | `id = 99999` | 404 | `WRONG_ANSWER_NOT_FOUND` |
| 24 | POST retry id thuộc user khác | id hợp lệ nhưng `userId` khác | 404 | `WRONG_ANSWER_NOT_FOUND` |
| 25 | POST retry bản ghi đã hết hạn | `expiresAt < NOW()` | 404 | `WRONG_ANSWER_NOT_FOUND` |
