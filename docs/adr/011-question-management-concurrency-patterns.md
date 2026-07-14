# ADR-011: Quản lý câu hỏi — 3 kỹ thuật chống concurrency không cần lock DB

**Ngày**: 2026-07-13 (bổ sung 2026-07-14 sau vòng test S5)
**Trạng thái**: Accepted
**Tính năng liên quan**: Quản lý câu hỏi — Học sinh đóng góp câu hỏi + Report Redesign (branch `feature/question-management-hub`)

---

## Bối cảnh

Feature 014 có 3 nhu cầu concurrency khác nhau, không nhu cầu nào phù hợp với optimistic-lock kiểu `version` column (đã dùng cho điểm số ở Feature 011) hay pessimistic lock (`SELECT FOR UPDATE`, vốn tạo bottleneck):

1. Nhiều admin có thể xử lý (duyệt/từ chối/sửa/xoá) cùng 1 `StudentQuestionSubmission` gần như đồng thời.
2. 1 câu hỏi trong kho (bắt nguồn từ submission) có thể được thêm vào nhiều đề thi khác nhau gần như đồng thời — mỗi lần cộng thêm điểm "usage" có trần 100đ/câu.
3. Ràng buộc "1 học sinh chỉ báo cáo 1 câu 1 lần" cần được nới lỏng theo trục thời gian (cho báo cáo lại sau khi report cũ đã xử lý xong) mà vẫn phải chống spam report trùng lúc còn PENDING.

Cả 3 đều được giải quyết bằng kỹ thuật đẩy việc kiểm tra "còn hợp lệ hay không" xuống ngay trong câu lệnh ghi DB (dùng `WHERE` làm điều kiện xác nhận), thay vì tách riêng bước "kiểm tra" rồi "ghi" ở tầng ứng dụng.

---

## Quyết định 1: Claim Pattern — `updateMany`/`deleteMany` điều kiện trạng thái thay vì `update`/`delete` theo `id`

### Vấn đề
Bản nháp đầu tiên (S2) viết theo mẫu: `findUnique` → kiểm tra `status === 'PENDING'` ở code → `update`/`delete` theo `id`. Giữa bước kiểm tra và bước ghi luôn có 1 khe hở thời gian (TOCTOU — Time-Of-Check to Time-Of-Use) mà 1 request khác có thể chen vào.

### Lựa chọn đã xét

**A. Giữ nguyên check-rồi-ghi, thêm transaction bao ngoài**: Không giải quyết được vấn đề — transaction chỉ đảm bảo atomicity của các câu lệnh BÊN TRONG nó, không ngăn được 2 transaction độc lập cùng đọc cùng 1 trạng thái trước khi cả 2 đều ghi.

**B. Pessimistic lock (`SELECT ... FOR UPDATE`)**: Đúng về mặt kỹ thuật nhưng tạo bottleneck không cần thiết cho thao tác admin vốn tần suất thấp; thêm độ phức tạp quản lý lock timeout.

**C. Claim pattern — `updateMany`/`deleteMany` với điều kiện trạng thái trong `WHERE`, kiểm tra `count`** *(đã chọn)*:
```ts
const claimed = await prisma.studentQuestionSubmission.updateMany({
  where: { id, status: 'PENDING' },   // điều kiện xác nhận NGAY TRONG câu lệnh ghi
  data: { status: 'APPROVED' },
});
if (claimed.count === 0) throw new SubmissionNotPendingError(); // thua "cuộc đua"
```
- ✅ Atomic thật sự ở tầng DB — không cần lock, không cần transaction bao ngoài riêng cho việc này
- ✅ 1 round-trip DB duy nhất để vừa xác nhận vừa ghi
- ✅ Áp dụng được cho MỌI thao tác ghi có điều kiện tiền đề về trạng thái (không riêng gì submission)
- ⚠️ Cần nhớ luôn kiểm tra `count` sau mỗi lệnh — dễ quên nếu không thành thói quen

### Quyết định
Chọn **C**, áp dụng cho `approveSubmission`, `rejectSubmission`, `updateSubmission`, `deleteSubmission`. Đây là bug S3 tìm thấy khi review — bản đầu tiên của S2 chưa áp dụng pattern này.

---

## Quyết định 2: Compare-And-Swap (CAS) cho điểm "usage" có trần

### Vấn đề
`usagePointsEarned` (trần 100đ/câu) cần cộng dồn an toàn khi 2 `addFromBank` (thêm câu vào đề thi) chạy song song cho cùng 1 câu hỏi. Đọc-tính-ghi bằng `update` thường có thể "lost update".

### Lựa chọn đã xét

**A. Thêm cột `version` riêng (optimistic lock kiểu Feature 011)**: Hoạt động đúng nhưng dư thừa — `usagePointsEarned` đã là giá trị đơn điệu tăng, tự nó đủ làm điều kiện so sánh mà không cần thêm 1 cột theo dõi riêng.

