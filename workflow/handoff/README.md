# Thư mục handoff — Trao đổi giữa các session

Ba thư mục con, **ba mục đích khác nhau — không được lẫn**:

| Thư mục | Chứa gì | Ai đọc |
|---------|---------|--------|
| `PENDING/` | **Lệnh đang chờ xử lý.** Chỉ file `SX.md` của session chưa làm | Session X đọc ở Bước 0 |
| `backlog/` | **Kế hoạch dài hạn chưa tới lượt** (saved plan, thứ tự ưu tiên) | Chỉ S1 đọc, khi cần chọn việc tiếp theo |
| `archive/` | **Lệnh đã xử lý xong** (`SX.done.md`) + handoff format cũ | Không ai đọc thường xuyên — chỉ tra cứu lịch sử |

## Vì sao phải tách

`PENDING/` là hộp thư đến. Mọi session đọc nó ở Bước 0, mỗi lần khởi động.
Nếu để lẫn saved plan và file `.done` vào đây thì mỗi session phải quét qua
hàng chục file không liên quan → tốn token vô ích mỗi lần mở session.

**Quy tắc vàng: `PENDING/` rỗng nghĩa là không còn việc đang chờ.**

## Vòng đời một lệnh

```
1. Session A giao việc cho B   → ghi  PENDING/SB.md
2. Session B khởi động          → đọc  PENDING/SB.md  (Bước 0)
3. Session B làm xong           → chuyển sang archive/SB.done.md:

   mv workflow/handoff/PENDING/SB.md workflow/handoff/archive/SB.done.md

4. Session B báo kết quả về session nguồn qua PENDING/SA.md
   (KHÔNG tự mở tab mới — người dùng quyết định khi nào chuyển session)
```

⚠️ **Không bao giờ để `SX.md` và `SX.done.md` cùng tồn tại trong `PENDING/`** —
sẽ không biết lệnh nào đang hiệu lực.

## Quy ước đặt tên trong PENDING/

```
S1.md → lệnh đang chờ S1 (Kiến Trúc Sư)
S2.md → lệnh đang chờ S2 (Thợ Code)
...
S9.md → lệnh đang chờ S9 (Cố Vấn Ra Mắt)
```
