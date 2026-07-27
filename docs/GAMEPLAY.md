# 🎮 QuizzGame — Luật chơi & Cơ chế Game

> File này được duy trì bởi **Session 8 - Giám Sát Chất Lượng**.
> Tạo lần đầu khi Feature 016 (Thi đấu đối kháng) merge — tính năng đầu tiên có đủ yếu tố
> "game" thật sự (đối kháng, cược điểm, thời gian thực) để cần 1 file luật chơi riêng, tách
> khỏi mô tả kỹ thuật chi tiết ở `docs/FEATURE_LOG.md`.
>
> File này nói về **LUẬT CHƠI** (góc nhìn người chơi) — không đi sâu implementation. Muốn xem
> chi tiết kỹ thuật (schema, transaction, thuật toán) → xem mục tương ứng trong
> `docs/FEATURE_LOG.md`.

---

## 1. Hệ thống điểm (Points) — nền tảng chung

Điểm là đơn vị "tiền" xuyên suốt toàn bộ app, không có mệnh giá thật, dùng để:

| Nguồn thu điểm | Nguồn tiêu điểm |
|---|---|
| Hoàn thành phiên Ôn tập/Thi thử (thưởng theo bậc điểm số) | Vào thi thử (phí cố định, hiện 60đ) |
| Admin duyệt câu hỏi học sinh đóng góp (+30đ) / câu được dùng trong đề (+5đ, tối đa 100đ) | **Đặt cược Thi đấu đối kháng** (xem mục 3) |
| Thắng trận Thi đấu đối kháng | Thua trận Thi đấu đối kháng |

Điểm hiện ở khắp nơi (ProfilePage, kết quả từng phiên) và là cơ sở tính **Điểm Uy Tín** trên
Bảng xếp hạng (không phải tổng điểm thô — xem `FEATURE_LOG.md` mục Leaderboard).

## 2. Streak (chuỗi ngày ôn tập) 🐝

