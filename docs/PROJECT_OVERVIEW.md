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

---

## Liên kết tài liệu khác

| File | Nội dung |
|---|---|
| `docs/TASKS.md` | Theo dõi tiến độ từng tính năng |
| `docs/GAMEPLAY.md` | Luật chơi/luồng ôn tập (khi có phần game) |
| `docs/FEATURE_LOG.md` | Log chi tiết kỹ thuật từng tính năng |
| `docs/WORKFLOW.md` | Quy trình 9-session phát triển |
