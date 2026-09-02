[KẾ HOẠCH ĐÃ LƯU — TÍNH NĂNG THI ĐẤU (PvP QUIZ BATTLE)]
Ngày lưu: 2026-07-07

== NGUYÊN TẮC CỐT LÕI ==
- Công bằng: cùng bộ câu hỏi, cùng thời gian cho cả hai
- Rủi ro có thưởng: cả hai đặt cược điểm trước khi vào trận
- Nhanh nhạy: mỗi câu có đếm ngược 20 giây
- Trận đấu ngắn: 10 câu, tối đa ~10 phút
- ELO hoàn toàn công bằng giữa Free và Premium

== CẤU TRÚC TRẬN ĐẤU ==
- 10 câu hỏi ngẫu nhiên từ ngân hàng câu hỏi chung (lọc theo môn)
- Cả hai nhận cùng bộ câu, thứ tự đáp án xáo ngẫu nhiên
- Mỗi câu: 20 giây đếm ngược
- Điểm câu = 10 điểm cơ bản + bonus tốc độ (0~3 điểm) = tối đa 13 điểm/câu
- Tối đa 130 điểm/trận
- Thấy điểm realtime của đối thủ trong lúc làm

== GHÉP TRẬN ==
- Cùng môn học + cùng mức cược → ghép ngẫu nhiên
- Không giới hạn theo ELO
- Chờ 30 giây không có đối thủ → thông báo thử lại
- Lựa chọn: ghép ngẫu nhiên hoặc mời bạn bè (link/mã phòng)

== MỨC CƯỢC ==
- Free: 50 / 100 điểm
- Premium: 50 / 100 / 200 / 500 điểm

== KẾT THÚC TRẬN ==
- Thắng → nhận toàn bộ điểm cược 2 người
- Thua → mất điểm cược
- Hòa → trả lại điểm cược
- Đối thủ thoát → thắng kỹ thuật (S_A = 1.0)
- Mình thoát → thua kỹ thuật (S_A = 0.0)
- Cả hai mất mạng → hủy trận, ELO không đổi

== HỆ THỐNG ELO ==
Tính riêng theo từng môn đã đăng ký.
ELO Tổng = trung bình ELO tất cả các môn đã đăng ký.

ELO bắt đầu: 1.000 mỗi môn

Hệ số K:
- < 10 trận: K = 40 (người mới)
- 10–30 trận: K = 30
- > 30 trận: K = 20

Công thức:
  E_A = 1 / (1 + 10^((ELO_B - ELO_A) / 400))
  S_A = điểm_A / (điểm_A + điểm_B)  [nếu tổng = 0 thì S_A = 0.5]
  ELO_mới_A = ELO_cũ_A + K × (S_A - E_A)

ELO tính theo tỉ số: thắng áp đảo 10-0 được nhiều hơn thắng sít sao 6-4.

== FREE VS PREMIUM ==
- Số trận/ngày: Free = 5, Premium = 10
- Mức cược: Free = 50/100, Premium = 50/100/200/500
- ELO: HOÀN TOÀN GIỐNG NHAU (không lợi thế)
- Câu hỏi: giống nhau
- Thời gian mỗi câu: giống nhau
- Xem lại lịch sử trận: Free = không, Premium = có
- Huy hiệu danh hiệu: Free = bình thường, Premium = khung đặc biệt (chỉ trang trí)

== MÙA GIẢI ==
- Thời gian: 3 tháng/mùa → 4 mùa/năm
- Lịch cố định:
    Mùa 1: Tháng 9  – 11  (đầu năm học)
    Mùa 2: Tháng 12 – 2   (thi HK1 + Tết)
    Mùa 3: Tháng 3  – 5   (cận thi THPT — mùa nóng nhất)
    Mùa 4: Tháng 6  – 8   (nghỉ hè)
- ELO reset mềm cuối mùa: về 60% ELO cũ (không về 0)
- Chống lạm phát: 4 mùa/năm → tối đa 4.000đ/năm từ Huyền Thoại (thay vì 6.000đ)

