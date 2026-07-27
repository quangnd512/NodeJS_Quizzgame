# Troubleshooting Guide — QuizzGame

> Hướng dẫn xử lý các lỗi phổ biến cho admin và developer.

---

## Lỗi liên quan đến Thi thử (Exam)

### 1. Học sinh báo "bị chặn nộp bài" dù vừa bắt đầu thi

**Triệu chứng**: Frontend hiển thị "Bạn cần làm bài thêm X phút nữa mới được nộp."

**Nguyên nhân**: Tính năng anti-cheat Bug 1a — học sinh phải làm ít nhất 30% thời gian đề thi trước khi nộp. Đề 60 phút → phải làm tối thiểu 18 phút.

**Giải pháp**:
- Đây là hành vi *đúng*. Nhắc học sinh chờ đủ thời gian.
- Nếu học sinh thật sự bị lỗi (không phải gian lận): kiểm tra đồng hồ thiết bị của họ có đúng giờ không (lệch giờ server có thể gây sai elapsed).
- Điều chỉnh ngưỡng: sửa `EXAM_MIN_SUBMIT_RATIO` trong `exam.types.ts` (cần deploy lại).

---

### 2. Học sinh báo "có phiên thi chưa hoàn thành" nhưng không thấy phiên nào

**Triệu chứng**: POST /api/exam/start trả 409 `EXAM_SESSION_ALREADY_ACTIVE`.

**Nguyên nhân**: Có phiên `IN_PROGRESS` trong DB chưa hết hạn (ví dụ: học sinh tắt browser giữa chừng, chờ đủ giờ tự EXPIRED, hoặc multi-tab).

**Giải pháp**:
```sql
-- Kiểm tra phiên IN_PROGRESS của user
SELECT id, subjectId, startedAt, durationMinutes,
       (EXTRACT(EPOCH FROM NOW()) - EXTRACT(EPOCH FROM "startedAt")) / 60 AS elapsed_minutes
FROM exam_sessions
WHERE "userId" = '<user_id>' AND status = 'IN_PROGRESS';
```
- Nếu `elapsed_minutes > durationMinutes + 0.5`: phiên thật sự đã hết hạn nhưng chưa được mark EXPIRED. Cập nhật thủ công:
```sql
UPDATE exam_sessions SET status = 'EXPIRED', "completedAt" = NOW()
WHERE "userId" = '<user_id>' AND status = 'IN_PROGRESS';
```
- Nếu chưa hết hạn: học sinh cần đợi hết giờ hoặc hoàn thành phiên hiện tại.

---

### 3. Kết quả thi không hiển thị đáp án đúng cho một số câu

**Triệu chứng**: Một số câu trong kết quả thi hiển thị "Bạn chưa trả lời câu này" thay vì đáp án đúng.

**Nguyên nhân**: Đây là hành vi *đúng*. Câu đó học sinh đã bỏ trắng (không chọn đáp án). Backend trả `correctAnswer: null` để không lộ đáp án cho câu bỏ qua.

**Giải pháp**: Giải thích cho học sinh đây là tính năng bảo mật, không phải lỗi. Họ cần thực sự trả lời câu hỏi để xem đáp án đúng/sai.

---

## Lỗi liên quan đến Luyện tập (Practice)

### 4. Học sinh không thể bắt đầu phiên luyện tập dù chưa đạt giới hạn

**Triệu chứng**: POST /api/practice/start trả 429 `PRACTICE_RATE_LIMIT_EXCEEDED` khi học sinh chưa đạt 10 phiên/giờ.

**Nguyên nhân có thể**:
- Redis đang gặp sự cố (kết nối chậm, restart). Hệ thống dùng fail-closed — khi Redis không phản hồi → block request.
- Count trong Redis bị sai do bug cũ.

**Giải pháp**:
```bash
# Kiểm tra Redis
redis-cli ping  # Kỳ vọng: PONG

# Xem count hiện tại của user
redis-cli get "ratelimit:practice:<user_id>"

# Xóa count nếu sai (reset về 0)
redis-cli del "ratelimit:practice:<user_id>"
```
- Kiểm tra logs backend có `[PracticeService] Redis rate limit check that bai (fail-closed)` không. Nếu có → Redis có vấn đề, cần điều tra Redis server.

---

### 5. Học sinh báo hoàn thành phiên luyện tập nhưng không nhận điểm

**Triệu chứng**: POST /api/practice/complete trả 410 `PRACTICE_SESSION_EXPIRED`.

**Nguyên nhân**: Học sinh nộp sau khi phiên hết 17 phút + 60 giây grace (tổng 18 phút 1 giây). Hệ thống đánh dấu session `completedAt` nhưng không cộng điểm.

