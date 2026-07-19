[GHI CHÚ ƯU TIÊN — DO NGƯỜI DÙNG + S1 THỐNG NHẤT]
Ngày lưu: 2026-07-13
Cập nhật: 2026-07-15 — ĐÍNH CHÍNH quan trọng (xem mục 3) + thêm bước 7 theo yêu cầu người dùng.

Người dùng đã đồng ý thứ tự triển khai các kế hoạch đã lưu như sau (lý do: giảm thiểu
việc phải sửa lại các phần đã làm khi làm tới phần sau):

1. ✅ Notifications (Feature 013) — ĐÃ XONG (merge 2026-07-11, v1.11.0)
2. ✅ Gộp "Học sinh đóng góp câu hỏi" + "Thiết kế lại luồng xử lý báo cáo câu hỏi"
   thành "Quản lý câu hỏi" (Feature 014) — ĐÃ XONG (merge 2026-07-15, v1.12.0)
3. ~~Anti-Cheat Security Fixes~~ — ĐÃ XONG TỪ TRƯỚC (Feature 011, v1.8.1, 2026-07-07 —
   tức là xong TRƯỚC CẢ Notifications). File kế hoạch cũ + file done cũ trong PENDING/
   chỉ là rác còn sót lại chưa dọn, đã bị hiểu lầm là "chưa làm" khi lên thứ tự ưu tiên
   ngày 2026-07-13. Đã dọn rác + đính chính ở đây ngày 2026-07-15.
4. ⏭️ TIẾP THEO: Xây "khung Free/Premium" tối giản (CHỈ cờ đánh dấu user + hàm kiểm tra
   quyền, CHƯA cần cổng thanh toán thật/IAP) — đây là 1 kế hoạch MỚI, CHƯA được viết
   chi tiết, cần S1 phân tích kỹ khi tới lượt. Mục đích: để Battle (bước 5) xây đúng
   lên khung này, tránh phải sửa lại toàn bộ logic Free/Premium trong Battle khi sau
   này làm Mobile Roadmap (bước 6) với hệ thanh toán thật.
5. ⏭️ Thi đấu đối kháng — PvP Quiz Battle
   (workflow/handoff/PENDING/S1_saved_plan_battle.md) — dùng khung Free/Premium ở bước 4.
6. ⏭️ Roadmap phát triển Mobile (React Native + thanh toán thật IAP)
   (workflow/handoff/PENDING/S1_saved_plan_mobile_business.md) — lý do làm trước bước 7:
   đây gần như viết lại toàn bộ frontend; nên ổn định hết nghiệp vụ (Battle, Submissions...)
   trên web trước, tránh phải build lại UI React Native nhiều lần mỗi khi nghiệp vụ còn
   thay đổi. Bước này sẽ "thật hoá" khung Free/Premium (bước 4) bằng subscription/IAP thật.
7. ⏭️ CUỐI CÙNG (thêm 2026-07-15 theo yêu cầu người dùng): Tối ưu Frontend để phù hợp
   với người dùng — trọng tâm: UI/UX + responsive trên điện thoại. CHƯA phân tích chi
   tiết, xem workflow/handoff/PENDING/S1_saved_plan_frontend_optimization.md — có ghi
   chú mâu thuẫn tiềm ẩn cần hỏi lại (bước này có áp dụng cho app React Native mới từ
   bước 6 hay frontend web hiện tại, hay cả hai) trước khi lên task.

👉 KHI VÒNG LẶP QUAY VỀ S1 (sau khi tính năng ở bước 2 merge xong — ĐÃ XẢY RA 2026-07-15):
hãy hỏi người dùng có muốn tiếp tục đúng thứ tự này không (mặc định: có), và bắt đầu PHÂN
TÍCH TỪ ĐẦU "khung Free/Premium" (bước 4) — đây CHƯA có kế hoạch chi tiết, cần hỏi người
dùng đầy đủ (mức độ giới hạn của Free, cách admin gán Premium thủ công tạm thời khi chưa
có thanh toán thật, v.v.) trước khi chia task, không được xác nhận nhanh như Anti-Cheat.
