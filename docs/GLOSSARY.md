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

## Ngân hàng câu hỏi (Question Bank) — Thuật ngữ kỹ thuật

### Fisher-Yates Shuffle (autoFillFromBank)
**Định nghĩa**: Thuật toán xáo trộn mảng đảm bảo mỗi phần tử có xác suất bằng nhau để xuất hiện ở bất kỳ vị trí nào — không bị lệch xác suất như `sort(() => Math.random() - 0.5)`.

**Trong dự án này**: Dùng trong `autoFillFromBank()` (`question-bank.service.ts:401`) — sau khi lấy danh sách câu hỏi theo độ khó từ DB, xáo mảng rồi `slice(0, need)` để lấy N câu ngẫu nhiên thực sự.

**Cách hoạt động** (mảng 5 câu [A, B, C, D, E], cần 3 câu):
```
Bước i=4: j=random(0..4)=2  →  đổi chỗ E ↔ C  →  [A, B, E, D, C]
Bước i=3: j=random(0..3)=0  →  đổi chỗ D ↔ A  →  [D, B, E, A, C]
Bước i=2: j=random(0..2)=2  →  đổi chỗ E ↔ E  →  [D, B, E, A, C]
Bước i=1: j=random(0..1)=0  →  đổi chỗ B ↔ D  →  [B, D, E, A, C]

slice(0, 3) → lấy [B, D, E]
```

**Tại sao không dùng `ORDER BY RANDOM()` ở SQL?**
```
SQL RANDOM():  sort toàn bộ bảng → O(N log N) → chậm khi kho lớn
Fisher-Yates:  xáo mảng JS đã lấy về → O(N) tuyến tính → nhanh hơn
```

---

### Transaction (Giao dịch nguyên tử)
**Định nghĩa**: Nhóm nhiều thao tác DB thành một khối "tất cả thành công hoặc tất cả thất bại" — không bao giờ bị dừng giữa chừng dẫn đến dữ liệu không nhất quán.

**Trong dự án này**: Dùng ở 2 nơi quan trọng:

1. `addFromBank` / `autoFillFromBank` — tránh race condition khi 2 admin thêm câu vào cùng 1 đề cùng lúc:
```
Không có TX:
  Admin A đọc "đề chưa có câu nào" → insert 10 câu ✓
  Admin B đọc "đề chưa có câu nào" → insert 10 câu ✓ (TRÙNG!)

Với TX:
  Admin A [TX bắt đầu]──── đọc + insert ──── [TX kết thúc] ✓
  Admin B              ────── chờ A xong ──── [TX bắt đầu] → 0 câu thêm (đã có rồi)
```

2. `deleteQuestion` — tránh khoảng hở giữa "kiểm tra session" và "xoá":
```
Không có TX:
  Kiểm tra: "không có session IN_PROGRESS" → OK
  ← học sinh bắt đầu session mới ngay lúc này! →
  Xoá câu hỏi → câu trong session đang thi bị mất!

Với TX:
  Kiểm tra + xoá là 1 thao tác liền mạch → không có kẽ hở
```

---

### ON DELETE SET NULL (FK nullable)
**Định nghĩa**: Khi xoá bản ghi cha (QuestionBank), DB tự động đặt cột `questionBankId = NULL` trên các bản ghi con (ExamQuestion) thay vì xoá chúng.

**Trong dự án này** (`schema.prisma:376`): Quan hệ `ExamQuestion → QuestionBank` là nullable. Khi admin xoá câu hỏi khỏi kho:
```
Trước khi xoá:
  QuestionBank [Q1] ──────► ExamQuestion [EQ1] → ExamAnswer (học sinh đã làm)

Sau khi xoá (SET NULL):
  QuestionBank [Q1] ✗        ExamQuestion [EQ1] → ExamAnswer (vẫn nguyên!)
                               questionBankId = NULL
                               questionText/options/correctAnswer vẫn còn đủ
```

**Tại sao không dùng ON DELETE CASCADE?**
```
CASCADE: xoá Q1 → xoá luôn EQ1 → ExamAnswer trỏ vào EQ1 không còn tồn tại
       → điểm thi của học sinh bị hỏng / mất dữ liệu lịch sử
```
Khi `addFromBank` copy câu vào đề thi, nó **copy toàn bộ nội dung** (questionText, options, correctAnswer...) vào ExamQuestion — không chỉ lưu ID. Nên dù nguồn gốc bị xoá, nội dung vẫn còn nguyên. Xem chi tiết: `docs/adr/003-question-bank-fk-set-null.md`.

---

### Hard Delete có Guard (Xoá thật với bảo vệ)
**Định nghĩa**: Xoá thật sự khỏi DB (không phải soft delete `isActive=false`), nhưng kiểm tra điều kiện trước — nếu không an toàn thì từ chối với lỗi rõ ràng.

