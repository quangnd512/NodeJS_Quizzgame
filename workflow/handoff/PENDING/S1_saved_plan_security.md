[KẾ HOẠCH ĐÃ LƯU — CHỜ LÀM SAU]
Tên: Anti-Cheat Security Fixes
Ngày lưu: 2026-07-07

📋 TÓM TẮT:
Sửa 4 lỗ hổng bảo mật trong phần thi thử và luyện tập.
Không cần migration DB, không cần endpoint mới.

🔧 TASK LIST:
TASK 1: Thêm hằng số EXAM_MIN_SUBMIT_RATIO=0.3 + 2 lớp lỗi mới (ExamSubmitTooEarlyError HTTP 400, ExamSessionAlreadyActiveError HTTP 409) — Phụ thuộc: không
TASK 2: Bug 4 — startExam() kiểm tra IN_PROGRESS session cùng môn → throw ExamSessionAlreadyActiveError — Phụ thuộc: TASK 1
TASK 3: Bug 1a — submitExam() kiểm tra elapsed time >= durationMinutes * 60 * 0.3 → throw ExamSubmitTooEarlyError — Phụ thuộc: TASK 1
TASK 4: Bug 1b — getExamResult() trả correctAnswer = null cho câu chưa trả lời (selectedAnswer = {}) — Phụ thuộc: không
TASK 5: Bug 2 + Bug 3 — checkRateLimit() Redis lỗi → throw; completeSession() elapsed > SESSION_TIMEOUT + 60s → throw PracticeSessionExpiredError — Phụ thuộc: không
TASK 6: Frontend — hiển thị đúng các lỗi mới (nộp sớm, phiên dở, câu bỏ trắng) — Phụ thuộc: TASK 2,3,4

📋 DEFINITION OF DONE:
□ POST /api/exam/submit khi chưa đủ 30% thời gian → 400
□ POST /api/exam/submit sau 30% → thành công
□ POST /api/exam/start khi đang có IN_PROGRESS cùng môn → 409
□ GET /api/exam/:id/result: câu bỏ trắng → correctAnswer = null
□ GET /api/exam/:id/result: câu trả lời → correctAnswer bình thường
□ POST /api/practice/start khi Redis down → lỗi (không cho tạo)
□ POST /api/practice/complete sau hết giờ → lỗi
□ POST /api/practice/complete trong giờ → thành công
□ Frontend hiển thị đúng tất cả
□ 44 unit tests vẫn PASS
□ Build BE + FE không lỗi

⚠️ LƯU Ý KHI TRIỂN KHAI:
- Kiểm tra elapsed time exam dùng session.durationMinutes (lưu trong DB), không hardcode
- completeSession grace period = 60 giây sau SESSION_TIMEOUT_SECONDS
- checkRateLimit fail-closed: Redis lỗi → throw PracticeRateLimitError
- correctAnswer null check: selectedAnswer là {} (empty object) = bỏ trắng
