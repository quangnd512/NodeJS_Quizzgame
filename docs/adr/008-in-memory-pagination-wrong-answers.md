# ADR 008: Phân trang trong bộ nhớ cho danh sách câu sai

## Bối cảnh

`getWrongAnswers()` cần hỗ trợ lọc theo `subjectId` và phân trang. Câu sai có thể đến từ hai nguồn:
- **Practice**: `Question.subject` lấy trực tiếp được từ bảng `Question`
- **Exam**: subject nằm ở bảng `ExamPaper`, phải JOIN qua `ExamQuestion → ExamPaper`

Nếu dùng `LIMIT/OFFSET` ở tầng SQL, cần viết một query phức tạp JOIN cả hai nhánh rồi filter subject — hoặc dùng hai query riêng rồi UNION — đều khó bảo trì và khó test.

## Quyết định

Tải toàn bộ câu sai còn hạn của user vào bộ nhớ (`findMany` không có LIMIT), resolve subject của ExamQuestion bằng một query phụ vào `ExamPaper`, rồi filter và cắt trang bằng code TypeScript.

## Lý do

- Mỗi user có tối đa vài trăm câu sai tại bất kỳ thời điểm nào (TTL 14 ngày tự giới hạn tập dữ liệu).
- Dataset nhỏ → load vào RAM không gây vấn đề hiệu năng.
- Code đơn giản hơn đáng kể, dễ test hơn (mock `findMany` trả về mảng, test slice logic bằng array thật).
- Tránh được query UNION/subquery phức tạp vốn dễ sai và khó debug.

## Phương án đã cân nhắc nhưng không chọn

**Paginate ở DB**: Phải JOIN `ExamQuestion → ExamPaper` để lấy subject trước khi filter — tạo ra query lồng nhau khó bảo trì. Chỉ đáng làm nếu dataset vượt ~10.000 record/user, điều này không xảy ra với TTL 14 ngày.