**Giải pháp**:
- Đây là hành vi *đúng* (anti-cheat Bug 3).
- Nhắc học sinh hoàn thành bài trong vòng 17 phút.
- Nếu học sinh bị mất mạng giữa chừng: hệ thống có 60s grace, nhưng nếu mất mạng lâu hơn thì không cứu được. Đây là đánh đổi bảo mật/UX đã được chấp nhận.

---

## Lỗi chung / Server

### 6. Các lỗi 409 Conflict không rõ nguyên nhân trong Exam module

| Error Code | Nguyên nhân | Giải pháp |
|------------|-------------|-----------|
| `EXAM_SESSION_ALREADY_ACTIVE` | Phiên IN_PROGRESS đang tồn tại | Xem mục #2 |
| `EXAM_SESSION_ALREADY_COMPLETED` | Nộp bài 2 lần | Bình thường, bảo học sinh không bấm submit nhiều lần |
| `EXAM_INSUFFICIENT_POINTS` | Không đủ 60 điểm vào thi | Học sinh cần tích thêm điểm qua luyện tập |

---

## Lỗi liên quan đến tính năng Exam UX Improvements

### 7. Bấm "Tiếp tục" nhưng không vào được bài thi

**Triệu chứng**: Bấm "Tiếp tục" trong banner resume → thông báo "Không thể khôi phục bài thi. Bạn có thể bắt đầu bài mới."

**Nguyên nhân**: Dữ liệu câu hỏi (`exam_session_data_{sessionId}`) không còn trong localStorage — có thể do người dùng clear cache trình duyệt hoặc dùng chế độ ẩn danh.

**Giải pháp**:
- Hệ thống tự động huỷ phiên cũ và cho phép thi lại.
- Học sinh mất 60đ vào thi của phiên đó (không hoàn lại).
- Bấm vào môn học để bắt đầu bài thi mới bình thường.

---

### 8. Bài thi bị huỷ nhưng vẫn bị chặn khi thi lại

**Triệu chứng**: Sau khi huỷ bài (abandon), bấm bắt đầu thi mới vẫn nhận 409 `EXAM_SESSION_ALREADY_ACTIVE`.

**Nguyên nhân**: Có thể gọi abandon thất bại (mất mạng trong lúc xử lý) khiến session vẫn ở trạng thái `IN_PROGRESS`.

**Giải pháp**:
- Làm mới trang → banner "Tiếp tục?" hiện lại → bấm "Huỷ bài" lần nữa.
- Hoặc đợi session tự hết giờ (tối đa bằng thời gian còn lại của đề thi).
- Admin có thể kiểm tra DB và update status thủ công nếu cần giải quyết nhanh.

---

### 9. Đáp án đã chọn không được khôi phục khi resume

**Triệu chứng**: Bấm "Tiếp tục" → vào bài thi nhưng tất cả câu đều trắng (chưa chọn gì).

**Nguyên nhân**: File `exam_draft_{sessionId}` trong localStorage bị mất hoặc bị xóa.

**Giải pháp**:
- Đây là giới hạn đã biết của tính năng (draft lưu client-side).
- Học sinh cần chọn lại đáp án. Đồng hồ vẫn chạy đúng — chỉ đáp án nháp bị mất.
- Để tránh: không xóa cache trình duyệt trong khi đang có bài thi dở.

---

## Lỗi liên quan đến tính năng Notifications — Thông báo hệ thống (Feature 013)

### 10. Badge chuông không cập nhật số thông báo mới

**Triệu chứng**: Có sự kiện mới (lên hạng, streak milestone...) nhưng số đỏ trên icon chuông 🔔 không đổi.

**Nguyên nhân**: Frontend polling `GET /api/notifications/unread-count` mỗi 30 giây — có độ trễ tối đa 30s theo thiết kế (xem `FEATURE_LOG.md` mục "Polling 30 giây thay vì WebSocket").

**Giải pháp**:
- Đợi tối đa 30 giây rồi kiểm tra lại.
- Nếu quá 1 phút vẫn không cập nhật: kiểm tra tab trình duyệt có đang ở background/inactive không (một số trình duyệt throttle `setInterval` khi tab không active).
- Reload trang để buộc gọi lại API ngay lập tức.

### 11. Không nhận thông báo Streak Milestone dù đã đủ 7 ngày liên tiếp

**Triệu chứng**: Học sinh chắc chắn đã học 7 ngày liên tiếp nhưng không thấy thông báo 🔥.