**Trong dự án này**: `deleteQuestion()` kiểm tra xem có `ExamSession` nào đang `IN_PROGRESS` tham chiếu đến câu hỏi không. Nếu có → throw `QuestionBankDeleteBlockedError` (400) — admin phải chờ phiên đó kết thúc.

**Luồng admin xoá câu hỏi an toàn**:
```
1. GET /api/admin/question-bank/:id/usage  ← xem câu đang dùng ở đề nào
2. Nếu có session IN_PROGRESS → đợi hoặc không xoá
3. DELETE /api/admin/question-bank/:id      ← xoá thật
4. ExamQuestion giữ lại nội dung, questionBankId = NULL (ON DELETE SET NULL)
```

---

### Idempotent Seed Script (`sourceQuestionId @unique`)
**Định nghĩa**: Script có thể chạy nhiều lần mà không tạo dữ liệu trùng lặp — mỗi lần chạy cho kết quả giống lần đầu.

**Trong dự án này**: `QuestionBank.sourceQuestionId` có ràng buộc `@unique`. Seed script import câu từ module Ôn tập vào kho — nếu câu đã có trong kho (`sourceQuestionId` đã tồn tại), Prisma throw `P2002` → script bỏ qua, không insert thêm. Chạy lại 100 lần cũng không sinh duplicate.

---

### Phân phối độ khó 50/30/20 (AutoFill ratio)
**Định nghĩa**: Quy tắc tỉ lệ câu hỏi theo độ khó khi tự động lấy từ kho.

**Trong dự án này** (`question-bank.service.ts:347`):
```typescript
const easyCount   = Math.round(count * 0.5);
const mediumCount = Math.round(count * 0.3);
const hardCount   = count - easyCount - mediumCount;  // ← phần còn lại
```

`hardCount` lấy phần còn lại (không dùng `Math.round(count * 0.2)`) để đảm bảo tổng 3 mức **luôn bằng chính xác `count`** — tránh sai 1 câu do làm tròn số lẻ:
```
count=7: round(3.5)=4, round(2.1)=2, 7-4-2=1  → tổng = 7 ✓
         (nếu round(1.4)=1 thì 4+2+1=7 cũng đúng, nhưng
          với count khác có thể ra 4+2+2=8 ✗ → không dùng)
```

---

## Leaderboard (Bảng Xếp Hạng) — Thuật ngữ kỹ thuật

### Điểm Uy Tín (Reputation Score)
**Định nghĩa**: Chỉ số xếp hạng tổng hợp, không chỉ dựa vào điểm trung bình mà còn phạt sự không ổn định và số lần thi ít.

**Công thức**:
```
Điểm Uy Tín = (Trung Bình - 0.5 × Độ Dao Động) × (1 - 1/(n+1))
```
- **Trung Bình**: AVG(score) của các ExamSession COMPLETED
- **Độ Dao Động**: STDDEV_POP(score) — bằng 0 nếu chỉ thi 1 lần
- **n**: số lần thi thành công

**Tại sao không dùng điểm trung bình thuần?**: Dễ bị gian lận — user thi 1 lần may mắn đạt 10/10 sẽ đứng đầu mãi. Điểm Uy Tín phạt cả sự không ổn định lẫn số lần thi ít:
```
Bạn A: 10, 10, 10, 10, 10 (5 lần)  → Uy Tín = (10 - 0) × (1-1/6)  = 8.33
Bạn B: 8.5 điểm TB, ổn định (10 lần) → Uy Tín = (8.25) × (1-1/11) = 7.50
```

---

### CTE (Common Table Expression) — Mệnh đề WITH
**Định nghĩa**: Cách đặt tên cho một đoạn SELECT để dùng lại trong cùng query — giống tạo "bảng tạm" trong RAM, không lưu xuống đĩa.

**Trong dự án này**: `leaderboard.service.ts` dùng 4 CTE nối tiếp nhau:
```sql
WITH current_scores AS (...)   -- Bước 1: tính Điểm Uy Tín mỗi user
     current_ranks  AS (...)   -- Bước 2: xếp hạng từ kết quả Bước 1
     old_scores     AS (...)   -- Bước 3: tính Điểm Uy Tín 30 ngày trước
     old_ranks      AS (...)   -- Bước 4: xếp hạng 30 ngày trước
SELECT ... FROM current_ranks JOIN old_ranks ...
```

**Tại sao không dùng subquery lồng nhau?**: CTE đọc như truyện — từng bước rõ ràng. Subquery lồng nhau rất khó đọc và debug.

---

### Window Function — ROW_NUMBER() OVER
**Định nghĩa**: Hàm tính toán trên "cửa sổ" gồm nhiều row, thêm kết quả như một cột mới mà không thu gọn số row như `GROUP BY`.

