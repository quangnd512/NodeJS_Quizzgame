[KẾ HOẠCH ĐÃ LƯU — CHỜ LÀM CUỐI CÙNG, THEO YÊU CẦU NGƯỜI DÙNG]
Tên: Tối ưu Frontend để phù hợp với người dùng
Ngày lưu: 2026-07-15
Vị trí trong roadmap: CUỐI CÙNG (sau cả Mobile Roadmap) — người dùng yêu cầu rõ ràng
"cho tôi 1 kế hoạch vào cuối cùng".

== TRẠNG THÁI ==
CHƯA phân tích chi tiết — mới chỉ có định hướng chung từ người dùng. Khi tới lượt,
S1 cần hỏi lại đầy đủ (Bước 1-5 quy trình chuẩn) trước khi chia task.

== ĐỊNH HƯỚNG CHUNG (do người dùng chọn) ==
- Giao diện/trải nghiệm (UI/UX): làm đẹp hơn, dễ dùng hơn, thao tác thuận tiện hơn
- Hiển thị tốt trên điện thoại (responsive): dùng mượt trên màn hình nhỏ, không vỡ layout

== ĐIỂM CẦN LÀM RÕ KHI TỚI LƯỢT (S1 phải hỏi lại) ==
- ⚠️ Mâu thuẫn tiềm ẩn về thứ tự: kế hoạch "Roadmap Mobile" (đứng ngay trước bước này)
  đã bao gồm việc VIẾT LẠI TOÀN BỘ frontend sang React Native. Cần hỏi rõ: tính năng
  "Tối ưu Frontend" này áp dụng cho:
    (a) app React Native mới (sau khi Mobile Roadmap xong), hay
    (b) frontend web hiện tại (nếu Mobile Roadmap bị hoãn/không làm), hay
    (c) cả hai?
  Nếu (a), có thể phần lớn nội dung "responsive" đã dư thừa vì RN vốn tự thích ứng
  màn hình — cần xác nhận lại phạm vi thực tế trước khi lên task.
- Chưa biết cụ thể màn hình/luồng nào người dùng thấy "chưa phù hợp" — cần hỏi ví dụ
  cụ thể (trang nào, thao tác nào đang khó dùng?) thay vì tối ưu chung chung.
- Chưa biết có cần đo lường trước/sau (VD Lighthouse score, thời gian tải) hay chỉ cần
  cảm nhận trực quan "đẹp hơn, mượt hơn".