**Nguyên nhân phổ biến nhất**: Đây không phải phiên ôn tập **đầu tiên** hoàn thành trong ngày — cơ chế dedup chỉ gửi thông báo khi `count sessions hôm nay === 1`. Nếu học sinh học nhiều phiên rồi mới đạt mốc, notification không bắn (đã bắn ở phiên đầu ngày với streak cũ hơn, chưa chạm mốc).

**Giải pháp**:
- Kiểm tra DB xem streak thực tế đã đúng mốc `[7,14,30,60,100]` chưa:
```sql
SELECT "completedAt" FROM practice_sessions
WHERE "userId" = '<userId>' AND "completedAt" IS NOT NULL
ORDER BY "completedAt" DESC LIMIT 30;
```
- Đây là hành vi *đúng theo thiết kế* — không phải bug. Giải thích cho học sinh: mốc chỉ thông báo 1 lần/ngày, vào phiên đầu tiên đạt mốc.

### 12. Toast thông báo hiện lại ngay khi vừa mở app (spam)

**Triệu chứng**: Mở lại app sau một thời gian, toast thông báo cũ hiện lên ngay lập tức dù đã đọc từ trước.

**Nguyên nhân**: Đây là bug đã được S3 sửa trong review (dùng sentinel `prevUnreadRef.current = -1` thay vì `0`). Nếu vẫn gặp, có thể do build cũ chưa deploy fix.

**Giải pháp**:
- Xác nhận đang chạy code từ commit `41a1ef5` trở về sau (branch `feature/notifications`).
- Nếu vẫn lỗi sau khi deploy đúng bản: kiểm tra `frontend/src/App.tsx` xem `prevUnreadRef` có khởi tạo đúng `-1` không.

### 13. Bấm PATCH đánh dấu đã đọc trả về 404

**Triệu chứng**: Gọi `PATCH /api/notifications/:id/read` hoặc thao tác trên panel báo lỗi, notification không được đánh dấu đã đọc.

**Nguyên nhân**: Nhiều khả năng nhất là **route ordering** — nếu code bị sửa lại và `/:id/read` được đăng ký TRƯỚC `/unread-count` hoặc `/read-all`, Express sẽ match nhầm các path tĩnh này vào `:id`. Khả năng khác: `id` không thuộc về user hiện tại (`403 NOTIFICATION_NOT_OWNED`) hoặc notification không tồn tại (`404 NOTIFICATION_NOT_FOUND`).

**Giải pháp**:
- Kiểm tra thứ tự khai báo route trong `backend/src/routes/notification.route.ts`: `/unread-count` và `/read-all` phải đứng TRƯỚC `/:id/read`.
- Xác nhận `id` truyền vào đúng là UUID của notification, không phải chuỗi khác.
- Xem response body để phân biệt 404 (không tồn tại) và 403 (không phải chủ sở hữu).

### 14. Học sinh không nhận thông báo "Đề thi mới" dù admin đã bật active

**Triệu chứng**: Admin bật `isActive` cho đề thi nhưng học sinh trong môn đó không thấy thông báo 📝.

**Nguyên nhân**: Batch trigger `fireNewExamPaperNotifications` chỉ chạy khi `isActive` chuyển từ `false → true`. Nếu đề thi tạo mới đã `isActive: true` ngay từ đầu, hoặc chuyển `true → true`, trigger không chạy. Ngoài ra, chỉ học sinh **đã từng có session (luyện tập hoặc thi thử) ở môn đó** mới nhận được — học sinh chưa từng học môn này sẽ không nằm trong danh sách nhận.

**Giải pháp**:
- Xem mục 13.3 trong `admin-guide.md` để kiểm tra điều kiện trigger.
- Xác nhận học sinh đã từng luyện tập/thi môn đó ít nhất 1 lần trước khi đề mới được bật.
- Không có cách gửi lại thủ công — nếu cần, admin tắt rồi bật lại `isActive` để trigger chạy lại (sẽ gửi lại cho TẤT CẢ user đủ điều kiện, không chỉ user mới).

---

## Lỗi liên quan đến Quản lý câu hỏi — Submissions + Report Redesign (Feature 014)

### 15. Duyệt/từ chối/sửa/xoá câu hỏi gửi báo lỗi 409 SUBMISSION_NOT_PENDING

**Triệu chứng**: Admin bấm "Duyệt" hoặc "Từ chối" (hoặc học sinh bấm "Sửa"/"Xoá") trên 1 câu hỏi gửi, nhận lỗi 409 dù nhìn trên màn hình vẫn thấy trạng thái "Chờ duyệt".