== DANH HIỆU ELO ==
- 🔰 Tân Binh:    0 – 999
- 🥉 Đồng:        1.000 – 1.199
- 🥈 Bạc:         1.200 – 1.499
- 🥇 Vàng:        1.500 – 1.799
- 💎 Kim Cương:   1.800+
- 👑 Huyền Thoại: Top 10 toàn server (ELO cao nhất)

== PHẦN THƯỞNG CUỐI MÙA ==
🔰 Tân Binh:    0 điểm
🥉 Đồng:        50 điểm + huy hiệu Đồng
🥈 Bạc:         150 điểm + huy hiệu Bạc
🥇 Vàng:        300 điểm + 1 tuần Premium + huy hiệu Vàng
💎 Kim Cương:   600 điểm + 2 tuần Premium + khung Kim Cương mùa đó
👑 Huyền Thoại: 1.000 điểm + 1 tháng Premium + khung Huyền Thoại + Hall of Fame

== PHẦN THƯỞNG BẢNG HỌC TẬP (cuối tháng) ==
#1:        500 điểm + 1 tháng Premium + khung Vàng Học Tập + tên màu vàng
#2–3:      300 điểm + 2 tuần Premium + khung Bạc Học Tập
#4–10:     150 điểm + 1 tuần Premium + huy hiệu Top 10
#11–50:    50 điểm + huy hiệu Top 50
Top 3 tuần: +30 điểm/người (thưởng hàng tuần)

== DANH HIỆU TOÀN NĂNG 🌟 ==
Điều kiện: Top 5 🎓 Bảng Học Tập + Top 5 ⚔️ Bảng Thi Đấu cùng 1 mùa
Ước tính: 0–2 người/mùa đạt được

Phần thưởng:
- 2.000 điểm
- 3 tháng Premium miễn phí
- Khung avatar "Toàn Năng" vĩnh viễn (không bao giờ có lại, không mua được)
- Tên màu cầu vồng hiển thị khắp app
- ⭐ Hall of Fame riêng, tách khỏi Huyền Thoại thường
- Dòng chữ "Toàn Năng — Mùa X" vĩnh viễn dưới tên trong hồ sơ

== BẢNG XẾP HẠNG UI ==
Màn hình "Xếp Hạng" có 2 tab:
- Tab 1: 🎓 Học Tập (Điểm Uy Tín — hiện tại)
- Tab 2: ⚔️ Thi Đấu (ELO — lọc theo môn hoặc xem tổng)

