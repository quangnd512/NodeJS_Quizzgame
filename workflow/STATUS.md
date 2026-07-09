# 📊 Trạng thái Workflow — QuizzGame

> File này do **S8-GiamSat** duy trì. Cập nhật sau mỗi hành động quan trọng.
> **Mọi session PHẢI đọc file này khi khởi động** (Bước 0).
> **Chỉ S8 được phép sửa bảng trạng thái.** Các session khác chỉ đọc.

---

## Tính năng đang triển khai

| Mục | Giá trị |
|-----|---------|
| Tính năng | Exam UX Improvements (012) |
| Branch | feature/exam-ux-improvements |
| Bắt đầu từ | 2026-07-07 |

---

## Trạng thái từng session

| Session | Tên | Trạng thái | Việc cần làm | Số lần làm lại |
|---------|-----|------------|--------------|---------------|
| S1 | Kiến Trúc Sư | ✅ Done | — | 0 |
| S2 | Thợ Code | ✅ Done | — | 0 |
| S3 | Người Soát Lỗi | ✅ Done | — | 0 |
| S4 | Người Ghi Chép | ✅ Done | — | 0 |
| S5 | Người Thử Nghiệm | ✅ Done | — | 0 |
| S6 | Người Giảng Giải | ✅ Done | — | 0 |
| S7 | Người Đóng Gói | 🔄 Đang làm | Push & merge feature/exam-ux-improvements | 0 |
| S8 | Giám Sát Chất Lượng | ✅ Done | Quality gate PASS | — |
| S9 | Cố Vấn Ra Mắt | ⏸ Chờ | — | — |

**Trạng thái**: `⏸ Chờ` | `🔄 Đang làm` | `✅ Done` | `↩️ Làm lại` | `⛔ Bị chặn`

> ⚠️ **Quy tắc làm lại**: Nếu "Số lần làm lại" của một session đạt **3**, S8 dừng tự động và báo người dùng trực tiếp.

---

## Yêu cầu mới từ người dùng (chưa xử lý)

_(S8 ghi vào đây khi người dùng đặt ra yêu cầu mới trong lúc tính năng đang được làm)_

---

## Lịch sử cập nhật

| Thời gian | Session | Hành động |
|-----------|---------|-----------|
| _(khởi tạo)_ | S8 | Tạo file STATUS.md |
| 2026-07-09 | S8 | Cập nhật tính năng đang triển khai → Feature 012 (Exam UX Improvements); chạy quality gate |
