# Handoff từ S8-GiamSat → S2-ThoCode

**Thời gian:** 2026-07-05  
**Branch:** feature/wrong-answer-review

---

[TỪ S8-GIAMSAT]

↩️ YÊU CẦU LÀM LẠI (nhỏ): Ôn Câu Sai — Fix unit test mock
🌿 BRANCH: feature/wrong-answer-review

---

## 📌 BỐI CẢNH

Code `retryQuestion()` có 2 dòng sau (dòng 252 và 259):

```typescript
if (isCorrect) await prisma.wrongAnswer.update({ where: { id }, data: { expiresAt: now } });
```

Đây là **yêu cầu của người dùng** (S5 xác nhận): khi làm lại đúng → set `expiresAt = NOW()` → câu biến mất khỏi danh sách sau khi reload. **KHÔNG xóa đoạn code này.**

---

## ⚠️ VẤN ĐỀ CẦN SỬA

**Unit test FAIL: 3/18**

File: `backend/src/services/wrongAnswer/__tests__/wrongAnswer.service.test.ts`

Mock Prisma hiện tại thiếu `wrongAnswer.update` → 3 test case Happy Path của `retryQuestion` bị lỗi:

```
TypeError: prisma.wrongAnswer.update is not a function
```

Test FAIL:
- `retryQuestion > MCQ_4 practice — đáp án đúng`
- `retryQuestion > TRUE_FALSE_4 exam — tất cả 4 ý đúng`
- `retryQuestion > FILL_BLANK — đáp án khớp sau normalize`

---

## ✅ FIX YÊU CẦU

**Thêm `update: vi.fn().mockResolvedValue({})` vào phần mock `wrongAnswer` trong file test.**

Tìm chỗ mock `prisma.wrongAnswer` (gần đầu file, trong `vi.mock(...)` block), thêm `update` vào:

```typescript
wrongAnswer: {
  upsert: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn().mockResolvedValue({}),   // ← THÊM DÒNG NÀY
},
```

Sau đó, nếu muốn test chắc hơn, có thể thêm assertion trong 3 test "Happy path":
```typescript
// Xác nhận update được gọi đúng khi isCorrect = true
expect(prismaMock.wrongAnswer.update).toHaveBeenCalledWith({
  where: { id: <id> },
  data: { expiresAt: expect.any(Date) },
});
```
(Không bắt buộc nếu test quá phức tạp — chỉ cần 18/18 PASS là đủ.)

---

## 📋 KIỂM TRA SAU KHI SỬA

```bash
cd backend && npm test
```

Kết quả mong đợi: **18/18 PASS, 0 FAIL**

---

## 👉 SAU KHI XONG

Báo lại trực tiếp cho **S8-GiamSat** với kết quả `npm test`.
