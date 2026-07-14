# 📖 QuizzGame — Tổng quan dự án

> File này được duy trì bởi **Session 8 - Giám Sát Chất Lượng**.
> Sau mỗi tính năng mới, S8 cập nhật file này nếu tính năng ảnh hưởng đến mô tả tổng quan.

---

## Mục tiêu dự án

QuizzGame là ứng dụng ôn thi THPT Quốc gia, giúp học sinh ôn tập theo môn học,
luyện đề, theo dõi tiến độ và tích điểm thông qua các phiên ôn tập thích nghi.

## Đối tượng người dùng

- **Học sinh THPT**: ôn tập, luyện đề, theo dõi điểm số/tiến độ cá nhân
- **Admin**: quản lý câu hỏi, môn học, theo dõi hoạt động hệ thống

## Tech stack

| Thành phần | Công nghệ |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Backend | Node.js + Express + TypeScript (NodeNext) |
| Database | PostgreSQL (port 5433) qua Prisma ORM v6 |
| Cache/Realtime | Redis, Socket.io |
| Auth | Firebase Authentication (Google Sign-In) + JWT session token (7 ngày) |

## Module đã có

| Module | Mô tả | Trạng thái |
|---|---|---|
| Auth + Onboarding | Đăng nhập Google, chọn môn học, hồ sơ cá nhân | ✅ Done |
| Practice Module (Ôn tập thích nghi) | Luyện tập theo môn, lưu lịch sử, thống kê theo môn | ✅ Done |
| Admin – Quản lý câu hỏi (Báo cáo lỗi) | Tab "Câu hỏi" gộp trong Admin: hiện đầy đủ nội dung câu hỏi (không chỉ UUID), sửa tại chỗ + lưu bản gốc (question_edit_history), 1 lần sửa đóng hết mọi báo cáo trùng cùng câu (batch-resolve, mỗi người báo cáo nhận 1 thông báo riêng), tự hiện lại câu bị auto-hide khi đánh dấu Đã sửa, chỉ còn 2 trạng thái Chờ xử lý/Đã sửa/Đã bỏ qua, lọc liên động môn+lý do (faceted) | ✅ Done |
| Đóng góp câu hỏi (Học sinh) | Học sinh gửi câu hỏi mới (MCQ_4/TRUE_FALSE_4/FILL_BLANK), giới hạn 5 câu/ngày; sửa/xoá khi còn chờ duyệt; admin duyệt (vào Ngân hàng câu hỏi + thưởng 30đ, cảnh báo trùng lặp kèm nội dung) hoặc từ chối kèm lý do; câu được dùng trong đề thi → +5đ/lần (tối đa 100đ), CAS retry chống lost-update; báo cáo lại 1 câu sau khi report cũ đã xử lý xong (partial unique index + xác nhận) | ✅ Done |
| Exam Module (Thi thử) | Làm đề thi đầy đủ (MCQ/True-False/Fill-Blank), trừ 60 điểm phí vào thi, thưởng điểm theo bậc (0/10/20/50/120), chọn đề công bằng round-robin, hết giờ + grace period; admin CRUD đề + câu hỏi, import Excel | ✅ Done |
| Question Bank – Ngân hàng câu hỏi | Kho câu hỏi toàn cục tách biệt đề thi; admin CRUD, soft-delete có cảnh báo, lấy câu từ ngân hàng vào đề (AdminFromBankModal), hard-delete với xác nhận | ✅ Done |
| Leaderboard – Bảng xếp hạng | Xếp hạng theo Điểm Uy Tín (AVG - 0.5×STDDEV) × (1-1/(n+1)); podium Top 3, xu hướng 30 ngày (↑↓→), filter môn, thanh ghim hạng; upload/xóa avatar (Multer, JPG/PNG ≤ 2MB) | ✅ Done |
| Progress Dashboard – Tiến độ học tập | Tổng quan (phiên ôn, lần thi, điểm, streak 🐝); so sánh tháng; thống kê theo môn; sparkline điểm 30 phiên; lịch sử thi thử phân trang; 9 query song song (Promise.all) | ✅ Done |
| Ôn câu sai (Wrong Answer Review) | Xem lại và làm lại câu sai từ phiên Ôn tập và Thi thử; TTL 14 ngày; 3 loại câu (MCQ_4, TRUE_FALSE_4, FILL_BLANK) | ✅ Done |
| Admin User Management + Dashboard | Tab Dashboard (6 chỉ số: tổng user, mới tuần/tháng, tổng phiên thi, tỷ lệ đậu, online ngay); Tab Người dùng (tìm kiếm/lọc/phân trang, chi tiết user + stats, khoá/mở khoá, reset mật khẩu, đổi role, xóa tài khoản) | ✅ Done |
| Notifications – Thông báo hệ thống | 5 loại thông báo tự động (streak milestone, lên/xuống hạng, báo cáo được xử lý, đề thi mới) — fire-and-forget; chuông 🔔 badge + polling 30s; toast popup 7s; bấm thông báo tự điều hướng theo `targetScreen` (Tiến độ/Bảng xếp hạng/Thi thử), riêng báo cáo chỉ đánh dấu đã đọc | ✅ Done |

## Kiến trúc tổng thể

```
[Frontend React] ──HTTP/Bearer token──► [Backend Express]
                                              │
                          ┌───────────────────┼───────────────────┐
                          ▼                   ▼                   ▼
                  [PostgreSQL/Prisma]      [Redis]          [Firebase Admin]
```

- Mọi route sau `/login` đều qua middleware `verifyAppToken`
- Admin route qua thêm `admin.middleware.ts`
- Trang `/#admin` (frontend) là 1 lối vào riêng, đọc `window.location.hash`
  ngay lúc init để **bỏ qua hoàn toàn Firebase Auth** — xác thực bằng header
  `X-Admin-Secret` (lưu ở `sessionStorage`), không dùng JWT session token

---

## Liên kết tài liệu khác

| File | Nội dung |
|---|---|
| `docs/TASKS.md` | Theo dõi tiến độ từng tính năng |
| `docs/GAMEPLAY.md` | Luật chơi/luồng ôn tập (khi có phần game) |
| `docs/FEATURE_LOG.md` | Log chi tiết kỹ thuật từng tính năng |
| `docs/WORKFLOW.md` | Quy trình 9-session phát triển |
