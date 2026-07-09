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

---

## Vòng 12: Exam UX Improvements (2026-07-07)

### Bài học kỹ thuật

**1. localStorage đủ tốt cho draft — không cần backend mới**
Thay vì thêm API `GET /api/exam/:id/questions` để fetch lại câu hỏi khi resume, ta lưu `StartExamResult` vào localStorage lúc bắt đầu thi. Đơn giản hơn nhiều, không cần migration hay endpoint mới. Trade-off: chỉ hoạt động cùng thiết bị — chấp nhận được cho MVP.

**2. Kiểm tra phiên dở khi mount, không block UI**
`getActiveSession` được gọi trong `useEffect` với `cancelled` flag để tránh set state sau khi component unmount. Khởi tạo `checkingActive = true` thay vì gọi `setCheckingActive(true)` trong effect (tránh lỗi lint `set-state-in-effect`).

**3. `catch (err)` trong TypeScript strict mode → dùng `catch {` (bỏ tham số)**
TypeScript 4.0+ cho phép `catch {` khi không dùng biến `err`. Dùng thay cho `catch (_err)` — ngắn gọn hơn và tránh lỗi `no-unused-vars`.

### Bài học quy trình

**4. S3 phải kiểm tra CSS classes mới**
S2 thêm class CSS mới (`exam-resume-banner`...) vào JSX nhưng quên thêm vào App.css. S3 phát hiện và sửa. Bài học: khi thêm class CSS mới trong component, kiểm tra ngay trong App.css trước khi commit.

**5. Scope nhỏ = ít rủi ro**
3 tính năng UX được gộp thành 1 feature nhỏ gọn (6 TASK, không migration DB, không table mới). Tổng thời gian S2→S3 rất nhanh. So sánh với các feature lớn như Admin User Management — giữ scope nhỏ giúp review kỹ hơn và ít lỗi hơn.

### Quyết định thiết kế đáng ghi nhớ

**6. ABANDONED ≠ refund điểm**
Học sinh thoát bài chủ động mất 60đ vào thi — giống với EXPIRED. Quyết định này ngăn lạm dụng "vào xem đề rồi thoát để không mất điểm". Nhất quán với triết lý fail-closed của Feature 011.

**7. remainingSeconds có thể âm — thiết kế chủ ý**
`GET /api/exam/active` trả `remainingSeconds` âm khi phiên đã hết giờ. Frontend dùng giá trị này để quyết định auto-submit thay vì hỏi "tiếp tục?". Không cần 2 trạng thái riêng ("còn giờ" / "hết giờ") — 1 số nguyên đủ mô tả cả 2.

### Bài học bổ sung từ S5 testing (5 bugs phát hiện)

**8. Đặt check phiên dở ở Page-level là sai chỗ (Bug 1)**
Ban đầu `getActiveExamSession` được gọi trong `useEffect` của `ExamPage` — nghĩa là chỉ khi user chủ động vào trang thi mới thấy thông báo. Người dùng mong đợi thông báo xuất hiện ngay khi mở app. **Bài học**: với thông tin quan trọng ảnh hưởng đến toàn bộ session (không phải 1 page), đặt check ở App-level (`onAuthStateChanged`) và truyền state xuống qua props.

**9. React StrictMode gây double-invoke — cần guard useRef (Bug 3)**
`useEffect` với `initialResume` đã có Cancelled Flag, nhưng Cancelled Flag chỉ block sau khi cleanup — StrictMode unmount/remount khiến lần 2 vẫn chạy `handleResume`. Giải pháp: `resumeAttempted = useRef(false)` không reset khi cleanup → block hoàn toàn lần 2. **Bài học**: khi effect chứa logic quan trọng "chỉ chạy 1 lần" (không phải "chạy lại khi deps đổi"), cần `useRef` guard, không chỉ Cancelled Flag.

**10. CSS class color context — tạo class mới thay vì tái sử dụng (Bug 5)**
`btn-icon-back` có `color: #fff` vì thiết kế cho topbar nền tối (ProfilePage). Exam session topbar dùng nền sáng → chữ trắng vô hình. **Bài học**: không giả định class CSS "generic" là trung lập về màu sắc. Khi dùng class cũ ở context nền mới, kiểm tra trực tiếp trên trình duyệt. Nếu không phù hợp, tạo class mới thay vì override.

**11. Catch block set error state gây UX xấu trong flow phức tạp (Bug 4)**
Catch trong `handleResume` set `hubError` — hợp lý ở mặt kỹ thuật ("có lỗi → báo user"), nhưng trong context resume-expired, lỗi là "bình thường" (phiên đã hết giờ và đã được xử lý). User đã thấy kết quả → lại thấy thêm banner lỗi là confusing. **Bài học**: không phải mọi exception đều nên hiển thị cho user. Trong flow có nhiều state transition, phân biệt "lỗi thực" (cần báo) vs "expected failure" (xử lý im lặng).

**12. Bảng điểm: balance table vs log table**
Trong quá trình test, phát hiện cộng điểm vào `point_transactions` (bảng log) thay vì `user_points` (bảng balance). Điểm không thay đổi dù insert thành công. **Bài học**: Khi có 2 bảng liên quan (balance + audit log), luôn xác nhận rõ bảng nào là "nguồn sự thật" trước khi viết code cập nhật. Ở QuizzGame: `user_points.currentPoints` là balance thực, `point_transactions` chỉ là lịch sử.
