# Troubleshooting Guide — QuizzGame

> Hướng dẫn xử lý các lỗi phổ biến cho admin và developer.

---

## Lỗi liên quan đến Thi thử (Exam)

### 1. Học sinh báo "bị chặn nộp bài" dù vừa bắt đầu thi

**Triệu chứng**: Frontend hiển thị "Bạn cần làm bài thêm X phút nữa mới được nộp."

**Nguyên nhân**: Tính năng anti-cheat Bug 1a — học sinh phải làm ít nhất 30% thời gian đề thi trước khi nộp. Đề 60 phút → phải làm tối thiểu 18 phút.

**Giải pháp**:
- Đây là hành vi *đúng*. Nhắc học sinh chờ đủ thời gian.
- Nếu học sinh thật sự bị lỗi (không phải gian lận): kiểm tra đồng hồ thiết bị của họ có đúng giờ không (lệch giờ server có thể gây sai elapsed).
- Điều chỉnh ngưỡng: sửa `EXAM_MIN_SUBMIT_RATIO` trong `exam.types.ts` (cần deploy lại).

---

### 2. Học sinh báo "có phiên thi chưa hoàn thành" nhưng không thấy phiên nào

**Triệu chứng**: POST /api/exam/start trả 409 `EXAM_SESSION_ALREADY_ACTIVE`.

**Nguyên nhân**: Có phiên `IN_PROGRESS` trong DB chưa hết hạn (ví dụ: học sinh tắt browser giữa chừng, chờ đủ giờ tự EXPIRED, hoặc multi-tab).

**Giải pháp**:
```sql
-- Kiểm tra phiên IN_PROGRESS của user
SELECT id, subjectId, startedAt, durationMinutes,
       (EXTRACT(EPOCH FROM NOW()) - EXTRACT(EPOCH FROM "startedAt")) / 60 AS elapsed_minutes
FROM exam_sessions
WHERE "userId" = '<user_id>' AND status = 'IN_PROGRESS';
```
- Nếu `elapsed_minutes > durationMinutes + 0.5`: phiên thật sự đã hết hạn nhưng chưa được mark EXPIRED. Cập nhật thủ công:
```sql
UPDATE exam_sessions SET status = 'EXPIRED', "completedAt" = NOW()
WHERE "userId" = '<user_id>' AND status = 'IN_PROGRESS';
```
- Nếu chưa hết hạn: học sinh cần đợi hết giờ hoặc hoàn thành phiên hiện tại.

---

### 3. Kết quả thi không hiển thị đáp án đúng cho một số câu

**Triệu chứng**: Một số câu trong kết quả thi hiển thị "Bạn chưa trả lời câu này" thay vì đáp án đúng.

**Nguyên nhân**: Đây là hành vi *đúng*. Câu đó học sinh đã bỏ trắng (không chọn đáp án). Backend trả `correctAnswer: null` để không lộ đáp án cho câu bỏ qua.

**Giải pháp**: Giải thích cho học sinh đây là tính năng bảo mật, không phải lỗi. Họ cần thực sự trả lời câu hỏi để xem đáp án đúng/sai.

---

## Lỗi liên quan đến Luyện tập (Practice)

### 4. Học sinh không thể bắt đầu phiên luyện tập dù chưa đạt giới hạn

**Triệu chứng**: POST /api/practice/start trả 429 `PRACTICE_RATE_LIMIT_EXCEEDED` khi học sinh chưa đạt 10 phiên/giờ.

**Nguyên nhân có thể**:
- Redis đang gặp sự cố (kết nối chậm, restart). Hệ thống dùng fail-closed — khi Redis không phản hồi → block request.
- Count trong Redis bị sai do bug cũ.

**Giải pháp**:
```bash
# Kiểm tra Redis
redis-cli ping  # Kỳ vọng: PONG

# Xem count hiện tại của user
redis-cli get "ratelimit:practice:<user_id>"

# Xóa count nếu sai (reset về 0)
redis-cli del "ratelimit:practice:<user_id>"
```
- Kiểm tra logs backend có `[PracticeService] Redis rate limit check that bai (fail-closed)` không. Nếu có → Redis có vấn đề, cần điều tra Redis server.