**Trong dự án này**: Dùng để xếp hạng toàn bộ user theo Điểm Uy Tín:
```sql
ROW_NUMBER() OVER (
  ORDER BY reputation_score DESC,
  last_completed_at DESC    -- tie-breaking: ai thi gần nhất lên trước
)::int AS current_rank
```

**Ví dụ**:
```
Dữ liệu thô:           Sau ROW_NUMBER():
  user_B: 9.2  →  rank 1
  user_A: 8.5  →  rank 2
  user_C: 7.1  →  rank 3
```
Khác với `ORDER BY` thông thường: Window Function **thêm cột mới** trong khi giữ nguyên toàn bộ các cột khác.

---

### Prisma.$queryRaw và Prisma.sql
**Định nghĩa**: `$queryRaw` cho phép viết SQL thuần trong Prisma khi ORM không hỗ trợ cú pháp phức tạp. `Prisma.sql` là tagged template literal bảo vệ khỏi SQL injection.

**Trong dự án này**: Dùng vì Prisma ORM không hỗ trợ Window Function và CTE nhiều tầng. `subjectClause()` dùng `Prisma.sql` để lọc theo môn học an toàn:
```typescript
// NGUY HIỂM (SQL injection):
`AND "subjectId" = '${subject}'`

// AN TOÀN — Prisma tách SQL và data thành 2 phần riêng biệt:
Prisma.sql`AND "subjectId" = ${subject}`
```
PostgreSQL nhận tham số qua bind parameter, không bao giờ hiểu data như SQL.

---

### Trend (Xu hướng xếp hạng)
**Định nghĩa**: So sánh hạng hiện tại với hạng tính từ dữ liệu trước 30 ngày, cho ra 4 trạng thái: `up` / `down` / `same` / `new`.

**Trong dự án này**:
```
old_rank > current_rank → 'up'   (hạng số nhỏ hơn = tốt hơn)
old_rank < current_rank → 'down'
old_rank = current_rank → 'same'
old_rank = null         → 'new'  (chưa có dữ liệu 30 ngày trước)
```
Hiển thị trên FE: `↑` (xanh) / `↓` (đỏ) / `→` (xám) / `—` (xám).

---

### Podium Reordering (Sắp xếp lại bục Top 3)
**Định nghĩa**: Đảo thứ tự mảng Top 3 từ [1,2,3] thành [2,1,3] để render bục podium đúng quy ước "hạng 1 ở giữa cao nhất".

**Trong dự án này** (`App.tsx`):
```typescript
const podiumOrder = [top3[1], top3[0], top3[2]];
//                   Hạng 2   Hạng 1   Hạng 3
//                   Trái     Giữa     Phải
```
Chiều cao bục theo index visual `[0,1,2]` = `['52px','80px','36px']` — hạng 2 thấp, hạng 1 cao nhất, hạng 3 thấp nhất.

---

### Sticky My Rank Bar (Thanh ghim "Hạng của tôi")
**Định nghĩa**: Thanh cố định ở cuối màn hình hiển thị hạng của user hiện tại khi entry của họ chưa xuất hiện trong danh sách đã load.

**Trong dự án này**: Hiện khi `myRank !== null && !myEntryLoaded`. Khi user scroll và load đến trang chứa entry của mình, `myEntryLoaded` chuyển thành `true` → thanh ghim tự ẩn để tránh hiển thị 2 lần.

---

### Promise.all (Gọi song song)
**Định nghĩa**: Chạy nhiều Promise đồng thời, chờ tất cả hoàn thành — tổng thời gian bằng Promise chậm nhất, không cộng dồn.

**Trong dự án này** (`LeaderboardPage`):
```typescript
const [lb, me] = await Promise.all([
  getLeaderboard(sessionToken, p, subj),
  p === 1 ? getMyLeaderboardRank(sessionToken, subj) : Promise.resolve(null),
]);
// getLeaderboard: ~200ms  ─┐ chạy song song
// getMyRank:      ~150ms  ─┘ tổng = 200ms (thay vì 350ms)
```
`getMyRank` chỉ gọi ở trang 1 — hạng của mình không đổi khi load thêm trang.

---

## Kiến trúc tổng thể & Pattern toàn dự án — Thuật ngữ kỹ thuật

### Two-Layer Auth (Xác thực 2 lớp: Firebase + JWT nội bộ)
**Định nghĩa**: Dùng Firebase ID Token chỉ một lần khi đăng nhập để xác minh danh tính, sau đó phát JWT nội bộ cho mọi request tiếp theo — không gọi lại Firebase mỗi request.

**Trong dự án này**:
- `POST /api/auth/login`: nhận Firebase token → xác thực qua Firebase SDK → phát JWT nội bộ (7 ngày)
- Mọi API khác: nhận JWT nội bộ → xác thực bằng toán học (`jwt.verify`) → tra cứu DB bằng `userId` thẳng

