# ADR-013: Thi đấu đối kháng (PvP Quiz Battle) — state realtime in-memory, ẩn danh tính bot, escrow cược điểm

**Ngày**: 2026-07-27 (bổ sung sau vòng test S5 — 3 thay đổi phạm vi so với thiết kế gốc)
**Trạng thái**: Accepted
**Tính năng liên quan**: Feature 016 — Thi đấu đối kháng, Đợt 1/MVP (branch `feature/battle-mvp`)

---

## Bối cảnh

Feature 016 là module realtime đầu tiên của QuizzGame (dùng Socket.io thay vì chỉ REST như Practice/Exam) — đưa ra 3 quyết định kiến trúc không thể đảo ngược dễ dàng sau này nếu chọn sai từ đầu:

1. Trạng thái "đang chơi" (câu hỏi, điểm tạm, timer) của 1 trận nên lưu ở đâu — DB, Redis, hay bộ nhớ RAM của chính process?
2. Đối thủ "bot" (khi không ghép được người thật) nên hiển thị danh tính như thế nào để không phá vỡ trải nghiệm cạnh tranh với người thật?
3. Tiền cược (điểm) nên bị trừ lúc nào — lúc bắt đầu hay lúc kết thúc trận?

Sau vòng test thủ công của S5, phát sinh thêm 1 quyết định quan trọng không có trong thiết kế gốc của S1: **tự động đưa người chơi vào lại trận đang dở** sau khi mất kết nối/tải lại trang — vì Battle nhạy thời gian hơn nhiều so với Exam (20s/câu, 30s ân hạn) nên không thể chỉ hiện banner hỏi "có muốn tiếp tục?" như Exam.

---

## Quyết định 1: State trận đấu sống trong RAM (`Map` in-memory), KHÔNG dùng Redis/DB cho mỗi thao tác

### Vấn đề
Mỗi câu hỏi realtime cần: gửi câu, nhận đáp án của cả 2 bên, tính điểm theo mốc thời gian server, biết khi nào cả 2 đã trả lời để chuyển câu tiếp theo — tất cả trong vòng vài trăm ms tới vài giây.

### Lựa chọn đã xét

**A. Ghi mỗi thay đổi trạng thái xuống DB (Postgres)**: Đúng nhưng chậm — mỗi câu hỏi cần nhiều lần đọc/ghi (gửi câu, ghi đáp án, cập nhật điểm tạm), độ trễ round-trip DB không phù hợp với nhịp độ 20s/câu cần phản hồi tức thì.

**B. Redis (in-memory nhưng ngoài process, dùng được nhiều instance)**: Giải quyết được cả tốc độ lẫn khả năng scale ngang, nhưng phát sinh thêm hạ tầng (Redis client, serialize/deserialize state phức tạp — câu hỏi đã xáo, timer đang chạy...) ngay từ Đợt 1/MVP khi chưa rõ nhu cầu tải thực tế.

**C. `Map<matchId, LiveMatch>` sống trong RAM của process backend** *(đã chọn)*:
```ts
const liveMatches = new Map<string, LiveMatch>();
```
- ✅ Nhanh nhất có thể — đọc/ghi state là thao tác đồng bộ trong bộ nhớ, không round-trip mạng
- ✅ Đơn giản nhất để viết đúng trong Đợt 1/MVP — không cần lo serialize timer/state phức tạp
- ⚠️ CHỈ đúng khi chạy 1 instance backend duy nhất — mất hết nếu restart, không đồng bộ nếu chạy nhiều instance sau lưng load balancer

### Quyết định
Chọn **C**, chấp nhận giới hạn 1-instance vì khớp với mô hình triển khai hiện tại (giống `battleQueueService`, và giống cache công tắc Premium ở ADR-012). Đây là quyết định có chủ đích để giao Đợt 1/MVP nhanh, không phải sơ suất — ghi rõ trong comment code + `docs/GLOSSARY.md` ("In-Memory Live State") để dev sau biết ngay bước cần làm khi scale ngang (chuyển sang Redis, serialize `LiveMatch`).

---

## Quyết định 2: Ẩn hoàn toàn danh tính bot bằng tên giả deterministic, KHÔNG bằng cách thêm cột DB

### Vấn đề (phát sinh từ test S5, ngoài thiết kế gốc)
Ban đầu đối thủ bot hiển thị "Máy 🤖" — trải nghiệm test thật cho thấy điều này làm giảm hẳn cảm giác cạnh tranh (người chơi biết trước là đang đấu với máy sẽ chơi khác đi/mất hứng thú). Yêu cầu mới: ẩn hoàn toàn danh tính bot, đối thủ phải "trông giống người thật" ở MỌI nơi hiển thị (lúc chơi + lúc xem lại lịch sử) và phải NHẤT QUÁN giữa các lần xem.

