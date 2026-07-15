[KẾ HOẠCH ĐÃ LƯU — HỌC SINH ĐÓNG GÓP CÂU HỎI]
Ngày lưu: 2026-07-09
Làm sau khi: Feature 013 (Notifications) hoàn thành

== YÊU CẦU NGƯỜI DÙNG (đã xác nhận) ==
- Học sinh điền form gửi câu hỏi: nội dung, 4 đáp án + đánh dấu đáp án đúng, môn học / chương
- Admin xem danh sách câu chờ duyệt → duyệt hoặc từ chối (kèm lý do)
- Khi duyệt: câu vào ngân hàng câu hỏi, học sinh nhận 30 điểm + thông báo
- Khi từ chối: học sinh nhận thông báo + thấy lý do bị từ chối
- Mỗi lần câu được thêm vào 1 đề thi: học sinh nhận thêm 5 điểm (tối đa 100 điểm từ usage)
- Học sinh xem danh sách câu đã gửi + trạng thái từng câu (Chờ duyệt / Đã duyệt / Bị từ chối)

== PHỤ THUỘC ==
- Yêu cầu Feature 013 (Notifications) PHẢI hoàn thành trước — vì dùng lại
  notification trigger khi duyệt/từ chối/câu được dùng
- Cần thêm 3 NotificationType mới vào enum: SUBMISSION_APPROVED, SUBMISSION_REJECTED, SUBMISSION_USED

== DB SCHEMA MỚI ==
Bảng: student_question_submissions
  - id: UUID PK
  - userId: FK → users (ON DELETE CASCADE)
  - subject: TEXT (TOAN, VAN, LY, HOA...)
  - chapter: TEXT nullable
  - questionText: TEXT
  - options: JSON (mảng 4 string — đáp án A/B/C/D)
  - correctOptionIndex: INT (0-3)
  - status: ENUM (PENDING, APPROVED, REJECTED) default PENDING
  - adminNote: TEXT nullable (lý do từ chối)
  - questionBankId: TEXT nullable FK → question_bank.id (set khi duyệt, ON DELETE SET NULL)
  - usageCount: INT default 0 (số lần câu được thêm vào đề thi)
  - usagePointsEarned: INT default 0 (tổng điểm usage đã thưởng, tối đa 100)
  - createdAt, updatedAt

Index: @@index([userId, status, createdAt])
Index: @@index([questionBankId])

== API ENDPOINTS ==

Student-facing:
  POST   /api/submissions            — gửi câu hỏi mới
  GET    /api/submissions            — danh sách câu đã gửi (filter status, phân trang)
  GET    /api/submissions/:id        — chi tiết 1 câu (kèm adminNote nếu bị từ chối)

Admin-facing:
  GET    /api/admin/submissions      — danh sách câu chờ duyệt (filter status)
  POST   /api/admin/submissions/:id/approve  — duyệt: tạo bank entry + 30pts + notify
  POST   /api/admin/submissions/:id/reject   — từ chối: update + notify kèm lý do

== LUỒNG NGHIỆP VỤ CHI TIẾT ==

Khi APPROVE:
  1. Tạo bản ghi trong question_bank từ submission data
  2. Update submission: status=APPROVED, questionBankId=<new bank id>
  3. PointsService.addPoints(userId, 30, reason='SUBMISSION_APPROVED')
  4. NotificationService.create(userId, SUBMISSION_APPROVED, ...)
  Fire-and-forget bước 3+4

Khi REJECT:
  1. Update submission: status=REJECTED, adminNote=<lý do>
  2. NotificationService.create(userId, SUBMISSION_REJECTED, title, body=lý do)
  Fire-and-forget bước 2

Khi câu được thêm vào đề thi (from-bank):
  1. Trong examService.addFromBank() — sau khi insert exam_question
  2. Kiểm tra: bank_question có submission không? (query submission WHERE questionBankId = ?)
  3. Nếu có và usagePointsEarned < 100:
     - points = min(5, 100 - usagePointsEarned)
     - PointsService.addPoints(submission.userId, points, 'SUBMISSION_USED')
     - Update submission: usageCount+1, usagePointsEarned += points
     - NotificationService.create(userId, SUBMISSION_USED, "+5 điểm...")
  Fire-and-forget