**Tại sao?**: Firebase xác thực qua mạng (~100–300ms/request, tốn tiền API). JWT nội bộ xác thực offline bằng chữ ký HMAC (< 1ms). Xem chi tiết: `docs/adr/004-two-layer-auth.md`.

---

### Selective Sync (Đồng bộ có chọn lọc)
**Định nghĩa**: Khi user đăng nhập lại, chỉ cập nhật một số field từ Firebase vào DB — không ghi đè toàn bộ để bảo vệ dữ liệu user tự chỉnh sửa.

**Trong dự án này** (`auth.service.ts`):
```
Firebase mỗi lần đăng nhập:
  email       → CẬP NHẬT nếu khác (Firebase là nguồn sự thật cho email)
  lastLoginAt → LUÔN cập nhật = thời điểm hiện tại
  displayName → KHÔNG cập nhật (user có thể đổi tên trong app)
  phone       → KHÔNG cập nhật (user tự quản lý)
```
Nếu ghi đè `displayName` từ Google mỗi lần đăng nhập → user mất tên tùy chỉnh trong QuizzGame.

---

### Graceful Degradation (Suy giảm từ tốt)
**Định nghĩa**: Khi một thành phần phụ bị lỗi, hệ thống vẫn tiếp tục hoạt động với tính năng chính — chỉ mất tính năng phụ, không crash toàn bộ.

**Trong dự án này**: Redis dùng cho rate limiting. Nếu Redis mất kết nối:
```typescript
} catch (err) {
  if (err instanceof PracticeRateLimitError) throw err; // lỗi nghiệp vụ → throw
  console.warn('Redis lỗi, bỏ qua rate limit');         // lỗi Redis → bỏ qua
}
```
User vẫn dùng được app bình thường — chỉ không bị rate limit, chấp nhận được.

Cũng áp dụng cho `verifyFirebaseToken`: nếu lookup User DB lỗi → log + tiếp tục, không từ chối request có Firebase token hợp lệ.

---

### Lazy Initialization (Khởi tạo lười biếng)
**Định nghĩa**: Không tạo bản ghi ngay khi user đăng ký mà tạo lần đầu tiên khi thực sự cần — tiết kiệm storage cho user "zombie" chưa bao giờ dùng tính năng.

**Trong dự án này**: Bảng `user_points` không được tạo khi user đăng ký. Lần đầu cộng/trừ điểm, `ensureUserPointsRecord()` dùng `upsert`:
```typescript
await tx.userPoints.upsert({
  where: { userId },
  update: {},                               // đã có → chỉ đọc, không sửa
  create: { userId, currentPoints: 0, version: 0 }, // chưa có → tạo mới
});
```
`upsert` là atomic ở mức DB — không có race condition như `findOrCreate` thủ công.

---

### Consistent Lock Ordering (Thứ tự khóa nhất quán — chống Deadlock)
**Định nghĩa**: Khi cần khóa nhiều bản ghi trong cùng transaction, luôn khóa theo cùng một thứ tự cố định — không phụ thuộc vào chiều của giao dịch.

**Trong dự án này** (`points.service.ts` — `transferPoints`):
```typescript
// Dù chuyển A→B hay B→A, luôn khóa userId nhỏ hơn về alphabet trước:
const [firstId, secondId] = [fromUserId, toUserId].sort();
```
```
Không sort: A→B khóa A rồi B  |  B→A khóa B rồi A  → deadlock!
Có sort:    A→B khóa A rồi B  |  B→A khóa A rồi B  → không bao giờ deadlock ✓
```
Đây là giải pháp kinh điển cho bài toán "Triết gia ăn tối" (Dining Philosophers) trong CS. Xem chi tiết: `docs/adr/006-deadlock-prevention.md`.

---

### Thundering Herd + Jitter (Bầy thú sấm sét + Nhiễu ngẫu nhiên)
**Định nghĩa**: Thundering herd là hiện tượng nhiều request thất bại cùng retry vào đúng cùng lúc — gây xung đột tiếp. Jitter là thêm độ trễ ngẫu nhiên để trải chúng ra theo thời gian.

**Trong dự án này** (`points.service.ts:82`):
```typescript
function delayWithJitter(): Promise<void> {
  const ms = 10 + Math.random() * 40; // 10–50ms ngẫu nhiên
  return new Promise(resolve => setTimeout(resolve, ms));
}
```
```
Không jitter: 100 request thất bại → cùng retry sau 30ms → 100 request xung đột lại
Có jitter:    100 request thất bại → retry sau 10ms, 23ms, 47ms... → trải đều → ít xung đột
```

---

