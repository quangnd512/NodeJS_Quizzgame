[GHI CHÚ ƯU TIÊN — DO NGƯỜI DÙNG + S1 THỐNG NHẤT]
Ngày lưu: 2026-07-13

Người dùng đã đồng ý thứ tự triển khai các kế hoạch đã lưu như sau (lý do: giảm thiểu
việc phải sửa lại các phần đã làm khi làm tới phần sau):

1. ✅ Notifications (Feature 013) — ĐÃ XONG (merge 2026-07-11, v1.11.0)
2. 🔄 Gộp "Học sinh đóng góp câu hỏi" + "Thiết kế lại luồng xử lý báo cáo câu hỏi"
   thành 1 khu "Quản lý câu hỏi" — ĐANG BÀN GIAO cho S2 (xem PENDING/S2.md)
3. ⏭️ TIẾP THEO: Anti-Cheat Security Fixes (workflow/handoff/PENDING/S1_saved_plan_security.md)
   — lý do làm sớm: vá lỗ hổng chấm điểm/phiên thi TRƯỚC khi Battle (bước 5) xây thêm
   logic cược điểm lên cùng nền tảng chấm điểm này, tránh phải vá 2 lần ở 2 nơi.
4. ⏭️ SAU ĐÓ: Xây "khung Free/Premium" tối giản (CHỈ cờ đánh dấu user + hàm kiểm tra
   quyền, CHƯA cần cổng thanh toán thật/IAP) — đây là 1 kế hoạch MỚI, CHƯA được viết
   chi tiết, cần S1 phân tích kỹ khi tới lượt. Mục đích: để Battle (bước 5) xây đúng
   lên khung này, tránh phải sửa lại toàn bộ logic Free/Premium trong Battle khi sau
   này làm Mobile Roadmap (bước 6) với hệ thanh toán thật.
5. ⏭️ Thi đấu đối kháng — PvP Quiz Battle
   (workflow/handoff/PENDING/S1_saved_plan_battle.md) — dùng khung Free/Premium ở bước 4.
6. ⏭️ CUỐI CÙNG: Roadmap phát triển Mobile (React Native + thanh toán thật IAP)
   (workflow/handoff/PENDING/S1_saved_plan_mobile_business.md) — lý do làm sau cùng:
   đây gần như viết lại toàn bộ frontend; nên ổn định hết nghiệp vụ (Battle, Submissions,
   Anti-cheat...) trên web trước, tránh phải build lại UI React Native nhiều lần mỗi khi
   nghiệp vụ còn thay đổi. Bước này sẽ "thật hoá" khung Free/Premium (bước 4) bằng
   subscription/IAP thật.

👉 KHI VÒNG LẶP QUAY VỀ S1 (sau khi tính năng ở bước 2 merge xong): hãy hỏi người dùng
có muốn tiếp tục đúng thứ tự này không (mặc định: có), và bắt đầu phân tích Anti-Cheat
Security Fixes (bước 3) — kế hoạch này đã có sẵn task list + DoD đầy đủ, không cần hỏi
lại nhiều, có thể xác nhận nhanh rồi bàn giao luôn.
