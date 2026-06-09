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
