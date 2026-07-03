# ADR 003: Dùng ON DELETE SET NULL thay vì CASCADE cho QuestionBank → ExamQuestion

## Bối cảnh

Khi admin xoá một câu hỏi khỏi ngân hàng (`QuestionBank`), các câu hỏi đó có thể
đã được copy vào nhiều đề thi (`ExamQuestion`). Học sinh có thể đã làm bài và có
`ExamAnswer` trỏ vào các `ExamQuestion` đó.

Cần quyết định: khi xoá `QuestionBank`, các `ExamQuestion` tham chiếu đến nó sẽ
xử lý thế nào?

## Các lựa chọn đã cân nhắc

### Lựa chọn A: ON DELETE CASCADE
Xoá `QuestionBank` → xoá luôn toàn bộ `ExamQuestion` liên quan.

**Hệ quả:**
- `ExamAnswer` của học sinh trỏ vào `ExamQuestion` không còn tồn tại
- Điểm thi bị hỏng, lịch sử làm bài mất
- Không thể xem lại bài thi cũ

### Lựa chọn B: ON DELETE RESTRICT
Không cho xoá `QuestionBank` nếu còn `ExamQuestion` nào tham chiếu.

**Hệ quả:**
- Câu hỏi không bao giờ xoá được nếu đã dùng trong đề thi
- Phải soft delete thay thế → kho phình to theo thời gian

### Lựa chọn C: ON DELETE SET NULL ← **Đã chọn**
Xoá `QuestionBank` → đặt `ExamQuestion.questionBankId = NULL`, giữ nguyên
toàn bộ nội dung (questionText, options, correctAnswer...) trong `ExamQuestion`.

## Quyết định

Dùng **ON DELETE SET NULL** với `QuestionBank → ExamQuestion`.

Khai báo trong `schema.prisma`:
```prisma
questionBankId String?
questionBank   QuestionBank? @relation(fields: [questionBankId], references: [id])
// onDelete mặc định = SetNull khi FK nullable trong Prisma
```

## Lý do

Khi `addFromBank` thêm câu từ kho vào đề thi, nó **copy toàn bộ nội dung**
(questionText, options, correctAnswer, explanation...) vào bản ghi `ExamQuestion` —
không chỉ lưu `questionBankId`. Vì vậy `ExamQuestion` hoàn toàn tự đứng được sau
khi nguồn gốc bị xoá.

`questionBankId` chỉ là "liên kết nguồn gốc" — biết câu này từ đâu — chứ không
phải dữ liệu cần thiết để thi hoặc chấm điểm. SET NULL là cách thể hiện
"mất kết nối với kho, nhưng nội dung vẫn còn".

## Hệ quả

- Lịch sử thi và điểm số học sinh **không bao giờ bị ảnh hưởng** khi admin xoá câu hỏi
- Admin vẫn xoá được câu khỏi kho (chỉ bị block nếu có session IN_PROGRESS)
- Sau khi xoá, `ExamQuestion.questionBankId = NULL` — có thể dùng để phân biệt
  "câu tự tạo" vs "câu từ kho đã bị xoá" nếu cần sau này