Hồ sơ cá nhân hiển thị cả hai:
- 🎓 Điểm Uy Tín: X.XX (xếp hạng #N)
- ⚔️ ELO Thi Đấu: X.XXX (Danh hiệu — Mùa N)

Hall of Fame:
- Huyền Thoại: ghi tên theo mùa đạt được
- Toàn Năng: tách riêng, đánh dấu ⭐ đặc biệt

== KỸ THUẬT ==
- Socket.io (đã có trong tech stack, CHƯA cài package thật — chỉ mới có comment placeholder
  trong auth.middleware.ts/jwt.ts/auth.errors.ts nhắc "dùng chung JWT session token cho cả
  HTTP và Socket.io sau này") cho realtime
- transferPoints (đã có trong PointsService) cho chuyển điểm cược
- Ngân hàng câu hỏi (đã có) cho nội dung
- DB mới cần: battle_sessions, battle_elo, battle_seasons, hall_of_fame
- ELO per subject: lưu theo cặp (userId, subjectId)

== CẬP NHẬT 2026-07-19 — GIẢI QUYẾT ĐỘ TRỄ GHÉP TRẬN (người dùng xác nhận) ==
Vấn đề: giai đoạn đầu ít người chơi cùng lúc → khó ghép trận thật ngay lập tức.
Giải pháp đã CHỐT (kết hợp cả 3):
1. Bot fallback: sau ~10-15s không tìm được người thật → tự động ghép với bot giả lập
   (tốc độ trả lời + tỉ lệ đúng random theo độ khó chọn trước). Trận đấu bot: vẫn cho điểm
   thưởng bình thường nhưng KHÔNG tính ELO (hoặc tính hệ số rất thấp) để tránh cày bot lên hạng ảo.
2. Nới lỏng tiêu chí ghép trận dần theo thời gian chờ: 0-10s chỉ ghép đúng môn+đúng mức cược;
   10-20s nới ra đúng môn/mọi mức cược; >20s nới ra mọi môn/mọi cược; sau đó mới rơi vào bot
   nếu vẫn không có ai.
3. Mời bạn bè qua link/mã phòng luôn có sẵn như phương án phụ (đã có trong kế hoạch gốc).
Ghost replay (đấu với bản ghi trận đấu thật của người chơi khác) → để dành làm v2 sau, không
làm ngay vì cần hạ tầng ghi/phát lại riêng, phức tạp hơn 2 giải pháp trên.

== CẬP NHẬT 2026-07-19 — ĐỐI CHIẾU VỚI KHUNG FREE/PREMIUM THẬT (Feature 015 đã xong) ==
Kế hoạch gốc viết TRƯỚC KHI có Khung Free/Premium thật — khi lên task chi tiết, PHẢI dùng
đúng cơ chế đã xây (isUserPremium(), premiumExpiresAt, premium.service.ts...), KHÔNG tự chế
cờ Free/Premium riêng cho Battle. Đồng thời người dùng đã chốt thêm 1 quyền lợi Premium liên
quan trực tiếp tới Battle: "Ưu tiên ghép trận nhanh hơn / ít rơi vào bot hơn" (xem file
S1_saved_plan_premium_ads_expansion.md) — cần tích hợp vào thuật toán ghép trận ở mục trên
(ví dụ: Premium được nới lỏng tiêu chí NHANH HƠN Free, hoặc ưu tiên ghép với người thật
trước trong hàng đợi). Ngoài ra còn 1 ý tưởng quảng cáo liên quan Battle: "Free thua trận →
xem quảng cáo để đấu lại ngay" — cũng cần tính đến khi thiết kế luồng kết thúc trận.

== CẬP NHẬT 2026-07-20 — CHIA 2 ĐỢT (người dùng xác nhận) ==
ĐỢT 1 (Feature 016, đang làm ngay bây giờ — xem PENDING/S2.md khi bàn giao): MVP chơi được cơ
bản — ghép trận (bot fallback sau 30s + nới lỏng tiêu chí + mời bạn qua mã phòng), 10 câu/trận
20s/câu, cược điểm 50/100/200/500đ CHUNG cho mọi người (chưa phân biệt Free/Premium), thắng
người thật ăn cược, thắng bot +100% cược, hòa hoàn cược, đối thủ mất kết nối → chờ 30 GIÂY
(đã sửa từ đề xuất ban đầu 15s) trước khi xử thắng kỹ thuật. KHÔNG có ELO/danh hiệu/mùa
giải/Hall of Fame ở đợt này.

ĐỢT 2 (đã dời xuống làm CUỐI CÙNG trong toàn bộ roadmap, sau cả "Tối ưu Frontend" — xem
workflow/handoff/PENDING/S1_priority_order.md): toàn bộ phần còn lại của kế hoạch gốc —
hệ ELO theo môn, danh hiệu (Đồng/Bạc/Vàng/Kim Cương/Huyền Thoại), mùa giải 3 tháng/4 mùa,
phần thưởng cuối mùa, danh hiệu "Toàn Năng", tích hợp Bảng xếp hạng 2 tab, VÀ toàn bộ phần
phân biệt Free/Premium cho Battle (mức cược riêng, số trận/ngày riêng, ưu tiên ghép trận
nhanh hơn cho Premium, xem lịch sử trận Premium-only, "Free thua → xem quảng cáo đấu lại
ngay"). Khi tới lượt Đợt 2, S1 cần đối chiếu lại DB schema đã tạo ở Đợt 1 (BattleMatch...)
để mở rộng chứ không tạo lại từ đầu.