**Nguyên nhân**: Đây là kết quả của cơ chế chống race condition có chủ đích (claim pattern bằng `updateMany`/`deleteMany` điều kiện `status=PENDING`, xem `docs/FEATURE_LOG.md` Section 14 mục "Ghi chú kỹ thuật") — không phải bug. Xảy ra khi: 2 admin cùng xử lý 1 submission gần như đồng thời (người thao tác sau nhận 409), hoặc học sinh vừa sửa/xoá đúng lúc admin đang duyệt, hoặc dữ liệu trên màn hình admin đã cũ (chưa refresh sau khi người khác xử lý).

**Giải pháp**:
- Làm mới (F5 hoặc bấm lại filter) danh sách để lấy trạng thái mới nhất trước khi thao tác lại.
- Nếu lỗi lặp lại liên tục với cùng 1 submission dù đã refresh: kiểm tra trực tiếp trong DB `SELECT status FROM student_question_submissions WHERE id = '<id>';` — trạng thái thực tế mới là nguồn đúng, không phải giao diện.

### 16. Học sinh báo "đã được duyệt" nhưng không thấy cộng 30 điểm

**Triệu chứng**: Submission đã chuyển sang trạng thái ✅ Đã duyệt, nhưng điểm tích luỹ của học sinh không tăng.

**Nguyên nhân**: Bước cộng điểm + gửi thông báo chạy **fire-and-forget** (`fireApprovedRewards`, không `await`, không block response duyệt) — nếu bước này lỗi (hiếm, ví dụ DB tạm thời không kết nối được), việc duyệt (tạo bản ghi Ngân hàng câu hỏi) vẫn thành công nhưng điểm sẽ **không** được cộng.

**Giải pháp**:
- Kiểm tra log backend tìm dòng `[SubmissionService] fireApprovedRewards addPoints error`.
- Nếu có, cộng điểm thủ công 30đ cho học sinh (qua `pointsService.addPoints` hoặc script debug), lý do `SUBMISSION_APPROVED`.
- Áp dụng tương tự cho điểm "usage" (+5đ/lần dùng trong đề thi) — tìm log `[QuestionBankService] fireUsagePointsTrigger addPoints error`.

### 17. Gọi `PATCH /api/admin/questions/reports/:id` (không có `/resolve`) trả về 404

**Triệu chứng**: Script/Postman collection cũ gọi `PATCH /api/admin/questions/reports/:id` để đổi trạng thái báo cáo, nhận lỗi 404 "Not Found" (không phải lỗi nghiệp vụ `QUESTION_REPORT_NOT_FOUND`).

**Nguyên nhân**: Đây là **breaking change có chủ đích** của Feature 014 — endpoint cũ đã bị xoá hoàn toàn khỏi router, thay bằng `PATCH /api/admin/questions/reports/:id/resolve` (thêm `/resolve`, chỉ nhận `status: FIXED|DISMISSED`, không còn `REVIEWED`).

**Giải pháp**:
- Cập nhật mọi script/Postman collection/tài liệu nội bộ sang endpoint mới, xem `docs/api/openapi.yaml` hoặc mục 4.3 trong `admin-guide.md`.
- Nếu cần xử lý hàng loạt bằng script, nhớ đổi luôn field response: `autoHidden` (cũ) → `reactivated` + `batchResolvedCount` (mới).

### 18. Bấm "Bỏ qua" (DISMISSED) nhưng câu hỏi vẫn bị ẩn — tưởng là bug

**Triệu chứng**: Câu hỏi đang bị auto-hide (do ≥5 báo cáo PENDING), admin xử lý báo cáo bằng "Bỏ qua", nhưng câu hỏi vẫn không hiện lại cho học sinh.

**Nguyên nhân**: **Đây là hành vi đúng theo thiết kế**, không phải bug — chỉ `status=FIXED` mới kích hoạt tự động `isActive=true`. `DISMISSED` nghĩa là "báo cáo này không hợp lệ", không phải "đã xác nhận câu hỏi ổn" — hệ thống cố tình không tự hiện lại câu hỏi trong trường hợp này để tránh admin vô tình bỏ qua 1 báo cáo hợp lệ rồi câu hỏi lỗi lại hiện ra cho học sinh khác.

**Giải pháp**:
- Nếu sau khi xem xét, câu hỏi thực sự không có vấn đề gì (báo cáo sai), admin cần chủ động sửa `isActive=true` qua tab "Ngân hàng câu hỏi" (mục 8, `admin-guide.md`) hoặc dùng nút "✏️ Sửa & Đánh dấu đã sửa" (`status=FIXED`) thay vì "Bỏ qua" nếu muốn câu hỏi tự động hiện lại.

### 19. Dashboard admin hiện số "chờ xử lý" trên tab "Câu hỏi" sai/không khớp

**Triệu chứng**: Badge đỏ trên tab "Câu hỏi" hiện số không khớp với tổng số báo cáo PENDING + submission PENDING thực tế.

