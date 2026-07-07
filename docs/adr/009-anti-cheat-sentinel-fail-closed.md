# ADR-009: Anti-Cheat — Sentinel `{}` và Fail-Closed Redis

**Ngày**: 2026-07-07
**Trạng thái**: Accepted
**Tính năng liên quan**: Anti-Cheat Security Fixes (branch `feature/anti-cheat-fixes`)

---

## Bối cảnh

Phát hiện 4 lỗ hổng cho phép học sinh gian lận trong module Thi thử và Luyện tập. Cần quyết định cách thiết kế cho 2 vấn đề kỹ thuật:

1. **Phân biệt "câu bỏ trắng" vs "câu trả lời sai"** trong kết quả thi để tránh lộ đáp án đúng của câu bỏ trắng.
2. **Xử lý khi Redis không khả dụng** trong kiểm tra rate limit luyện tập.

---

## Quyết định 1: Sentinel `{}` cho câu bỏ trắng

### Vấn đề
`getExamResult()` trả về `correctAnswer` cho *tất cả* câu trong `wrongAnswers`, kể cả câu học sinh bỏ trắng. Điều này cho phép học sinh:
1. Bắt đầu thi
2. Nộp bài ngay (không làm gì)
3. Xem kết quả → thấy đáp án tất cả câu → học thuộc → thi lại

### Lựa chọn đã xét

**A. Lọc câu bỏ trắng ra khỏi `wrongAnswers`** (không hiển thị câu bỏ trắng):
- ✅ Đơn giản
- ❌ Frontend mất thông tin "câu đã bị bỏ qua" → UX kém
- ❌ Không phân biệt được "bỏ trắng cố ý" vs "câu thật sự làm sai"

**B. Thêm field `isUnanswered: boolean` vào `ExamWrongAnswerItem`**:
- ✅ Rõ ràng về ý định
- ❌ Thay đổi API response shape (breaking change nếu có client khác)
- ❌ Redundant với `selectedAnswer` đã có

**C. Dùng sentinel `{}` + `correctAnswer = null`** *(đã chọn)*:
- ✅ `selectedAnswer: {}` → frontend biết "câu bỏ trắng"
- ✅ `correctAnswer: null` → không lộ đáp án
- ✅ Không thêm field mới vào interface
- ✅ `null` trong TypeScript là giá trị hợp lệ, đủ rõ về ý nghĩa
- ⚠️ Cần phân biệt `null` (không có ExamAnswer record) vs `{}` (có record nhưng bỏ trắng)

### Quyết định
Chọn **C**. Backend detect `isSentinelUnanswered(selectedAnswer)` → set `correctAnswer = null`. Frontend check `w.correctAnswer === null` → hiển thị "Bạn chưa trả lời câu này" thay vì đáp án đúng.

---

## Quyết định 2: Fail-Closed cho Redis rate limit

### Vấn đề
`checkRateLimit()` bắt lỗi Redis và *bỏ qua* (fail-open). Khi Redis down (dù hiếm), giới hạn 10 phiên/giờ bị vô hiệu hóa — học sinh có thể tạo phiên vô hạn.

### Lựa chọn đã xét

**A. Fail-Open (giữ nguyên)** — bỏ qua lỗi Redis, cho phép tạo phiên:
- ✅ UX tốt khi Redis down
- ❌ Bảo mật kém — gian lận được khi Redis down
- ❌ Rate limit không đáng tin cậy

**B. Fail-Closed** *(đã chọn)* — throw `PracticeRateLimitError` khi Redis lỗi:
- ✅ Rate limit luôn được đảm bảo
- ✅ Bảo mật nhất quán
- ⚠️ UX xấu khi Redis down (user không thể luyện tập)

**C. Fallback sang DB counter**:
- ✅ Không phụ thuộc Redis
- ❌ Phức tạp, cần migration (thêm cột counter vào DB)
- ❌ DB counter chậm hơn Redis cho rate limit
- ❌ Ngoài phạm vi PR này

### Quyết định
Chọn **B (Fail-Closed)**. Redis uptime thực tế >99.9% — downtime rất hiếm và ngắn. Bảo mật quan trọng hơn UX trong trường hợp hiếm gặp này. Ghi log `console.error` khi Redis lỗi để monitoring phát hiện sớm.

---

## Hệ quả

### Tích cực
- Loại bỏ 4 vector gian lận rõ ràng
- Sentinel pattern có thể tái dụng cho các module khác
- Fail-closed là default security posture tốt

### Tiêu cực / Đánh đổi
- Khi Redis down: user không bắt đầu luyện tập được
- Race condition nhỏ ở Bug 4 (startExam check ngoài transaction) — chấp nhận được

### Nợ kỹ thuật
- [ ] Thêm unique constraint DB `(userId, subjectId, status='IN_PROGRESS')` để fix race condition Bug 4 hoàn toàn
- [ ] Monitoring alert khi Redis down
- [ ] Xem xét DB fallback counter cho rate limit trong giai đoạn mobile (khi cần scale)
