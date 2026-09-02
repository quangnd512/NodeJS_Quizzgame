[GHI CHÚ ƯU TIÊN — DO NGƯỜI DÙNG + S1 THỐNG NHẤT]
Ngày lưu: 2026-07-13
Cập nhật: 2026-07-15 — ĐÍNH CHÍNH quan trọng (xem mục 3) + thêm bước 7 theo yêu cầu người dùng.
Cập nhật: 2026-07-19 — Bước 4 (Khung Free/Premium) đã xong, merge v1.13.0.
Cập nhật: 2026-07-19 (2) — Thêm bước mới "Mở rộng Premium + Đặt quảng cáo" ngay trước
"Tối ưu Frontend" (theo yêu cầu người dùng) + chốt phương án matchmaking cho Battle.
Cập nhật: 2026-07-20 — Battle chia 2 đợt: Đợt 1 (MVP) đang làm ở bước 5; Đợt 2 (ELO/mùa
giải/danh hiệu/Hall of Fame + toàn bộ phân biệt Free-Premium cho Battle) dời xuống làm
CUỐI CÙNG, sau cả "Tối ưu Frontend" — xem bước 9 mới.

Người dùng đã đồng ý thứ tự triển khai các kế hoạch đã lưu như sau (lý do: giảm thiểu
việc phải sửa lại các phần đã làm khi làm tới phần sau):

1. ✅ Notifications (Feature 013) — ĐÃ XONG (merge 2026-07-11, v1.11.0)
2. ✅ Gộp "Học sinh đóng góp câu hỏi" + "Thiết kế lại luồng xử lý báo cáo câu hỏi"
   thành "Quản lý câu hỏi" (Feature 014) — ĐÃ XONG (merge 2026-07-15, v1.12.0)
3. ~~Anti-Cheat Security Fixes~~ — ĐÃ XONG TỪ TRƯỚC (Feature 011, v1.8.1, 2026-07-07 —
   tức là xong TRƯỚC CẢ Notifications). File kế hoạch cũ + file done cũ trong PENDING/
   chỉ là rác còn sót lại chưa dọn, đã bị hiểu lầm là "chưa làm" khi lên thứ tự ưu tiên
   ngày 2026-07-13. Đã dọn rác + đính chính ở đây ngày 2026-07-15.
4. ✅ Khung Free/Premium (Feature 015) — ĐÃ XONG (merge 2026-07-19, v1.13.0). Công tắc
   toàn cục "mặc định Premium cho tất cả" đang BẬT; 4 gate Premium (Ôn câu sai, Lịch sử
   thi thử, Đổi môn cần quảng cáo giả lập, streak-freeze 3 thẻ) đã hoạt động.
5. ⏭️ TIẾP THEO: Thi đấu đối kháng — PvP Quiz Battle, ĐỢT 1/MVP (Feature 016)
   (workflow/handoff/PENDING/S1_saved_plan_battle.md, xem mục "CẬP NHẬT 2026-07-20 — CHIA
   2 ĐỢT") — chỉ làm phần chơi được cơ bản (ghép trận + cược điểm + 10 câu/trận), CHƯA
   ELO/mùa giải/danh hiệu/phân biệt Free-Premium (dời xuống Đợt 2 ở bước 9).
6. ⏭️ Roadmap phát triển Mobile (React Native + thanh toán thật IAP)
   (workflow/handoff/PENDING/S1_saved_plan_mobile_business.md) — lý do làm trước bước 7:
   đây gần như viết lại toàn bộ frontend; nên ổn định hết nghiệp vụ (Battle, Submissions...)
   trên web trước, tránh phải build lại UI React Native nhiều lần mỗi khi nghiệp vụ còn
   thay đổi. Bước này sẽ "thật hoá" khung Free/Premium (bước 4) bằng subscription/IAP thật.
7. ⏭️ Mở rộng Premium + Đặt quảng cáo tự nguyện (thêm 2026-07-19 theo yêu cầu người dùng,
   đặt NGAY TRƯỚC bước Tối ưu Frontend) — xem
   workflow/handoff/PENDING/S1_saved_plan_premium_ads_expansion.md. 4 quyền lợi Premium
   mới (giới hạn phiên ôn tập/ngày cho Free, ưu tiên ghép trận Battle, khung avatar đặc
   biệt, thống kê nâng cao) + 4 vị trí đặt quảng cáo tự nguyện (xem đáp án chi tiết, thêm
   phiên ôn tập, x2 điểm thưởng, đấu lại sau khi thua Battle). Phụ thuộc Battle (bước 5)
   cho 2 mục liên quan matchmaking — không làm trước khi Battle có khung matchmaking cơ bản.
8. ⏭️ Tối ưu Frontend để phù hợp với người dùng — trọng tâm: UI/UX + responsive trên
   điện thoại. CHƯA phân tích chi tiết, xem
   workflow/handoff/PENDING/S1_saved_plan_frontend_optimization.md — có ghi chú mâu
   thuẫn tiềm ẩn cần hỏi lại (bước này có áp dụng cho app React Native mới từ bước 6 hay
   frontend web hiện tại, hay cả hai) trước khi lên task.
9. ⏭️ CUỐI CÙNG (thêm 2026-07-20 theo yêu cầu người dùng): Battle ĐỢT 2 — hệ ELO theo
   môn, danh hiệu (Đồng/Bạc/Vàng/Kim Cương/Huyền Thoại), mùa giải 3 tháng/4 mùa, phần
   thưởng cuối mùa, danh hiệu "Toàn Năng", tích hợp Bảng xếp hạng 2 tab, VÀ toàn bộ phân
   biệt Free/Premium cho Battle (mức cược riêng, số trận/ngày riêng, ưu tiên ghép trận
   nhanh hơn cho Premium, xem lịch sử trận Premium-only, "Free thua → xem quảng cáo đấu
   lại ngay" từ S1_saved_plan_premium_ads_expansion.md). Khi tới lượt, S1 cần đối chiếu
   lại DB schema đã tạo ở Đợt 1 (BattleMatch...) để MỞ RỘNG chứ không tạo lại từ đầu.

👉 KHI VÒNG LẶP QUAY VỀ S1 (sau khi tính năng ở bước 4 merge xong — ĐÃ XẢY RA 2026-07-19):
hãy hỏi người dùng có muốn tiếp tục đúng thứ tự này không (mặc định: có), và bắt đầu rà
soát lại kế hoạch "Battle" đã lưu sẵn (workflow/handoff/PENDING/S1_saved_plan_battle.md)
— vì kế hoạch đó được viết TRƯỚC KHI có Khung Free/Premium thật, cần đối chiếu lại các
chỗ nhắc "Free/Premium" (mức cược, số trận/ngày, xem lại lịch sử trận...) cho khớp với
cơ chế thật vừa xây (isUserPremium, premiumExpiresAt...) trước khi chốt task — không nên
copy nguyên xi kế hoạch cũ mà không đối chiếu.
