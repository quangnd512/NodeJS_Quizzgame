[KẾ HOẠCH ĐÃ LƯU — CHỜ LÀM SAU]
Tên: Thiết kế lại luồng xử lý báo cáo câu hỏi (Admin Reports Workflow Redesign)
Ngày lưu: 2026-07-10
Nguồn: Người dùng yêu cầu trực tiếp trong lúc S5 đang test Feature 013 (Notifications)
        — ghi nhận là yêu cầu MỚI, KHÔNG thuộc phạm vi Feature 013, không xử lý
        ngay trong phiên test đó.

📋 TÓM TẮT VẤN ĐỀ NGƯỜI DÙNG NÊU:

1. Trang Admin → Quản lý báo cáo câu hỏi hiện chỉ hiển thị mã UUID thô của câu hỏi
   (`Câu hỏi: <code>{questionId}</code>` trong AdminReportsPage, frontend/src/App.tsx),
   KHÔNG hiển thị nội dung/đáp án/giải thích của câu hỏi bị báo cáo → admin không
   xem được câu hỏi đang bị báo cáo là gì nếu không tự tra cứu thủ công.
   → Đã XÁC NHẬN đúng là hạn chế thật trong code hiện tại (không phải hiểu lầm).

2. Người dùng phản ánh số lượng "Chờ xử lý" hiển thị có vẻ ít hơn số câu thực tế
   đã báo cáo — CHƯA làm rõ được cụ thể (thẻ thống kê vs danh sách lệch bao nhiêu),
   S1 cần điều tra lại từ đầu khi làm feature này (kiểm tra summary vs list có cùng
   filter/pagination không).

📋 YÊU CẦU THIẾT KẾ MỚI (theo đúng lời người dùng):

- Bỏ trạng thái "REVIEWED" (Đã xem) — người dùng cho rằng trạng thái này không có
  ý nghĩa. Chỉ giữ luồng: PENDING → FIXED (đã sửa) hoặc DISMISSED (đã bỏ qua).
- Trang "Chờ xử lý" (PENDING) phải liệt kê ĐẦY ĐỦ chi tiết từng câu hỏi bị báo cáo
  (nội dung, đáp án đúng, giải thích, môn/chương/độ khó, không chỉ ID).
- Cho phép admin xem VÀ SỬA câu hỏi ngay tại trang xử lý báo cáo đó (không cần
  chuyển sang màn hình Quản lý đề thi / Ngân hàng câu hỏi riêng).
- Khi admin sửa xong nội dung câu hỏi → mới cập nhật trạng thái báo cáo thành
  FIXED hoặc DISMISSED (gắn liền hành động sửa với đổi trạng thái).
- QUAN TRỌNG — đồng bộ dữ liệu: khi sửa 1 câu hỏi, câu hỏi đó phải được cập nhật
  ở TẤT CẢ những nơi đang dùng nó (không chỉ 1 bản sao).

⚠️ GHI CHÚ KIẾN TRÚC CẦN S1 CÂN NHẮC KỸ (rủi ro thiết kế):

- Hiện tại theo FEATURE_LOG / TEST_CASES, `ExamQuestion` là BẢN SAO độc lập khi
  thêm từ `QuestionBank` vào đề thi (có `questionBankId` tham chiếu ngược, nhưng
  khi xoá câu trong kho thì `ExamQuestion.questionBankId` tự set NULL — tức 2 bên
  KHÔNG phải live-reference, mà là copy-on-add).
- Yêu cầu "sửa 1 nơi, cập nhật mọi nơi" đối lập với thiết kế hiện tại (copy-based).
  Cần quyết định kiến trúc: chuyển sang tham chiếu sống (rủi ro: sửa câu hỏi sau
  khi user đã thi xong sẽ làm thay đổi dữ liệu lịch sử/kết quả đã chấm — cần xác
  định rõ có nên áp dụng hồi tố hay chỉ áp dụng cho các phiên thi MỚI sau khi sửa),
  hay giữ copy nhưng thêm cơ chế "đồng bộ lại" (batch update mọi ExamQuestion có
  cùng questionBankId khi sửa câu gốc trong kho).
- Cần làm rõ: "mọi nơi" có bao gồm các `ExamAnswer`/`UserQuestionHistory` đã lưu
  snapshot đáp án cũ của user hay không (không nên sửa dữ liệu lịch sử đã chấm).

📋 DEFINITION OF DONE (nháp — S1 hoàn thiện khi lên kế hoạch chi tiết):
□ Enum ReportStatus bỏ REVIEWED (hoặc giữ trong DB cho dữ liệu cũ nhưng ẩn khỏi UI/luồng mới)
□ API danh sách reports trả kèm chi tiết câu hỏi (join Question/ExamQuestion) thay vì chỉ questionId
□ Admin có thể sửa câu hỏi ngay tại trang xử lý báo cáo
□ Sửa xong → cập nhật report status (FIXED/DISMISSED) trong cùng 1 luồng thao tác
□ Quyết định + triển khai cơ chế đồng bộ câu hỏi (xem ghi chú kiến trúc ở trên)
□ Điều tra + sửa lệch số liệu "Chờ xử lý" giữa thẻ thống kê và danh sách
□ Unit test cho luồng mới
