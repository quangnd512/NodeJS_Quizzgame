# ADR-012: Khung Free/Premium — công tắc toàn cục, cache invalidate-on-write, streak freeze

**Ngày**: 2026-07-16 (bổ sung 2026-07-19 sau vòng test S5)
**Trạng thái**: Accepted
**Tính năng liên quan**: Khung Free/Premium — Free vs Premium (branch `feature/premium-framework`)

---

## Bối cảnh

Feature 015 cần đưa vào hệ thống 1 khái niệm hoàn toàn mới ("gói dịch vụ") mà không được làm gián đoạn trải nghiệm người dùng hiện tại, đồng thời phải hỗ trợ vận hành linh hoạt (bật/tắt khuyến mãi toàn hệ thống, cấp thủ công cho từng user). 3 quyết định kiến trúc cốt lõi:

1. Trạng thái Premium của 1 user được xác định như thế nào — và làm sao để ra mắt tính năng mà không "khoá" đột ngột ai.
2. Công tắc toàn cục cần được đọc ở rất nhiều nơi mỗi request — làm sao tránh query DB liên tục mà vẫn phản ánh thay đổi tức thì.
3. Quyền lợi "bảo hiểm chuỗi ngày học" (streak freeze) cần thuật toán nhất quán giữa nhiều nơi tính streak trong hệ thống.

---

## Quyết định 1: Premium = công tắc toàn cục HOẶC hạn dùng cá nhân — mặc định công tắc BẬT SẴN

### Vấn đề
Cần 1 quy tắc duy nhất xác định "user X có phải Premium không", áp dụng nhất quán ở mọi nơi gate (đổi môn, ôn câu sai, lịch sử thi thử, thống kê tiến độ...), đồng thời ra mắt không làm mất quyền lợi đột ngột của user hiện tại.

### Lựa chọn đã xét

**A. Chỉ dựa vào `premiumExpiresAt` cá nhân, mặc định `null` (Free) cho mọi user cũ**: Đơn giản nhất về mặt code, nhưng ra mắt xong MỌI user hiện tại lập tức mất quyền truy cập các tính năng vừa bị gate — trải nghiệm xấu, dễ gây phản ứng tiêu cực ngay khi tính năng ra mắt.

**B. Migration script gán `premiumExpiresAt` xa trong tương lai cho toàn bộ user hiện có**: Giải quyết được vấn đề ra mắt, nhưng phải chạy 1 migration dữ liệu one-off, và không có cách "tắt Premium cho tất cả" dễ dàng sau này (phải xoá dữ liệu ngược lại).

**C. Công tắc toàn cục `defaultPremiumForAll` (bảng `AppSettings` singleton), mặc định BẬT SẴN, kết hợp OR với hạn dùng cá nhân** *(đã chọn)*:
```
isUserPremium = defaultPremiumForAll || (premiumExpiresAt != null && premiumExpiresAt > now)
```
- ✅ Ra mắt không ảnh hưởng ai — mọi user (cũ lẫn mới) đều là Premium cho tới khi admin **chủ động** tắt công tắc
- ✅ Không cần migration dữ liệu cho user hiện có
- ✅ Đảo ngược được dễ dàng (bật/tắt lại) — phù hợp cho các đợt khuyến mãi ngắn hạn sau này
- ✅ Cấp Premium cá nhân (`premiumExpiresAt`) vẫn hoạt động độc lập, không phụ thuộc công tắc

### Quyết định
Chọn **C**. Đây là quyết định nghiệp vụ đã chốt từ S1, không phải giá trị mặc định an toàn ngẫu nhiên — `defaultPremiumForAll: true` là lựa chọn có chủ đích để trì hoãn việc "thu phí thật" tới khi admin sẵn sàng.

---

## Quyết định 2: Cache in-memory invalidate-on-write cho công tắc toàn cục (không dùng TTL)

### Vấn đề
`isUserPremium` được gọi ở hầu như mọi request (gate wrong-answer, gate exam-history, gate subjects, `/me`, `/progress/summary`...) — query DB mỗi lần sẽ tốn kém không cần thiết cho 1 giá trị hiếm khi đổi.

### Lựa chọn đã xét

**A. Không cache, query DB mỗi lần**: Đúng nhưng lãng phí — giá trị này gần như không đổi (chỉ đổi khi admin thao tác thủ công), tốn 1 round-trip DB oan cho mọi request có gate.

**B. Cache TTL (VD: 60 giây)**: Giảm tải DB, nhưng tạo ra 1 khoảng "cửa sổ trễ" khó hiểu — admin bật/tắt công tắc xong, user vẫn thấy hành vi cũ trong tối đa 60 giây, dễ bị hiểu nhầm là bug khi test/vận hành.

