# ADR 005: Dùng Optimistic Locking (trường `version`) cho hệ thống điểm

## Bối cảnh

Hệ thống điểm tích lũy là "currency" duy nhất trong QuizzGame. Nhiều sự kiện có thể
kích hoạt thay đổi điểm gần như đồng thời cho cùng một user (ví dụ: cộng điểm ôn tập
+ trừ điểm vào thi thử xảy ra trong vài giây).

Cần đảm bảo không có **Lost Update**: 2 request cùng đọc `points=100`, cùng tính toán,
cùng ghi → 1 request bị mất hoàn toàn.

## Các lựa chọn đã cân nhắc

### Lựa chọn A: Pessimistic Locking — `SELECT FOR UPDATE`
Lock row ngay khi đọc, request khác phải chờ đến khi lock được giải phóng.

**Hệ quả:**
- An toàn tuyệt đối, không có race condition
- Bottleneck khi nhiều request cùng thao tác điểm của 1 user
- Dễ gây deadlock nếu không cẩn thận về thứ tự lock

### Lựa chọn B: Optimistic Locking — trường `version` ← **Đã chọn**
Đọc kèm `version`, khi ghi thêm điều kiện `WHERE version = oldVersion`.
Nếu `updateMany` trả về `count = 0` → có conflict → retry.

## Quyết định

Dùng **Optimistic Locking** với trường `version` trong bảng `user_points`.

```typescript
// Đọc:
const { currentPoints, version } = await ensureUserPointsRecord(tx, userId);

// Ghi có điều kiện:
const result = await tx.userPoints.updateMany({
  where: { userId, version: version },        // ← điều kiện kiểm tra
  data: { currentPoints: newBalance, version: { increment: 1 } },
});

if (result.count === 0) throw new OptimisticLockRetrySignal(); // conflict → retry
```

Retry tối đa 10 lần, mỗi lần nghỉ 10–50ms ngẫu nhiên (jitter) để tránh thundering herd.

## Lý do

**Xung đột thực tế hiếm**: Cùng 1 user thường không có hàng chục request thay đổi điểm
đúng cùng lúc. Optimistic lock chỉ retry khi thật sự có conflict — hiệu quả hơn
pessimistic lock luôn chặn dù không có conflict.

**Không dùng `UPDATE ... SET points = points + amount`**: Cách này atomic nhưng không
kiểm tra "điểm có đủ để trừ không" — có thể cho phép điểm âm.

**Jitter chống thundering herd**: Nếu nhiều request cùng thất bại và retry đúng cùng lúc
→ xung đột lại. Delay ngẫu nhiên 10–50ms phân tán chúng theo thời gian.

## Hệ quả

- Điểm không bao giờ âm (có check `if (currentPoints < amount)` trước khi ghi)
- Mọi thay đổi điểm đều được ghi vào `point_transactions` (audit log)
- Trong trường hợp cực kỳ hiếm (xung đột liên tục > 10 lần), trả về `OptimisticLockError` (500)
- `addPointsInTx` / `deductPointsInTx` cho phép caller lồng vào outer transaction
