# ADR-010: Notifications — Fire-and-Forget Trigger và Polling thay vì WebSocket

**Ngày**: 2026-07-09
**Trạng thái**: Accepted
**Tính năng liên quan**: Notifications — Thông báo hệ thống (branch `feature/notifications`)

---

## Bối cảnh

Feature 013 cần thông báo cho user về 5 loại sự kiện: streak milestone, đổi hạng leaderboard, báo cáo câu hỏi được xử lý, đề thi mới. Các sự kiện này phát sinh từ nhiều service nghiệp vụ khác nhau (`practice.service`, `exam.service`) đã có luồng transaction riêng, ổn định từ trước. Cần quyết định 2 vấn đề kiến trúc:

1. Notification nên được tạo **trong** hay **ngoài** transaction nghiệp vụ chính?
2. Frontend nên biết có thông báo mới bằng cơ chế nào — real-time (WebSocket/SSE) hay polling định kỳ?

---

## Quyết định 1: Fire-and-forget — tạo notification NGOÀI transaction chính

### Vấn đề
Sau khi `exam.submitExam()` hoặc `practice.completeSession()` commit thành công, cần kiểm tra thêm (đổi hạng? đủ streak milestone?) rồi tạo bản ghi `notification`. Nếu làm trong cùng transaction, một lỗi ở bước tạo thông báo (bug, DB tạm lỗi...) sẽ rollback toàn bộ điểm số / kết quả bài thi của user — hậu quả nghiêm trọng hơn nhiều so với việc mất 1 thông báo.

### Lựa chọn đã xét

**A. Tạo notification TRONG transaction chính (atomic)**:
- ✅ Đảm bảo tính nhất quán tuyệt đối — nếu có bài thi thì chắc chắn có thông báo tương ứng (nếu điều kiện đúng)
- ❌ Transaction dài hơn → tăng khả năng deadlock/timeout (đặc biệt `checkAndFireRankChangeNotification` cần query lại rank SAU submit — không thể biết trước khi transaction đóng)
- ❌ 1 bug nhỏ ở notification logic có thể làm hỏng toàn bộ luồng nộp bài thi — rủi ro không tương xứng với giá trị nghiệp vụ của notification

**B. Fire-and-forget: gọi `void notificationService.createNotification(...)` SAU khi transaction chính đã commit** *(đã chọn)*:
- ✅ Transaction nghiệp vụ giữ ngắn gọn, không phụ thuộc notification
- ✅ Lỗi notification chỉ bị `console.error`, không ảnh hưởng response trả về user
- ✅ Mỗi hàm trigger tự bọc `try/catch` riêng — cô lập lỗi ở tầng gọi
- ⚠️ Có khả năng (rất nhỏ) mất 1 thông báo nếu server crash đúng giữa lúc transaction vừa commit và trước khi `createNotification` chạy xong — chấp nhận được vì notification không phải dữ liệu nghiệp vụ cốt lõi

### Quyết định
Chọn **B**. Áp dụng nhất quán cho cả 4 trigger: `checkAndFireStreakMilestone`, `checkAndFireRankChangeNotification`, `fireReportResolvedNotification`, `fireNewExamPaperNotifications` — tất cả đều là `void this.fireXxx(...)` gọi sau khi thao tác chính đã hoàn tất, và đều tự bắt lỗi bên trong.

---

## Quyết định 2: Polling 30 giây thay vì WebSocket/SSE

### Vấn đề
Frontend cần biết "có thông báo mới" để cập nhật badge chuông và hiện toast, mà không có hạ tầng real-time nào sẵn có trong dự án.

### Lựa chọn đã xét

**A. WebSocket hoặc Server-Sent Events (real-time)**:
- ✅ Độ trễ gần như 0 — user thấy thông báo ngay khi phát sinh
- ❌ App chưa có hạ tầng WebSocket — cần thêm server-side connection management, phức tạp hóa deploy/scale
- ❌ Chi phí hạ tầng không tương xứng với bản chất sự kiện (streak, đổi hạng, đề thi mới đều không cần real-time tới từng mili-giây)

**B. Polling `GET /api/notifications/unread-count` mỗi 30 giây** *(đã chọn)*:
- ✅ Không cần hạ tầng mới, tái dùng REST API sẵn có
- ✅ Endpoint rất nhẹ — chỉ 1 câu `COUNT` có index `(userId, isRead, createdAt)`
- ✅ 30 giây là độ trễ chấp nhận được cho các sự kiện học tập (khác với chat cần real-time)
- ✅ Có thể nâng cấp lên WebSocket sau này mà không phá vỡ tương thích ngược (route REST vẫn giữ nguyên)
- ⚠️ Độ trễ tối đa 30 giây, cộng thêm rủi ro `setInterval` bị trình duyệt throttle ở tab nền → bù bằng listener `visibilitychange` (poll ngay khi tab active trở lại)
- ⚠️ Tạo load nhẹ liên tục lên server (1 query/user/30s) — chấp nhận được ở quy mô hiện tại

### Quyết định
Chọn **B**. Kèm theo 2 biện pháp giảm độ trễ cảm nhận (bổ sung sau vòng test thủ công của S5):
- Sentinel `prevUnreadRef.current = -1` để lần poll đầu tiên sau đăng nhập không "dội" toast cho các thông báo cũ.
- Listener `visibilitychange` gọi `poll()` ngay khi tab được focus lại.

---

## Hệ quả

### Tích cực
- Cả 2 quyết định giữ notification là tính năng "phụ" — không bao giờ trở thành single point of failure cho luồng thi/luyện tập.
- Không cần đầu tư hạ tầng WebSocket cho một nhu cầu chưa thật sự real-time.
- Dễ mở rộng: thêm loại thông báo mới chỉ cần 1 hàm `void fireXxx(...)` mới, không đụng vào transaction nghiệp vụ.

### Tiêu cực / Đánh đổi
- Có xác suất rất nhỏ mất thông báo nếu crash đúng thời điểm giữa commit và fire-and-forget (chấp nhận được).
- Độ trễ tối đa ~30 giây (hoặc tới khi tab focus lại) — không phù hợp nếu sau này cần thông báo dạng chat/real-time.
- Polling tạo request định kỳ cho mọi user đang online, dù nhẹ nhưng sẽ cần đánh giá lại khi số lượng user tăng lớn.

### Nợ kỹ thuật
- [ ] Nếu số lượng user tăng đáng kể, cân nhắc chuyển sang WebSocket/SSE hoặc kéo dài chu kỳ polling + thêm cơ chế "long-poll".
- [ ] Toast hiện tại chỉ hỗ trợ hiển thị 1 thông báo tại 1 thời điểm (so sánh theo `id` để tránh race condition khi 2 toast đến gần nhau — xem Glossary "Toast ID Guard"). Nếu cần hiện đồng thời nhiều toast, cần thiết kế lại thành queue.
