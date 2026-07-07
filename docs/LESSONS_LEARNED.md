# Bài học kinh nghiệm — QuizzGame

> Ghi lại những điều rút ra sau mỗi vòng phát triển.
> Dùng để tránh lặp lại sai lầm và đưa ra quyết định tốt hơn trong tương lai.

---

## Vòng 008: Admin User Management + Dashboard (2026-07-05)

### Phức tạp hơn dự kiến
- **Prisma migration drift**: `prisma migrate dev` thất bại do drift giữa
  migration history và schema thực tế (bảng `wrong_answers` có index khác).
  Phải dùng `prisma db push` để sync, rồi tạo migration file thủ công và
  đánh dấu đã apply bằng `prisma migrate resolve --applied`.
  → Mất thêm thời gian không dự kiến trong S2.

- **ExamSession → ExamPaper N+1**: Ban đầu định dùng Prisma relation để include
  `examPaper` trong query `examSession`, nhưng schema không có relation giữa
  2 bảng này. Phải dùng batch query pattern (fetch `examPaperIds` → findMany → Map).

- **Firebase reset password**: `generatePasswordResetLink` trả về link nhưng
  không tự gửi email. Phải dùng `window.prompt` để hiển thị link cho admin
  tự gửi — không lý tưởng nhưng chấp nhận được ở giai đoạn này.

### Nên làm khác lần sau
- **Test user không có Firebase account**: Khi tạo user test thẳng vào DB
  (bỏ qua Firebase), các thao tác liên quan Firebase (delete, reset password)
  sẽ thất bại. Nên tạo user test qua API `/login` với Firebase token thật,
  hoặc mock Firebase trong môi trường test.

- **Nút Đăng xuất nên đặt ở layout chung ngay từ đầu**: Khi thêm tab mới,
  dễ quên đặt nút logout ở mỗi tab. Nên đặt ở component cha (AdminPage)
  từ đầu thay vì copy sang từng tab.

- **Page size nên nhỏ hơn trong dev**: Mặc định 20 items/trang khiến khó
  test phân trang khi chưa có đủ data. Cân nhắc dùng env variable để
  override page size trong môi trường dev.

### Quyết định thiết kế đáng ghi nhớ
- **Firebase-first delete**: Xóa Firebase trước DB để đảm bảo user không
  thể "hồi sinh" dù DB xóa thất bại. Chiều ngược lại (DB trước) có thể
  tạo tài khoản zombie.

- **Fire-and-forget cho Redis online tracking**: Không `await` việc ghi
  Redis trong middleware xác thực — tránh Redis chậm làm chậm toàn bộ
  request của user. Chấp nhận đôi khi mất tracking để đổi lấy độ ổn định.

- **SCAN thay vì KEYS**: Luôn dùng SCAN để tìm key theo pattern trong
  production. KEYS block Redis và có thể làm app chết nếu có nhiều key.

- **isBlocked check trong middleware**: Đặt check khoá tài khoản ở
  `verifyAppToken` (middleware chạy mọi request) thay vì từng route riêng
  → đảm bảo không route nào "lọt" qua, không cần nhớ thêm check ở nhiều nơi.

---

## Vòng 11: Anti-Cheat Security Fixes (2026-07-07)

### Phức tạp hơn dự kiến
- **Sentinel value `{}` cần xuyên suốt 3 lớp**: Frontend cần `toSubmitAnswer()` để convert, Zod cần `z.object({}).strict()` để validate, backend cần `isSentinelUnanswered()` để detect. Ban đầu S2 quên lớp Zod validation → bug phát sinh khi test.
- **Auto-submit React**: Tưởng đơn giản nhưng `useEffect([..., onSubmit])` có race condition tinh vi. Cần thêm 1 vòng debug và fix với Latest Ref Pattern.

### Nên làm khác lần sau
- **Test Zod schema trước khi test E2E**: Mỗi khi thêm kiểu dữ liệu mới vào API, viết test Zod schema riêng ngay trong S2 — không để đến S5 manual test mới phát hiện.
- **React timer + auto-submit**: Dùng `setTimeout` + Latest Ref Pattern ngay từ đầu thay vì `useEffect` watch state. Pattern này ổn định hơn trong mọi hoàn cảnh.

### Quyết định thiết kế đáng ghi nhớ
- **Fail-Closed > Fail-Open cho security**: Khi Redis lỗi, chặn user (tạm thời bất tiện) thay vì cho qua (nguy cơ bảo mật vĩnh viễn). Đây là triết lý "mặc định an toàn".
- **Sentinel `{}` thay vì `null`**: `null` đã có ngữ nghĩa riêng trong Prisma ("không có bản ghi"). Dùng `{}` tạo một ký hiệu không thể nhầm lẫn, không xung đột với bất kỳ đáp án hợp lệ nào của 3 loại câu hỏi.
- **`EXAM_MIN_SUBMIT_RATIO` là constant, không hardcode**: Ngưỡng 30% được đặt trong `exam.types.ts` thay vì hardcode ở nhiều nơi → dễ điều chỉnh sau này (ví dụ đổi thành 25% cho đề ngắn hơn).
