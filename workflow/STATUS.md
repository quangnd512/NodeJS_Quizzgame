# 📊 Trạng thái Workflow — QuizzGame

> File này do **S8-GiamSat** duy trì. Cập nhật sau mỗi hành động quan trọng.
> **Mọi session PHẢI đọc file này khi khởi động** (Bước 0).
> **Chỉ S8 được phép sửa bảng trạng thái.** Các session khác chỉ đọc.

---

## Tính năng đang triển khai

| Mục | Giá trị |
|-----|---------|
| Tính năng | _(chưa có — đang chờ S1 bắt đầu)_ |
| Branch | _(chưa có)_ |
| Bắt đầu từ | _(chưa có)_ |

---

## Trạng thái từng session

| Session | Tên | Trạng thái | Việc cần làm | Số lần làm lại |
|---------|-----|------------|--------------|---------------|
| S1 | Kiến Trúc Sư | ⏸ Chờ | — | 0 |
| S2 | Thợ Code | ⏸ Chờ | — | 0 |
| S3 | Người Soát Lỗi | ⏸ Chờ | — | 0 |
| S4 | Người Ghi Chép | ⏸ Chờ | — | 0 |
| S5 | Người Thử Nghiệm | ⏸ Chờ | — | 0 |
| S6 | Người Giảng Giải | ⏸ Chờ | — | 0 |
| S7 | Người Đóng Gói | ⏸ Chờ | — | 0 |
| S8 | Giám Sát Chất Lượng | ⏸ Chờ | — | — |
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
