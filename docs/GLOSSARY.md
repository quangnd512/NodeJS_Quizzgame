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

## Admin Dashboard – Quản lý báo cáo câu hỏi — Thuật ngữ kỹ thuật

### Anti-spam qua `user_question_history` (chặn báo cáo câu chưa làm)
**Định nghĩa**: Trước khi cho phép tạo báo cáo, kiểm tra user đã từng có bản ghi
lịch sử làm bài cho câu hỏi đó chưa. Chưa làm → không cho báo cáo.

**Trong dự án này**: `reportQuestion()` gọi
`prisma.userQuestionHistory.findUnique({ where: { userId_questionId: { userId, questionId } } })`.
Nếu `null` → throw `QuestionNotAttemptedForReportError` (`403 QUESTION_NOT_ATTEMPTED_FOR_REPORT`).
Đây là cùng composite key đã dùng để chống trùng lặp ở `POST /practice/answer`,
nên không cần thêm bảng/cột mới.

**Ví dụ**:
```
User chưa từng làm câu Q5
  → POST /practice/questions/Q5/report { reason: "BAD_CONTENT" }
  → userQuestionHistory.findUnique({ userId, questionId: "Q5" }) === null
  → 403 QUESTION_NOT_ATTEMPTED_FOR_REPORT
```

**Tại sao cần?**: Nếu không chặn, 1 user có thể gửi nhiều báo cáo cho các câu
họ chưa từng thấy để cố tình đẩy số PENDING của 1 câu vượt
`AUTO_HIDE_REPORT_THRESHOLD` (xem [[Auto-Hide]]) → ẩn câu hỏi của người khác
một cách ác ý. Xem chi tiết quyết định ở `docs/adr/001-chan-bao-cao-cau-chua-lam.md`.

---

### Helper dùng chung `autoHideIfThresholdExceeded`
**Định nghĩa**: Refactor — gộp logic "đếm báo cáo PENDING rồi tự ẩn câu hỏi nếu
vượt ngưỡng" thành 1 method `private` dùng chung, thay vì lặp lại ở nhiều nơi.

**Trong dự án này**: Cả `reportQuestion()` (user gửi báo cáo mới) và
`updateReport()` (admin đổi trạng thái 1 báo cáo, có thể đưa nó về lại
`PENDING`) đều gọi `this.autoHideIfThresholdExceeded(questionId)` ở cuối. Helper
này còn `console.warn` mỗi lần auto-hide xảy ra, giúp dễ trace trong log.

**Tại sao gộp lại?**: Trước đây 2 nơi tự viết cùng đoạn `count` + `update`
giống nhau — nếu sau này đổi ngưỡng hoặc thêm log, dễ sửa thiếu 1 chỗ.

---

### Response shape "flatten" vs "nested" (breaking change)
**Định nghĩa**: Cách tổ chức field trong JSON response — "nested" là gom các
field liên quan vào 1 object con (`{ byStatus: { PENDING: 1, ... } }`),
"flatten" là đưa thẳng ra ngoài cùng cấp (`{ pending: 1, reviewed: 2, ... }`).

**Trong dự án này**: `GET /api/admin/questions/reports/summary` đổi từ
`{ byStatus: {...}, topReportedQuestions }` sang
`{ pending, reviewed, fixed, dismissed, topReportedQuestions }`. Đây là
**breaking change** — bất kỳ client cũ đọc `result.byStatus.PENDING` sẽ nhận
`undefined` sau khi đổi.

**Tại sao đổi?**: Dashboard FE cần đúng 4 số cho 4 thẻ thống kê — đọc
`summary.pending` trực tiếp gọn hơn `summary.byStatus.PENDING` và khớp với
`ReportStatus` đã định nghĩa (luôn đủ 4 khóa, không cần optional-check).

---

### Admin Dashboard dùng `sessionStorage` + `ADMIN_SECRET` (không qua Firebase)
**Định nghĩa**: Trang `/#admin` xác thực bằng một secret tĩnh gửi qua header
`X-Admin-Secret`, lưu ở `sessionStorage` (mất khi đóng tab) — hoàn toàn tách
biệt với luồng đăng nhập Firebase của user thường.