### Object.setPrototypeOf trong Custom Error
**Định nghĩa**: Dòng bắt buộc khi extend `Error` trong TypeScript để đảm bảo `instanceof` hoạt động đúng.

**Vấn đề**: TypeScript compile `class extends Error` sang ES5, trong đó `Error.call(this)` trả về object mới thay vì `this` → `instanceof MyError` trả về `false` dù đúng kiểu.

**Trong dự án này** (`points.service.ts`, `auth.errors.ts`...):
```typescript
class OptimisticLockRetrySignal extends Error {
  constructor() {
    super('OPTIMISTIC_LOCK_RETRY_SIGNAL');
    this.name = 'OptimisticLockRetrySignal';
    Object.setPrototypeOf(this, OptimisticLockRetrySignal.prototype); // ← bắt buộc
  }
}
// Nếu thiếu dòng trên: err instanceof OptimisticLockRetrySignal === false ❌
```

---

### TypeScript `satisfies` keyword
**Định nghĩa**: Kiểm tra object có thỏa mãn một kiểu không, nhưng giữ nguyên kiểu cụ thể (narrow type) của từng field — khác với type annotation (`:`) làm mất thông tin kiểu cụ thể.

**Trong dự án này** (`points.service.ts:249`):
```typescript
return {
  fromUserId, toUserId, amount,
  fromBalanceAfter: fromNewBalance,
  toBalanceAfter:   toNewBalance,
} satisfies TransferResult;
```

**Khác nhau với `: TransferResult`**:
```typescript
// Dùng : TransferResult → TypeScript ép về TransferResult, mất narrow type
const r1: TransferResult = { ... };
r1.fromUserId; // type: string (mất thông tin cụ thể)

// Dùng satisfies → kiểm tra + giữ nguyên narrow type
const r2 = { ... } satisfies TransferResult;
r2.fromUserId; // type cụ thể vẫn còn
```

---

## Progress Dashboard (Tiến độ học tập) — Thuật ngữ kỹ thuật

### Streak (Chuỗi ngày học liên tục)
**Định nghĩa**: Số ngày liên tiếp mà người dùng có ít nhất 1 phiên ôn tập hoàn thành.

**Trong dự án này**: Tính trong `computeStreaks()` (`progress.service.ts`). Có 2 loại:
- `currentStreak`: chuỗi đang chạy tính từ hôm nay hoặc hôm qua
- `bestStreak`: chuỗi dài nhất trong toàn bộ lịch sử

**Ví dụ**:
```
Ngày học: [04/07, 03/07, 02/07, 30/06]
currentStreak = 3 (04→03→02/07 liên tiếp)
bestStreak    = 3 (chuỗi dài nhất)

Nếu hôm nay (04/07) chưa học, nhưng hôm qua (03/07) có học:
currentStreak vẫn = 1 (hôm qua) — không reset về 0 ngay
```

---

### Promise.all (Xử lý song song)
**Định nghĩa**: Gửi nhiều tác vụ bất đồng bộ cùng một lúc và chờ tất cả hoàn thành. Tổng thời gian = tác vụ chậm nhất (không phải tổng cộng).

**Trong dự án này**: `getSummary` (`progress.service.ts`) dùng `Promise.all` để chạy 9 query DB song song thay vì tuần tự.

**Ví dụ**:
```
Tuần tự: 50ms + 40ms + 60ms + ... = ~400ms tổng
Song song (Promise.all): chờ query chậm nhất ~60ms → tổng ≈ 60ms

9 query trong getSummary:
  [0] practiceSessions (để tính streak)
  [1] totalExamCount
  [2] userPoints
  [3] thisMonthPracticeCount
  [4] lastMonthPracticeCount
  [5] thisMonthExamScores
  [6] lastMonthExamScores
  [7] scoreTrendRaw (30 phiên gần nhất)
  [8] practiceStatsBySubject
```

---

### Sparkline (Biểu đồ xu hướng mini)
**Định nghĩa**: Biểu đồ đường nhỏ gọn, không có trục, dùng để thể hiện xu hướng tăng/giảm theo thời gian.

**Trong dự án này**: Component `ScoreSparkline` (`App.tsx`) tự vẽ bằng SVG thuần — không dùng thư viện. Normalize điểm về khoảng [0, H-8] pixels để vừa khung.

**Ví dụ**:
```
Điểm: [6, 7, 5, 8, 9]   min=5, max=9, range=4
toY(9) = đỉnh SVG (gần 0px)
toY(5) = đáy SVG (gần 60px)
→ vẽ đường polyline nối 5 điểm + tô màu phần dưới đường
```

---

### Pagination (Phân trang)
**Định nghĩa**: Chia danh sách lớn thành nhiều trang nhỏ, mỗi lần chỉ tải một số bản ghi nhất định.

