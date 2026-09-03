[KẾ HOẠCH ĐÃ LƯU — MỞ RỘNG PREMIUM + ĐẶT QUẢNG CÁO TỰ NGUYỆN]
Tên: Mở rộng quyền lợi Premium + Vị trí đặt quảng cáo (rewarded ads)
Ngày lưu: 2026-07-19
Nguồn: Người dùng yêu cầu S1 rà soát toàn bộ app và đề xuất, đã chọn lọc qua AskUserQuestion.
Vị trí trong roadmap: NGAY TRƯỚC "Tối ưu Frontend" (theo đúng yêu cầu người dùng) — xem
workflow/handoff/PENDING/S1_priority_order.md để biết thứ tự chính xác.

== TRẠNG THÁI ==
CHƯA phân tích kỹ thuật chi tiết (chưa có DB schema/API/task list) — mới ở mức định hướng
đã được người dùng CHỌN LỌC cụ thể (không phải toàn bộ gợi ý ban đầu của S1). Khi tới lượt,
S1 cần làm đầy đủ Bước 1-9 (hỏi thêm chi tiết triển khai, đặc biệt phần quảng cáo vì web
CHƯA có hạ tầng AdMob/quảng cáo thật — nhiều khả năng vẫn cần giả lập như đã làm ở Feature 015
cho tới khi có Mobile Roadmap).

== 4 QUYỀN LỢI PREMIUM MỚI (đã chọn, bổ sung thêm vào 4 quyền lợi đã có từ Feature 015) ==
1. Không giới hạn số phiên ôn tập/ngày — Free bị giới hạn (số phiên/ngày cụ thể cần chốt
   khi lên kế hoạch chi tiết, gợi ý ban đầu 10 phiên/ngày theo ý tưởng cũ ở Mobile Roadmap).
2. Ưu tiên ghép trận nhanh hơn trong Battle — Premium ít rơi vào bot hơn / được ưu tiên ghép
   với người chơi thật trước trong hàng đợi (liên quan trực tiếp thuật toán matchmaking đã
   chốt trong S1_saved_plan_battle.md, cập nhật 2026-07-19).
3. Khung avatar/huy hiệu đặc biệt trên Bảng xếp hạng — chỉ mang tính trang trí/thể hiện,
   không ảnh hưởng gameplay/thứ hạng thật.
4. Thống kê học tập nâng cao ở trang Tiến độ — so sánh với bạn bè, phân tích điểm yếu chi
   tiết hơn bảng "Thống kê theo môn" hiện tại.

== 4 VỊ TRÍ ĐẶT QUẢNG CÁO TỰ NGUYỆN (đã chọn) ==
Nguyên tắc chung: LUÔN là lựa chọn (opt-in), không ép buộc, đổi lấy lợi ích rõ ràng ngay lập
tức — không dùng quảng cáo xen ngang (interstitial) ép xem.
1. Free xem đáp án chi tiết sau khi thi — thay vì chỉ thấy điểm tổng, xem 1 quảng cáo để mở
   khoá xem đáp án đúng/sai từng câu CHO LẦN THI ĐÓ (không phải mở khoá vĩnh viễn — mỗi lần
   muốn xem lại cần xem quảng cáo, giống cơ chế ad-unlock đổi môn đã có ở Feature 015).
2. Free hết lượt ôn tập trong ngày — xem quảng cáo để được thêm 1 phiên ôn tập (liên quan
   trực tiếp tới quyền lợi Premium #1 ở trên — cần thiết kế đồng bộ: giới hạn phiên/ngày +
   cách Free "mua thêm" bằng quảng cáo).
3. Nhân đôi điểm thưởng sau phiên ôn tập — sau khi hoàn thành phiên ôn tập (Free lẫn Premium
   đều có thể dùng, không giới hạn riêng Premium), xem quảng cáo TÙY CHỌN để x2 điểm thưởng
   vừa kiếm được từ phiên đó.
4. Đấu lại ngay sau khi thua trận Battle — Free thua 1 trận → xem quảng cáo để được vào trận
   mới ngay lập tức, không phải chờ ghép trận lại từ đầu (liên quan trực tiếp luồng kết thúc
   trận trong Battle).

== ĐIỂM CẦN LÀM RÕ KHI TỚI LƯỢT (S1 phải hỏi lại) ==
- Giới hạn "X phiên ôn tập/ngày" cho Free cụ thể là bao nhiêu? (gợi ý cũ: 10/ngày)
- Quảng cáo hiện vẫn phải GIẢ LẬP (web chưa có AdMob thật, giống pattern ad-unlock ở Feature
  015) — xác nhận lại có tiếp tục giả lập hay tới lúc này đã muốn tích hợp quảng cáo web thật
  (Google AdSense hoặc tương tự) thay vì giả lập?
- "Ưu tiên ghép trận nhanh hơn" cho Premium — nới lỏng tiêu chí matchmaking nhanh hơn Free
  theo % thời gian nào? (ví dụ Premium nới lỏng ở giây thứ 5/10 thay vì 10/20 như Free)
- "Thống kê học tập nâng cao" — cần cụ thể hoá: so sánh với bạn bè là so sánh với AI (bạn bè
  trong danh sách kết bạn — CHƯA có tính năng kết bạn trong app) hay so sánh với TOP người
  cùng môn/cùng trường? Cần xác nhận vì app hiện CHƯA có khái niệm "bạn bè".
- Phụ thuộc trực tiếp vào Battle (Feature 016, đang làm) cho 2 mục: ưu tiên ghép trận +
  đấu lại sau khi thua — nên làm SAU khi Battle đã có khung matchmaking cơ bản, không làm
  trước Battle.
- Phụ thuộc gián tiếp vào Khung Free/Premium (Feature 015, đã xong) cho toàn bộ gate logic —
  tái sử dụng premium.service.ts đã có, không tạo cơ chế Free/Premium riêng.