**Trong dự án này**: `App` đọc `window.location.hash === '#admin'` ngay lúc
khởi tạo state (`useState(() => ...)`) để bỏ qua `onAuthStateChanged` của
Firebase. `AdminLoginPage` không có endpoint "verify secret" riêng — nó gọi
thử `GET /reports/summary`; nếu trả `401`/`403` thì coi là sai secret.
`AdminReportsPage` cũng tự đăng xuất nếu bất kỳ request nào trả `401`/`403`
giữa phiên (secret bị thu hồi).

**Tại sao `sessionStorage` không phải `localStorage`?**: `sessionStorage` tự
xoá khi đóng tab — giảm rủi ro lộ secret trên máy dùng chung (máy tính công ty,
phòng net...).

---

### `parseJsonBody` — đọc response rỗng an toàn
**Định nghĩa**: Helper đọc `response.text()` trước, nếu rỗng thì trả `{}`,
nếu không thì `JSON.parse()`. Tránh lỗi khi gọi trực tiếp `response.json()`
trên body rỗng (ví dụ `204 No Content`, hoặc lỗi proxy trả body trống).

**Trong dự án này**: `frontend/src/lib/api.ts` — dùng trong `request()`,
`loginWithFirebaseToken()`, và `adminRequest()`. Trước đây gọi trực tiếp
`await res.json()` sẽ throw `SyntaxError: Unexpected end of JSON input` nếu
body rỗng, che mất lỗi HTTP thật (vd. `401`) bằng một lỗi parse JSON gây nhiễu.

---

---

## Exam Module (Thi Thử) — Thuật ngữ kỹ thuật

### Fair Exam Selection (Chọn đề công bằng / Round-Robin tự nhiên)
**Định nghĩa**: Thuật toán chọn đề thi sao cho user được tiếp xúc đều với tất cả các đề — không bị lặp lại đề cũ khi vẫn còn đề chưa làm.

**Trong dự án này**: `pickFairExamPaper()` trong `exam.service.ts`:
1. Lấy tất cả đề đang active và có ít nhất 1 câu hỏi
2. Đếm số lần user đã làm mỗi đề (từ bảng `ExamSession`)
3. Tìm số lần làm nhỏ nhất (minAttempts)
4. Random trong nhóm đề có số lần làm = minAttempts

```
User đã làm: Đề A (2 lần), Đề B (2 lần), Đề C (1 lần), Đề D (1 lần)
minAttempts = 1 → candidates = [C, D]
→ Random chọn C hoặc D (không bao giờ chọn A/B lúc này)
```

**Tại sao không dùng shuffle đơn thuần?**: Shuffle ngẫu nhiên có thể cho ra đề A 3 lần liên tiếp. Round-robin tự nhiên đảm bảo user trải qua hết tất cả đề ít nhất 1 lần trước khi bắt đầu vòng 2.

---

### ExamQuestionType (3 dạng câu hỏi thi thử)
**Định nghĩa**: Module thi thử hỗ trợ 3 dạng câu hỏi khác nhau, mỗi dạng có cấu trúc `options`/`correctAnswer` và cách chấm điểm riêng:

| Dạng | options | correctAnswer | Cách chấm |
|------|---------|---------------|-----------|
| `MCQ_4` | 4 string (A/B/C/D) | số 0-3 | Đúng = full điểm, Sai = 0 |
| `TRUE_FALSE_4` | 4 string (4 phát biểu) | 4 boolean | Điểm theo tỉ lệ số ý đúng (xem TRUE_FALSE_SCORE_RATIOS) |
| `FILL_BLANK` | null | mảng string (các đáp án chấp nhận) | Khớp 1 đáp án = full điểm (có normalize) |

**Trong dự án này**: `validateQuestionShape()` trong `exam.service.ts` kiểm tra format trước khi lưu. `gradeQuestion()` chấm điểm theo đúng dạng.

---