### Lựa chọn đã xét

**A. Thêm cột `botDisplayName` vào bảng `BattleMatch`, gán ngẫu nhiên lúc tạo trận**: Đảm bảo nhất quán tuyệt đối (đọc lại từ DB), nhưng cần 1 migration, tốn thêm 1 cột chỉ để phục vụ hiển thị, và phải nhớ gán giá trị này ở đúng thời điểm tạo trận (dễ quên nếu có nhiều nơi tạo trận bot sau này).

**B. Random tên mỗi lần hiển thị (`Math.random()` mỗi lần gọi)**: Đơn giản nhất về code, nhưng KHÔNG nhất quán — cùng 1 trận, lúc đang chơi thấy tên A, lúc xem lại Lịch sử thấy tên B → lộ ngay là giả, phản tác dụng với chính mục tiêu của tính năng.

**C. Hàm băm THUẦN, tất định theo `matchId`** *(đã chọn)*:
```ts
export function pickBotDisplayName(matchId: string): string {
  let hash = 0;
  for (const ch of matchId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return BOT_DISPLAY_NAMES[hash % BOT_DISPLAY_NAMES.length]!;
}
```
- ✅ Nhất quán tuyệt đối giữa mọi lần gọi (đang chơi / lịch sử / auto-resume) — không cần lưu gì thêm
- ✅ Không cần migration, không tốn cột DB
- ⚠️ Chỉ có 12 tên cố định — 2 trận bot khác nhau có xác suất trùng tên (chấp nhận được vì mục tiêu chỉ là "giống người thật", không phải "định danh duy nhất")

### Quyết định
Chọn **C**. `isBotMatch: true` vẫn được giữ nguyên vẹn trong MỌI response (data layer minh bạch) — chỉ tầng hiển thị (UI) không còn dùng cờ này để vẽ icon riêng. Việc đối soát nội bộ (tỉ lệ thắng bot có đúng ~65% cấu hình không) vẫn thực hiện được qua SQL trực tiếp trên cột `isBotMatch`, không phụ thuộc tên hiển thị.

---

## Quyết định 3: Escrow betting (khoá cược ngay lúc bắt đầu) thay vì trừ điểm người thua lúc kết thúc

### Vấn đề
Cần quyết định thời điểm trừ điểm cược: ngay lúc vào trận, hay chỉ trừ của người thua khi trận kết thúc.

### Lựa chọn đã xét

**A. Chỉ trừ điểm người thua lúc kết thúc (transfer lúc settle)**: Đơn giản hơn (1 giao dịch lúc kết thúc thay vì 2 lúc bắt đầu + kết thúc), nhưng để hở 1 khoảng thời gian (suốt trận đấu, có thể vài phút) mà cả 2 người chơi vẫn có toàn quyền tiêu số điểm "coi như đã cược" vào việc khác (mở trận PvP khác, đổi môn premium...) — nếu họ tiêu hết trước khi trận kết thúc, hệ thống sẽ không trừ được đủ khi thanh toán.

**B. Khoá cược (escrow) — trừ NGAY của cả 2 người chơi thật lúc bắt đầu, cộng lại lúc kết thúc** *(đã chọn)*:
```
Bắt đầu:  deductPointsInTx(player1, stake); deductPointsInTx(player2, stake)  // PVP_LOCK_BET
Kết thúc: addPointsInTx(winner, stake*2)  // PVP_WIN — không dùng transferPoints vì
                                          // điểm không còn nằm trong ví người thua
          hoặc addPointsInTx(mỗi bên, stake) nếu hoà/huỷ
```
- ✅ Trong suốt thời gian trận diễn ra, điểm cược THẬT SỰ không thể bị tiêu vào việc khác — không có khoảng hở
- ✅ Nhất quán với pattern `deductPointsInTx`/`addPointsInTx` đã dùng cho Exam (ADR đã có sẵn tiền lệ)
- ⚠️ Cần xử lý huỷ trận (hoàn tiền) cho MỌI nhánh kết thúc bất thường (2 người cùng mất kết nối, lỗi hệ thống giữa chừng) — bề mặt code settle phức tạp hơn 1 chút so với phương án A

### Quyết định
Chọn **B**. Toàn bộ 4 nhánh thanh toán (thắng/thua/hoà/huỷ) đều nằm trong CÙNG 1 `prisma.$transaction` với bước "chốt" trạng thái `BattleMatch` dùng `updateMany({ where: { status: 'IN_PROGRESS' } })` làm compare-and-swap — chống thanh toán 2 lần cho cùng 1 trận (cùng nguyên tắc atomicity S3 đã áp dụng ở `ExamService.submitExam`).

