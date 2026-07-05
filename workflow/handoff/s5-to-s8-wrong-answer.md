# S5 → S8: Kết quả kiểm thử Ôn Câu Sai (Wrong Answer Review)

**Branch:** feature/wrong-answer-review  
**Ngày kiểm thử:** 2026-07-05  
**Tester:** S5-ThuNghiem  

---

## Tóm tắt

| Loại | Tổng | Pass | Fail | Skip |
|------|------|------|------|------|
| Happy Path | 13 | 13 | 0 | 0 |
| Edge Cases | 5 | 5 | 0 | 0 |
| Error/Loading | 2 | 2 | 0 | 0 |
| **Tổng** | **20** | **20** | **0** | **0** |

---

## Chi tiết kết quả

### Happy Path

| # | Mô tả | Kết quả |
|---|-------|---------|
| 1 | Nút "❌ Ôn câu sai" hiển thị trên ProfilePage | ✅ PASS |
| 2 | Điều hướng vào WrongAnswersPage, header + danh sách đúng | ✅ PASS |
| 3 | Nút Back quay về ProfilePage | ✅ PASS |
| 4 | Trạng thái trống (🎉 Không có câu sai nào) | ✅ PASS |
| 5 | Câu sai từ Practice ghi vào DB và hiện trong danh sách | ✅ PASS |
| 6 | Câu sai từ Exam ghi vào DB và hiện trong danh sách | ✅ PASS |
| 7 | Xem đáp án câu MCQ_4 | ✅ PASS |
| 8 | Ẩn đáp án | ✅ PASS |
| 9 | Làm lại MCQ_4 đúng → card xanh + badge "✅ Đã làm đúng" | ✅ PASS |
| 10 | Làm lại MCQ_4 sai → "❌ Chưa đúng" + link Thử lại | ✅ PASS |
| 11 | Nút "Thử lại" reset mini quiz về trạng thái ban đầu | ✅ PASS |
| 12 | Nút "Kiểm tra" disabled khi chưa chọn đáp án | ✅ PASS |
| 13 | Xem đáp án và Làm lại không hiện đồng thời | ✅ PASS |

### Edge Cases

| # | Mô tả | Kết quả |
|---|-------|---------|
| 14 | Filter theo môn học | ✅ PASS |
| 15 | Filter "Tất cả môn học" hiện lại tất cả | ✅ PASS |
| 16 | Trạng thái trống khi filter môn không có câu sai | ✅ PASS |
| 17 | Phân trang (PAGE_SIZE=10, hoạt động đúng) | ✅ PASS |
| 18 | Sai câu lần 2 → wrongCount tăng đúng | ✅ PASS |

### Error/Loading

| # | Mô tả | Kết quả |
|---|-------|---------|
| 19 | Loading spinner + text "Đang tải danh sách câu sai…" | ✅ PASS |
| 20 | Nút "Đang kiểm tra…" disabled khi đang gửi request | ✅ PASS |

---

## Thay đổi phát sinh từ yêu cầu người dùng (không phải bug)

| File | Thay đổi |
|------|----------|
| `backend/src/services/wrongAnswer/wrongAnswer.service.ts` | retryQuestion: set expiresAt=NOW() khi isCorrect — câu làm đúng biến mất sau reload |
| `frontend/src/App.tsx` | Card hiện green state + badge "✅ Đã làm đúng" sau retry đúng |
| `frontend/src/App.tsx` | Thêm text "Đang tải danh sách câu sai…" bên dưới spinner |

---

**Kết luận:** 20/20 PASS. Không bug mới. UI/UX hoạt động mượt. Ready for S6.