Học sinh ôn tập/thi thử liên tiếp mỗi ngày → tăng streak. Đứt streak (bỏ 1 ngày) → về 0, TRỪ
KHI dùng **thẻ bảo hiểm chuỗi streak** (Premium, tối đa 3 thẻ, cơ chế "bridge/trailing
forgiveness" — xem chi tiết thuật toán ở `FEATURE_LOG.md` mục Khung Free/Premium). Đạt các mốc
streak → nhận thông báo streak milestone.

## 3. Thi đấu đối kháng — PvP Quiz Battle (ĐỢT 1/MVP)

> Tính năng đối kháng 1-vs-1 đầu tiên của app. Chi tiết kỹ thuật đầy đủ (schema, thuật toán
> ghép trận, atomic transaction thanh toán điểm...) xem `docs/FEATURE_LOG.md` Section 16.

### 3.1 Nguyên tắc cốt lõi

- **Công bằng**: cả 2 người chơi nhận CÙNG 1 bộ 10 câu hỏi, thứ tự đáp án xáo giống nhau,
  cùng thời gian mỗi câu.
- **Rủi ro có thưởng**: cả 2 đặt cược điểm TRƯỚC khi vào trận — thắng ăn cược của đối thủ,
  thua mất cược của mình.
- **Không ai phải chờ vô thời hạn**: không ghép được người thật trong 30 giây → tự động ghép
  với máy (bot).

### 3.2 Vào trận

1. Chọn 1 môn học + 1 mức cược: **50 / 100 / 200 / 500 điểm** (ĐỢT 1: mức cược CHUNG cho mọi
   người, chưa phân biệt Free/Premium).
2. Bấm **"Tìm trận"** → vào hàng đợi ghép cặp, HOẶC bấm **"Tạo phòng"** → nhận mã 6 ký tự để
   gửi riêng cho bạn bè (vào thẳng trận, bỏ qua hàng đợi).
3. Không đủ điểm cược → bị chặn ngay, không trừ nhầm điểm.
4. Đã có 1 trận đang diễn ra (kể cả ở tab/thiết bị khác) → bị chặn vào trận thứ 2
   (`BATTLE_ALREADY_IN_MATCH`) — không thể "nhân bản" cược.

### 3.3 Ghép trận (chỉ áp dụng khi "Tìm trận", không áp dụng khi vào bằng mã phòng)

Tiêu chí nới lỏng dần theo thời gian chờ, để càng chờ lâu càng dễ ghép:

| Thời gian chờ | Tiêu chí ghép |
|---|---|
| 0–10 giây | Đúng môn + đúng mức cược |
| 10–20 giây | Đúng môn (bất kỳ mức cược) |
| 20–30 giây | Bất kỳ môn, bất kỳ mức cược |
| Sau 30 giây | Tự động ghép với **bot** (không còn chờ người thật) |

> Đối thủ bot **hoàn toàn không thể phân biệt được qua giao diện** — hiện tên giả kiểu người
> thật (deterministic theo trận, không đổi giữa lúc chơi và lúc xem lại lịch sử), không còn
> nhãn "Máy"/🤖 ở bất kỳ đâu. Đây là quyết định sản phẩm có chủ đích (giữ cảm giác cạnh
> tranh), không phải hành vi che giấu gian lận — dữ liệu nội bộ vẫn phân biệt rõ bot/người
> thật cho mục đích đối soát điểm.

### 3.4 Trong trận

- **10 câu hỏi** trắc nghiệm ngẫu nhiên cùng môn, mỗi câu tối đa **20 giây**.
- Điểm mỗi câu = **10 điểm cơ bản** + **bonus tốc độ 0–3 điểm** (trả lời càng nhanh càng
  nhiều bonus) → tối đa **13 điểm/câu**, tối đa **130 điểm/trận**. Bonus tính theo **thời
  gian server nhận được câu trả lời** — không thể gian lận bằng cách sửa đồng hồ máy mình.
- Thấy điểm của đối thủ cập nhật theo thời gian thực sau mỗi câu.
- Quá 20 giây chưa trả lời → tự động tính 0 điểm câu đó, chuyển câu tiếp theo.

### 3.5 Mất kết nối giữa trận

- 1 bên mất kết nối → bên còn lại thấy banner "đang chờ..." đếm ngược **30 giây**.
- Quay lại (F5, mất mạng tạm thời...) **trong 30 giây** → trận tiếp tục bình thường, KHÔNG
  mất điểm đã tích luỹ, đồng hồ câu hỏi hiện tại được tính lại từ đầu cho công bằng.
- **Không** quay lại trong 30 giây → bên còn lại được xử **thắng kỹ thuật**, ăn trọn cược
  (không phụ thuộc điểm số lúc đó — kể cả đang dẫn điểm mà mất kết nối vẫn thua).
- **Cả 2** cùng mất kết nối trong lúc chờ → huỷ trận ngay, hoàn lại cược cho cả 2, không tính
  thắng/thua cho ai.
- Thoát app/tải lại trang giữa trận → tự động vào lại ĐÚNG trận đang dở khi mở lại app
  (không cần bấm gì); nếu quay lại quá trễ (trận đã kết thúc do mất kết nối) → tự động hiện
  thẳng màn kết quả.

### 3.6 Kết thúc trận & thanh toán điểm

| Kết quả | Nhận về |
|---|---|
| Thắng người thật (điểm cao hơn, hoặc đối thủ mất kết nối quá 30s) | Ăn trọn cược 2 người (hoàn cược mình + cược đối thủ) |
| Thua | Mất đúng số điểm đã cược |
| Hoà (điểm bằng nhau) | Hoàn lại đúng số điểm đã cược — không lãi không lỗ |
| Thắng bot | Hoàn cược + thưởng thêm **100% mức cược** (không trừ điểm của ai khác) |
| Thua bot | Mất đúng số điểm đã cược (như thua người thật) |
| Trận bị huỷ (cả 2 mất kết nối) | Hoàn lại đúng số điểm đã cược, không tính thắng/thua |

### 3.7 Xem lại

Lịch sử trận đấu (`Lịch sử` trong màn Thi đấu) hiện đầy đủ: môn, đối thủ (hoặc tên giả nếu
là bot), điểm số, kết quả, điểm thay đổi, ngày giờ — phân trang, mở cho **mọi người** (chưa
khoá Premium ở đợt này).

### 3.8 Giới hạn ĐỢT 1/MVP — chưa làm

Các phần sau đã dời sang **"Battle Đợt 2"** (làm cuối roadmap, sau "Tối ưu Frontend"):

- Hệ ELO / xếp hạng theo kỹ năng
- Danh hiệu, mùa giải, Hall of Fame
- Phân biệt Free/Premium: mức cược riêng, số trận/ngày riêng, ưu tiên ghép trận nhanh hơn
  cho Premium, khoá xem lịch sử trận cho Free

### 3.9 Giới hạn hạ tầng

Hàng đợi ghép trận + trạng thái trận đang diễn ra nằm **in-memory trên 1 process backend duy
nhất** (chưa dùng Redis/pub-sub) — chỉ hoạt động đúng khi chạy **1 instance backend**. Nếu
sau này cần scale nhiều instance, đây là điểm phải xử lý trước (xem `docs/adr/013-pvp-battle-realtime-state.md`).

---

## Liên kết tài liệu khác

| File | Nội dung |
|---|---|
| `docs/FEATURE_LOG.md` | Chi tiết kỹ thuật đầy đủ (schema, thuật toán, API) từng tính năng |
| `docs/TEST_CASES.md` | Test case chi tiết (kể cả các trường hợp race condition/bảo mật) |
| `docs/adr/013-pvp-battle-realtime-state.md` | Quyết định kiến trúc cho trạng thái realtime |
| `docs/PROJECT_OVERVIEW.md` | Tổng quan toàn dự án |