**Nguyên nhân phổ biến nhất**: Badge (`questionsPendingBadge`) chỉ refetch khi đổi `tab` hoặc `secret` thay đổi (`useEffect` phụ thuộc `[secret, tab]`) — nếu admin xử lý xong 1 báo cáo/submission mà KHÔNG chuyển tab ra rồi vào lại, badge không tự cập nhật ngay (không có polling như bell icon phía học sinh, Feature 013).

**Giải pháp**: Chuyển sang tab khác rồi quay lại tab "Câu hỏi" để buộc tính lại badge, hoặc F5 trang. Đây là giới hạn đã biết (badge admin không polling theo thời gian thực), không phải lỗi tính toán sai.

---

## Lỗi liên quan đến Khung Free/Premium (Feature 015)

### 20. Đổi trạng thái Free/Premium (cấp thủ công hoặc đổi công tắc) nhưng user vẫn thấy trạng thái cũ

**Triệu chứng**: Admin vừa cấp Premium (hoặc bật/tắt công tắc toàn cục), nhưng app của user vẫn hiển thị Free (hoặc ngược lại).

**Nguyên nhân**: `premiumService` có cache in-memory cho công tắc toàn cục — cache này được invalidate NGAY khi ghi, nên backend luôn trả đúng dữ liệu mới cho request tiếp theo. Vấn đề thường nằm ở phía client: frontend chỉ đọc lại `profile.isPremium` khi gọi `GET /api/users/me` — nếu user không tải lại trang/đăng nhập lại, họ vẫn thấy `profile` cũ đã lấy từ trước đó (state React không tự refetch).

**Giải pháp**:
- Yêu cầu user F5 trang hoặc đăng xuất/đăng nhập lại để lấy `profile` mới nhất.
- Nếu vẫn sai sau khi F5: kiểm tra trực tiếp DB `SELECT "premiumExpiresAt" FROM users WHERE id='<userId>';` và `SELECT "defaultPremiumForAll" FROM app_settings;` để xác nhận dữ liệu backend đã đúng chưa — nếu backend đã đúng mà FE vẫn sai, đây mới là bug thực sự cần điều tra thêm (không phải hành vi mong đợi).

### 21. Cấp Premium báo lỗi 409 PREMIUM_GRANT_CONFLICT

**Triệu chứng**: Admin bấm "🎁 Cấp" Premium cho 1 user, nhận lỗi 409 thay vì thành công.

**Nguyên nhân**: Đây là kết quả của cơ chế Compare-And-Swap (CAS) chống race condition có chủ đích (xem `docs/FEATURE_LOG.md` Section 15) — xảy ra khi có RẤT NHIỀU request cấp Premium cho CÙNG 1 user gần như đồng thời (ví dụ double-click liên tục, hoặc 2 admin cùng thao tác), vượt quá `MAX_GRANT_CAS_RETRY` (5) lần thử lại liên tiếp. Cực kỳ hiếm trong sử dụng bình thường.

**Giải pháp**: Thử lại thao tác cấp Premium — do bản chất transient (tạm thời) của lỗi này, lần thử lại thường thành công ngay vì tần suất request đồng thời đã giảm.

### 22. Free đã "xem quảng cáo" xong nhưng vẫn bị chặn đổi môn (403 SUBJECTS_CHANGE_LOCKED)

**Triệu chứng**: User Free xem xong đếm ngược 5 giây, nhưng khi bấm lưu môn học vẫn nhận lỗi 403 `SUBJECTS_CHANGE_LOCKED`.

**Nguyên nhân phổ biến nhất**: Token mở khoá (Redis, TTL 300 giây, single-use) đã hết hạn giữa lúc "xem quảng cáo" xong và lúc user thực sự bấm lưu ở màn chọn môn (ví dụ user để màn hình mở quá lâu trước khi bấm lưu). Nguyên nhân khác: user đã dùng token đó cho 1 lần đổi môn khác trước đó (single-use, không tái sử dụng được).

**Giải pháp**:
- Yêu cầu user quay lại bấm "Đổi môn" → xem lại quảng cáo → lưu môn NGAY sau khi đếm ngược xong.
- Kiểm tra còn hạn hay không (không xoá key khi kiểm tra bằng `TTL`):
  ```bash
  redis-cli TTL "premium:ad-unlock:<userId>"
  # -2 = không tồn tại (hết hạn/chưa xem), >0 = còn N giây
  ```
- Đây KHÔNG phải bug nếu token thực sự đã hết hạn — đúng theo thiết kế (single-use, TTL ngắn để tránh lạm dụng).

### 23. Streak bị đứt dù Premium còn thẻ bảo hiểm chuỗi

