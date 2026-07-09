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
- Socket.io (đã có trong tech stack) cho realtime
- transferPoints (đã có trong PointsService) cho chuyển điểm cược
- Ngân hàng câu hỏi (đã có) cho nội dung
- DB mới cần: battle_sessions, battle_elo, battle_seasons, hall_of_fame
- ELO per subject: lưu theo cặp (userId, subjectId)