---

## Quyết định 4: Tự động resume trận đang dở — REST snapshot + `localStorage` marker, KHÔNG hỏi xác nhận như Exam

### Vấn đề (phát sinh từ test S5, ngoài thiết kế gốc)
Sau khi mất kết nối/tải lại trang, Exam hiện banner hỏi "Bạn có bài thi đang dở, tiếp tục?" — người dùng có thời gian đọc và bấm. Battle không thể dùng cách này vì mỗi câu chỉ có 20s và grace period mất kết nối chỉ 30s — thời gian chờ người dùng đọc banner + bấm có thể khiến họ tự động thua trước khi kịp phản hồi.

### Lựa chọn đã xét

**A. Banner hỏi xác nhận giống Exam**: Nhất quán với pattern đã có, nhưng không phù hợp với ngân sách thời gian cực ngắn của Battle — rủi ro cao người dùng bị xử thua trong lúc đang đọc banner.

**B. Tự động đưa thẳng vào lại đúng trận, không hỏi** *(đã chọn)*: Thêm `GET /api/battle/active` đọc trực tiếp `liveMatches` (không qua DB) trả về `ActiveBattleMatchSnapshot` (câu hỏi hiện tại, điểm số, số giây còn lại). Nếu server không còn giữ trận nào sống (đã kết thúc trong lúc rời app), dùng `localStorage['battle_active_match_id']` (ghi lúc vào trận, xoá lúc nhận `battle:match-ended` bình thường) làm "vé nhớ" để tra cứu `GET /api/battle/history` và hiện thẳng màn kết quả thay vì im lặng bỏ qua.

### Quyết định
Chọn **B**. Chấp nhận đánh đổi: cơ chế này kế thừa đúng giới hạn "1 instance" của Quyết định 1 (snapshot chỉ đúng nếu socket reconnect về đúng instance đang giữ trận) — không phải giới hạn mới, mà là hệ quả tự nhiên của kiến trúc đã chọn.

---

## Hệ quả

### Tích cực
- Toàn bộ luồng chơi 1 câu hỏi (gửi câu → nhận đáp án → tính điểm → chuyển câu) xử lý hoàn toàn trong bộ nhớ, không có độ trễ round-trip DB nào trong nhịp 20s/câu.
- Ẩn danh tính bot không cần thêm cột DB, không cần migration — tận dụng dữ liệu đã có sẵn (`matchId`) qua 1 hàm băm thuần.
- Escrow betting đảm bảo điểm cược không thể "biến mất" giữa chừng do người chơi tiêu vào việc khác.
- Tự động resume giải quyết đúng bài toán UX đặc thù của realtime (khác Exam) mà không cần thiết kế lại toàn bộ luồng đăng nhập.

### Tiêu cực / Đánh đổi
- Toàn bộ module Battle (hàng đợi + trận đang diễn ra + resume) bị giới hạn ở **1 instance backend duy nhất** — đây là nợ kỹ thuật lớn nhất của Đợt 1/MVP, ảnh hưởng tới 3/4 quyết định trên cùng lúc (không phải 1 chỗ sửa đơn lẻ nếu cần scale sau này).
- 12 tên bot cố định — về lý thuyết 2 trận bot khác nhau (khác `matchId`) có thể trùng tên nếu hash trùng modulo 12; chấp nhận vì không ảnh hưởng tính đúng đắn, chỉ ảnh hưởng trải nghiệm rất nhỏ.
- `battle.engine.service.ts` (nơi có 2 timer phối hợp: `questionTimer` + `disconnectTimers`) hiện CHƯA có unit test tự động — chỉ được xác minh bằng tay trong vòng test S5. Đây là rủi ro cao nhất còn tồn đọng khi merge.

### Nợ kỹ thuật
- [ ] Khi cần scale nhiều instance: chuyển `liveMatches` + `battleQueueService` sang Redis (hoặc cơ chế sticky session đảm bảo 1 user luôn về đúng 1 instance trong suốt vòng đời 1 trận).
- [ ] Viết unit test tự động cho `battle.engine.service.ts`, đặc biệt luồng phối hợp `questionTimer`/`disconnectTimers` (pause lúc disconnect, resume fresh lúc reconnect) và `hasActiveMatch()` chặn 2 trận cùng lúc — hiện chỉ có test cho `battle.utils.ts`/`battle.queue.service.ts`/`battle.match.service.ts`.
- [ ] Cân nhắc mở rộng `BOT_DISPLAY_NAMES` (hiện 12 tên) nếu tần suất trận bot tăng cao, giảm xác suất trùng tên giữa các trận gần nhau về thời gian.
