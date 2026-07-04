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
| Admin Dashboard – Quản lý báo cáo câu hỏi | Trang `/#admin`: 4 thẻ thống kê, danh sách báo cáo (filter/phân trang), đổi trạng thái, cảnh báo auto-hide | ✅ Done |
| Exam Module (Thi thử) | Làm đề thi đầy đủ (MCQ/True-False/Fill-Blank), trừ 60 điểm phí vào thi, thưởng điểm theo bậc (0/10/20/50/120), chọn đề công bằng round-robin, hết giờ + grace period; admin CRUD đề + câu hỏi, import Excel | ✅ Done |
| Question Bank – Ngân hàng câu hỏi | Kho câu hỏi toàn cục tách biệt đề thi; admin CRUD, soft-delete có cảnh báo, lấy câu từ ngân hàng vào đề (AdminFromBankModal), hard-delete với xác nhận | ✅ Done |
| Leaderboard – Bảng xếp hạng | Xếp hạng theo Điểm Uy Tín (AVG - 0.5×STDDEV) × (1-1/(n+1)); podium Top 3, xu hướng 30 ngày (↑↓→), filter môn, thanh ghim hạng; upload/xóa avatar (Multer, JPG/PNG ≤ 2MB) | ✅ Done |
| Progress Dashboard – Tiến độ học tập | Tổng quan (phiên ôn, lần thi, điểm, streak 🐝); so sánh tháng; thống kê theo môn; sparkline điểm 30 phiên; lịch sử thi thử phân trang; 9 query song song (Promise.all) | ✅ Done |

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