---

### 5. Học sinh báo hoàn thành phiên luyện tập nhưng không nhận điểm

**Triệu chứng**: POST /api/practice/complete trả 410 `PRACTICE_SESSION_EXPIRED`.

**Nguyên nhân**: Học sinh nộp sau khi phiên hết 17 phút + 60 giây grace (tổng 18 phút 1 giây). Hệ thống đánh dấu session `completedAt` nhưng không cộng điểm.

**Giải pháp**:
- Đây là hành vi *đúng* (anti-cheat Bug 3).
- Nhắc học sinh hoàn thành bài trong vòng 17 phút.
- Nếu học sinh bị mất mạng giữa chừng: hệ thống có 60s grace, nhưng nếu mất mạng lâu hơn thì không cứu được. Đây là đánh đổi bảo mật/UX đã được chấp nhận.

---

## Lỗi chung / Server

### 6. Các lỗi 409 Conflict không rõ nguyên nhân trong Exam module

| Error Code | Nguyên nhân | Giải pháp |
|------------|-------------|-----------|
| `EXAM_SESSION_ALREADY_ACTIVE` | Phiên IN_PROGRESS đang tồn tại | Xem mục #2 |
| `EXAM_SESSION_ALREADY_COMPLETED` | Nộp bài 2 lần | Bình thường, bảo học sinh không bấm submit nhiều lần |
| `EXAM_INSUFFICIENT_POINTS` | Không đủ 60 điểm vào thi | Học sinh cần tích thêm điểm qua luyện tập |

---

## Lỗi liên quan đến tính năng Exam UX Improvements

### 7. Bấm "Tiếp tục" nhưng không vào được bài thi

**Triệu chứng**: Bấm "Tiếp tục" trong banner resume → thông báo "Không thể khôi phục bài thi. Bạn có thể bắt đầu bài mới."

**Nguyên nhân**: Dữ liệu câu hỏi (`exam_session_data_{sessionId}`) không còn trong localStorage — có thể do người dùng clear cache trình duyệt hoặc dùng chế độ ẩn danh.

**Giải pháp**:
- Hệ thống tự động huỷ phiên cũ và cho phép thi lại.
- Học sinh mất 60đ vào thi của phiên đó (không hoàn lại).
- Bấm vào môn học để bắt đầu bài thi mới bình thường.

---

### 8. Bài thi bị huỷ nhưng vẫn bị chặn khi thi lại

**Triệu chứng**: Sau khi huỷ bài (abandon), bấm bắt đầu thi mới vẫn nhận 409 `EXAM_SESSION_ALREADY_ACTIVE`.

**Nguyên nhân**: Có thể gọi abandon thất bại (mất mạng trong lúc xử lý) khiến session vẫn ở trạng thái `IN_PROGRESS`.

**Giải pháp**:
- Làm mới trang → banner "Tiếp tục?" hiện lại → bấm "Huỷ bài" lần nữa.
- Hoặc đợi session tự hết giờ (tối đa bằng thời gian còn lại của đề thi).
- Admin có thể kiểm tra DB và update status thủ công nếu cần giải quyết nhanh.

---

### 9. Đáp án đã chọn không được khôi phục khi resume

**Triệu chứng**: Bấm "Tiếp tục" → vào bài thi nhưng tất cả câu đều trắng (chưa chọn gì).

**Nguyên nhân**: File `exam_draft_{sessionId}` trong localStorage bị mất hoặc bị xóa.

**Giải pháp**:
- Đây là giới hạn đã biết của tính năng (draft lưu client-side).
- Học sinh cần chọn lại đáp án. Đồng hồ vẫn chạy đúng — chỉ đáp án nháp bị mất.
- Để tránh: không xóa cache trình duyệt trong khi đang có bài thi dở.