**Trong dự án này**: `getExamHistory` dùng `limit` + `offset`. Frontend dùng thêm `examPage` (số trang hiện tại) nhân với `EXAM_PAGE_SIZE=6` để tính offset.

**Ví dụ**:
```
Trang 0: offset=0,  lấy bản ghi 1-6
Trang 1: offset=6,  lấy bản ghi 7-12
Trang 2: offset=12, lấy bản ghi 13-18
Clamp: limit tối đa 50 (tránh tải quá nhiều), offset tối thiểu 0
```

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

---

## Ôn Câu Sai (Wrong Answer Review) — Thuật ngữ kỹ thuật

### Upsert
**Định nghĩa**: Thao tác kết hợp "UPDATE nếu đã tồn tại, INSERT nếu chưa có" — thực hiện trong một câu lệnh SQL duy nhất, an toàn với race condition.

**Trong dự án này**: Dùng trong `upsertWrongAnswer()` để ghi nhận câu sai. Nếu user làm sai cùng một câu lần 2, thay vì INSERT thêm dòng mới thì `wrongCount` được cộng thêm 1 và `expiresAt` được gia hạn thêm 14 ngày.

**Ví dụ**: User làm sai câu q1 lần 1 → INSERT (wrongCount=1). Làm sai lần 2 → UPDATE (wrongCount=2, expiresAt mới).

---

### TTL (Time-To-Live)
**Định nghĩa**: "Thời gian sống" — một bản ghi tự động bị coi là hết hạn sau một khoảng thời gian nhất định, thay vì bị xóa thực sự khỏi DB.

**Trong dự án này**: Mỗi câu sai có trường `expiresAt = lastWrongAt + 14 ngày`. Khi query, chỉ lấy các record có `expiresAt > now`. Câu sai tự "biến mất" sau 14 ngày mà không cần job dọn dẹp định kỳ.

**Ví dụ**: Làm sai ngày 1/7 → expiresAt = 15/7. Ngày 16/7 mở app, câu đó không còn xuất hiện nữa.

---

### Soft Expiry (Xóa mềm bằng thời gian)
**Định nghĩa**: Kỹ thuật "xóa" một bản ghi bằng cách đặt `expiresAt = now` thay vì DELETE thật — bản ghi vẫn còn trong DB nhưng sẽ không bao giờ được query ra nữa.

**Trong dự án này**: Trong `retryQuestion()`, khi user trả lời đúng, code chạy `UPDATE wrongAnswer SET expiresAt = now WHERE id = ?`. Câu đó ngay lập tức "biến mất" khỏi danh sách ôn, nhưng lịch sử vẫn còn nguyên trong DB.

**Tại sao không DELETE?**: Giữ lại bản ghi giúp tránh race condition và dễ audit sau này nếu cần thống kê.

---

### Dual FK (Hai Foreign Key song song)
**Định nghĩa**: Một bảng có hai cột FK tới hai bảng khác nhau, nhưng mỗi record chỉ dùng đúng một trong hai — cái còn lại là NULL.

**Trong dự án này**: Bảng `WrongAnswer` có cả `questionId` (FK → bảng `Question` của Practice) và `examQuestionId` (FK → bảng `ExamQuestion` của Exam). Một câu sai từ luyện tập có `questionId`, còn `examQuestionId = NULL`; và ngược lại.

**Ví dụ**:
```
id | userId | questionId | examQuestionId | wrongCount
1  | u1     | q-abc      | NULL           | 2        ← từ Practice
2  | u1     | NULL       | eq-xyz         | 1        ← từ Exam
```

---

### In-Memory Pagination (Phân trang trong bộ nhớ)
**Định nghĩa**: Tải toàn bộ dữ liệu từ DB vào RAM rồi cắt thành trang bằng code, thay vì dùng `LIMIT/OFFSET` trực tiếp trong SQL.

**Trong dự án này**: `getWrongAnswers()` dùng cách này vì subject của `ExamQuestion` phải JOIN qua bảng `ExamPaper` — không thể filter/paginate trực tiếp ở DB-level một cách gọn gàng. Chấp nhận được vì mỗi user chỉ có tối đa vài trăm câu sai (TTL 14 ngày).

**Khi nào không dùng được**: Nếu dataset có thể lên tới hàng nghìn/triệu record thì phải paginate ở DB.

---

### normalizeAnswer
**Định nghĩa**: Hàm chuẩn hóa chuỗi trước khi so sánh — bỏ khoảng trắng thừa, chuyển về chữ thường — để chấp nhận các cách gõ khác nhau của cùng một đáp án.

**Trong dự án này**: Dùng để chấm câu `FILL_BLANK`. `normalizeAnswer('  Hà Nội  ')` → `'hà nội'`. Nếu đáp án trong DB là `['Hà Nội', 'ha noi']` thì user gõ `'HA NOI'` (không dấu, chữ hoa) sẽ không khớp, nhưng `'ha noi'` sẽ khớp sau normalize.