== DANH SÁCH TASK ==

TASK 1: Backend — Schema + Migration
  Tạo enum SubmissionStatus, model StudentQuestionSubmission
  Migration + index
  Phụ thuộc: không

TASK 2: Backend — SubmissionService (student)
  createSubmission(userId, data) — validate 4 đáp án, correctOptionIndex 0-3
  getMySubmissions(userId, page, statusFilter?)
  getSubmissionById(userId, id)
  Phụ thuộc: TASK 1

TASK 3: Backend — SubmissionService (admin)
  getPendingSubmissions(page, statusFilter)
  approveSubmission(submissionId) → bank entry + 30pts + notify
  rejectSubmission(submissionId, note) → update + notify
  Phụ thuộc: TASK 2

TASK 4: Backend — Routes
  Student: POST/GET /api/submissions, GET /api/submissions/:id
  Admin: GET/POST /api/admin/submissions + approve/reject
  Phụ thuộc: TASK 3

TASK 5: Backend — Usage points trigger
  Trong examService.addFromBank(): sau insert → check submission → award 5pts
  Thêm SUBMISSION_USED vào NotificationType enum
  Phụ thuộc: TASK 3

TASK 6: Frontend — Form gửi câu hỏi
  Form trên tab mới trong ProfilePage hoặc trang riêng
  Fields: chọn môn, nhập chương (optional), nội dung câu, 4 ô đáp án, radio chọn đáp án đúng
  Validation: không được bỏ trống nội dung/đáp án, phải chọn đáp án đúng
  Phụ thuộc: TASK 4

TASK 7: Frontend — Danh sách câu đã gửi (học sinh)
  Tab "Câu hỏi đã gửi" với badge trạng thái (🟡 Chờ / ✅ Duyệt / ❌ Từ chối)
  Click xem chi tiết + lý do từ chối nếu bị reject
  Thống kê nhỏ: tổng câu, tổng điểm thưởng nhận được
  Phụ thuộc: TASK 6

TASK 8: Frontend — Admin UI quản lý submissions
  Tab mới "Câu hỏi học sinh" trong admin dashboard
  Danh sách filter theo status (PENDING trước)
  Modal xem chi tiết câu + nút "Duyệt" / "Từ chối" (nhập lý do khi từ chối)
  Phụ thuộc: TASK 4

== DEFINITION OF DONE ==
□ Học sinh gửi câu hỏi thành công (nội dung + 4 đáp án + đáp án đúng + môn/chương)
□ Câu mới xuất hiện trong danh sách "Đang chờ duyệt" của học sinh
□ Admin thấy danh sách câu PENDING trong dashboard, xem được chi tiết
□ Admin duyệt → câu vào ngân hàng + học sinh nhận 30 điểm + thông báo SUBMISSION_APPROVED
□ Admin từ chối kèm lý do → học sinh thấy lý do + nhận thông báo SUBMISSION_REJECTED
□ Câu từ ngân hàng được thêm vào đề thi → học sinh nhận +5 điểm + thông báo SUBMISSION_USED
□ Tổng điểm usage không vượt quá 100 điểm cho 1 câu hỏi
□ Học sinh xem danh sách câu đã gửi với trạng thái và lý do từ chối (nếu có)
□ POST /api/submissions validate đầy đủ (thiếu field → 400, correctOptionIndex ngoài 0-3 → 400)
□ POST /api/admin/submissions/:id/approve sai user không phải admin → 403
□ Build BE + FE không lỗi, unit test không giảm

== LƯU Ý KỸ THUẬT ==
- Question type mặc định là MCQ_4 (trắc nghiệm 4 đáp án) — học sinh chưa cần chọn loại
- Khi approve: copy toàn bộ sang question_bank với isActive=true, type=MCQ_4
- adminNote chỉ hiển thị cho học sinh khi status=REJECTED
- usagePointsEarned tối đa 100: min(5, 100 - current) để không vượt trần
- Tất cả points + notification dùng fire-and-forget, không block response admin
