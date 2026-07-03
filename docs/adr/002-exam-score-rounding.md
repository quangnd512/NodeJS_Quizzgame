# ADR 002: Công thức tính điểm thi thử và cách làm tròn an toàn

## Bối cảnh

Module thi thử cần quy đổi điểm thô (tổng điểm đạt được / tổng điểm tối đa) về
thang điểm 10 (1 chữ số thập phân), rồi dùng điểm này để tra bảng thưởng điểm:

| Điểm | Thưởng |
|------|--------|
| < 7.0 | 0 |
| 7.0–7.9 | 10 |
| 8.0–8.9 | 20 |
| 9.0–9.9 | 50 |
| 10.0 | 120 |

## Vấn đề phát hiện trong review

Công thức ban đầu:
```typescript
Math.round((totalEarned / totalPoints) * 100) / 10
```

Gây ra bug tại các biên .5:
```
totalEarned=199, totalPoints=200
→ (199/200) × 100 = 99.5
→ Math.round(99.5) = 100   ← làm tròn lên trước
→ 100 / 10 = 10.0
→ getExamBonusPoints(10.0) → 120 điểm thưởng  ← SAI, đáng ra 50
```

Tương tự tại 6.95, 7.95, 8.95 (nhảy lên tier trên một cách không mong muốn).

## Quyết định

Dùng `Math.floor` thay vì `Math.round`:
```typescript
const score = totalPoints > 0
  ? Math.floor((totalEarned / totalPoints) * 100) / 10
  : 0;
```

`Math.floor` làm tròn XUỐNG — 99.5% → 9.9, không bao giờ nhảy lên tier 10.

## Lý do chọn floor thay vì các phương án khác

**Phương án A — Math.floor (đã chọn)**:
- Làm tròn xuống → không bao giờ lợi hơn điểm thực
- Nhất quán với thông lệ giáo dục VN (điểm 6.95 = 6.9, không phải 7.0)
- Đơn giản, dễ hiểu

**Phương án B — `toFixed(1)` rồi `parseFloat`**:
- `(9.95).toFixed(1)` có thể cho `"9.9"` hoặc `"10.0"` tùy JS engine (floating-point)
- Không đảm bảo deterministic trên mọi môi trường

**Phương án C — Tính toán trước rồi mới làm tròn**:
- `Math.floor(ratio * 10) / 10` — tương đương phương án A, chỉ khác cách viết

## Hệ quả

Học sinh với điểm thực 99.5% nhận 9.9 (thưởng 50 điểm), không phải 10.0 (thưởng 120 điểm). Đây là hành vi đúng theo thiết kế bảng thưởng.