**Triệu chứng**: User Premium báo mất streak dù họ nghĩ mình còn thẻ bảo hiểm chuỗi (`streakFreeze.remaining > 0`).

**Nguyên nhân phổ biến nhất**: Thẻ bảo hiểm chuỗi CHỈ "bắc cầu" khoảng trống **ĐÚNG 1 ngày** — nếu user lỡ **2 ngày liên tiếp trở lên** không ôn tập, streak LUÔN đứt dù còn bao nhiêu thẻ (xem thuật toán `computeStreaksWithFreeze` trong `docs/FEATURE_LOG.md` Section 15). Nguyên nhân khác: khoảng trống xảy ra TRƯỚC mốc `premiumSinceEffective` (ví dụ user vừa mới được cấp Premium, nhưng khoảng trống đó nằm trong giai đoạn họ còn là Free) — không được tính bắc cầu.

**Giải pháp**:
- Xác nhận số ngày thực sự bị lỡ (không phải 1 ngày) bằng cách xem lịch sử phiên ôn tập:
  ```sql
  SELECT "completedAt" FROM practice_sessions
  WHERE "userId" = '<userId>' AND "completedAt" IS NOT NULL
  ORDER BY "completedAt" DESC LIMIT 30;
  ```
- Xác nhận thời điểm `premiumSince` của user để so sánh với thời điểm xảy ra khoảng trống:
  ```sql
  SELECT "premiumSince", "premiumExpiresAt" FROM users WHERE id = '<userId>';
  ```
- Nếu khoảng trống đúng 1 ngày VÀ xảy ra sau `premiumSince` VÀ user thực sự có `streakFreeze.remaining > 0` tại thời điểm đó mà vẫn bị đứt — đây mới là bug cần báo cáo, không phải hành vi mong đợi.

### 24. Cron cảnh báo Premium sắp hết hạn không gửi thông báo

**Triệu chứng**: User có Premium hết hạn trong 24h nhưng không nhận được thông báo "⏰ Premium sắp hết hạn".

**Nguyên nhân phổ biến nhất**: Cron chỉ chạy 1 lần/ngày lúc 3:05 AM — nếu hạn Premium rơi vào "cửa sổ 24h" SAU thời điểm cron chạy hôm đó, user sẽ nhận cảnh báo vào lần chạy cron TIẾP THEO (hôm sau), có thể chỉ còn vài giờ trước khi hết hạn thay vì đủ 24h. Nguyên nhân khác: `premiumExpiryWarnedAt` đã được set từ lần cảnh báo trước đó cho ĐÚNG hạn này (nếu user không được gia hạn thêm, trường này không tự reset).

**Giải pháp**:
- Kiểm tra `premiumExpiryWarnedAt` hiện tại của user — nếu đã có giá trị VÀ `premiumExpiresAt` không đổi từ lần cảnh báo trước, đây là hành vi đúng (không gửi trùng lặp cho cùng 1 hạn).
- Nếu cần gửi cảnh báo thủ công ngay: gọi trực tiếp `premiumService.notifyExpiringPremiumUsers()` qua script debug, hoặc set `premiumExpiryWarnedAt = NULL` cho user đó rồi đợi lần chạy cron kế tiếp.
- Xem log backend tìm dòng `[Scheduler] Da canh bao N user Premium sap het han.` để xác nhận cron có chạy đúng giờ không.

## Lỗi liên quan đến Thi đấu đối kháng — PvP Quiz Battle (Feature 016)

### 25. Bấm "Tìm trận" không có phản ứng gì / nút mãi bị disable

**Triệu chứng**: User bấm "Tìm trận 🔍" hoặc "Tạo phòng mời bạn 👥" nhưng không thấy chuyển sang màn hình chờ ghép trận, nút vẫn hiện spinner mãi hoặc bị mờ (disabled).

**Nguyên nhân phổ biến nhất**: Socket.io chưa kết nối xong (`socketReady=false`) — cả 2 nút này bị disable cho tới khi `socket.on('connect')` bắn ra. Thường do: (1) mạng chậm/chặn WebSocket (một số mạng công ty/trường học chặn cổng WebSocket, khiến client phải fallback về `polling` — chậm hơn đáng kể); (2) session token đã hết hạn, middleware xác thực socket từ chối kết nối (`connect_error`) nhưng FE không hiển thị rõ ràng lỗi này ở màn hình setup.