**Nguồn gốc**: Hàm này được tái sử dụng từ `exam.service.ts`, không viết lại, để đảm bảo logic chấm bài nhất quán giữa Exam và Wrong Answer Review.

---

## Admin User Management + Dashboard (Feature 008) — Thuật ngữ kỹ thuật

### TTL (Time-To-Live) — Thời gian tự hết hạn
**Định nghĩa**: Một giá trị được lưu kèm "hạn sử dụng" — sau thời gian đó tự động biến mất mà không cần ai xóa thủ công.

**Trong dự án này**: Redis key `online:{userId}` có TTL = 300 giây. Mỗi khi user gọi API, key được ghi lại (và đồng thời reset đồng hồ đếm ngược). Nếu 5 phút không có hoạt động, key tự biến mất → user không còn được đếm là "online".

**Ví dụ**:
```
14:00:00 — User gọi API → redis.set("online:abc", "1", EX 300)
14:04:30 — User gọi API lại → key được gia hạn thêm 300 giây
14:09:30 — Không có hoạt động → key tự xóa → user "offline"
```

---

### Redis SCAN vs KEYS
**Định nghĩa**: Hai cách tìm key trong Redis theo pattern, nhưng cách hoạt động rất khác nhau.

**Trong dự án này**: Dùng `SCAN cursor MATCH "online:*" COUNT 100` thay vì `KEYS online:*` để đếm user online, vì SCAN không block Redis trong khi quét.

**Ví dụ**:
```
KEYS online:*   → Redis dừng hết, quét 1 lần, trả tất cả  ← nguy hiểm khi có nhiều key
SCAN 0 ...      → Quét 100 key, trả cursor tiếp theo
SCAN cursor ... → Quét 100 key tiếp, trả cursor tiếp
... lặp cho đến cursor = "0" → xong
```

---

### Fire-and-Forget
**Định nghĩa**: Gọi một hàm/lệnh mà không chờ kết quả — nếu thất bại thì bỏ qua, không ảnh hưởng đến luồng chính.

**Trong dự án này**: Ghi Redis online tracking và xóa key Redis khi mở khoá/xóa user đều dùng pattern này: `redis.set(...).catch(() => {})` — không `await`, không ném lỗi ra ngoài.

**Ví dụ**:
```typescript
// ❌ Không làm thế này — nếu Redis chậm, mọi request của user bị chậm theo
await redis.set(`online:${userId}`, '1', 'EX', 300);

// ✅ Fire-and-forget — Redis chết cũng không sao
redis.set(`online:${userId}`, '1', 'EX', 300).catch(() => {});
```

---

### Firebase-first Delete Strategy
**Định nghĩa**: Chiến lược xóa dữ liệu trên nhiều hệ thống: ưu tiên xóa hệ thống xác thực (Firebase) trước để đảm bảo user không thể đăng nhập lại, dù các bước sau có thất bại.

**Trong dự án này**: `deleteUser()` trong `admin-users.service.ts` xóa Firebase account trước, DB sau. Nếu DB xóa thất bại → log lỗi + admin xử lý thủ công, nhưng user đã không thể đăng nhập vì Firebase mất.

**Tại sao không làm ngược lại**:
```
Xóa DB trước → Firebase còn → user đăng nhập lại bằng Firebase
→ POST /login tạo bản ghi mới → tài khoản "hồi sinh" 👻

Xóa Firebase trước → dù DB còn, user không vào được app ✓
```

---

### Cascade Delete
**Định nghĩa**: Khi xóa một bản ghi cha, các bản ghi con liên quan tự động bị xóa theo ở tầng DB (không cần code xóa thủ công).

**Trong dự án này**: `wrong_answers` có `onDelete: Cascade` với `users` — khi admin xóa user, toàn bộ câu sai của user đó bị xóa ngay lập tức bởi PostgreSQL. Nhưng `practice_sessions` và `exam_sessions` **không** cascade — giữ lại để thống kê hệ thống chính xác.

**Ví dụ**:
```
DELETE FROM users WHERE id = 'abc'
→ PostgreSQL tự động: DELETE FROM wrong_answers WHERE userId = 'abc'
→ KHÔNG tự động: practice_sessions, exam_sessions (giữ lại)
```

---

### Sentinel Value (Giá trị đánh dấu)
**Định nghĩa**: Một giá trị đặc biệt được dùng để đánh dấu trạng thái "không có dữ liệu thực" — khác với `null` (không tồn tại) hay `undefined`.

**Trong dự án này**: `{}` (object rỗng) được dùng làm sentinel cho "câu hỏi bị bỏ trắng" trong `ExamAnswer.selectedAnswer`. Frontend gửi `{}` thay vì bỏ qua field, giúp backend phân biệt "chưa trả lời" vs "trả lời sai".