### TRUE_FALSE_SCORE_RATIOS (Chấm điểm từng phần)
**Định nghĩa**: Bảng tỉ lệ điểm cho dạng TRUE_FALSE_4 — học sinh đúng bao nhiêu ý trong 4 ý thì được bao nhiêu % điểm của câu đó.

**Trong dự án này** (`exam.types.ts`):
```
[0, 0.1, 0.25, 0.5, 1]
 ↑    ↑    ↑    ↑   ↑
0ý  1ý   2ý   3ý  4ý
```
Ví dụ: câu worth 4 điểm, học sinh đúng 3/4 ý → 4 × 0.5 = **2 điểm**.

---

### normalizeAnswer (Chuẩn hóa đáp án FILL_BLANK)
**Định nghĩa**: Trước khi so sánh đáp án tự điền của học sinh với đáp án đúng, chuẩn hóa cả hai về dạng giống nhau để tránh sai vì khoảng trắng thừa hoặc chữ hoa/thường.

**Trong dự án này** (`exam.service.ts`):
```typescript
value.trim().toLowerCase().replace(/\s+/g, ' ')
```
```
"  Hà Nội  " → "hà nội"
"HÀ NỘI"    → "hà nội"
"hà  nội"   → "hà nội"   ← gộp khoảng trắng giữa
Tất cả đều match với đáp án đúng "hà nội" ✓
```

---

### EXAM_GRACE_SECONDS (Thời gian ân hạn)
**Định nghĩa**: Số giây cộng thêm vào thời gian làm bài trước khi hệ thống đánh dấu phiên là EXPIRED. Cho phép nộp bài trong khoảng trễ mạng bình thường.

**Trong dự án này**: `EXAM_GRACE_SECONDS = 30`. Công thức:
```
deadline = startedAt + durationMinutes × 60s + 30s
```
Nếu `Date.now() > deadline` → trả `ExamExpiredError`, không chấm điểm.

**Tại sao cần?**: Nếu học sinh bấm "Nộp bài" đúng lúc hết giờ, request mất 1-2 giây để đến server — không có grace period thì bị từ chối oan.

---

### durationMinutes Snapshot (Snapshot thời gian làm bài)
**Định nghĩa**: Khi tạo `ExamSession`, hệ thống copy giá trị `durationMinutes` từ `ExamPaper` vào session — thay vì đọc trực tiếp từ đề thi mỗi lần.

**Trong dự án này**: Nếu admin sửa thời gian làm bài của đề từ 90 phút xuống 45 phút sau khi học sinh đã bắt đầu thi, học sinh đó vẫn có đủ 90 phút (theo snapshot đã lưu). Không bị ảnh hưởng bởi thay đổi sau.

---

### deductPointsInTx (Trừ điểm trong transaction ngoài)
**Định nghĩa**: Method mới thêm vào `PointsService` — tương tự `addPointsInTx` nhưng để trừ điểm. Dùng khi cần trừ điểm ATOMIC cùng với các thao tác khác trong 1 transaction.

**Trong dự án này**: `startExam` cần trừ 60 điểm phí VÀ tạo ExamSession trong cùng 1 transaction — nếu tạo session thất bại thì việc trừ điểm cũng phải rollback:
```
$transaction:
  1. deductPointsInTx(tx, userId, 60, ...)  ← trừ 60 điểm
  2. tx.examSession.create(...)              ← tạo phiên thi
  Nếu bước 2 fail → bước 1 cũng rollback → user không bị mất điểm
```

---

### Partial Success Import (Import thành công một phần)
**Định nghĩa**: Khi import nhiều dòng từ Excel, những dòng hợp lệ được lưu ngay, những dòng lỗi được báo cáo kèm số dòng — không vì 1 dòng lỗi mà hủy toàn bộ.

**Trong dự án này** (`exam-import.service.ts`): Kết quả trả về:
```json
{
  "inserted": 48,
  "errors": [
    { "row": 5, "message": "Loại câu hỏi 'XYZ' không hợp lệ" },
    { "row": 23, "message": "Điểm phải là số dương" }
  ]
}
```
Admin biết chính xác dòng nào lỗi để sửa và import lại riêng phần đó.

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