**Giải pháp**:
- Yêu cầu user F5 lại trang — nếu session token hết hạn, việc F5 sẽ kích hoạt luồng đăng nhập lại bình thường.
- Kiểm tra console trình duyệt tìm log `connect_error` — nếu thấy `INVALID_SESSION_TOKEN`/`SESSION_USER_NOT_FOUND`, xác nhận đây đúng là vấn đề phiên đăng nhập.
- Nếu mạng chặn WebSocket, ứng dụng vẫn hoạt động được qua `polling` (cấu hình fallback tự động trong `battleSocket.ts`) nhưng có độ trễ cao hơn — không phải lỗi, chỉ là trải nghiệm chậm hơn trên mạng đó.

### 26. User báo "Không đủ điểm để cược" dù số dư hiển thị đủ

**Triệu chứng**: Màn hình vào trận hiển thị số dư điểm đủ cho mức cược đã chọn, nhưng khi bấm "Tìm trận" vẫn nhận lỗi `BATTLE_INSUFFICIENT_POINTS`.

**Nguyên nhân**: Số dư hiển thị ở màn hình setup được tải **1 lần** khi vào trang (`GET /api/battle/config`) — nếu user vừa tiêu điểm ở nơi khác (một tab/thiết bị khác, hoặc một trận Battle khác vừa kết thúc) SAU khi màn hình này đã tải xong, số hiển thị sẽ cũ. Server luôn validate lại số dư THẬT ngay lúc `battle:join-queue`/`battle:create-room` (không tin số hiển thị phía FE) — đây là hành vi đúng thiết kế (chặn đúng, chỉ là hiển thị cũ).

**Giải pháp**: Yêu cầu user F5 lại màn hình Thi đấu đối kháng để tải lại số dư mới nhất trước khi thử lại.

### 27. Đối thủ "biến mất" giữa trận nhưng không thấy banner mất kết nối

**Triệu chứng**: 1 người chơi thoát app/mất mạng giữa trận, nhưng người còn lại không thấy banner "⚠️ Đối thủ mất kết nối..." xuất hiện.

**Nguyên nhân phổ biến nhất**: Sự kiện `disconnect` của Socket.io có thể mất vài giây để server phát hiện (phụ thuộc heartbeat/ping timeout mặc định của Socket.io, không phải tức thời 100%) — nếu người còn lại kiểm tra ngay trong vài giây đầu, banner có thể chưa kịp hiện. Nguyên nhân khác (hiếm hơn): nếu người mất kết nối đóng app rồi MỞ LẠI rất nhanh (trong vài giây) trước khi server kịp xử lý `disconnect`, có thể server coi như chưa từng mất kết nối (reconnect quá nhanh).

**Giải pháp**: Đây phần lớn là hành vi bình thường của độ trễ mạng, không phải bug. Chỉ cần điều tra thêm nếu banner **không bao giờ** xuất hiện dù đã chờ hơn 10-15 giây, kết hợp kiểm tra log backend tìm dòng `[battle.socket] User ... ngat ket noi` để xác nhận server có nhận được sự kiện `disconnect` hay không.

### 28. Trận đấu "biến mất" hoàn toàn sau khi backend restart/deploy

**Triệu chứng**: User đang thi đấu giữa chừng thì bị văng ra, vào lại không thấy trận đâu (không phải màn kết quả, không phải màn chờ — quay thẳng về màn setup).

**Nguyên nhân**: Toàn bộ trạng thái "đang chơi" (câu hỏi, điểm tạm thời, hàng đợi, phòng riêng) sống **in-memory** trên process backend — restart/deploy backend giữa lúc có trận đang diễn ra sẽ xoá sạch trạng thái đó (xem `docs/FEATURE_LOG.md` Section 16 mục "Lưu ý / rủi ro"). Đây là giới hạn đã biết của Đợt 1/MVP, không phải bug.

