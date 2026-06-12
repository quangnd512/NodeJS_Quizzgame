# ADR 001: Chỉ cho phép báo cáo câu hỏi đã từng làm

## Bối cảnh

Hệ thống có cơ chế **auto-hide**: khi một câu hỏi nhận đủ
`AUTO_HIDE_REPORT_THRESHOLD` (5) báo cáo ở trạng thái `PENDING`, câu hỏi đó tự
động bị ẩn (`isActive = false`) mà không cần admin can thiệp (xem
`docs/GLOSSARY.md` mục "Auto-Hide").

Cơ chế này giúp ẩn nhanh các câu hỏi lỗi rõ ràng (sai đáp án, sai chính tả...)
khi nhiều user cùng phản ánh. Nhưng nó cũng tạo ra một lỗ hổng: trước feature
này, `POST /api/practice/questions/:id/report` chỉ kiểm tra
`questionId` có tồn tại hay không — bất kỳ user đã đăng nhập đều có thể gửi
báo cáo cho **bất kỳ `questionId` nào**, kể cả câu họ chưa từng nhìn thấy.

Một user (hoặc nhóm user phối hợp) có thể tạo nhiều tài khoản, mỗi tài khoản
gửi 1 báo cáo cho cùng `questionId` của đối thủ/đối tượng muốn hạ — đủ 5 báo
cáo là câu đó bị ẩn khỏi mọi phiên ôn tập mới, ảnh hưởng đến tất cả user khác.

## Quyết định

Thêm một bước kiểm tra trong `reportQuestion()`: trước khi tạo
`question_report`, query
`prisma.userQuestionHistory.findUnique({ where: { userId_questionId: { userId, questionId } } })`.

- Nếu **không tồn tại** bản ghi lịch sử → throw `QuestionNotAttemptedForReportError`
  (`403 QUESTION_NOT_ATTEMPTED_FOR_REPORT`), không tạo báo cáo.
- Nếu **tồn tại** → tiếp tục luồng cũ (check đã báo cáo trùng chưa → tạo
  `question_report` → `autoHideIfThresholdExceeded`).

Tái sử dụng bảng `user_question_history` và composite key
`userId_questionId` đã có sẵn từ Practice Module (dùng cho idempotency của
`POST /practice/answer`) — không cần migration hay bảng mới.

## Lý do

**Đã cân nhắc các giải pháp khác:**

1. **Rate limit số báo cáo / user / giờ (qua Redis)** — đã có cơ chế rate
   limit tương tự cho việc tạo session (`MAX_SESSIONS_PER_HOUR`). Nhưng rate
   limit chỉ giảm *tốc độ* spam, không chặn được tấn công phối hợp nhiều tài
   khoản — mỗi tài khoản chỉ cần gửi 1 báo cáo.

2. **Yêu cầu admin duyệt thủ công trước khi auto-hide** — loại bỏ hoàn toàn
   lợi ích "tự động" của auto-hide (vốn được thiết kế để giảm tải cho admin),
   biến nó thành một hàng đợi review thông thường.

3. **Tăng `AUTO_HIDE_REPORT_THRESHOLD`** — chỉ làm tăng *chi phí* tấn công
   (cần nhiều tài khoản hơn), không giải quyết gốc vấn đề, và làm chậm việc ẩn
   các câu hỏi thật sự lỗi khi có phản ánh hợp lệ.

**Giải pháp được chọn — kiểm tra `user_question_history`:**

- Buộc kẻ tấn công phải **thực sự làm bài và trả lời** câu hỏi đó trước khi có
  thể báo cáo → chi phí tấn công tăng đáng kể (phải chạy qua toàn bộ luồng
  ôn tập cho mỗi tài khoản, mỗi câu).
- Tận dụng dữ liệu & composite key **đã có sẵn** — không cần bảng/migration
  mới, không tốn thêm chi phí lưu trữ.
- Không ảnh hưởng đến luồng hợp lệ: user bình thường chỉ báo cáo câu họ vừa
  làm, nên hầu như luôn có `user_question_history` tương ứng.

**Đánh đổi đã chấp nhận**: User không thể báo cáo "hộ" một câu hỏi họ thấy lỗi
nhưng chưa làm (vd. xem màn hình người khác). Đây là đánh đổi hợp lý vì luồng
chính (báo cáo ngay sau khi làm câu, xem `PracticeSessionScreen`) không bị
ảnh hưởng.
