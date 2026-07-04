# ADR 006: Chống Deadlock trong `transferPoints` bằng Consistent Lock Ordering

## Bối cảnh

`transferPoints` cần thay đổi điểm của 2 user trong cùng 1 transaction:
trừ điểm người gửi, cộng điểm người nhận.

Nếu có 2 giao dịch ngược chiều xảy ra đồng thời (A→B và B→A), chúng có thể
khóa tài nguyên theo thứ tự ngược nhau và chờ nhau mãi mãi — **deadlock**.

```
Giao dịch 1 (A→B): khóa row A → chờ khóa row B
Giao dịch 2 (B→A): khóa row B → chờ khóa row A
→ Cả 2 chờ nhau → deadlock!
```

## Quyết định

**Luôn khóa các bản ghi theo thứ tự alphabet của userId**, bất kể chiều chuyển.

```typescript
// Sắp xếp userId theo alphabet → thứ tự khóa nhất quán
const [firstId, secondId] = [fromUserId, toUserId].sort();

// Khóa firstId trước, secondId sau — mọi giao dịch đều dùng cùng thứ tự này
const firstRecord  = await ensureUserPointsRecord(tx, firstId);
const secondRecord = await ensureUserPointsRecord(tx, secondId);
```

```
Có sort: A→B → sort → [A, B] → khóa A rồi B
         B→A → sort → [A, B] → khóa A rồi B
→ Cả 2 đều cùng thứ tự → không bao giờ deadlock ✓
```

## Lý do

Đây là giải pháp kinh điển trong khoa học máy tính cho bài toán
**"Dining Philosophers"** (Triết gia ăn tối): khi nhiều tác nhân cần
dùng chung tài nguyên, quy định thứ tự lấy tài nguyên cố định sẽ phá vỡ
khả năng deadlock về mặt toán học.

**Tại sao sort theo alphabet?**: Đơn giản, deterministic, không cần thêm bảng
hay sequence. Bất kỳ thứ tự nào đều hoạt động — quan trọng là **nhất quán**.

**Tại sao không dùng `SELECT FOR UPDATE`?**: Có thể dùng, nhưng kết hợp với
Optimistic Locking đã có (ADR 005) sẽ phức tạp thêm. Consistent lock ordering
giải quyết deadlock mà không cần thêm cơ chế.

## Hệ quả

- `transferPoints` không bao giờ deadlock với chính nó, dù có hàng trăm giao dịch đồng thời
- Code phải map lại `firstRecord`/`secondRecord` về đúng `fromRecord`/`toRecord` sau khi sort
- 2 bản ghi log riêng biệt (`TRANSFER_OUT` / `TRANSFER_IN`) giúp truy vết từ cả 2 phía