⚠️ **Phân biệt quan trọng (thay đổi phạm vi muộn — mục kỹ thuật #9)**: từ khi có `GET /api/battle/active`, chỉ **backend THỰC SỰ restart/crash** mới gây ra triệu chứng này. Nếu user chỉ đơn thuần F5/tắt mở lại tab/đăng nhập lại (backend vẫn sống bình thường) mà VẪN quay thẳng về màn setup thay vì tự động vào lại trận — đây KHÔNG còn là hành vi mong đợi nữa, cần điều tra như 1 bug thật (kiểm tra `GET /api/battle/active` có trả đúng `active:true` không, xem console lỗi phía FE).

**Giải pháp**:
- Không có cách khôi phục trận đang dở NẾU backend đã thực sự restart — user cần bắt đầu trận mới.
- Điểm đã cược từ đầu trận **an toàn** (`PVP_LOCK_BET` đã ghi DB) nhưng cũng KHÔNG tự động hoàn — cần tra `point_transactions` (xem mục 16.3 trong `admin-guide.md`) để xác nhận có dòng `PVP_LOCK_BET` không kèm dòng thanh toán tương ứng, rồi hoàn thủ công nếu cần (liên hệ kỹ thuật).
- Nên tránh deploy/restart backend vào khung giờ nhiều user đang thi đấu nếu có thể chọn thời điểm.

### 29. Vào phòng bằng mã báo "Không tìm thấy phòng" dù bạn vừa gửi mã đúng

**Triệu chứng**: User B nhập đúng mã 6 ký tự do user A gửi, nhưng nhận lỗi `BATTLE_ROOM_NOT_FOUND`.

**Nguyên nhân phổ biến nhất** (theo thứ tự khả năng):
1. User A đã bấm "Huỷ tìm trận" sau khi tạo phòng — phòng đã bị xoá khỏi server ngay lúc đó (hành vi đúng thiết kế, xem `docs/FEATURE_LOG.md` Section 16 mục kỹ thuật #5).
2. User A đã mất kết nối (đóng tab/tắt app) trước khi B kịp vào — phòng của người tạo đã ngắt kết nối được coi là không còn hợp lệ.
3. Mã phòng đã được dùng bởi người khác trước đó (chỉ dùng được 1 lần, xoá ngay sau khi có người vào thành công).
4. User B gõ nhầm ký tự dễ nhầm lẫn — mã phòng **không dùng** các ký tự `0`, `O`, `1`, `I`, `L` (đã loại bỏ có chủ đích để tránh nhầm lẫn), nếu B tự gõ tay thay vì copy-paste có thể nhầm ký tự khác sang các ký tự này.

**Giải pháp**: Yêu cầu A tạo lại phòng mới (mã mới) và gửi lại ngay cho B, đảm bảo B vào trong lúc A vẫn còn mở màn hình chờ (chưa bấm Huỷ, chưa thoát app).

### 30. Báo lỗi "Bạn đang có 1 trận đấu khác chưa kết thúc" (`BATTLE_ALREADY_IN_MATCH`) dù không nghĩ mình đang chơi gì

**Triệu chứng**: User bấm "Tìm trận"/"Tạo phòng"/"Vào phòng bằng mã" nhưng nhận `battle:error` mã `BATTLE_ALREADY_IN_MATCH`, dù họ khẳng định không đang thi đấu trận nào.

**Nguyên nhân phổ biến nhất** (thay đổi phạm vi muộn — mục kỹ thuật #8, fix lỗ hổng bảo mật): hệ thống chặn 1 tài khoản tham gia 2 trận cùng lúc (`hasActiveMatch(userId)`), kể cả khi 2 kết nối đến từ 2 tab/thiết bị khác nhau của cùng 1 user. Trường hợp hay gặp: user mở app ở điện thoại VÀ máy tính cùng lúc, hoặc mở nhiều tab trình duyệt mà không để ý tab cũ vẫn còn 1 trận dang dở (có thể đã bị mất kết nối nhưng chưa hết 30 giây chờ nên trận vẫn tính là "sống").

**Giải pháp**:
- Kiểm tra `GET /api/battle/active` (xem mục 16.2 trong `admin-guide.md`) với session token của user — nếu `active:true`, xác nhận đúng họ đang có 1 trận sống ở nơi khác, hướng dẫn họ mở lại đúng thiết bị/tab đó để hoàn tất hoặc chờ hết 30 giây mất kết nối để trận tự xử lý xong.
- Nếu `active:false` mà vẫn báo lỗi này — đây là bug thật cần báo cáo kỹ thuật (không phải hành vi mong đợi).

### 31. Đối thủ trong "Lịch sử" hiện tên lạ, không nhớ đã đấu với ai — nghi ngờ dữ liệu sai

**Triệu chứng**: User xem lại "Lịch sử" thấy tên đối thủ không quen thuộc (không phải bạn bè, không nhớ từng gặp), nghi ngờ hệ thống ghép sai hoặc hiện sai tên.

**Nguyên nhân** (thay đổi phạm vi muộn — mục kỹ thuật #9): rất có thể đây là 1 trận đấu với **bot** (máy) — giao diện cố tình hiện tên giả kiểu người thật cho các trận này (không còn "Máy"/🤖), nên user không có cách nào tự phân biệt được qua giao diện. Đây là hành vi đúng thiết kế, không phải lỗi dữ liệu.

**Giải pháp**: Không cần xử lý gì phía user (không có gì sai). Nếu cần XÁC NHẬN nội bộ đây đúng là trận với bot, tra trực tiếp cột `isBotMatch` trong bảng `battle_matches` cho `matchId` tương ứng (xem mục 16.2 trong `admin-guide.md`) — `isBotMatch=true` nghĩa là chắc chắn bot, bất kể tên hiển thị là gì.