**Cách detect**:
```typescript
function isSentinelUnanswered(value: Prisma.JsonValue | null): boolean {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0;
}
```

**Tại sao không dùng `null`**: `null` đã có nghĩa riêng trong Prisma — "không có bản ghi ExamAnswer cho câu hỏi này". `{}` rõ ràng hơn về ý nghĩa "đã ghi nhận câu trả lời, nhưng là bỏ trống".

---

### Fail-Closed (Đóng khi lỗi)
**Định nghĩa**: Chiến lược xử lý lỗi hệ thống phụ thuộc (như Redis, external API): khi hệ thống đó không phản hồi, từ chối request thay vì cho phép qua.

**Đối lập**: **Fail-Open** (Mở khi lỗi) — cho phép qua khi hệ thống phụ thuộc lỗi. Ưu tiên tính khả dụng (availability) hơn an toàn.

**Trong dự án này**: `checkRateLimit()` trong `practice.service.ts` dùng fail-closed — khi Redis không phản hồi, throw `PracticeRateLimitError` thay vì bỏ qua. Ưu tiên bảo mật (không cho vượt giới hạn) hơn UX (user bị block tạm thời khi Redis down).

---

### EXAM_MIN_SUBMIT_RATIO
**Định nghĩa**: Tỉ lệ thời gian tối thiểu học sinh phải làm bài trước khi được phép nộp.

**Giá trị**: `0.3` (30%)

**Ví dụ**: Đề thi 60 phút → học sinh phải làm ít nhất 60 × 0.3 = 18 phút trước khi bấm "Nộp bài".

**Lý do tồn tại**: Ngăn gian lận bằng cách submit ngay sau khi bắt đầu, nhận session ID và xem đáp án qua công cụ khác, rồi submit lại với đáp án đúng.

---

### ExamSubmitTooEarlyError
**Định nghĩa**: Lỗi 400 Bad Request được throw khi học sinh cố nộp bài trước khi đủ `EXAM_MIN_SUBMIT_RATIO × durationMinutes` thời gian.

**Thuộc tính**: `remainingSeconds` — số giây còn thiếu để được nộp. Frontend dùng để hiển thị "Bạn cần làm thêm X phút nữa".

---

### ExamSessionAlreadyActiveError
**Định nghĩa**: Lỗi 409 Conflict được throw khi học sinh cố bắt đầu phiên thi mới trong khi đang có phiên `IN_PROGRESS` cho cùng môn học.

**Thuộc tính**: `existingSessionId` — ID của phiên đang chạy. Ngăn gian lận kiểu "mở nhiều tab để bypass timer".

---

### SESSION_TIMEOUT_SECONDS
**Định nghĩa**: Thời gian tối đa (giây) của một phiên luyện tập trước khi hết hạn.

**Giá trị**: `1020` (17 phút = 17 × 60).

**Grace period**: Khi `completeSession()` kiểm tra timeout, được cộng thêm 60 giây grace để học sinh không bị mất điểm do trễ mạng.

---

### Stale Closure (Closure cũ)
**Định nghĩa**: Hiện tượng trong React khi một hàm (closure) bên trong `useEffect` hoặc `setTimeout` "nhớ" giá trị state/prop từ lần render trước, không phản ánh giá trị hiện tại.

**Trong dự án này (S5 bug fix)**: Auto-submit cũ dùng `useEffect([..., onSubmit])` — `onSubmit` là hàm mới mỗi lần `ExamPage` render, khiến effect có thể chạy với phiên bản cũ của `handleSubmit` (bắt state cũ). Fix: dùng `onSubmitRef.current` — ref luôn trỏ đến phiên bản mới nhất.

**Cách nhận biết**: Code có `useEffect(() => {...}, [someFunction])` mà `someFunction` được tạo inline (`() => ...`) → nguy cơ stale closure.

---

### Ref Pattern cho Callback (Latest Ref Pattern)
**Định nghĩa**: Kỹ thuật React: lưu một callback vào `useRef` và cập nhật ref sau mỗi render, để `setTimeout`/`setInterval` luôn gọi phiên bản mới nhất của callback mà không cần đưa nó vào dependency array.

**Trong dự án này**:
```tsx
const onSubmitRef = useRef(onSubmit);
useEffect(() => { onSubmitRef.current = onSubmit; }); // không có deps → chạy sau mỗi render

useEffect(() => {
  const id = setTimeout(() => onSubmitRef.current(), msLeft);
  return () => clearTimeout(id);
}, []); // chỉ set up 1 lần lúc mount
```

**Khi nào dùng**: Khi cần gọi callback mới nhất từ bên trong một effect/timer có deps là `[]` (chỉ chạy 1 lần).