**B. CAS trực tiếp trên giá trị nghiệp vụ** *(đã chọn)*:
```ts
const claimed = await prisma.studentQuestionSubmission.updateMany({
  where: { id, usagePointsEarned: sub.usagePointsEarned }, // = giá trị vừa đọc
  data: { usagePointsEarned: newTotal },
});
if (claimed.count === 0) continue; // đọc lại, thử lại (tối đa 5 lần)
```
- ✅ Không cần thêm cột mới
- ✅ Retry loop đơn giản, giới hạn số lần thử (`MAX_CAS_RETRY = 5`) tránh vòng lặp vô hạn dưới tranh chấp cực cao
- ⚠️ Chỉ phù hợp khi giá trị cần bảo vệ tự nó đơn điệu và đủ để làm điều kiện — không tổng quát bằng cột `version` nếu sau này cần bảo vệ nhiều field cùng lúc trên cùng bản ghi

### Quyết định
Chọn **B**. Đây cũng là bug S3 tìm thấy — bản đầu tiên dùng `update` thường, không có điều kiện CAS.

---

## Quyết định 3: Partial Unique Index cho phép báo cáo lại sau khi đã xử lý

### Vấn đề
`UNIQUE(userId, questionId)` toàn phần chặn báo cáo lại vĩnh viễn — kể cả khi report cũ đã xử lý xong và câu hỏi phát sinh lỗi MỚI sau đó.

### Lựa chọn đã xét

**A. Xoá report cũ trước khi tạo report mới**: Mất lịch sử — admin không còn thấy được câu hỏi này đã từng bị báo cáo bao nhiêu lần, xử lý ra sao.

**B. Thêm cột `isLatest: boolean`, tự quản lý ở code**: Thêm 1 nguồn có thể lệch dữ liệu (phải nhớ update cột này ở MỌI nơi ghi report) — vi phạm nguyên tắc "để DB đảm bảo bất biến, không giao cho code tự giữ kỷ luật".

**C. Partial Unique Index — unique CÓ ĐIỀU KIỆN** *(đã chọn)*:
```sql
DROP INDEX "question_reports_userId_questionId_key"; -- unique toàn phần cũ
CREATE UNIQUE INDEX "question_reports_user_question_pending_key"
  ON "question_reports" ("userId", "questionId")
  WHERE status = 'PENDING';
```
- ✅ Giữ nguyên toàn bộ lịch sử report (không xoá gì)
- ✅ DB tự đảm bảo "tối đa 1 report PENDING / user / câu hỏi" — atomic, chống race condition khi 2 request báo cáo đồng thời
- ✅ Service layer chỉ cần catch lỗi `P2002` (unique violation) làm lớp phòng thủ thứ 2
- ⚠️ Prisma schema (`schema.prisma`) không có cú pháp khai báo partial index — phải viết raw SQL migration, và mọi lần `prisma migrate dev` sau này cần cẩn thận không để Prisma "tưởng nhầm" là thiếu index rồi tự sinh migration xoá nó đi (cần review migration tự sinh trước khi apply)

### Quyết định
Chọn **C**. Đi kèm: service layer check "report gần nhất" (`findFirst orderBy createdAt desc`) → nếu `PENDING` thì chặn hẳn (`ReportAlreadySubmittedError`), nếu đã xử lý xong thì yêu cầu xác nhận qua flag `confirmResubmit` (`ReportResubmitConfirmRequiredError`) trước khi tạo report mới.

---

## Hệ quả

### Tích cực
- Cả 3 kỹ thuật đều là pattern tổng quát, tái dùng được cho bất kỳ dự án nào có nhu cầu tương tự (không riêng gì QuizzGame) — xem `docs/GLOSSARY.md` mục "Thuật ngữ Feature 014" để tra cứu nhanh khi cần áp dụng lại.
- Không cần thêm hạ tầng lock/queue nào — toàn bộ giải quyết bằng SQL `WHERE` + kiểm tra `count`/catch lỗi unique.
- Cả 3 đều lộ ra qua review/test tập trung vào concurrency (S3 viết test race-condition/CAS riêng) — khẳng định giá trị của việc chủ động viết test cho kịch bản đồng thời, không chỉ test đơn luồng.

### Tiêu cực / Đánh đổi
- Claim pattern và CAS đều yêu cầu developer **nhớ** kiểm tra `count`/catch lỗi đúng chỗ — không có compiler nào bắt lỗi nếu quên, chỉ lộ ra qua test concurrency chuyên biệt hoặc production incident.
- Partial unique index không thể khai báo trong `schema.prisma` — dễ bị `prisma migrate dev` hiểu nhầm là "thiếu unique constraint đầy đủ" và đề xuất migration xoá nó nếu không review kỹ mỗi lần chạy migrate ở môi trường dev.

### Nợ kỹ thuật
- [ ] Cân nhắc viết 1 helper/wrapper chung cho "claim pattern" (VD: `claimAndUpdate(model, id, expectedStatus, data)`) để giảm lặp code và giảm rủi ro quên kiểm tra `count` ở các feature sau.
- [ ] Thêm comment cảnh báo ngay trong `schema.prisma` cạnh model `QuestionReport` để nhắc nhở về partial index tồn tại ngoài schema, tránh bị `migrate dev` xoá nhầm.