**C. Cache in-memory, ghi đè NGAY khi admin ghi (invalidate-on-write)** *(đã chọn)*:
```ts
async function setGlobalPremiumSetting(enabled: boolean) {
  const row = await prisma.appSettings.upsert({ ... , data: { defaultPremiumForAll: enabled } });
  cachedGlobalSetting = { defaultPremiumForAll: row.defaultPremiumForAll }; // ghi đè NGAY
  return cachedGlobalSetting;
}
```
- ✅ Không tốn DB query cho các lần đọc lặp lại
- ✅ Không có độ trễ — request NGAY SAU khi admin ghi (kể cả trên cùng process) thấy giá trị mới
- ⚠️ Chỉ đúng khi server chạy 1 process duy nhất — không tự động đồng bộ giữa nhiều worker/instance

### Quyết định
Chọn **C**, chấp nhận giới hạn "1 process" vì khớp với mô hình triển khai hiện tại của dự án. Ghi rõ giới hạn này trong code + `docs/GLOSSARY.md` ("Invalidate-on-Write Cache") để khi dự án mở rộng sang nhiều instance, đây là điểm đầu tiên cần sửa (chuyển sang Redis pub/sub hoặc đọc thẳng DB).

---

## Quyết định 3: Streak Freeze là pure function riêng, tách khỏi `computeStreaks` gốc

### Vấn đề
Quyền lợi "3 thẻ bảo hiểm chuỗi" cho Premium cần thuật toán tính streak phức tạp hơn (có thể "bắc cầu" qua 1 ngày bị bỏ lỡ), nhưng hệ thống có ≥2 nơi độc lập tính streak (hiển thị số ở trang Tiến độ, và bắn thông báo mốc streak sau khi hoàn thành phiên ôn tập).

### Lựa chọn đã xét

**A. Sửa trực tiếp `computeStreaks` hiện có để nhận thêm tham số freeze**: Rủi ro phá vỡ các nơi đang dùng hàm gốc cho trường hợp không cần freeze; hàm gốc trở nên phức tạp hơn cho use-case đơn giản.

**B. Viết `computeStreaksWithFreeze` — hàm MỚI, độc lập, giữ nguyên `computeStreaks` cũ** *(đã chọn)*:
- ✅ Không ảnh hưởng code hiện có đang dùng `computeStreaks`
- ✅ Pure function (không query DB) — dễ viết test bao phủ đầy đủ kịch bản (bridge, hết thẻ, trailing forgiveness, Free `freezeGrant=0`...)
- ✅ Dùng CHUNG ở cả 2 nơi cần streak (progress summary + thông báo mốc streak) — đảm bảo không lệch nhau vì cùng 1 hàm, cùng 1 tham số đầu vào (`premiumSinceEffective`, `freezeGrant`)
- ⚠️ Có 2 hàm tính streak song song trong codebase (`computeStreaks` và `computeStreaksWithFreeze`) — cần tài liệu rõ ràng để dev sau không nhầm lẫn dùng sai hàm

### Quyết định
Chọn **B**. Đặt cả 2 hàm trong cùng `streak.utils.ts`, ghi rõ trong docstring khi nào dùng hàm nào.

---

## Hệ quả

### Tích cực
- Ra mắt Feature 015 không gây gián đoạn cho user hiện tại — công tắc toàn cục cho phép admin kiểm soát thời điểm "thu phí thật" bắt đầu.
- Cache invalidate-on-write loại bỏ hoàn toàn độ trễ khó hiểu giữa thao tác admin và hành vi hệ thống — dễ vận hành, dễ test.
- Streak freeze là pure function tái dùng được, tránh lệch số liệu giữa các nơi hiển thị khác nhau — bài học lặp lại từ Feature 013 (`computeStreaks` gốc cũng đã áp dụng nguyên tắc "tách util dùng chung" để tránh circular import).

### Tiêu cực / Đánh đổi
- Cache in-memory giới hạn ở 1 process — nợ kỹ thuật rõ ràng khi cần scale ngang.
- Có 2 hàm tính streak song song (`computeStreaks` / `computeStreaksWithFreeze`) — tăng nhẹ bề mặt cần hiểu khi onboarding dev mới.
- Công tắc toàn cục BẬT SẴN nghĩa là trong giai đoạn đầu, KHÔNG có dữ liệu thực tế nào kiểm chứng hành vi "Free thật sự" cho tới khi admin tắt công tắc — rủi ro bug ở nhánh Free chỉ lộ ra sau khi tắt.

### Nợ kỹ thuật
- [ ] Khi scale sang nhiều instance/worker: chuyển cache công tắc toàn cục sang cơ chế đồng bộ liên-process (Redis pub/sub invalidate, hoặc bỏ cache đọc thẳng DB nếu tải cho phép).
- [ ] `AdminUserListItem`/`AdminUserDetail` (ghi nhận bởi S3, không phải thiếu sót của PR) chưa hiển thị `isPremium`/`premiumExpiresAt` trong bảng danh sách admin — cần bổ sung ở vòng UX sau để admin xem lại trạng thái Premium của user mà không cần tra riêng.
- [ ] Cân nhắc viết test tích hợp chạy với `defaultPremiumForAll=false` làm mặc định trong CI, để nhánh hành vi Free được kiểm chứng thường xuyên thay vì chỉ khi admin tắt công tắc trong môi trường thật.
