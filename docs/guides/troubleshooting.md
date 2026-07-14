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

---

## Lỗi liên quan đến tính năng Notifications — Thông báo hệ thống (Feature 013)

### 10. Badge chuông không cập nhật số thông báo mới

**Triệu chứng**: Có sự kiện mới (lên hạng, streak milestone...) nhưng số đỏ trên icon chuông 🔔 không đổi.

**Nguyên nhân**: Frontend polling `GET /api/notifications/unread-count` mỗi 30 giây — có độ trễ tối đa 30s theo thiết kế (xem `FEATURE_LOG.md` mục "Polling 30 giây thay vì WebSocket").

**Giải pháp**:
- Đợi tối đa 30 giây rồi kiểm tra lại.
- Nếu quá 1 phút vẫn không cập nhật: kiểm tra tab trình duyệt có đang ở background/inactive không (một số trình duyệt throttle `setInterval` khi tab không active).
- Reload trang để buộc gọi lại API ngay lập tức.

### 11. Không nhận thông báo Streak Milestone dù đã đủ 7 ngày liên tiếp

**Triệu chứng**: Học sinh chắc chắn đã học 7 ngày liên tiếp nhưng không thấy thông báo 🔥.

**Nguyên nhân phổ biến nhất**: Đây không phải phiên ôn tập **đầu tiên** hoàn thành trong ngày — cơ chế dedup chỉ gửi thông báo khi `count sessions hôm nay === 1`. Nếu học sinh học nhiều phiên rồi mới đạt mốc, notification không bắn (đã bắn ở phiên đầu ngày với streak cũ hơn, chưa chạm mốc).

**Giải pháp**:
- Kiểm tra DB xem streak thực tế đã đúng mốc `[7,14,30,60,100]` chưa:
```sql
SELECT "completedAt" FROM practice_sessions
WHERE "userId" = '<userId>' AND "completedAt" IS NOT NULL
ORDER BY "completedAt" DESC LIMIT 30;
```
- Đây là hành vi *đúng theo thiết kế* — không phải bug. Giải thích cho học sinh: mốc chỉ thông báo 1 lần/ngày, vào phiên đầu tiên đạt mốc.

### 12. Toast thông báo hiện lại ngay khi vừa mở app (spam)

**Triệu chứng**: Mở lại app sau một thời gian, toast thông báo cũ hiện lên ngay lập tức dù đã đọc từ trước.

**Nguyên nhân**: Đây là bug đã được S3 sửa trong review (dùng sentinel `prevUnreadRef.current = -1` thay vì `0`). Nếu vẫn gặp, có thể do build cũ chưa deploy fix.

**Giải pháp**:
- Xác nhận đang chạy code từ commit `41a1ef5` trở về sau (branch `feature/notifications`).
- Nếu vẫn lỗi sau khi deploy đúng bản: kiểm tra `frontend/src/App.tsx` xem `prevUnreadRef` có khởi tạo đúng `-1` không.

### 13. Bấm PATCH đánh dấu đã đọc trả về 404

**Triệu chứng**: Gọi `PATCH /api/notifications/:id/read` hoặc thao tác trên panel báo lỗi, notification không được đánh dấu đã đọc.

**Nguyên nhân**: Nhiều khả năng nhất là **route ordering** — nếu code bị sửa lại và `/:id/read` được đăng ký TRƯỚC `/unread-count` hoặc `/read-all`, Express sẽ match nhầm các path tĩnh này vào `:id`. Khả năng khác: `id` không thuộc về user hiện tại (`403 NOTIFICATION_NOT_OWNED`) hoặc notification không tồn tại (`404 NOTIFICATION_NOT_FOUND`).

**Giải pháp**:
- Kiểm tra thứ tự khai báo route trong `backend/src/routes/notification.route.ts`: `/unread-count` và `/read-all` phải đứng TRƯỚC `/:id/read`.
- Xác nhận `id` truyền vào đúng là UUID của notification, không phải chuỗi khác.
- Xem response body để phân biệt 404 (không tồn tại) và 403 (không phải chủ sở hữu).

### 14. Học sinh không nhận thông báo "Đề thi mới" dù admin đã bật active

**Triệu chứng**: Admin bật `isActive` cho đề thi nhưng học sinh trong môn đó không thấy thông báo 📝.

**Nguyên nhân**: Batch trigger `fireNewExamPaperNotifications` chỉ chạy khi `isActive` chuyển từ `false → true`. Nếu đề thi tạo mới đã `isActive: true` ngay từ đầu, hoặc chuyển `true → true`, trigger không chạy. Ngoài ra, chỉ học sinh **đã từng có session (luyện tập hoặc thi thử) ở môn đó** mới nhận được — học sinh chưa từng học môn này sẽ không nằm trong danh sách nhận.

**Giải pháp**:
- Xem mục 13.3 trong `admin-guide.md` để kiểm tra điều kiện trigger.
- Xác nhận học sinh đã từng luyện tập/thi môn đó ít nhất 1 lần trước khi đề mới được bật.
- Không có cách gửi lại thủ công — nếu cần, admin tắt rồi bật lại `isActive` để trigger chạy lại (sẽ gửi lại cho TẤT CẢ user đủ điều kiện, không chỉ user mới).

---

## Lỗi liên quan đến Quản lý câu hỏi — Submissions + Report Redesign (Feature 014)

### 15. Duyệt/từ chối/sửa/xoá câu hỏi gửi báo lỗi 409 SUBMISSION_NOT_PENDING

**Triệu chứng**: Admin bấm "Duyệt" hoặc "Từ chối" (hoặc học sinh bấm "Sửa"/"Xoá") trên 1 câu hỏi gửi, nhận lỗi 409 dù nhìn trên màn hình vẫn thấy trạng thái "Chờ duyệt".

