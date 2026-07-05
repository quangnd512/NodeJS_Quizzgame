# Thư mục PENDING — Hộp thư đến của từng session

Mỗi file trong thư mục này là **lệnh đang chờ** dành cho một session cụ thể.

## Quy ước đặt tên

```
S2.md  → lệnh đang chờ Session 2 (Thợ Code)
S3.md  → lệnh đang chờ Session 3 (Người Soát Lỗi)
S4.md  → lệnh đang chờ Session 4 (Người Ghi Chép)
S5.md  → lệnh đang chờ Session 5 (Người Thử Nghiệm)
S6.md  → lệnh đang chờ Session 6 (Người Giảng Giải)
S7.md  → lệnh đang chờ Session 7 (Người Đóng Gói)
S8.md  → lệnh đang chờ Session 8 (Giám Sát Chất Lượng)
```

## Quy trình

1. Khi session A giao việc cho session B → ghi file `SB.md`
2. Khi session B khởi động → đọc `SB.md` ngay ở Bước 0
3. Khi session B hoàn thành việc → xóa (hoặc đổi tên thành `SB.done.md`) file đó
4. Session B báo kết quả cho session nguồn qua `send_message` (KHÔNG mở tab mới)
