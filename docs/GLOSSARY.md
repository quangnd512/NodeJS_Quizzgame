# GLOSSARY — Thuật ngữ kỹ thuật trong QuizzGame

---

## Practice Module (Ôn tập) — Thuật ngữ kỹ thuật

### Fisher-Yates Shuffle
**Định nghĩa**: Thuật toán xáo trộn mảng ngẫu nhiên — mỗi phần tử có xác suất xuất hiện ở bất kỳ vị trí nào là như nhau (uniform random).

**Trong dự án này**: Dùng trong `shuffle()` (`practice.service.ts`) để xáo trộn danh sách câu hỏi trước khi chọn 5 câu mỗi độ khó.

**Ví dụ**:
```
Mảng gốc: [A, B, C, D, E]
i=4: đổi chỗ D[4] với D[random(0..4)] → ví dụ: [A, B, E, D, C]
i=3: đổi chỗ D[3] với D[random(0..3)] → ví dụ: [A, D, E, B, C]
...kết quả: thứ tự ngẫu nhiên thực sự, không bị lệch xác suất
```

---

### Idempotency (Tính bất biến khi gọi lại)
**Định nghĩa**: Gọi một API nhiều lần với cùng tham số thì luôn cho kết quả như lần đầu — không tạo dữ liệu trùng lặp, không tính điểm 2 lần.

**Trong dự án này**: `submitAnswer` dùng `@@unique([sessionId, questionId])` trong DB. Nếu gọi lại cùng `sessionId + questionId`, Prisma throw lỗi P2002 → code catch lại → trả về kết quả cũ.

**Ví dụ**:
```
Request 1: POST /answer { sessionId: "X", questionId: "Q1", selected: 2 }
           → INSERT PracticeAnswer → trả về { isCorrect: true }

Request 2: POST /answer { sessionId: "X", questionId: "Q1", selected: 2 }  ← gọi lại
           → findUnique thấy đã có → trả về kết quả cũ { isCorrect: true }
           → KHÔNG INSERT thêm ✓
```

---

### Race Condition
**Định nghĩa**: Tình huống 2 request đến server cùng lúc, cả 2 đều đọc cùng 1 trạng thái rồi cùng ghi → xung đột.

**Trong dự án này**: Trong `submitAnswer`, 2 request cùng vượt qua kiểm tra idempotency (cả 2 thấy "chưa có answer") → cả 2 cùng INSERT → 1 thành công, 1 bị lỗi P2002 → code catch P2002 và trả về kết quả của request đã thành công.

**Ví dụ**:
```
Request A ──────────────────────► findUnique: "chưa có" → INSERT ✓
Request B ──────────────────────► findUnique: "chưa có" → INSERT → P2002
                                                                   ↓
                                                         catch P2002 → findUnique lại
                                                                   ↓
                                                         thấy record của A → trả về ✓
```

---

### Optimistic Locking (Khóa lạc quan)
**Định nghĩa**: Thay vì khóa bản ghi trước khi đọc (pessimistic lock), ta đọc dữ liệu kèm `version`, rồi khi ghi thì kiểm tra: nếu `version` trong DB vẫn bằng `version` đã đọc → ghi thành công; nếu khác → có người khác đã sửa trước → retry.

**Trong dự án này**: Bảng `user_points` có cột `version`. Khi cộng điểm:
```
1. Đọc: { currentPoints: 50, version: 3 }
2. Tính: newBalance = 53
3. UPDATE WHERE userId = X AND version = 3   ← điều kiện kiểm tra
         SET currentPoints = 53, version = 4
4. Nếu count = 0 → version đã thay đổi → retry từ bước 1
```

**Tại sao không dùng SELECT FOR UPDATE?**: Lock cứng sẽ chặn mọi request cùng user → bottleneck. Optimistic lock chỉ retry khi thật sự có xung đột (trường hợp hiếm).

---

### `addPointsInTx` vs `addPoints`
**Định nghĩa**: Hai method khác nhau để cộng điểm:
- `addPoints`: tự tạo `$transaction` bên trong — dùng khi điểm là thao tác duy nhất.
- `addPointsInTx`: nhận `tx` từ bên ngoài — dùng khi cần gộp cộng điểm vào cùng 1 transaction với thao tác khác.

**Trong dự án này**: `completeSession` dùng `addPointsInTx` để đảm bảo: nếu cộng điểm thất bại thì việc đánh dấu session `completedAt` cũng bị rollback lại — hai việc hoặc cùng thành công hoặc cùng thất bại (atomic).

---

### Redis Rate Limiting
**Định nghĩa**: Dùng Redis (bộ nhớ tốc độ cao) để đếm số lần thực hiện một hành động trong khoảng thời gian nhất định.

**Trong dự án này**: Mỗi user được tạo tối đa 10 phiên ôn tập/giờ. Key Redis: `ratelimit:practice:{userId}`, TTL = 3600 giây. Nếu counter >= 10 → throw `PracticeRateLimitError`.

**Tại sao Redis thay vì DB?**: Đếm trong DB đòi SELECT + UPDATE mỗi request → chậm. Redis đếm trong RAM → gần như tức thì. Và nếu Redis lỗi, code cố ý bỏ qua (fail-open) để không chặn user vì lý do kỹ thuật.

---

### Soft Delete
**Định nghĩa**: Không xóa thật sự khỏi DB mà chỉ đánh dấu `isActive = false`. Dữ liệu vẫn còn, có thể khôi phục.

**Trong dự án này**: `deleteQuestion` set `isActive = false`. Câu hỏi bị ẩn khỏi tất cả phiên ôn tập mới nhưng dữ liệu lịch sử vẫn nguyên vẹn (không vi phạm foreign key trong `practice_answers`).

---

### Auto-Hide (Tự động ẩn câu hỏi)
**Định nghĩa**: Khi số báo cáo PENDING của 1 câu đạt ngưỡng, hệ thống tự động ẩn câu đó mà không cần admin can thiệp.

**Trong dự án này**: Ngưỡng = 5 báo cáo PENDING (`AUTO_HIDE_REPORT_THRESHOLD`). Sau khi user `reportQuestion`, code đếm lại → nếu >= 5 → `question.isActive = false`.

---

## Bug đã phát hiện và fix trong quá trình review

### Bug: ID không nhất quán giữa lưu điểm và đọc điểm
**Triệu chứng**: Điểm cộng vào DB thành công nhưng `GET /api/users/me` vẫn trả về 0 điểm.

**Nguyên nhân**:
- `addPointsInTx` lưu điểm với `userId = User.id` (internal UUID)
- `getProfile` đọc điểm với `userId = User.firebaseUid` (Firebase UID khác hoàn toàn)
→ Query không tìm thấy bản ghi → trả về 0

**Fix**: `users.service.ts:158` — đổi `getBalance(user.firebaseUid)` thành `getBalance(user.id)`.

### Bug: Frontend không refresh điểm sau khi hoàn thành phiên
**Triệu chứng**: Điểm trên màn hình Profile không thay đổi dù đã cộng thành công.

**Nguyên nhân**: `handleComplete` trong `App.tsx` refresh stats và history nhưng không gọi lại `getMyProfile` để cập nhật `profile.points`.

**Fix**: Thêm `void getMyProfile(sessionToken).then(onProfileUpdate)` vào `handleComplete`.
