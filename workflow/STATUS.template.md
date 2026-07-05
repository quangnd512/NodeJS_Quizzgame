# 📊 Trạng thái Workflow — [TÊN DỰ ÁN]

> File này do **S8-GiamSat** duy trì. Cập nhật sau mỗi hành động quan trọng.
> **Mọi session PHẢI đọc file này khi khởi động** (Bước 0).
> **Chỉ S8 được phép sửa bảng trạng thái.** Các session khác chỉ đọc.

---

## Tính năng đang triển khai

| Mục | Giá trị |
|-----|---------|
| Tính năng | _(tên tính năng đang làm)_ |
| Branch | `feature/<tên-branch>` |
| Bắt đầu từ | YYYY-MM-DD |
| Vòng lặp số | #1 _(tăng mỗi lần S1 bắt đầu tính năng mới)_ |

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

**Trạng thái hợp lệ**: `⏸ Chờ` | `🔄 Đang làm` | `✅ Done` | `↩️ Làm lại` | `⛔ Bị chặn`

> ⚠️ **Quy tắc làm lại**: Nếu cột "Số lần làm lại" của một session đạt **3**, S8 phải dừng
> tự động và báo người dùng trực tiếp — không tiếp tục vòng lặp.

---

## Yêu cầu mới từ người dùng (chưa xử lý)

> S8 ghi vào đây khi người dùng đặt ra yêu cầu mới trong lúc tính năng đang được làm.
> Xóa mục sau khi đã xử lý.

_(không có)_

---

## Lịch sử tính năng đã hoàn thành

| Tính năng | Branch | Ngày merge | Ghi chú |
|-----------|--------|------------|---------|
| _(chưa có)_ | — | — | — |

---

## Lịch sử cập nhật STATUS này

| Thời gian | Session | Hành động |
|-----------|---------|-----------|
| YYYY-MM-DD | S8 | Khởi tạo STATUS.md |

---

## HƯỚNG DẪN GHI STATUS (dành cho S8)

### Khi bắt đầu tính năng mới (S1 khởi động):
- Điền "Tính năng đang triển khai"
- Reset tất cả "Số lần làm lại" về 0
- Tất cả session → `⏸ Chờ`

### Khi giao việc cho session X:
- Cột trạng thái SX → `🔄 Đang làm`
- Cột "Việc cần làm" → mô tả ngắn

### Khi session X xong và chuyển sang SX+1:
- SX → `✅ Done`
- SX+1 → `🔄 Đang làm`

### Khi S8 trả lại session X (làm lại):
- SX → `↩️ Làm lại`
- Tăng "Số lần làm lại" lên 1
- Nếu đạt 3 → **DỪNG**, báo người dùng

### Khi session bị chặn (chờ thứ khác):
- SX → `⛔ Bị chặn`
- Cột "Việc cần làm" → ghi nguyên nhân bị chặn