**Nguyên nhân**: Đây là kết quả của cơ chế chống race condition có chủ đích (claim pattern bằng `updateMany`/`deleteMany` điều kiện `status=PENDING`, xem `docs/FEATURE_LOG.md` Section 14 mục "Ghi chú kỹ thuật") — không phải bug. Xảy ra khi: 2 admin cùng xử lý 1 submission gần như đồng thời (người thao tác sau nhận 409), hoặc học sinh vừa sửa/xoá đúng lúc admin đang duyệt, hoặc dữ liệu trên màn hình admin đã cũ (chưa refresh sau khi người khác xử lý).

**Giải pháp**:
- Làm mới (F5 hoặc bấm lại filter) danh sách để lấy trạng thái mới nhất trước khi thao tác lại.
- Nếu lỗi lặp lại liên tục với cùng 1 submission dù đã refresh: kiểm tra trực tiếp trong DB `SELECT status FROM student_question_submissions WHERE id = '<id>';` — trạng thái thực tế mới là nguồn đúng, không phải giao diện.

### 16. Học sinh báo "đã được duyệt" nhưng không thấy cộng 30 điểm

**Triệu chứng**: Submission đã chuyển sang trạng thái ✅ Đã duyệt, nhưng điểm tích luỹ của học sinh không tăng.

**Nguyên nhân**: Bước cộng điểm + gửi thông báo chạy **fire-and-forget** (`fireApprovedRewards`, không `await`, không block response duyệt) — nếu bước này lỗi (hiếm, ví dụ DB tạm thời không kết nối được), việc duyệt (tạo bản ghi Ngân hàng câu hỏi) vẫn thành công nhưng điểm sẽ **không** được cộng.

**Giải pháp**:
- Kiểm tra log backend tìm dòng `[SubmissionService] fireApprovedRewards addPoints error`.
- Nếu có, cộng điểm thủ công 30đ cho học sinh (qua `pointsService.addPoints` hoặc script debug), lý do `SUBMISSION_APPROVED`.
- Áp dụng tương tự cho điểm "usage" (+5đ/lần dùng trong đề thi) — tìm log `[QuestionBankService] fireUsagePointsTrigger addPoints error`.

### 17. Gọi `PATCH /api/admin/questions/reports/:id` (không có `/resolve`) trả về 404

**Triệu chứng**: Script/Postman collection cũ gọi `PATCH /api/admin/questions/reports/:id` để đổi trạng thái báo cáo, nhận lỗi 404 "Not Found" (không phải lỗi nghiệp vụ `QUESTION_REPORT_NOT_FOUND`).

**Nguyên nhân**: Đây là **breaking change có chủ đích** của Feature 014 — endpoint cũ đã bị xoá hoàn toàn khỏi router, thay bằng `PATCH /api/admin/questions/reports/:id/resolve` (thêm `/resolve`, chỉ nhận `status: FIXED|DISMISSED`, không còn `REVIEWED`).

**Giải pháp**:
- Cập nhật mọi script/Postman collection/tài liệu nội bộ sang endpoint mới, xem `docs/api/openapi.yaml` hoặc mục 4.3 trong `admin-guide.md`.
- Nếu cần xử lý hàng loạt bằng script, nhớ đổi luôn field response: `autoHidden` (cũ) → `reactivated` + `batchResolvedCount` (mới).

### 18. Bấm "Bỏ qua" (DISMISSED) nhưng câu hỏi vẫn bị ẩn — tưởng là bug

**Triệu chứng**: Câu hỏi đang bị auto-hide (do ≥5 báo cáo PENDING), admin xử lý báo cáo bằng "Bỏ qua", nhưng câu hỏi vẫn không hiện lại cho học sinh.

**Nguyên nhân**: **Đây là hành vi đúng theo thiết kế**, không phải bug — chỉ `status=FIXED` mới kích hoạt tự động `isActive=true`. `DISMISSED` nghĩa là "báo cáo này không hợp lệ", không phải "đã xác nhận câu hỏi ổn" — hệ thống cố tình không tự hiện lại câu hỏi trong trường hợp này để tránh admin vô tình bỏ qua 1 báo cáo hợp lệ rồi câu hỏi lỗi lại hiện ra cho học sinh khác.

**Giải pháp**:
- Nếu sau khi xem xét, câu hỏi thực sự không có vấn đề gì (báo cáo sai), admin cần chủ động sửa `isActive=true` qua tab "Ngân hàng câu hỏi" (mục 8, `admin-guide.md`) hoặc dùng nút "✏️ Sửa & Đánh dấu đã sửa" (`status=FIXED`) thay vì "Bỏ qua" nếu muốn câu hỏi tự động hiện lại.

### 19. Dashboard admin hiện số "chờ xử lý" trên tab "Câu hỏi" sai/không khớp

**Triệu chứng**: Badge đỏ trên tab "Câu hỏi" hiện số không khớp với tổng số báo cáo PENDING + submission PENDING thực tế.

**Nguyên nhân phổ biến nhất**: Badge (`questionsPendingBadge`) chỉ refetch khi đổi `tab` hoặc `secret` thay đổi (`useEffect` phụ thuộc `[secret, tab]`) — nếu admin xử lý xong 1 báo cáo/submission mà KHÔNG chuyển tab ra rồi vào lại, badge không tự cập nhật ngay (không có polling như bell icon phía học sinh, Feature 013).

**Giải pháp**: Chuyển sang tab khác rồi quay lại tab "Câu hỏi" để buộc tính lại badge, hoặc F5 trang. Đây là giới hạn đã biết (badge admin không polling theo thời gian thực), không phải lỗi tính toán sai.
